// ============================================================
// usePracticeController — mic capture and scoring for the Singing tab
// ============================================================
//
// Owns one mic lease for the duration of the practice run. It calls
// `registerMicIndicator` on start and must release unconditionally on
// unmount -- the device itself is owned by @/lib/mic-manager.ts, and skipping
// the release leaks the mic into whatever page the user visits next.

import type { Accessor, Setter } from 'solid-js'
import { createSignal, onCleanup, onMount } from 'solid-js'
import type { RecordingController } from '@/features/recording/useRecordingController'
import type { AudioEngine } from '@/lib/audio-engine'
import { registerMicIndicator } from '@/lib/mic-sentinel'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { micActive, setMicActive, setMicError, showNotification, } from '@/stores'
import type { PitchSample } from '@/types'
import type { NoteResult, PitchResult, PracticeResult } from '@/types'

export interface PracticeFrame {
  /** Monotonic timestamp for this detection frame. */
  atMs: number
  /** Current transport position when the frame was detected. */
  beat: number
  /** The one result returned by PracticeEngine.update() for this frame. */
  pitch: PitchResult | null
  /** Snapshot of the shared microphone state for this frame. */
  micActive: boolean
}

export type PracticeFrameListener = (frame: PracticeFrame) => void

export interface PracticeController {
  pitchHistory: Accessor<PitchSample[]>
  setPitchHistory: Setter<PitchSample[]>
  currentPitch: Accessor<PitchResult | null>
  noteResults: Accessor<NoteResult[]>
  setNoteResults: Setter<NoteResult[]>
  practiceResult: Accessor<PracticeResult | null>
  setPracticeResult: Setter<PracticeResult | null>
  liveScore: Accessor<number | null>
  setLiveScore: Setter<number | null>
  frequencyData: Accessor<Float32Array | null>
  waveformData: Accessor<Float32Array | null>
  targetPitch: Accessor<number | null>
  setTargetPitch: Setter<number | null>
  countInBeat: Accessor<number>
  isCountingIn: Accessor<boolean>
  /**
   * Subscribe to the canonical app-level pitch frame stream.
   * Consumers must not call PracticeEngine.update() themselves.
   */
  subscribeFrames: (listener: PracticeFrameListener) => () => void
}

interface Deps {
  audioEngine: AudioEngine
  playbackRuntime: PlaybackRuntime
  practiceEngine: PracticeEngine
  recording: RecordingController
  isPlaying: Accessor<boolean>
  isPaused: Accessor<boolean>
  editorIsPlaying: Accessor<boolean>
  activeTab: Accessor<string>
}

