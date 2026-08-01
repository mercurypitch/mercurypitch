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

export interface ZenExerciseTarget {
  id: string
  startBeat: number
  durationBeats: number
  /** Semitone offset from the user-fitted exercise root. */
  semitone: number
  /** Optional destination for a continuous glide. */
  endSemitone?: number
  /** The expression shown on the target instead of a note name. */
  cue: string
  /** Dense phrases can label only their first event. */
  showCue?: boolean
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
