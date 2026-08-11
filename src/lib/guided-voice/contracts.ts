// ============================================================
// Guided Voice contracts — versioned evidence, tasks, and handoffs
// ============================================================
//
// These data-only contracts sit below Hear Yourself and the exercise UI. They
// keep assessment identity, direct evidence, practice context, and matched
// retakes serializable without importing either product surface.

export type GuidedScalar = string | number | boolean | null
export type GuidedParameterValue = GuidedScalar | readonly GuidedScalar[]
export type GuidedParameters = Readonly<Record<string, GuidedParameterValue>>

export type GuidedEvidenceClass =
  | 'direct-measurement'
  | 'contextual-acoustic-proxy'
  | 'singer-report'
  | 'not-measured'

export type GuidedMeasurementUnit =
  | 'cents'
  | 'milliseconds'
  | 'seconds'
  | 'ratio'
  | 'count'
  | 'hertz'
  | 'decibels'
  | 'relative-level'

export type GuidedComparisonFamily =
  | 'pitch'
  | 'timing'
  | 'relative-level'
  | 'spectrum'

export type GuidedRequiredSignal =
  | 'f0'
  | 'confidence'
  | 'relative-level'
  | 'dry-audio'

export interface GuidedProtocolIdentity {
  assessmentId: string
  protocolVersion: string
  instructionVersion: string
  targetVersion: string
  analysisVersion: string
  scoringVersion: string
}

/** The material parameters needed to repeat a task exactly. */
export interface GuidedTaskConfiguration {
  taskId: string
  cueId: string
  /** Integer MIDI-cents prevent semitone rounding in fitted retakes. */
  comfortableRangeMidiCents: readonly [number, number] | null
  targetMidiCents: readonly number[]
  tempoBpm: number | null
  /** Integer milliseconds keep persisted timing and fingerprints stable. */
  durationMilliseconds: number
  repetitions: number
  parameters: GuidedParameters
}

export interface GuidedAssessmentDefinition {
  identity: GuidedProtocolIdentity
  title: string
  evidenceClass: 'direct-measurement'
  requiredSignals: readonly GuidedRequiredSignal[]
  requiredQualityChecks: readonly GuidedQualityRequirement[]
  allowedFindingCodes: readonly string[]
  recommendationRuleIds: readonly string[]
  comparisonFamilies: readonly GuidedComparisonFamily[]
}

export interface GuidedEvidenceMoment {
  id: string
  startSeconds: number
  endSeconds: number
  /** Reviewed UI-copy identifier, never model-authored prose. */
  labelId: string
}

interface GuidedEvidenceBase {
  id: string
  assessmentId: string
  measurementKey: string
}

export interface GuidedScalarMeasurement {
  kind: 'scalar'
  value: number
  unit: GuidedMeasurementUnit
}

/** A fraction keeps the denominator available wherever a percentage appears. */
export interface GuidedFractionMeasurement {
  kind: 'fraction'
  numerator: number
  denominator: number
  numeratorUnit:
    | 'frames'
    | 'milliseconds'
    | 'seconds'
    | 'repetitions'
    | 'targets'
  denominatorUnit:
    | 'frames'
    | 'milliseconds'
    | 'seconds'
    | 'repetitions'
    | 'targets'
}

export type GuidedNumericMeasurement =
  | GuidedScalarMeasurement
  | GuidedFractionMeasurement

export interface GuidedDirectMeasurementEvidence extends GuidedEvidenceBase {
  availability: 'available'
  evidenceClass: 'direct-measurement'
  comparisonFamily: GuidedComparisonFamily
  measurement: GuidedNumericMeasurement
  /** Algorithmic confidence, not a public singing score. */
  confidence: number
  moments: readonly GuidedEvidenceMoment[]
}

export interface GuidedContextualProxyEvidence extends GuidedEvidenceBase {
  availability: 'available'
  evidenceClass: 'contextual-acoustic-proxy'
  comparisonFamily: GuidedComparisonFamily
  measurement: GuidedNumericMeasurement
  confidence: number
  moments: readonly GuidedEvidenceMoment[]
  caveatId: string
  inputSensitivity: 'input-sensitive' | 'input-stable'
}

export interface GuidedSingerReportEvidence extends GuidedEvidenceBase {
  availability: 'available'
  evidenceClass: 'singer-report'
  comparisonFamily: null
  value: GuidedSingerEffort
  moments: readonly GuidedEvidenceMoment[]
}

export interface GuidedUnavailableEvidence extends GuidedEvidenceBase {
  availability: 'unavailable'
  evidenceClass: 'direct-measurement' | 'contextual-acoustic-proxy'
  comparisonFamily: GuidedComparisonFamily | null
  reason:
    | 'insufficient-signal'
    | 'insufficient-duration'
    | 'insufficient-repetitions'
    | 'unsupported-capability'
    | 'quality-gate'
}

export interface GuidedNotMeasuredEvidence extends GuidedEvidenceBase {
  availability: 'unavailable'
  evidenceClass: 'not-measured'
  comparisonFamily: null
  reason: 'outside-task-contract' | 'unsupported-construct'
}

export type GuidedEvidence =
  | GuidedDirectMeasurementEvidence
  | GuidedContextualProxyEvidence
  | GuidedSingerReportEvidence
  | GuidedUnavailableEvidence
  | GuidedNotMeasuredEvidence