export function usePracticeController(deps: Deps): PracticeController {
  const {
    audioEngine,
    playbackRuntime,
    practiceEngine,
    recording,
    editorIsPlaying,
  } = deps

  const [pitchHistory, setPitchHistory] = createSignal<PitchSample[]>([])
  const [currentPitch, setCurrentPitch] = createSignal<PitchResult | null>(null)
  const [noteResults, setNoteResults] = createSignal<NoteResult[]>([])
  const [practiceResult, setPracticeResult] =
    createSignal<PracticeResult | null>(null)
  const [liveScore, setLiveScore] = createSignal<number | null>(null)
  const [frequencyData, setFrequencyData] = createSignal<Float32Array | null>(
    null,
  )
  const [waveformData, setWaveformData] = createSignal<Float32Array | null>(
    null,
  )
  const [targetPitch, setTargetPitch] = createSignal<number | null>(null)
  const [countInBeat, setCountInBeat] = createSignal(0)
  const [isCountingIn, setIsCountingIn] = createSignal(false)
  const frameListeners = new Set<PracticeFrameListener>()

  const subscribeFrames = (listener: PracticeFrameListener): (() => void) => {
    frameListeners.add(listener)
    return () => {
      frameListeners.delete(listener)
    }
  }

  // Wire practice engine callbacks. This controller lives for the whole app
  // session and is the one place the shared mic-state signal gets updated,
  // so the subscription is never removed.
  practiceEngine.addCallbacks({
    onPitchDetected: (pitch) => {
      setCurrentPitch(pitch)
      if (pitch && pitch.frequency > 0 && pitch.clarity >= 0.2) {
        setFrequencyData(audioEngine.getFrequencyData())
      }
    },
    onNoteComplete: (result) => {
      setNoteResults((prev) => [...prev, result])
      const allResults = [...noteResults(), result]
      setLiveScore(practiceEngine.calculateScore(allResults))
    },
    onMicStateChange: (active, error) => {
      setMicActive(active)
      if (error !== undefined && error !== '') {
        setMicError(error)
        showNotification(error, 'error')
      } else {
        setMicError(null)
      }
    },
  })

  // Mic sentinel: the global singing/compose icon reads micActive — register
  // it so a confirmed "icon on with no live track" mismatch is reported and
  // healed through the engine's own stop path (which emits, so the signal
  // and the pipeline settle together). App-lifetime, like the callbacks.
  registerMicIndicator(
    'practice',
    () => micActive(),
    () => practiceEngine.stopMic(),
  )

  // Count-in tracking
  playbackRuntime.on('countIn', (e: { countIn?: number }) => {
    setCountInBeat(e?.countIn ?? 0)
    setIsCountingIn(true)
  })
  playbackRuntime.on('countInComplete', () => {
    setIsCountingIn(false)
    setCountInBeat(0)
  })

  // Animation loop
  let animId = 0
  onMount(() => {
    const loop = () => {
      const pitch = practiceEngine.update()
      const beat = playbackRuntime.getCurrentBeat()
      const micIsActive = practiceEngine.isMicActive()
      const frame: PracticeFrame = {
        atMs: performance.now(),
        beat,
        pitch,
        micActive: micIsActive,
      }

      // PracticeEngine.update() has exactly one app-level owner. Downstream
      // features observe that result through this stream instead of starting
      // competing detector loops. One faulty observer must not interrupt the
      // remaining listeners or the animation loop.
      for (const listener of [...frameListeners]) {
        try {
          listener(frame)
        } catch (error) {
          console.error(
            '[usePracticeController] pitch-frame listener failed:',
            error,
          )
        }
      }

      // Collect the trace only while the transport runs. Without the gate,
      // singing with the mic on after stop/pause kept appending samples at
      // the frozen/reset beat — a second glowing "live" dot parked at that
      // x (next to the left live marker, or mid-canvas when paused) that
      // still tracked pitch, plus a stray connector line into the
      // preserved run trace.
      const transportActive = deps.isPlaying() || editorIsPlaying()
      if (
        transportActive &&
        pitch &&
        pitch.frequency > 0 &&
        pitch.clarity >= 0.2
      ) {
        setPitchHistory((prev) => {
          const next = [
            ...prev,
            {
              freq: pitch.frequency,
              time: beat,
              cents: pitch.cents,
            },
          ]
          return next.length > 2000 ? next.slice(-2000) : next
        })
      } else if (transportActive) {
        // Unvoiced frame mid-run: close the current line segment with ONE
        // gap marker so silence renders as a gap — previously the last
        // sung note was connected straight across to the next detection
        // (often a breath/rumble artifact), a violent vertical spike.
        setPitchHistory((prev) => {
          const last = prev[prev.length - 1]
          if (last === undefined || last.freq === null) return prev
          return [...prev, { freq: null, time: beat }]
        })
      }

      // Recording integration
      recording.processPitchFrame(pitch, beat, editorIsPlaying())

      // Capture waveform data when mic is active
      if (micIsActive) {
        setWaveformData(practiceEngine.getWaveformData())
      }

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
  })

  onCleanup(() => {
    cancelAnimationFrame(animId)
    frameListeners.clear()
  })

  return {
    pitchHistory,
    setPitchHistory,
    currentPitch,
    noteResults,
    setNoteResults,
    practiceResult,
    setPracticeResult,
    liveScore,
    setLiveScore,
    frequencyData,
    waveformData,
    targetPitch,
    setTargetPitch,
    countInBeat,
    isCountingIn,
    subscribeFrames,
  }
}
