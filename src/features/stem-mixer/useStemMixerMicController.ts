// ============================================================
// StemMixer Mic Controller — mic capture, pitch detection, scoring
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js'
import { rmsOfAnalyser } from '@/features/mic-feedback/mic-level'
import { micManager } from '@/lib/mic-manager'
import type { ComparisonPoint, MicScore } from '@/lib/mic-scoring'
import { computeScore as computeFrameScore } from '@/lib/mic-scoring'
import { createPitchCompareEngine } from '@/lib/pitch-compare-engine'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import { createPersistedSignal } from '@/lib/storage'
import { sliderToGain } from '@/lib/volume-curve'
import { pitchAlgorithm, pitchBufferSize, settings, } from '@/stores/settings-store'

// ── Types ──────────────────────────────────────────────────────

interface PitchNote {
  time: number
  noteName: string
  frequency: number
  octave: number
}

export const PITCH_FFT_SIZE = 1024 // synced with PITCH_DETECT_CONFIG.bufferSize

export interface StemMixerMicDeps {
  getAudioCtx: () => AudioContext | null | undefined
  ensureAudioCtx: () => AudioContext
}

export interface StemMixerMicController {
  // Signals
  micEnabled: Accessor<boolean>
  micActive: Accessor<boolean>
  micPitch: Accessor<DetectedPitch | null>
  setMicPitch: Setter<DetectedPitch | null>
  /** Live input level 0–1 (for the volume "fill" meter). */
  micLevel: Accessor<number>
  micError: Accessor<string>
  /** Mic monitoring — routes the mic to the speakers so the singer hears
   *  themselves over the backing track (true karaoke). Off by default to avoid
   *  speaker feedback; best with headphones. */
  micMonitorEnabled: Accessor<boolean>
  setMicMonitor: (enabled: boolean) => void
  micMonitorVolume: Accessor<number>
  setMicMonitorVolume: (volume: number) => void
  comparisonData: Accessor<ComparisonPoint[]>
  setComparisonData: Setter<ComparisonPoint[]>
  /** Comparison points of the current loop iteration only. */
  iterationComparisonData: Accessor<ComparisonPoint[]>
  toleranceCents: Accessor<number>
  score: Accessor<MicScore | null>
  setScore: Setter<MicScore | null>
  showScore: Accessor<boolean>
  setShowScore: Setter<boolean>

  // Mic ref accessors (for audio controller RAF tick)
  getMicAnalyserNode: () => AnalyserNode | null
  getMicPitchDetector: () => PitchDetector | null
  getMicPitchHistory: () => PitchNote[]
  resetMicPitchHistory: () => void

  // Scoring
  /** Feed one RAF frame into the compare engine (0 = unvoiced). */
  pushComparison: (timeSec: number, refFreq: number, micFreq: number) => void
  /** Start a new loop iteration for the live metrics bar. */
  markLoopIteration: () => void
  /** Drop accumulated comparison data (start of a fresh run). */
  clearComparisonData: () => void
  computeScore: () => MicScore
  resetScore: () => void

  // Mic toggle
  toggleMic: () => Promise<void>
}

// ── Controller ─────────────────────────────────────────────────

