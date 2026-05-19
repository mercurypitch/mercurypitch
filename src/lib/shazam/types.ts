// ============================================================
// Shazam Sing — Shared types for client-side melody matching
// ============================================================

/** Compressed melody fingerprint for DTW matching */
export interface MelodyFingerprint {
  melodyId: string
  name: string
  /** Absolute pitch sequence (MIDI numbers, e.g. [60, 62, 64, 65]) */
  pitchSequence: number[]
  /** Inter-onset intervals in seconds (null for single-note melodies) */
  ioiSequence: number[]
  /** Duration of each note in seconds */
  durations: number[]
  /** Total duration in seconds */
  durationSec: number
  /** Number of notes */
  noteCount: number
  /** Octave-invariant pitch contour (MIDI mod 12) for octave-agnostic matching */
  chromaSequence: number[]
  /** Interval contour (delta between consecutive notes) for transposition-invariant matching */
  intervalSequence: number[]
  /** Tempo in BPM */
  bpm: number
  /** Musical key */
  key: string
}

/** In-memory fingerprint index */
export type FingerprintIndex = Map<string, MelodyFingerprint>

/** Result of a fingerprint build operation */
export interface FingerprintResult {
  fingerprints: FingerprintIndex
  errors: FingerprintError[]
}

/** Error encountered during fingerprint extraction */
export interface FingerprintError {
  melodyId: string
  name: string
  reason: string
}

// ============================================================
// Phase 2 — Onset detection & live pitch capture
// ============================================================

import type { DetectedPitch } from '@/lib/pitch-detector'

/** A single pitch frame with a relative timestamp (seconds from capture start) */
export interface TimestampedPitch {
  /** Seconds elapsed since capture began */
  time: number
  /** Detected pitch at this frame (frequency=0 means silence) */
  pitch: DetectedPitch
}

/** Detected note boundary event */
export interface OnsetEvent {
  /** Seconds from start of capture */
  time: number
  type: 'note-start' | 'note-change' | 'silence-end' | 'end-of-phrase'
  /** 0–1 confidence this is a real onset */
  confidence: number
}

/** Options for the onset detector */
export interface OnsetDetectorOptions {
  /** Minimum silence duration in seconds to mark a note boundary (default: 0.15) */
  minSilenceSec?: number
  /** Minimum pitch-jump in semitones to mark a note change (default: 1) */
  minPitchJumpSemitones?: number
  /** Minimum stable pitch duration in seconds to confirm a new note (default: 0.08) */
  minStableSec?: number
  /** Clarity below this value is considered silence (default: 0.3) */
  silenceClarityThreshold?: number
}

/** Processed contour ready for matching */
export interface LivePitchContour {
  /** All captured pitch frames with timestamps */
  frames: TimestampedPitch[]
  /** Detected note boundaries */
  onsets: OnsetEvent[]
  /** Total capture duration in seconds */
  durationSec: number
  /** Extracted pitch sequence (MIDI numbers) from onset-segmented notes */
  noteSequence: number[]
  /** Inter-onset intervals in seconds */
  ioiSequence: number[]
  /** Note durations in seconds */
  noteDurations: number[]
}

/** States for the live pitch buffer */
export type BufferState = 'idle' | 'listening' | 'processing'

// ============================================================
// Phase 3 — DTW matching & scoring
// ============================================================

/** Result of a DTW computation */
export interface DtwResult {
  /** Raw DTW distance (lower = better match) */
  distance: number
  /** Normalized distance 0–1 (0 = perfect match) */
  normalizedDistance: number
  /** Warp path: array of [queryIndex, referenceIndex] pairs */
  path: [number, number][]
}

/** A matched melody candidate with confidence scoring */
export interface MatchCandidate {
  melodyId: string
  name: string
  /** 0–100 overall confidence */
  confidence: number
  /** Individual feature scores (0–1, higher = better) */
  breakdown: MatchBreakdown
  /** Source of the match — melody library or user-uploaded stem */
  source?: 'melody' | 'stem'
  /** UVR session ID when source === 'stem' */
  sessionId?: string
  /** Whether humming normalization was applied to boost chroma/pitch weights */
  hummingNormalized?: boolean
}

/** Per-feature match scores */
export interface MatchBreakdown {
  pitchScore: number
  intervalScore: number
  chromaScore: number
  rhythmScore: number
  lengthBonus: number
}

/** Options for the melody matcher */
export interface MatcherOptions {
  /** Minimum confidence to include in results (default: 0) */
  minConfidence?: number
  /** Maximum number of results to return (default: 5) */
  maxResults?: number
  /** Scoring weights — must sum approximately to 1 */
  weights?: Partial<MatchWeights>
  /** Only include fingerprints from this source (omit = all sources) */
  sourceFilter?: 'melody' | 'stem'
}

export interface MatchWeights {
  pitchWeight: number
  intervalWeight: number
  chromaWeight: number
  rhythmWeight: number
  lengthBonusWeight: number
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  pitchWeight: 0.35,
  intervalWeight: 0.25,
  chromaWeight: 0.15,
  rhythmWeight: 0.15,
  lengthBonusWeight: 0.1,
}
