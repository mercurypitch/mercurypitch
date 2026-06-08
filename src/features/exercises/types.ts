// ── Exercise type constants ─────────────────────────────────────

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

// ── Config ──────────────────────────────────────────────────────

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
  }>
  currentPitch: () => { freq: number; clarity: number; noteName: string } | null
  frequencyData: () => Float32Array | null
  targetPitch: () => number | null
}
