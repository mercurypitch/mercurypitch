// ============================================================
// StemMixer Mic Controller — mic capture, pitch detection, scoring
// ============================================================

import type { Accessor, Setter } from 'solid-js'
import { createSignal } from 'solid-js'
import type { DetectedPitch } from '@/lib/pitch-detector'
import { PitchDetector } from '@/lib/pitch-detector'

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

  // Mic refs (not signals — no reactivity needed in RAF loop)
  let micStream: MediaStream | null = null
  let micGainNode: GainNode | null = null
  let micAnalyserNode: AnalyserNode | null = null
  let micPitchDetector: PitchDetector | null = null
  let micPitchHistory: PitchNote[] = []

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
      micStream?.getTracks().forEach((t) => t.stop())
      micGainNode?.disconnect()
      micAnalyserNode?.disconnect()
      micStream = null
      micGainNode = null
      micAnalyserNode = null
      micPitchDetector = null
      micPitchHistory = []
      setMicActive(false)
      setMicEnabled(false)
      setMicPitch(null)
      setMicError('')
    } else {
      try {
        const ctx = deps.getAudioCtx() ?? deps.ensureAudioCtx()
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        })
        const source = ctx.createMediaStreamSource(stream)
        micGainNode = ctx.createGain()
        micGainNode.gain.value = 1.0
        micAnalyserNode = ctx.createAnalyser()
        micAnalyserNode.fftSize = PITCH_FFT_SIZE
        micAnalyserNode.smoothingTimeConstant = 0.3
        source.connect(micGainNode)
        micGainNode.connect(micAnalyserNode)

        micPitchDetector = new PitchDetector({
          sampleRate: ctx.sampleRate,
          bufferSize: PITCH_FFT_SIZE,
          minConfidence: 0.35,
          minAmplitude: 0.01,
        })

        micStream = stream
        micPitchHistory = []
        setComparisonData([])
        setScore(null)
        setShowScore(false)
        setMicActive(true)
        setMicEnabled(true)
        setMicPitch(null)
        setMicError('')
      } catch (err: unknown) {
        const e = err as DOMException | Error | undefined
        const msg =
          e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError'
            ? 'Microphone access denied'
            : e !== undefined &&
                'message' in e &&
                typeof (e as Error).message === 'string'
              ? (e as Error).message
              : 'Microphone unavailable'
        setMicError(msg)
        setMicEnabled(false)
      }
    }
  }

  return {
    micEnabled,
    micActive,
    micPitch,
    setMicPitch,
    micError,
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
