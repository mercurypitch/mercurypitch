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
/**
 * The premium Long note (a lantern fills while the note holds). Its own id,
 * not `long-note`: its score is steadiness alone, a different ruler from the
 * web drill's, so their bests must never be compared.
 */
export const EXERCISE_LONG_NOTE_LANTERN = 'long-note-lantern' as const
/**
 * The premium Echo (Merc sings a phrase, the singer sings it back and the
 * stars light). Its own id, named as Long note's is: the exercise and what
 * it draws. The web Call & response is a different exercise and ruler.
 */
export const EXERCISE_ECHO_STARS = 'echo-stars' as const
/**
 * The premium Ng slides (the singer hums five slides up a fifth and back,
 * and each glass arch of the bridge lights where the voice followed it).
 * Named as the others are: the exercise and what it draws. The web Slide
 * drill is a different exercise and ruler.
 */
export const EXERCISE_NG_SLIDES_BRIDGE = 'ng-slides-bridge' as const
/**
 * The premium Lip roll (the singer buzzes their lips over three waves, up
 * an octave and back, and each wave of the night bay lights where the
 * voice rode its crest). Named as the others are: the exercise and what it
 * draws. The web warm-up's lip trill is a different exercise and ruler.
 */
export const EXERCISE_LIP_ROLL_BAY = 'lip-roll-bay' as const
/**
 * The premium Home note, the first Ear room (the band plays an intro, the
 * singer sings the note it calls home, and the lighthouse lights when the
 * voice gets there). Named as the others are: the exercise and what it
 * draws. Its ruler is notes found and the time to find them, a different
 * one from the Ear Lab's Home drill, which names a degree with a tap.
 */
export const EXERCISE_HOME_NOTE_LIGHTHOUSE = 'home-note-lighthouse' as const
/**
 * The premium First note, the second Ear room (an example song's band
 * plays up to where its singer comes in and stops, and the singer sings
 * that first note). Named as the others are: the exercise and what it
 * draws. Its ruler is entries sung on the note at the first try, then
 * notes found: an ear's first guess, then a voice's correction.
 */
export const EXERCISE_FIRST_NOTE_STAGE = 'first-note-stage' as const
/**
 * The premium Leap, the third Ear room (Merc sings a note on a ledge and
 * names a leap, the singer sings his note and leaps to the target on the
 * far ledge, where a lantern lights when the voice gets there). Named as
 * the others are: the exercise and what it draws. Its ruler is leaps
 * landed and the time from Merc's note to the target, a different one
 * from the Ear Lab's Leap drill, which names an interval with a tap.
 */
export const EXERCISE_LEAP_CLIFFS = 'leap-cliffs' as const
/**
 * The premium Warm-up: the rooms above run one after another, each a stop
 * on a glass path through the night, with the singer's song on top. Not an
 * exercise with a ruler of its own: each stop records in its own room, so
 * it is a premium exercise id (the picker opens it) and never an
 * ExerciseType. The web warm-up is a different routine.
 */
export const EXERCISE_WARM_UP_PATH = 'warm-up-path' as const

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
  | typeof EXERCISE_LONG_NOTE_LANTERN
  | typeof EXERCISE_ECHO_STARS
  | typeof EXERCISE_NG_SLIDES_BRIDGE
  | typeof EXERCISE_LIP_ROLL_BAY
  | typeof EXERCISE_HOME_NOTE_LIGHTHOUSE
  | typeof EXERCISE_FIRST_NOTE_STAGE
  | typeof EXERCISE_LEAP_CLIFFS

/**
 * The premium exercises the phone app opens from the Sing screen (Long note,
 * Echo, Ng slides, Lip roll, then the Warm-up) and from the Ear Lab (Home
 * note, First note, Leap). A type here, below the features, so the shell bridge in
 * `src/stores` can name one without importing a feature.
 */
export type PremiumExerciseId =
  | typeof EXERCISE_LONG_NOTE_LANTERN
  | typeof EXERCISE_ECHO_STARS
  | typeof EXERCISE_NG_SLIDES_BRIDGE
  | typeof EXERCISE_LIP_ROLL_BAY
  | typeof EXERCISE_WARM_UP_PATH
  | typeof EXERCISE_HOME_NOTE_LIGHTHOUSE
  | typeof EXERCISE_FIRST_NOTE_STAGE
  | typeof EXERCISE_LEAP_CLIFFS

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
  /** Intervals to drill, in semitones above the start note, each upward
   *  (e.g. `[5, 7]`, a fourth and a fifth): this launch's own set in place
   *  of the exercise's pool. Read it through `launchIntervals`. */
  intervals?: number[]
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
