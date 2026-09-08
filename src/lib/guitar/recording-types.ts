// Guitar recording contracts separate captured audio evidence from accepted practice targets.
import type { GuitarElectricAmpParameters } from './guitar-electric-amp'
import type { InstrumentTuning } from './instrument-tuning'

export const GUITAR_RECORDING_VERSION = 1
export const GUITAR_DETECTOR_VERSION = 'guitar-melody-1.1'
export const GUITAR_RECORDING_LIMIT_SECONDS = 300
export const GUITAR_RECORDING_CHUNK_FRAMES = 8192
/** Short analysis delivery, independent of the durable checkpoint size. */
export const GUITAR_RECORDING_PCM_FRAMES = 2048
// Preserve the original 65,536-sample backpressure budget, not a longer queue.
export const GUITAR_RECORDING_POOL_SIZE = 32

export interface GuitarPitchEvidence {
  frame: number
  midi: number | null
  clarity: number
}

export interface GuitarRecordedNote {
  id: string
  midi: number
  startFrame: number
  endFrame: number
  clarity: number
  onset: 'attack' | 'pitch-change'
}

/** Ephemeral ordered delta, never proof that its audio/evidence are durable. */
export interface GuitarRecordingPreview {
  sequence: number
  frames: number
  /** Every newly completed note since the previous preview, delivered once. */
  notes: GuitarRecordedNote[]
  pendingNote: GuitarRecordedNote | null
  pitch: GuitarPitchEvidence | null
  ended: boolean
}

export interface GuitarRecordingChunk {
  id: string
  createdAt: string
  updatedAt: string
  kind: 'audio' | 'ending'
  recordingId: string
  sequence: number
  firstFrame: number
  frames: number
  /** Little-endian signed PCM16; removed only after Keep commits its WAV. */
  pcm: ArrayBuffer | null
  pitches: GuitarPitchEvidence[]
  attacks: number[]
  notes: GuitarRecordedNote[]
  peak: number
  /** Unaccepted corrections are stored separately from measured notes. */
  editableScore?: GuitarPracticeScore
}

export interface GuitarRecordingBacking {
  id: string
  title: string
  startSeconds: number
  rate: number
}

export interface GuitarRecording {
  id: string
  version: 1
  detectorVersion: string
  title: string
  createdAt: string
  updatedAt: string
  state: 'capturing' | 'draft' | 'kept'
  sampleRate: number
  inputChannel: number
  inputKind: 'interface' | 'microphone'
  /** Pinned at Record; later room tuning changes cannot rewrite a draft's neck. */
  tuning?: InstrumentTuning
  frames: number
  chunks: number
  audioStartFrame: number | null
  clockAnomalies: number
  interruption: string | null
  amp: GuitarElectricAmpParameters | null
  backing: GuitarRecordingBacking | null
  takeId: string | null
  scoreId: string | null
}

export interface GuitarPracticeNote {
  id: string
  evidenceId: string
  midi: number
  startBeat: number
  endBeat: number
  /** One-based, highest string first; null means outside the chosen neck. */
  string: number | null
  fret: number | null
}

export interface GuitarPracticeScore {
  id: string
  recordingId: string
  revision: number
  title: string
  createdAt: string
  updatedAt: string
  bpm: number
  timeSignature: [number, number]
  grid: 'display' | 'chosen'
  instrument?: 'guitar' | 'bass'
  tuning: number[]
  capo: number
  notes: GuitarPracticeNote[]
  /** Pairing belongs to this immutable revision, never a global offset. */
  attachment: {
    backingId: string
    firstSeconds: number
    lastSeconds: number
  } | null
}

export interface GuitarRecordingSummary {
  frames: number
  notes: GuitarRecordedNote[]
  clockAnomalies: number
  interruption: string | null
}

export type GuitarCaptureMessage =
  | { type: 'started'; audioStartFrame: number }
  | {
      type: 'pcm'
      sequence: number
      firstFrame: number
      frames: number
      buffer: ArrayBuffer
    }
  | {
      type: 'stopped'
      frames: number
      clockAnomalies: number
      reason: string | null
    }

export type GuitarCaptureCommand =
  | { type: 'buffer'; buffer: ArrayBuffer }
  | { type: 'start'; maxFrames: number }
  | { type: 'stop'; reason: string | null }

export type GuitarRecordingWorkerMessage =
  | { type: 'preview'; preview: GuitarRecordingPreview }
  | {
      type: 'chunk'
      chunk: GuitarRecordingChunk
      recycled: ArrayBuffer[]
      previewNote?: GuitarRecordedNote | null
    }
  | { type: 'finished'; summary: GuitarRecordingSummary }
  | { type: 'error'; message: string }

export type GuitarRecordingWorkerCommand =
  | { type: 'init'; recordingId: string; sampleRate: number }
  | Extract<GuitarCaptureMessage, { type: 'pcm' | 'stopped' }>
