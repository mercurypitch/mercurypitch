import {
  createSignal,
  onCleanup,
  onMount,
  type Accessor,
  type Setter,
} from 'solid-js'
import type { AudioEngine } from '@/lib/audio-engine'
import type { PlaybackRuntime } from '@/lib/playback-runtime'
import type { PracticeEngine } from '@/lib/practice-engine'
import { appStore } from '@/stores'
import type { PitchSample } from '@/types'
import type {
  NoteResult,
  PitchResult,
  PracticeResult,
} from '@/types'
import type { RecordingController } from '@/features/recording/useRecordingController'

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
  const [currentPitch, setCurrentPitch] =
    createSignal<PitchResult | null>(null)
  const [noteResults, setNoteResults] = createSignal<NoteResult[]>([])
  const [practiceResult, setPracticeResult] =
    createSignal<PracticeResult | null>(null)
  const [liveScore, setLiveScore] = createSignal<number | null>(null)
  const [frequencyData, setFrequencyData] =
    createSignal<Float32Array | null>(null)
  const [waveformData, setWaveformData] = createSignal<Float32Array | null>(
    null,
  )
  const [targetPitch, setTargetPitch] = createSignal<number | null>(null)
  const [countInBeat, setCountInBeat] = createSignal(0)
  const [isCountingIn, setIsCountingIn] = createSignal(false)

  // Wire practice engine callbacks
  practiceEngine.setCallbacks({
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
      appStore.setMicActive(active)
      if (error !== undefined && error !== '') {
        appStore.setMicError(error)
        appStore.showNotification(error, 'error')
      }
    },
  })

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

      if (pitch && pitch.frequency > 0 && pitch.clarity >= 0.2) {
        setPitchHistory((prev) => {
          const next = [
            ...prev,
            {
              freq: pitch.frequency,
              time: beat,
              cents: pitch.cents,
            },
          ]
          return next.length > 800 ? next.slice(-800) : next
        })
      }

      // Recording integration
      recording.processPitchFrame(pitch, beat, editorIsPlaying())

      // Capture waveform data when mic is active
      if (practiceEngine.isMicActive()) {
        setWaveformData(practiceEngine.getWaveformData())
      }

      animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
  })

  onCleanup(() => {
    cancelAnimationFrame(animId)
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
  }
}
