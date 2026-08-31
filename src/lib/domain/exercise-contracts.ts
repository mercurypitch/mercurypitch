// ============================================================
// Exercise Contracts — shared drill identities, launch data, and results
// ============================================================
//
// Features, persistence, and stores all exchange these values. Keeping the
// contracts below the UI layers prevents an exercise screen from becoming the
// accidental owner of data that must survive outside that screen.

// ── Exercise type constants ─────────────────────────────────────

import type { GuidedExerciseLaunch, GuidedPracticeDose, } from '@/lib/guided-voice'

export const EXERCISE_VIBRATO = 'vibrato' as const
export const EXERCISE_SLIDE = 'slide' as const
export const EXERCISE_LONG_NOTE = 'long-note' as const
export const EXERCISE_PITCH_PURSUIT = 'pitch-pursuit' as const
export const EXERCISE_MIRROR_MELODY = 'mirror-melody' as const
export const EXERCISE_PITCH_HOLD = 'pitch-hold' as const
export const EXERCISE_INTERVAL_TRAINER = 'interval-trainer' as const
export const EXERCISE_SCALE_RUNNER = 'scale-runner' as const
export const EXERCISE_ARPEGGIO_JUMPER = 'arpeggio-jumper' as const
export const EXERCISE_DRONE_INTONATION = 'drone-intonation' as const
export const EXERCISE_SIREN = 'siren' as const
export const EXERCISE_CALL_RESPONSE = 'call-response' as const
export const EXERCISE_DYNAMIC_SWELL = 'dynamic-swell' as const
export const EXERCISE_CHORD_STACKER = 'chord-stacker' as const
export const EXERCISE_STACCATO = 'staccato-precision' as const
export const EXERCISE_ROUTINE_RUNNER = 'routine-runner' as const
export const EXERCISE_SIGHT_SINGING = 'sight-singing' as const
export const EXERCISE_WARMUP = 'warmup' as const

export type ExerciseType =
  | typeof EXERCISE_VIBRATO
  | typeof EXERCISE_SLIDE
  | typeof EXERCISE_LONG_NOTE
  | typeof EXERCISE_PITCH_PURSUIT
  | typeof EXERCISE_MIRROR_MELODY
  | typeof EXERCISE_PITCH_HOLD
  | typeof EXERCISE_INTERVAL_TRAINER
  | typeof EXERCISE_SCALE_RUNNER
  | typeof EXERCISE_ARPEGGIO_JUMPER
  | typeof EXERCISE_DRONE_INTONATION
  | typeof EXERCISE_SIREN
  | typeof EXERCISE_CALL_RESPONSE
  | typeof EXERCISE_DYNAMIC_SWELL
  | typeof EXERCISE_CHORD_STACKER
  | typeof EXERCISE_STACCATO
  | typeof EXERCISE_ROUTINE_RUNNER
  | typeof EXERCISE_SIGHT_SINGING
  | typeof EXERCISE_WARMUP

// ── Config ──────────────────────────────────────────────────────

/**
 * Launch-scoped, reviewed practice prescription from a guided Focus reading.
 *
 * This deliberately carries the immutable exercise configuration, bounded
 * dose, and stop-rule identity together. It is transient navigation context,
 * not a second preference store, and must never mutate the singer's normal
 * exercise timer choice.
 */
export interface GuidedPracticeLaunchConfig {
  assessmentRunId: string
  exercise: GuidedExerciseLaunch
  dose: GuidedPracticeDose
  stopRuleId: string
  /** Exact assessment-selected note; never re-fit from today's settings. */
  targetMidiCents: number
  /** Reviewed task tolerance, kept separate from adaptive exercise difficulty. */
  toleranceCents: number
}

export interface ExerciseConfig {
  type: ExerciseType
  /** Target note for single-note exercises (e.g., long-note, vibrato) */
  targetNote?: string
  /** Target notes for multi-note exercises (e.g., slide: [from, to]) */
  targetNotes?: string[]
  /** Duration in seconds for timed exercises */
  duration?: number
  /** Difficulty multiplier (1-10, default 5) */
  difficulty?: number
  /** Step-pattern for pattern-driven exercises (e.g. warmup blocks) */
  pattern?: string
  /** Reviewed guided-practice prescription for this one launch. */
  guidedPractice?: GuidedPracticeLaunchConfig
}

// ── State ───────────────────────────────────────────────────────

export type ExerciseStatus = 'idle' | 'count-in' | 'active' | 'complete'

export interface ExerciseState {
  status: ExerciseStatus
  currentScore: number
  elapsedMs: number
  /** Exercise-specific live metrics */
  metrics: Record<string, number>
}

// ── Results ─────────────────────────────────────────────────────

export interface ExerciseResult {
  type: ExerciseType
  score: number
  metrics: Record<string, number>
  completedAt: number
  /** Best 3-second window data for celebration highlight */
  bestWindow?: {
    startMs: number
    endMs: number
    score: number
  }
}

// ── Controller interface ────────────────────────────────────────

export interface ExerciseController {
  state: () => ExerciseState
  start: () => Promise<void>
  stop: () => void
  reset: () => void
  result: () => ExerciseResult | null
  /** Pitch history for visualization */
  pitchHistory: () => Array<{
    freq: number
    time: number
    cents: number
    clarity?: number
    /** Linear RMS for the frame. use-base-exercise has always recorded it
     *  (practiceEngine.getInputLevel) and the swell scorer has always read
     *  it; the public type simply did not say so, which kept the value
     *  invisible to the views that could show it. */
    rms?: number
  }>
  currentPitch: () => { freq: number; clarity: number; noteName: string } | null
  frequencyData: () => Float32Array | null
  targetPitch: () => number | null
}
