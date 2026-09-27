// Melody lesson contracts — immutable authored phrases and one calibrated attempt identity.

export type MelodyConnection = 'glide' | 'separate-note'

export interface MelodyVibratoDefinition {
  kind: 'vibrato'
  depthCents: number
  rateHz: number
}

export interface MelodyAnchorDefinition {
  id: string
  offsetSemitones: number
  landingSeconds?: number
  /** Duration and articulation from this anchor to the next one. */
  transitionSeconds?: number
  connection?: MelodyConnection
  ornament?: MelodyVibratoDefinition
}

export interface MelodyPhraseDefinition {
  id: string
  anchors: readonly MelodyAnchorDefinition[]
  /** A phrase boundary is an optional breath, never a required silence timer. */
  allowBreathAfter: boolean
}

export interface MelodyFeelDefinition {
  landingSeconds: number
  finalLandingSeconds: number
  transitionSeconds: number
  breathSeconds: number
  connection: MelodyConnection
}

export interface MelodyDefinition {
  id: string
  version: number
  title: string
  description: string
  feel: MelodyFeelDefinition
  phrases: readonly MelodyPhraseDefinition[]
}

/** Capture-clock policy embedded in a lesson profile, independent of content modules. */
export interface MelodyJudgePolicy {
  landingToleranceCents: number
  glideToleranceCents: number
  confidenceFloor: number
  maximumSampleAgeMs: number
  maximumSampleGapSeconds: number
  dropoutGraceSeconds: number
  mismatchGraceSeconds: number
  acquisitionSeconds: number
  minimumAnchorEvidenceSeconds: number
  minimumPace: number
  maximumPace: number
  alignmentResolutionSeconds: number
  maximumAlignmentWindowSeconds: number
  directionThresholdCents: number
}

export type MelodyJudgePhase = 'acquiring' | 'following' | 'breath' | 'complete'

export type MelodyJudgeFeedback =
  | 'find-start'
  | 'on-track'
  | 'high'
  | 'low'
  | 'dropout'
  | 'stale'
  | 'retry'
  | 'breathe'
  | 'complete'

export interface MelodyJudgeSnapshot {
  phase: MelodyJudgePhase
  feedback: MelodyJudgeFeedback
  progress: number
  phraseIndex: number
  phraseCount: number
  currentPhraseId: string
  targetMidi: number
  pitchErrorCents: number | null
  coveredAnchorIds: readonly string[]
  completedPhraseIds: readonly string[]
  retryCount: number
  complete: boolean
}

export interface MelodyLessonStationDefinition {
  encounterId: string
  anchorId: string
}

/** Fully compiled lesson data consumed directly by simulation and presentation. */
export interface MelodyLessonDefinition {
  id: string
  revision: number
  melody: MelodyDefinition
  comfortableOffsetSemitones: number
  defaultPace: number
  allowedPaces: readonly number[]
  allowedRange: { minimumMidi: number; maximumMidi: number }
  judgePolicy: Partial<MelodyJudgePolicy>
  referenceProfileId: string
  stations: readonly MelodyLessonStationDefinition[]
  finaleEncounterId: string
}

/** User choice before any lesson evidence is accepted. Defaults resolve in core. */
export interface MelodyAttemptConfiguration {
  attemptId: string
  comfortableMidi: number
  pace?: number
  transposeSemitones?: number
}

/** Durable, fully resolved truth shared by judging, references, UI and saves. */
export interface MelodyAttemptIdentity {
  attemptId: string
  levelId: string
  contentRevision: number
  lessonId: string
  lessonRevision: number
  melodyId: string
  melodyVersion: number
  comfortableMidi: number
  rootMidi: number
  pace: number
  transposeSemitones: number
  challengeSignature: string
}

export type MelodyAttemptConfigurationResult =
  | { ok: true; changed: boolean; attempt: MelodyAttemptIdentity }
  | { ok: false; reason: 'no-lesson' | 'invalid' | 'frozen' }