export const useStemMixerMicController = (
  deps: StemMixerMicDeps,
): StemMixerMicController => {
  const [micEnabled, setMicEnabled] = createSignal(false)
  const [micActive, setMicActive] = createSignal(false)
  const [micPitch, setMicPitch] = createSignal<DetectedPitch | null>(null)
  const [micLevel, setMicLevel] = createSignal(0)
  const [micError, setMicError] = createSignal('')
  const [comparisonData, setComparisonData] = createSignal<ComparisonPoint[]>(
    [],
  )
  const TOLERANCE_CENTS = 50
  const [toleranceCents] = createSignal(TOLERANCE_CENTS)
  const [score, setScore] = createSignal<MicScore | null>(null)
  const [showScore, setShowScore] = createSignal(false)

  // Octave-agnostic, transition-tolerant comparison core (see the engine's
  // header for the fairness rules). Signals mirror its counters so the
  // per-iteration slice below stays reactive.
  const compareEngine = createPitchCompareEngine({
    toleranceCents: TOLERANCE_CENTS,
  })
  const [pointsTotal, setPointsTotal] = createSignal(0)
  const [iterationStart, setIterationStart] = createSignal(0)

  const pushComparison = (
    timeSec: number,
    refFreq: number,
    micFreq: number,
  ): void => {
    const point = compareEngine.push(timeSec, refFreq, micFreq)
    if (point) {
      setComparisonData((prev) => [...prev.slice(-12000), point])
      setPointsTotal((n) => n + 1)
    }
  }

  const markLoopIteration = (): void => {
    setIterationStart(pointsTotal())
  }

  const clearComparisonData = (): void => {
    compareEngine.reset()
    setComparisonData([])
    setPointsTotal(0)
    setIterationStart(0)
  }

  // The stored array is capped, so slice by "points since the iteration
  // started" from the tail instead of by absolute index.
  const iterationComparisonData = createMemo<ComparisonPoint[]>(() => {
    const data = comparisonData()
    const count = Math.min(data.length, pointsTotal() - iterationStart())
    return count >= data.length ? data : data.slice(data.length - count)
  })

  // Mic monitoring — persisted so the choice survives reloads/song switches.
  const [micMonitorEnabled, setMicMonitorEnabled] = createPersistedSignal(
    'sm-mic-monitor-enabled',
    false,
  )
  const [micMonitorVolume, setMicMonitorVolumeSignal] = createPersistedSignal(
    'sm-mic-monitor-volume',
    0.8,
  )

  // Mic refs (not signals — no reactivity needed in RAF loop). The capture
  // stream itself is owned by the shared MicManager, not held here.
  let micGainNode: GainNode | null = null
  let micAnalyserNode: AnalyserNode | null = null
  let monitorGainNode: GainNode | null = null
  let micPitchDetector: PitchDetector | null = null
  let micPitchHistory: PitchNote[] = []

  // Apply the global pitch settings to the live mic detector so Karaoke matches
  // the Singing pipeline (algorithm, buffer size, sensitivity, thresholds) and
  // the sidebar "Mic & Sensitivity" controls take effect here too.
  const applyDetectorSettings = (): void => {
    const algo = pitchAlgorithm()
    const buf = pitchBufferSize()
    const s = settings()
    if (!micPitchDetector || !micAnalyserNode) return
    micAnalyserNode.fftSize = buf
    micPitchDetector.setAlgorithm(algo)
    micPitchDetector.setSensitivity(s.sensitivity)
    micPitchDetector.setMinConfidence(s.minConfidence)
    micPitchDetector.setMinAmplitude(s.minAmplitude)
  }
  // Re-apply whenever the global settings change while the mic is live.
  createEffect(applyDetectorSettings)

  // Drive the input-level "fill" meter from the mic analyser while active.
  createEffect(() => {
    if (!micActive()) {
      setMicLevel(0)
      return
    }
    let raf = 0
    const loop = (): void => {
      setMicLevel(Math.min(1, rmsOfAnalyser(micAnalyserNode) * 4))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    onCleanup(() => cancelAnimationFrame(raf))
  })

  /** Wire or unwire the monitor branch (micGain → monitorGain → destination)
   *  based on the enabled flag. Safe to call repeatedly. */
  const applyMonitorRouting = () => {
    const ctx = deps.getAudioCtx()
    if (!ctx || !micGainNode) return
    if (micMonitorEnabled()) {
      if (!monitorGainNode) {
        monitorGainNode = ctx.createGain()
        monitorGainNode.gain.value = sliderToGain(micMonitorVolume())
        micGainNode.connect(monitorGainNode)
        monitorGainNode.connect(ctx.destination)
      }
    } else if (monitorGainNode) {
      try {
        monitorGainNode.disconnect()
      } catch (_) {
        /* already disconnected */
      }
      monitorGainNode = null
    }
  }

  const setMicMonitor = (enabled: boolean) => {
    setMicMonitorEnabled(enabled)
    applyMonitorRouting()
  }

  const setMicMonitorVolume = (volume: number) => {
    const v = Math.max(0, Math.min(1, volume))
    setMicMonitorVolumeSignal(v)
    if (monitorGainNode) monitorGainNode.gain.value = sliderToGain(v)
  }

  const getMicAnalyserNode = () => micAnalyserNode
  const getMicPitchDetector = () => micPitchDetector
  const getMicPitchHistory = () => micPitchHistory
  const resetMicPitchHistory = () => {
    micPitchHistory = []
  }

  // ── Scoring ─────────────────────────────────────────────────
  const computeScore = (): MicScore => {
    const frameScore = computeFrameScore(comparisonData())
    const notes = compareEngine.noteStats()
    return {
      ...frameScore,
      notesTotal: notes.notesTotal,
      notesHit: notes.notesHit,
    }
  }

  const resetScore = () => {
    clearComparisonData()
    setScore(null)
    setShowScore(false)
  }

  // ── Mic Toggle ──────────────────────────────────────────────
  const toggleMic = async () => {
    if (micActive()) {
      // Disconnect our own nodes; the MicManager owns the device and stops the
      // tracks once no other feature holds them.
      micGainNode?.disconnect()
      micAnalyserNode?.disconnect()
      monitorGainNode?.disconnect()
      micGainNode = null
      micAnalyserNode = null
      monitorGainNode = null
      micPitchDetector = null
      micPitchHistory = []
      micManager.release('stem-mixer')
      setMicActive(false)
      setMicEnabled(false)
      setMicPitch(null)
      setMicError('')
    } else {
      try {
        const ctx = deps.getAudioCtx() ?? deps.ensureAudioCtx()
        const stream = await micManager.acquire('stem-mixer')
        const source = ctx.createMediaStreamSource(stream)
        micGainNode = ctx.createGain()
        micGainNode.gain.value = 1.0
        micAnalyserNode = ctx.createAnalyser()
        micAnalyserNode.fftSize = pitchBufferSize()
        micAnalyserNode.smoothingTimeConstant = 0.3
        source.connect(micGainNode)
        micGainNode.connect(micAnalyserNode)

        // Route mic to speakers if monitoring is enabled (hear yourself).
        applyMonitorRouting()

        micPitchDetector = new PitchDetector({
          sampleRate: ctx.sampleRate,
          bufferSize: pitchBufferSize(),
          algorithm: pitchAlgorithm(),
        })
        // Apply sensitivity/confidence/amplitude via the setters (which carry
        // the correct 1–10 → RMS scaling), matching the Singing pipeline.
        applyDetectorSettings()

        micPitchHistory = []
        clearComparisonData()
        setScore(null)
        setShowScore(false)
        setMicActive(true)
        setMicEnabled(true)
        setMicPitch(null)
        setMicError('')
      } catch (err: unknown) {
        // MicManager rejects with a classified { kind, message }.
        const msg =
          (err as { message?: string } | null | undefined)?.message ??
          'Microphone unavailable'
        setMicError(msg)
        setMicEnabled(false)
      }
    }
  }

  // Release the shared mic device if this panel unmounts while the mic is on
  // (e.g. navigating away from Karaoke). Without this the 'stem-mixer' hold
  // would leak, keeping the device open and leaving global mic state stale.
  onCleanup(() => {
    if (!micActive()) return
    micGainNode?.disconnect()
    micAnalyserNode?.disconnect()
    monitorGainNode?.disconnect()
    micManager.release('stem-mixer')
  })

  return {
    micEnabled,
    micActive,
    micPitch,
    setMicPitch,
    micLevel,
    micError,
    micMonitorEnabled,
    setMicMonitor,
    micMonitorVolume,
    setMicMonitorVolume,
    comparisonData,
    setComparisonData,
    iterationComparisonData,
    toleranceCents,
    score,
    setScore,
    showScore,
    setShowScore,
    getMicAnalyserNode,
    getMicPitchDetector,
    getMicPitchHistory,
    resetMicPitchHistory,
    pushComparison,
    markLoopIteration,
    clearComparisonData,
    computeScore,
    resetScore,
    toggleMic,
  }
}
