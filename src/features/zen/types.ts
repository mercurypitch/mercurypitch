export type ZenPracticeMode = 'monitor' | 'exercise'

export type ZenSessionStatus = 'idle' | 'running' | 'paused'

export type ZenTargetVisibility = 'off' | 'dim' | 'on'

export type ZenProgressCue = 'none' | 'playhead'

export type ZenExerciseCategory =
  | 'range'
  | 'agility'
  | 'scales'
  | 'tone'
  | 'articulation'

/**
 * What a block asks the singer for.
 *
 * The stage was built assuming every block is a note. A warm-up is not: a
 * hiss has no pitch but plenty of signal, and a held breath has neither. The
 * honest taxonomy is three kinds, and the middle one is the whole reason this
 * exists — today an unpitched step is a timer, and the app has no idea whether
 * the singer made a sound at all.
 *
 * - `pitch` — sung notes and glides. Scored on pitch, coverage, steadiness.
 * - `amplitude` — hiss, `shh`, a sustained breath out. Scored on whether a
 *   sound was there and how steady it was, from the level the pitch pipeline
 *   already measures.
 * - `breath` — breathe in, hold, rest. Nothing to hear, nothing to score;
 *   drawn as a shape that moves so the step teaches the timing.
 */
export type ZenTargetKind = 'pitch' | 'amplitude' | 'breath'

export interface ZenExerciseTarget {
  id: string
  startBeat: number
  durationBeats: number
  /**
   * Semitone offset from the user-fitted exercise root.
   *
   * Only meaningful for `pitch` blocks. Amplitude and breath blocks carry a
   * number because the schema demands one and the authoring UI has to put
   * something there; nothing reads it.
   */
  semitone: number
  /** Optional destination for a continuous glide. */
  endSemitone?: number
  /** The expression shown on the target instead of a note name. */
  cue: string
  /** Dense phrases can label only their first event. */
  showCue?: boolean
  /** Absent means `pitch` — which is every exercise authored before kinds. */
  kind?: ZenTargetKind
}

export interface ZenExampleAudio {
  src: string
  durationMs: number
  locale: 'en-GB'
  source: 'coach' | 'generated' | 'imported'
  transcript: string
}

export interface ZenScoringConfig {
  pitchWeight: number
  coverageWeight: number
  steadinessWeight: number
  toleranceCents: number
}

export interface ZenExerciseDefinition {
  id: string
  version: number
  title: string
  category: ZenExerciseCategory
  level: 'foundation' | 'developing' | 'advanced'
  summary: string
  goal: string
  instructions: string
  safetyNote?: string
  pronunciationHint?: string
  bpm: number
  countInBeats: number
  loopBeats: number
  defaultRootMidi: number
  targets: ZenExerciseTarget[]
  defaultTargetVisibility: ZenTargetVisibility
  defaultProgressCue: ZenProgressCue
  scoring: ZenScoringConfig
  exampleAudio?: ZenExampleAudio
}

export interface ResolvedZenTarget extends ZenExerciseTarget {
  startSec: number
  endSec: number
  startMidi: number
  endMidi: number
}

/**
 * Per-target live emphasis, keyed by target id in the render model. Hosts
 * that score note-by-note (the weekly challenge stage) light targets up as
 * the singer hits them; plain zen practice passes none and renders as before.
 */
export interface ZenTargetHighlight {
  /** 0..1 live glow strength while the singer is on (or near) the note. */
  glow: number
  /** The note's window has passed and it was sung well — keep it shining. */
  cleared: boolean
  /** The note's window has passed without being hit — recede. */
  missed: boolean
}

export interface ZenPitchPoint {
  timeSec: number
  /** Fractional MIDI retains cents-level pitch detail; null marks a gap. */
  midi: number | null
  clarity?: number
  /**
   * Linear RMS at this instant.
   *
   * Recorded only while an exercise has amplitude blocks to score — a number
   * per sample on every take would grow stored runs for nothing. A hiss is
   * loud and unpitched, so this is the only evidence such a step ever
   * produces.
   */
  level?: number
}

export interface ZenViewport {
  minMidi: number
  maxMidi: number
}

export interface ZenRunScore {
  total: number
  pitch: number
  coverage: number
  steadiness: number
  averageCents: number
  /**
   * The amplitude blocks' score, 0-100. Absent when the exercise had none,
   * which keeps every existing run's shape and every existing total intact.
   */
  level?: number
}

export interface ZenPitchRun {
  id: string
  /** Monotonic within the open Zen session, even after old runs are pruned. */
  takeNumber: number
  completedAt: number
  mode: ZenPracticeMode
  exerciseId?: string
  /** Immutable published revision used for this pass. */
  exerciseVersion?: number
  /** Exercise root used for this take, so historical targets stay aligned. */
  rootMidi?: number
  durationSec: number
  points: ZenPitchPoint[]
  viewport: ZenViewport
  score?: ZenRunScore
}
