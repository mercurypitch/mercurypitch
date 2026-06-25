// ============================================================
// StemMixer Mic Controller — mic capture, pitch detection, scoring
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { createSignal, onCleanup } from 'solid-js'
import { micManager } from '@/lib/mic-manager'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import { createPersistedSignal } from '@/lib/storage'

// ── Types ──────────────────────────────────────────────────────

interface ComparisonPoint {
  time: number
  vocalNote: string
  micNote: string
  centsOff: number // positive = mic is sharp
  inTolerance: boolean
}

interface MicScore {
  totalNotes: number
  matchedNotes: number
  accuracyPct: number
  avgCentsOff: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D'
}

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
  const [micError, setMicError] = createSignal('')
  const [comparisonData, setComparisonData] = createSignal<ComparisonPoint[]>(
    [],
  )
  const [toleranceCents] = createSignal(50)
  const [score, setScore] = createSignal<MicScore | null>(null)
  const [showScore, setShowScore] = createSignal(false)

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

  /** Wire or unwire the monitor branch (micGain → monitorGain → destination)
   *  based on the enabled flag. Safe to call repeatedly. */
  const applyMonitorRouting = () => {
    const ctx = deps.getAudioCtx()
    if (!ctx || !micGainNode) return
    if (micMonitorEnabled()) {
      if (!monitorGainNode) {
        monitorGainNode = ctx.createGain()
        monitorGainNode.gain.value = micMonitorVolume()
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
    if (monitorGainNode) monitorGainNode.gain.value = v
  }

  const getMicAnalyserNode = () => micAnalyserNode
  const getMicPitchDetector = () => micPitchDetector
  const getMicPitchHistory = () => micPitchHistory
  const resetMicPitchHistory = () => {
    micPitchHistory = []
  }

  // ── Scoring ─────────────────────────────────────────────────
  const computeScore = (): MicScore => {
    const data = comparisonData()
    if (data.length === 0) {
      return {
        totalNotes: 0,
        matchedNotes: 0,
        accuracyPct: 0,
        avgCentsOff: 0,
        grade: 'D',
      }
    }
    const total = data.length
    const matched = data.filter((d) => d.inTolerance).length
    const sumCents = data.reduce((s, d) => s + Math.abs(d.centsOff), 0)
    const accuracy = (matched / total) * 100
    const grade =
      accuracy >= 95
        ? 'S'
        : accuracy >= 85
          ? 'A'
          : accuracy >= 70
            ? 'B'
            : accuracy >= 50
              ? 'C'
              : 'D'
    return {
      totalNotes: total,
      matchedNotes: matched,
      accuracyPct: Math.round(accuracy),
      avgCentsOff: Math.round(sumCents / total),
      grade,
    }
  }

  const resetScore = () => {
    setComparisonData([])
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
        micAnalyserNode.fftSize = PITCH_FFT_SIZE
        micAnalyserNode.smoothingTimeConstant = 0.3
        source.connect(micGainNode)
        micGainNode.connect(micAnalyserNode)

        // Route mic to speakers if monitoring is enabled (hear yourself).
        applyMonitorRouting()

        micPitchDetector = new PitchDetector({
          sampleRate: ctx.sampleRate,
          bufferSize: PITCH_FFT_SIZE,
          minConfidence: 0.35,
          minAmplitude: 0.01,
        })

        micPitchHistory = []
        setComparisonData([])
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
    micError,
    micMonitorEnabled,
    setMicMonitor,
    micMonitorVolume,
    setMicMonitorVolume,
    comparisonData,
    setComparisonData,
    toleranceCents,
    score,
    setScore,
    showScore,
    setShowScore,
    getMicAnalyserNode,
    getMicPitchDetector,
    getMicPitchHistory,
    resetMicPitchHistory,
    computeScore,
    resetScore,
    toggleMic,
  }
}