export interface GuidedFinding {
  id: string
  assessmentId: string
  role: 'positive' | 'focus'
  findingCode: string
  evidenceId: string
  confidence: number
}

export type GuidedSingerEffort =
  | 'easy'
  | 'workable'
  | 'effortful'
  | 'uncomfortable'

/**
 * Raw symptom answers are intentionally absent. Only the coarse local
 * disposition may travel with an assessment handoff or kept Focus Take.
 */
export interface GuidedSafetyContext {
  preCapture: 'proceed' | 'stop'
  singerEffort: GuidedSingerEffort | null
}

export type GuidedQualityCheckId =
  | 'microphone-continuity'
  | 'clipping'
  | 'noise-separation'
  | 'signal-coverage'
  | 'pitch-confidence'
  | 'task-completion'
  | 'duration'
  | 'repetitions'
  | 'analysis-capability'

export type GuidedQualityOutcome =
  | 'ready'
  | 'partial'
  | 'needs-another-recording'
  | 'unavailable'

export type GuidedQualityFailureDisposition =
  | 'retry-recording'
  | 'unavailable-here'

export interface GuidedQualityRequirement {
  id: GuidedQualityCheckId
  failureDisposition: GuidedQualityFailureDisposition
}

export interface GuidedQualityObservation {
  id: GuidedQualityCheckId
  status: 'pass' | 'fail' | 'unavailable' | 'not-required'
  reasonCode: string | null
}

export interface GuidedResolvedQualityObservation extends GuidedQualityObservation {
  required: boolean
  failureDisposition: GuidedQualityFailureDisposition | null
}

export interface GuidedQualityGateResult {
  outcome: GuidedQualityOutcome
  observations: readonly GuidedResolvedQualityObservation[]
  blockingCheckIds: readonly GuidedQualityCheckId[]
  partialCheckIds: readonly GuidedQualityCheckId[]
}

export interface GuidedExerciseLaunch {
  exerciseId: string
  exerciseVersion: string
  /**
   * Exact reference to an immutable, reviewed exercise configuration. Dynamic
   * parameters live in the bounded dose; this prevents an unreviewed numeric
   * payload from silently increasing range, level, duration, or repetitions.
   */
  configuration: {
    configurationId: string
    configurationVersion: string
  }
}

export interface GuidedPracticeDose {
  durationMilliseconds: number | null
  repetitions: number | null
  sets: number | null
  comfortableRangeMidiCents: readonly [number, number] | null
  demand: 'gentler' | 'same' | 'increased'
}

export interface GuidedReturnDestination {
  kind: 'guided-focus-reading'
  assessmentRunId: string
}

export interface GuidedRetakeProtocol {
  identity: GuidedProtocolIdentity
  task: GuidedTaskConfiguration
  comparisonFingerprint: string
}

/** Immutable protocol provenance captured with the originating assessment. */
export interface GuidedOriginatingCapture {
  assessmentRunId: string
  protocol: Readonly<GuidedRetakeProtocol>
}

export interface GuidedPracticeRecommendation {
  id: string
  version: string
  originatingAssessmentId: string
  originatingEvidenceIds: readonly string[]
  exercise: GuidedExerciseLaunch
  reasonId: string
  dose: GuidedPracticeDose
  stopRuleId: string
  alternativeRecommendationId: string | null
  returnDestination: GuidedReturnDestination
  retake: GuidedRetakeProtocol
}

/** Minimal local input context; it deliberately contains no hardware label. */
export interface GuidedCaptureContext {
  inputContextKey: string | null
  detectorId: string
  detectorVersion: string
  sampleRateHz: number | null
}

export interface GuidedPersistedAssessmentContext {
  runId: string
  identity: GuidedProtocolIdentity
  task: GuidedTaskConfiguration
  captureSource: 'dry-microphone'
  comparisonFingerprint: string
  quality: GuidedQualityGateResult
  evidence: readonly GuidedEvidence[]
  recommendation: GuidedPracticeRecommendation | null
  singerEffort: GuidedSingerEffort | null
  captureContext: GuidedCaptureContext
}

export interface GuidedFocusReading {
  primaryEvidenceId: string
  positiveFinding: GuidedFinding
  focusFinding: GuidedFinding
  recommendation: GuidedPracticeRecommendation
}

export type GuidedAssessmentOutcome =
  | {
      kind: 'focus-reading'
      quality: 'ready' | 'partial'
      evidence: readonly GuidedEvidence[]
      reading: GuidedFocusReading
    }
  | {
      kind: 'no-reliable-focus'
      evidence: readonly GuidedEvidence[]
    }
  | {
      kind: 'needs-another-recording'
      quality: GuidedQualityGateResult
    }
  | { kind: 'unavailable-here'; quality: GuidedQualityGateResult }
  | { kind: 'safety-stop' }
  | { kind: 'analysis-failed'; reasonCode: string }

export type GuidedAnalyticsEventName =
  | 'guided-check-opened'
  | 'assessment-selected'
  | 'quality-gate-ready'
  | 'quality-gate-partial'
  | 'quality-gate-retry'
  | 'quality-gate-unavailable'
  | 'assessment-completed'
  | 'result-evidence-played'
  | 'recommendation-launched'
  | 'returned-from-practice'
  | 'matched-retake-started'
  | 'matched-retake-completed'
  | 'take-kept'
  | 'take-discarded'
  | 'twin-trails-played'
