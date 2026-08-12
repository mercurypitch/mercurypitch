// ============================================================
// Pitch Centre pilot assessment — one bounded route from capture to practice
// ============================================================
//
// The neutral landing metric deliberately owns no public policy. This adapter
// supplies the reviewed pilot thresholds, fits one exact-register task, and
// emits only validated evidence that Hear Yourself can persist and present.

import type { F0Frame } from '@/lib/pitch-measurements'
import { buildGuidedComparisonFingerprint } from './comparison'
import type { GuidedAssessmentDefinition, GuidedAssessmentOutcome, GuidedCaptureContext, GuidedDirectMeasurementEvidence, GuidedEvidence, GuidedEvidenceMoment, GuidedFinding, GuidedFocusReading, GuidedPersistedAssessmentContext, GuidedQualityGateResult, GuidedQualityObservation, GuidedRetakeProtocol, GuidedSafetyContext, GuidedTaskConfiguration, GuidedUnavailableEvidence, } from './contracts'
import { isGuidedIdentifier } from './identifiers'
import type { PitchCentreLandingAggregate, PitchCentreLandingProtocol, PitchCentreLandingResult, } from './pitch-centre'
import { aggregatePitchCentreLandings, measurePitchCentreLanding, } from './pitch-centre'
import { evaluateGuidedQualityGate } from './quality-gate'
import type { GuidedRecommendationRule } from './recommendations'
import { resolveGuidedRecommendationOutcome } from './recommendations'
import { validateGuidedEvidenceContract, validateGuidedFocusReadingContract, } from './validation'

function freezeDeep<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value
  }
  for (const nested of Object.values(
    value as unknown as Record<string, unknown>,
  )) {
    freezeDeep(nested)
  }
  return Object.freeze(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => sameJsonValue(entry, right[index]))
    )
  }
  if (!isRecord(left) || !isRecord(right)) return false
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && sameJsonValue(left[key], right[key]),
    )
  )
}

function hasExactKeys(
  value: unknown,
  expectedKeys: readonly string[],
): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const actualKeys = Object.keys(value).sort()
  const sortedExpectedKeys = [...expectedKeys].sort()
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  )
}

function cloneProtocol(
  protocol: Readonly<GuidedRetakeProtocol>,
): GuidedRetakeProtocol {
  const range = protocol.task.comfortableRangeMidiCents
  return {
    identity: { ...protocol.identity },
    task: {
      ...protocol.task,
      comfortableRangeMidiCents: range === null ? null : [range[0], range[1]],
      targetMidiCents: [...protocol.task.targetMidiCents],
      parameters: Object.fromEntries(
        Object.entries(protocol.task.parameters).map(([key, value]) => [
          key,
          Array.isArray(value) ? [...value] : value,
        ]),
      ),
    },
    comparisonFingerprint: protocol.comparisonFingerprint,
  }
}

/** Every public pilot threshold is versioned here rather than in the UI. */
export const PITCH_CENTRE_PILOT_THRESHOLDS_V1 = freezeDeep({
  version: '1.0.0',
  repetitions: 3,
  targetOffsetsMidiCents: [-200, 0, 200] as const,
  minimumComfortableSpanMidiCents: 400,
  landingWindowMilliseconds: 1_800,
  minimumConfidentCoverageRatio: 0.55,
  reinforceSettledRepetitions: 3,
  reinforceMedianAbsoluteErrorCents: 25,
  practiceDurationMilliseconds: 5_000,
  measurement: {
    confidenceFloor: 0.6,
    medianWindow: 5,
    maxVoicedGapMilliseconds: 100,
    minimumObservationMilliseconds: 900,
    minimumConfidentFrames: 18,
    settleToleranceCents: 35,
    settleHoldMilliseconds: 300,
    minimumSettlingFrames: 10,
    approachDeadbandCents: 12,
    approachConsensusRatio: 0.7,
  } satisfies PitchCentreLandingProtocol,
})

export const PITCH_CENTRE_PILOT_IDENTITY_V1 = freezeDeep({
  assessmentId: 'pitch-centre',
  protocolVersion: PITCH_CENTRE_PILOT_THRESHOLDS_V1.version,
  instructionVersion: '1.0.0',
  targetVersion: '1.0.0',
  analysisVersion: '1.0.0',
  scoringVersion: 'score-free-1.0.0',
})

const REQUIRED_QUALITY_CHECKS = freezeDeep([
  { id: 'microphone-continuity', failureDisposition: 'retry-recording' },
  { id: 'clipping', failureDisposition: 'retry-recording' },
  { id: 'signal-coverage', failureDisposition: 'retry-recording' },
  { id: 'pitch-confidence', failureDisposition: 'retry-recording' },
  { id: 'task-completion', failureDisposition: 'retry-recording' },
  { id: 'duration', failureDisposition: 'retry-recording' },
  { id: 'repetitions', failureDisposition: 'retry-recording' },
  { id: 'analysis-capability', failureDisposition: 'unavailable-here' },
] as const)

// Landing windows originate from integer millisecond capture clocks but cross
// the public boundary as seconds. Allow only sub-microsecond representation
// error when comparing them back to the authored millisecond duration.
const DURATION_COMPARISON_EPSILON_MS = 0.001

function meetsLandingWindowDuration(
  startSeconds: number,
  endSeconds: number,
): boolean {
  return (
    (endSeconds - startSeconds) * 1000 + DURATION_COMPARISON_EPSILON_MS >=
    PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds
  )
}

export const PITCH_CENTRE_PILOT_DEFINITION_V1: GuidedAssessmentDefinition =
  freezeDeep({
    identity: PITCH_CENTRE_PILOT_IDENTITY_V1,
    title: 'Pitch Centre',
    evidenceClass: 'direct-measurement',
    requiredSignals: ['f0', 'confidence', 'dry-audio'],
    requiredQualityChecks: REQUIRED_QUALITY_CHECKS,
    allowedFindingCodes: [
      'pitch-centre.finding.complete-landings',
      'pitch-centre.finding.reinforce-centre',
      'pitch-centre.finding.refine-centre',
    ],
    recommendationRuleIds: [
      'pitch-centre.rule.reinforce-centre',
      'pitch-centre.rule.refine-centre',
    ],
    comparisonFamilies: ['pitch', 'timing'],
  })

export interface CreatePitchCentrePilotProtocolInput {
  comfortableRangeMidiCents: readonly [number, number]
  preferredMidiCents: number
}

function requireSafeMidiCents(label: string, value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`Pitch Centre ${label} must use integer MIDI-cents`)
  }
}

/**
 * Fit the three-note pilot route to a declared comfortable range. Targets are
 * authored semitones and never octave-folded during either fitting or scoring.
 */
export function createPitchCentrePilotProtocol(
  input: CreatePitchCentrePilotProtocolInput,
): Readonly<GuidedRetakeProtocol> {
  const [rangeLow, rangeHigh] = input.comfortableRangeMidiCents
  requireSafeMidiCents('range floor', rangeLow)
  requireSafeMidiCents('range ceiling', rangeHigh)
  requireSafeMidiCents('preferred note', input.preferredMidiCents)
  if (
    rangeHigh - rangeLow <
    PITCH_CENTRE_PILOT_THRESHOLDS_V1.minimumComfortableSpanMidiCents
  ) {
    throw new Error('Pitch Centre comfortable range is too narrow for pilot')
  }

  const lowerOffset = Math.abs(
    PITCH_CENTRE_PILOT_THRESHOLDS_V1.targetOffsetsMidiCents[0],
  )
  const upperOffset = PITCH_CENTRE_PILOT_THRESHOLDS_V1.targetOffsetsMidiCents[2]
  const minimumCentre = Math.ceil((rangeLow + lowerOffset) / 100) * 100
  const maximumCentre = Math.floor((rangeHigh - upperOffset) / 100) * 100
  if (minimumCentre > maximumCentre) {
    throw new Error(
      'Pitch Centre comfortable range contains no three-note pilot route',
    )
  }

  const preferredSemitone = Math.round(input.preferredMidiCents / 100) * 100
  const fittedCentreMidiCents = Math.min(
    maximumCentre,
    Math.max(minimumCentre, preferredSemitone),
  )
  const targetMidiCents =
    PITCH_CENTRE_PILOT_THRESHOLDS_V1.targetOffsetsMidiCents.map(
      (offset) => fittedCentreMidiCents + offset,
    )
  const task: GuidedTaskConfiguration = {
    taskId: 'pitch-centre.pilot-three-landings',
    cueId: 'pitch-centre.cue.hear-then-land',
    comfortableRangeMidiCents: [rangeLow, rangeHigh],
    targetMidiCents,
    tempoBpm: null,
    durationMilliseconds:
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds *
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
    repetitions: PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
    parameters: {
      fittedCentreMidiCents,
      preferredMidiCents: input.preferredMidiCents,
      landingWindowMilliseconds:
        PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds,
      routeOffsetsMidiCents: [
        ...PITCH_CENTRE_PILOT_THRESHOLDS_V1.targetOffsetsMidiCents,
      ],
      exactRegister: true,
      octaveFold: false,
      vowel: 'ah',
    },
  }
  const comparisonFingerprint = buildGuidedComparisonFingerprint({
    identity: PITCH_CENTRE_PILOT_IDENTITY_V1,
    task,
  })

  return freezeDeep({
    identity: { ...PITCH_CENTRE_PILOT_IDENTITY_V1 },
    task,
    comparisonFingerprint,
  })
}

export interface PitchCentrePilotLandingWindow {
  /** Start of this scored window on the full dry recording clock. */
  startSeconds: number
  /** End of this scored window on the full dry recording clock. */
  endSeconds: number
  /** Raw detector frames may use this window's local clock or the full take clock. */
  frames: readonly F0Frame[]
}

export interface PitchCentrePilotCaptureQuality {
  microphoneContinuous: boolean
  clippingDetected: boolean | 'unavailable'
  noiseSeparation: 'sufficient' | 'insufficient' | 'unavailable'
  taskCompleted: boolean
  analysisAvailable: boolean
}

export interface PitchCentrePilotAssessmentInput {
  runId: string
  protocol: Readonly<GuidedRetakeProtocol>
  captureDurationMilliseconds: number
  landingWindows: readonly PitchCentrePilotLandingWindow[]
  quality: PitchCentrePilotCaptureQuality
  safety: GuidedSafetyContext
  captureContext: GuidedCaptureContext
}

export interface PitchCentrePilotAssessmentResult {
  definition: GuidedAssessmentDefinition
  protocol: Readonly<GuidedRetakeProtocol>
  landings: readonly PitchCentreLandingResult[]
  aggregate: PitchCentreLandingAggregate
  quality: GuidedQualityGateResult
  evidence: readonly GuidedEvidence[]
  findings: readonly GuidedFinding[]
  outcome: GuidedAssessmentOutcome
  /** Null means no guided assessment context is safe to persist. */
  persistedContext: GuidedPersistedAssessmentContext | null
  /** Present only when the validated outcome contains a Focus reading. */
  reading: GuidedFocusReading | null
}

/** Accept only the exact versioned task produced by the Pitch Centre pilot. */
export function isPitchCentrePilotProtocol(
  protocol: Readonly<GuidedRetakeProtocol>,
): boolean {
  try {
    const range = protocol.task.comfortableRangeMidiCents
    const preferred = protocol.task.parameters.preferredMidiCents
    if (
      range === null ||
      typeof preferred !== 'number' ||
      !Number.isSafeInteger(preferred)
    ) {
      return false
    }
    const expected = createPitchCentrePilotProtocol({
      comfortableRangeMidiCents: [range[0], range[1]],
      preferredMidiCents: preferred,
    })
    return (
      sameJsonValue(protocol, expected) &&
      protocol.comparisonFingerprint === expected.comparisonFingerprint &&
      protocol.comparisonFingerprint ===
        buildGuidedComparisonFingerprint({
          identity: protocol.identity,
          task: protocol.task,
        })
    )
  } catch {
    return false
  }
}

function validCaptureContext(context: GuidedCaptureContext): boolean {
  return (
    context.detectorId.trim().length > 0 &&
    context.detectorVersion.trim().length > 0 &&
    (context.inputContextKey === null ||
      context.inputContextKey.trim().length > 0) &&
    (context.sampleRateHz === null ||
      (Number.isFinite(context.sampleRateHz) && context.sampleRateHz > 0))
  )
}

function validSafetyContext(safety: GuidedSafetyContext): boolean {
  return (
    (safety.preCapture === 'proceed' || safety.preCapture === 'stop') &&
    (safety.singerEffort === null ||
      safety.singerEffort === 'easy' ||
      safety.singerEffort === 'workable' ||
      safety.singerEffort === 'effortful' ||
      safety.singerEffort === 'uncomfortable')
  )
}

interface NormalizedLandingWindow {
  valid: boolean
  startSeconds: number
  endSeconds: number
  frames: readonly F0Frame[]
}

function normalizeLandingWindow(
  window: PitchCentrePilotLandingWindow,
  captureDurationSeconds: number,
): NormalizedLandingWindow {
  const valid =
    Number.isFinite(window.startSeconds) &&
    Number.isFinite(window.endSeconds) &&
    window.startSeconds >= 0 &&
    window.endSeconds > window.startSeconds &&
    window.endSeconds <= captureDurationSeconds &&
    Array.isArray(window.frames)
  if (!valid) {
    return { valid: false, startSeconds: 0, endSeconds: 0, frames: [] }
  }

  const windowDurationSeconds = window.endSeconds - window.startSeconds
  const usesLocalClock = window.frames.every(
    (frame) => frame.t >= 0 && frame.t <= windowDurationSeconds,
  )

  return {
    valid: true,
    startSeconds: window.startSeconds,
    endSeconds: window.endSeconds,
    frames: usesLocalClock
      ? window.frames.map((frame) => ({ ...frame }))
      : window.frames
          .filter(
            (frame) =>
              frame.t >= window.startSeconds && frame.t < window.endSeconds,
          )
          .map((frame) => ({ ...frame, t: frame.t - window.startSeconds })),
  }
}

function observedStatus(
  value: boolean,
  passWhen: boolean,
): GuidedQualityObservation['status'] {
  if (typeof value !== 'boolean') return 'unavailable'
  return value === passWhen ? 'pass' : 'fail'
}

function captureQualityObservations(input: {
  facts: PitchCentrePilotCaptureQuality
  normalized: readonly NormalizedLandingWindow[]
  landings: readonly PitchCentreLandingResult[]
  captureDurationMilliseconds: number
  task: GuidedTaskConfiguration
}): GuidedQualityObservation[] {
  const coverage = input.landings.reduce(
    (total, landing) => ({
      numerator: total.numerator + landing.confidentCoverage.numeratorFrames,
      denominator:
        total.denominator + landing.confidentCoverage.denominatorFrames,
    }),
    { numerator: 0, denominator: 0 },
  )
  const coverageRatio =
    coverage.denominator > 0 ? coverage.numerator / coverage.denominator : 0
  const exactRepetitionCount =
    input.normalized.length === PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions
  const windowsInOrder = input.normalized.every(
    (window, index) =>
      index === 0 ||
      window.startSeconds >= input.normalized[index - 1].endSeconds,
  )
  const validWindowDuration =
    exactRepetitionCount &&
    windowsInOrder &&
    input.normalized.every(
      (window) =>
        window.valid &&
        meetsLandingWindowDuration(window.startSeconds, window.endSeconds),
    )
  const durationSufficient =
    Number.isFinite(input.captureDurationMilliseconds) &&
    input.captureDurationMilliseconds >= input.task.durationMilliseconds &&
    validWindowDuration
  const noiseStatus =
    input.facts.noiseSeparation === 'sufficient'
      ? 'pass'
      : input.facts.noiseSeparation === 'insufficient'
        ? 'fail'
        : 'unavailable'
  const clippingStatus =
    input.facts.clippingDetected === 'unavailable'
      ? 'unavailable'
      : observedStatus(input.facts.clippingDetected, false)

  return [
    {
      id: 'microphone-continuity',
      status: observedStatus(input.facts.microphoneContinuous, true),
      reasonCode:
        input.facts.microphoneContinuous === true
          ? null
          : 'pitch-centre.microphone-interrupted',
    },
    {
      id: 'clipping',
      status: clippingStatus,
      reasonCode:
        clippingStatus === 'pass'
          ? null
          : clippingStatus === 'fail'
            ? 'pitch-centre.clipping-detected'
            : 'pitch-centre.clipping-unavailable',
    },
    {
      id: 'noise-separation',
      status: noiseStatus,
      reasonCode:
        noiseStatus === 'pass'
          ? null
          : noiseStatus === 'fail'
            ? 'pitch-centre.noise-separation-low'
            : 'pitch-centre.noise-separation-unavailable',
    },
    {
      id: 'signal-coverage',
      status:
        coverageRatio >=
        PITCH_CENTRE_PILOT_THRESHOLDS_V1.minimumConfidentCoverageRatio
          ? 'pass'
          : 'fail',
      reasonCode:
        coverageRatio >=
        PITCH_CENTRE_PILOT_THRESHOLDS_V1.minimumConfidentCoverageRatio
          ? null
          : 'pitch-centre.signal-coverage-low',
    },
    {
      id: 'pitch-confidence',
      status:
        exactRepetitionCount &&
        input.landings.every((landing) => landing.kind === 'measured')
          ? 'pass'
          : 'fail',
      reasonCode:
        exactRepetitionCount &&
        input.landings.every((landing) => landing.kind === 'measured')
          ? null
          : 'pitch-centre.pitch-confidence-low',
    },
    {
      id: 'task-completion',
      status:
        observedStatus(input.facts.taskCompleted, true) === 'pass' &&
        exactRepetitionCount
          ? 'pass'
          : 'fail',
      reasonCode:
        input.facts.taskCompleted === true && exactRepetitionCount
          ? null
          : 'pitch-centre.task-incomplete',
    },
    {
      id: 'duration',
      status: durationSufficient ? 'pass' : 'fail',
      reasonCode: durationSufficient
        ? null
        : 'pitch-centre.duration-insufficient',
    },
    {
      id: 'repetitions',
      status: exactRepetitionCount ? 'pass' : 'fail',
      reasonCode: exactRepetitionCount
        ? null
        : 'pitch-centre.repetitions-incomplete',
    },
    {
      id: 'analysis-capability',
      status:
        typeof input.facts.analysisAvailable !== 'boolean' ||
        !input.facts.analysisAvailable
          ? 'unavailable'
          : 'pass',
      reasonCode:
        input.facts.analysisAvailable === true
          ? null
          : 'pitch-centre.analysis-unavailable',
    },
  ]
}

function fullWindowMoments(
  normalized: readonly NormalizedLandingWindow[],
): GuidedEvidenceMoment[] {
  return normalized
    .filter((window) => window.valid)
    .map((window, index) => ({
      id: `pitch-centre.moment.landing-${index + 1}`,
      startSeconds: window.startSeconds,
      endSeconds: window.endSeconds,
      labelId: 'pitch-centre.evidence.landing-window',
    }))
}

function settlingMoments(
  normalized: readonly NormalizedLandingWindow[],
  landings: readonly PitchCentreLandingResult[],
): GuidedEvidenceMoment[] {
  const moments: GuidedEvidenceMoment[] = []
  for (const [index, landing] of landings.entries()) {
    if (landing.kind !== 'measured') continue
    const window = normalized[index]
    if (window === undefined || !window.valid) continue
    for (const [momentIndex, moment] of landing.evidenceMoments.entries()) {
      moments.push({
        id: `pitch-centre.moment.${index + 1}-${moment.kind}-${momentIndex + 1}`,
        startSeconds: window.startSeconds + moment.startMilliseconds / 1000,
        endSeconds: window.startSeconds + moment.endMilliseconds / 1000,
        labelId: `pitch-centre.evidence.${moment.kind}`,
      })
    }
  }
  return moments
}

function unavailablePitchEvidence(
  id: string,
  measurementKey: string,
): GuidedUnavailableEvidence {
  return {
    id,
    assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
    measurementKey,
    availability: 'unavailable',
    evidenceClass: 'direct-measurement',
    comparisonFamily: 'pitch',
    reason: 'insufficient-signal',
  }
}

function buildEvidence(input: {
  normalized: readonly NormalizedLandingWindow[]
  aggregate: PitchCentreLandingAggregate
  landings: readonly PitchCentreLandingResult[]
}): GuidedEvidence[] {
  const coverageFrames = input.landings.reduce(
    (total, landing) => ({
      numerator: total.numerator + landing.confidentCoverage.numeratorFrames,
      denominator:
        total.denominator + landing.confidentCoverage.denominatorFrames,
    }),
    { numerator: 0, denominator: 0 },
  )
  const coverageConfidence =
    coverageFrames.denominator > 0
      ? coverageFrames.numerator / coverageFrames.denominator
      : 0
  const windowMoments = fullWindowMoments(input.normalized)
  const localSettlingMoments = settlingMoments(input.normalized, input.landings)
  const measuredEvidence: GuidedDirectMeasurementEvidence = {
    id: 'pitch-centre.evidence.measured-landings',
    assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
    measurementKey: 'pitch-centre.measured-landings',
    availability: 'available',
    evidenceClass: 'direct-measurement',
    comparisonFamily: 'pitch',
    measurement: {
      kind: 'fraction',
      numerator: input.aggregate.measuredRepetitions,
      denominator: Math.max(
        PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
        input.aggregate.totalRepetitions,
      ),
      numeratorUnit: 'repetitions',
      denominatorUnit: 'repetitions',
    },
    confidence: coverageConfidence,
    moments: windowMoments,
  }
  const settledEvidence: GuidedDirectMeasurementEvidence = {
    id: 'pitch-centre.evidence.settled-landings',
    assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
    measurementKey: 'pitch-centre.settled-landings',
    availability: 'available',
    evidenceClass: 'direct-measurement',
    comparisonFamily: 'pitch',
    measurement: {
      kind: 'fraction',
      numerator: input.aggregate.settledCoverage.numeratorRepetitions,
      denominator: Math.max(
        PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
        input.aggregate.settledCoverage.denominatorRepetitions,
      ),
      numeratorUnit: 'repetitions',
      denominatorUnit: 'repetitions',
    },
    confidence: coverageConfidence,
    moments: localSettlingMoments,
  }
  const medianErrorEvidence: GuidedEvidence =
    input.aggregate.medianAbsoluteErrorCents === null
      ? unavailablePitchEvidence(
          'pitch-centre.evidence.median-absolute-error',
          'pitch-centre.median-absolute-error',
        )
      : {
          id: 'pitch-centre.evidence.median-absolute-error',
          assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
          measurementKey: 'pitch-centre.median-absolute-error',
          availability: 'available',
          evidenceClass: 'direct-measurement',
          comparisonFamily: 'pitch',
          measurement: {
            kind: 'scalar',
            value: input.aggregate.medianAbsoluteErrorCents,
            unit: 'cents',
          },
          confidence: coverageConfidence,
          moments: localSettlingMoments,
        }
  const settlingTimeEvidence: GuidedEvidence =
    input.aggregate.medianSettledAtMilliseconds === null
      ? unavailablePitchEvidence(
          'pitch-centre.evidence.median-settling-time',
          'pitch-centre.median-settling-time',
        )
      : {
          id: 'pitch-centre.evidence.median-settling-time',
          assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
          measurementKey: 'pitch-centre.median-settling-time',
          availability: 'available',
          evidenceClass: 'direct-measurement',
          comparisonFamily: 'timing',
          measurement: {
            kind: 'scalar',
            value: input.aggregate.medianSettledAtMilliseconds,
            unit: 'milliseconds',
          },
          confidence: coverageConfidence,
          moments: localSettlingMoments,
        }

  return [
    measuredEvidence,
    settledEvidence,
    medianErrorEvidence,
    settlingTimeEvidence,
  ]
}

function shouldReinforcePitchCentre(
  settledRepetitions: number,
  medianAbsoluteErrorCents: number | null,
): boolean {
  return (
    settledRepetitions >=
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.reinforceSettledRepetitions &&
    medianAbsoluteErrorCents !== null &&
    medianAbsoluteErrorCents <=
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.reinforceMedianAbsoluteErrorCents
  )
}

function buildPitchCentrePilotFindings(
  runId: string,
  reinforce: boolean,
): GuidedFinding[] {
  return [
    {
      id: `${runId}.finding.complete-landings`,
      assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
      role: 'positive',
      findingCode: 'pitch-centre.finding.complete-landings',
      evidenceId: 'pitch-centre.evidence.measured-landings',
      confidence: 1,
    },
    {
      id: `${runId}.finding.${reinforce ? 'reinforce' : 'refine'}-centre`,
      assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
      role: 'focus',
      findingCode: reinforce
        ? 'pitch-centre.finding.reinforce-centre'
        : 'pitch-centre.finding.refine-centre',
      evidenceId: 'pitch-centre.evidence.settled-landings',
      confidence: 1,
    },
  ]
}

function buildFindings(
  runId: string,
  aggregate: PitchCentreLandingAggregate,
): GuidedFinding[] {
  return buildPitchCentrePilotFindings(
    runId,
    shouldReinforcePitchCentre(
      aggregate.settledRepetitions,
      aggregate.medianAbsoluteErrorCents,
    ),
  )
}

function recommendationRule(input: {
  id: string
  order: number
  focusFindingCode: string
  recommendationId: string
  reasonId: string
}): GuidedRecommendationRule {
  return {
    id: input.id,
    version: PITCH_CENTRE_PILOT_THRESHOLDS_V1.version,
    order: input.order,
    assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
    primaryEvidenceId: 'pitch-centre.evidence.settled-landings',
    evidenceRequirements: [
      {
        evidenceId: 'pitch-centre.evidence.measured-landings',
        evidenceClass: 'direct-measurement',
        requiredFindingCodes: ['pitch-centre.finding.complete-landings'],
      },
      {
        evidenceId: 'pitch-centre.evidence.settled-landings',
        evidenceClass: 'direct-measurement',
        requiredFindingCodes: [input.focusFindingCode],
      },
    ],
    positiveFinding: {
      evidenceId: 'pitch-centre.evidence.measured-landings',
      findingCode: 'pitch-centre.finding.complete-landings',
    },
    focusFinding: {
      evidenceId: 'pitch-centre.evidence.settled-landings',
      findingCode: input.focusFindingCode,
    },
    recommendation: {
      id: input.recommendationId,
      version: PITCH_CENTRE_PILOT_THRESHOLDS_V1.version,
      exercise: {
        exerciseId: 'pitch-hold',
        exerciseVersion: '1.0.0',
        configuration: {
          configurationId: 'pitch-hold.guided-pitch-centre',
          configurationVersion: '1.0.0',
        },
      },
      reasonId: input.reasonId,
      dose: {
        durationMilliseconds:
          PITCH_CENTRE_PILOT_THRESHOLDS_V1.practiceDurationMilliseconds,
        repetitions: PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions,
        sets: 1,
        comfortableRangeMidiCents: null,
        demand: 'same',
      },
      stopRuleId: 'guided.stop-on-discomfort-v1',
      alternativeRecommendationId: null,
    },
  }
}

export const PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1 = freezeDeep([
  recommendationRule({
    id: 'pitch-centre.rule.reinforce-centre',
    order: 10,
    focusFindingCode: 'pitch-centre.finding.reinforce-centre',
    recommendationId: 'pitch-centre.recommendation.pitch-hold-reinforce',
    reasonId: 'pitch-centre.reason.reinforce-centred-landings',
  }),
  recommendationRule({
    id: 'pitch-centre.rule.refine-centre',
    order: 20,
    focusFindingCode: 'pitch-centre.finding.refine-centre',
    recommendationId: 'pitch-centre.recommendation.pitch-hold-refine',
    reasonId: 'pitch-centre.reason.refine-centred-landings',
  }),
] as const)

const PITCH_CENTRE_PILOT_QUALITY_OBSERVATIONS = freezeDeep([
  {
    id: 'microphone-continuity',
    required: true,
    failureDisposition: 'retry-recording',
  },
  { id: 'clipping', required: true, failureDisposition: 'retry-recording' },
  { id: 'noise-separation', required: false, failureDisposition: null },
  {
    id: 'signal-coverage',
    required: true,
    failureDisposition: 'retry-recording',
  },
  {
    id: 'pitch-confidence',
    required: true,
    failureDisposition: 'retry-recording',
  },
  {
    id: 'task-completion',
    required: true,
    failureDisposition: 'retry-recording',
  },
  { id: 'duration', required: true, failureDisposition: 'retry-recording' },
  {
    id: 'repetitions',
    required: true,
    failureDisposition: 'retry-recording',
  },
  {
    id: 'analysis-capability',
    required: true,
    failureDisposition: 'unavailable-here',
  },
] as const)

function isCanonicalPersistedQuality(
  quality: GuidedQualityGateResult,
): boolean {
  if (
    !hasExactKeys(quality, [
      'outcome',
      'observations',
      'blockingCheckIds',
      'partialCheckIds',
    ]) ||
    !Array.isArray(quality.observations) ||
    quality.observations.length !==
      PITCH_CENTRE_PILOT_QUALITY_OBSERVATIONS.length
  ) {
    return false
  }

  for (const [index, observation] of quality.observations.entries()) {
    const expected = PITCH_CENTRE_PILOT_QUALITY_OBSERVATIONS[index]
    if (
      expected === undefined ||
      !hasExactKeys(observation, [
        'id',
        'status',
        'reasonCode',
        'required',
        'failureDisposition',
      ]) ||
      observation.id !== expected.id ||
      observation.required !== expected.required ||
      observation.failureDisposition !== expected.failureDisposition
    ) {
      return false
    }

    if (observation.id === 'noise-separation') {
      const validNoise =
        (observation.status === 'pass' && observation.reasonCode === null) ||
        (observation.status === 'fail' &&
          observation.reasonCode === 'pitch-centre.noise-separation-low') ||
        (observation.status === 'unavailable' &&
          observation.reasonCode ===
            'pitch-centre.noise-separation-unavailable')
      if (!validNoise) return false
    } else if (
      observation.status !== 'pass' ||
      observation.reasonCode !== null
    ) {
      return false
    }
  }

  const recomputed = evaluateGuidedQualityGate(
    PITCH_CENTRE_PILOT_DEFINITION_V1.requiredQualityChecks,
    quality.observations.map(({ id, status, reasonCode }) => ({
      id,
      status,
      reasonCode,
    })),
  )
  return (
    (quality.outcome === 'ready' || quality.outcome === 'partial') &&
    sameJsonValue(quality, recomputed)
  )
}

interface PersistedFractionEvidence {
  numerator: number
  denominator: number
  confidence: number
  moments: readonly unknown[]
}

interface PersistedScalarEvidence {
  value: number
  confidence: number
  moments: readonly unknown[]
}

function readPersistedFractionEvidence(
  value: unknown,
  expected: {
    id: string
    measurementKey: string
    comparisonFamily: 'pitch' | 'timing'
  },
): PersistedFractionEvidence | null {
  if (
    !hasExactKeys(value, [
      'id',
      'assessmentId',
      'measurementKey',
      'availability',
      'evidenceClass',
      'comparisonFamily',
      'measurement',
      'confidence',
      'moments',
    ]) ||
    value.id !== expected.id ||
    value.assessmentId !== PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId ||
    value.measurementKey !== expected.measurementKey ||
    value.availability !== 'available' ||
    value.evidenceClass !== 'direct-measurement' ||
    value.comparisonFamily !== expected.comparisonFamily ||
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    !Array.isArray(value.moments) ||
    !hasExactKeys(value.measurement, [
      'kind',
      'numerator',
      'denominator',
      'numeratorUnit',
      'denominatorUnit',
    ]) ||
    value.measurement.kind !== 'fraction' ||
    typeof value.measurement.numerator !== 'number' ||
    !Number.isSafeInteger(value.measurement.numerator) ||
    typeof value.measurement.denominator !== 'number' ||
    !Number.isSafeInteger(value.measurement.denominator) ||
    value.measurement.numeratorUnit !== 'repetitions' ||
    value.measurement.denominatorUnit !== 'repetitions'
  ) {
    return null
  }

  return {
    numerator: value.measurement.numerator,
    denominator: value.measurement.denominator,
    confidence: value.confidence,
    moments: value.moments,
  }
}

function readPersistedScalarEvidence(
  value: unknown,
  expected: {
    id: string
    measurementKey: string
    comparisonFamily: 'pitch' | 'timing'
    unit: 'cents' | 'milliseconds'
  },
): PersistedScalarEvidence | null {
  if (
    !hasExactKeys(value, [
      'id',
      'assessmentId',
      'measurementKey',
      'availability',
      'evidenceClass',
      'comparisonFamily',
      'measurement',
      'confidence',
      'moments',
    ]) ||
    value.id !== expected.id ||
    value.assessmentId !== PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId ||
    value.measurementKey !== expected.measurementKey ||
    value.availability !== 'available' ||
    value.evidenceClass !== 'direct-measurement' ||
    value.comparisonFamily !== expected.comparisonFamily ||
    typeof value.confidence !== 'number' ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    !Array.isArray(value.moments) ||
    !hasExactKeys(value.measurement, ['kind', 'value', 'unit']) ||
    value.measurement.kind !== 'scalar' ||
    typeof value.measurement.value !== 'number' ||
    !Number.isFinite(value.measurement.value) ||
    value.measurement.value < 0 ||
    value.measurement.unit !== expected.unit
  ) {
    return null
  }

  return {
    value: value.measurement.value,
    confidence: value.confidence,
    moments: value.moments,
  }
}

function isPersistedUnavailableEvidence(
  value: unknown,
  expected: {
    id: string
    measurementKey: string
    comparisonFamily: 'pitch' | 'timing'
  },
): boolean {
  return (
    hasExactKeys(value, [
      'id',
      'assessmentId',
      'measurementKey',
      'availability',
      'evidenceClass',
      'comparisonFamily',
      'reason',
    ]) &&
    value.id === expected.id &&
    value.assessmentId === PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId &&
    value.measurementKey === expected.measurementKey &&
    value.availability === 'unavailable' &&
    value.evidenceClass === 'direct-measurement' &&
    value.comparisonFamily === expected.comparisonFamily &&
    value.reason === 'insufficient-signal'
  )
}

function isPersistedMoment(
  value: unknown,
  expected: { id: string; labelId: string },
  captureDurationSeconds: number,
): value is Record<string, unknown> & {
  startSeconds: number
  endSeconds: number
} {
  return (
    hasExactKeys(value, ['id', 'startSeconds', 'endSeconds', 'labelId']) &&
    value.id === expected.id &&
    value.labelId === expected.labelId &&
    typeof value.startSeconds === 'number' &&
    Number.isFinite(value.startSeconds) &&
    typeof value.endSeconds === 'number' &&
    Number.isFinite(value.endSeconds) &&
    value.startSeconds >= 0 &&
    value.endSeconds >= value.startSeconds &&
    value.endSeconds <= captureDurationSeconds
  )
}

function readPersistedPitchCentreEvidence(input: {
  evidence: readonly GuidedEvidence[]
  captureDurationSeconds: number
}): {
  settledRepetitions: number
  medianAbsoluteErrorCents: number | null
} | null {
  if (input.evidence.length !== 4) return null
  const evidenceValidation = validateGuidedEvidenceContract({
    assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
    captureDurationSeconds: input.captureDurationSeconds,
    evidence: input.evidence,
  })
  if (!evidenceValidation.valid) return null

  const measured = readPersistedFractionEvidence(input.evidence[0], {
    id: 'pitch-centre.evidence.measured-landings',
    measurementKey: 'pitch-centre.measured-landings',
    comparisonFamily: 'pitch',
  })
  const settled = readPersistedFractionEvidence(input.evidence[1], {
    id: 'pitch-centre.evidence.settled-landings',
    measurementKey: 'pitch-centre.settled-landings',
    comparisonFamily: 'pitch',
  })
  if (
    measured === null ||
    settled === null ||
    measured.numerator !== PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions ||
    measured.denominator !== PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions ||
    settled.denominator !== PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions ||
    settled.numerator < 0 ||
    settled.numerator > settled.denominator ||
    measured.confidence <
      PITCH_CENTRE_PILOT_THRESHOLDS_V1.minimumConfidentCoverageRatio ||
    settled.confidence !== measured.confidence ||
    measured.moments.length !== PITCH_CENTRE_PILOT_THRESHOLDS_V1.repetitions
  ) {
    return null
  }

  const landingMoments: Array<{
    startSeconds: number
    endSeconds: number
  }> = []
  for (const [index, moment] of measured.moments.entries()) {
    if (
      !isPersistedMoment(
        moment,
        {
          id: `pitch-centre.moment.landing-${index + 1}`,
          labelId: 'pitch-centre.evidence.landing-window',
        },
        input.captureDurationSeconds,
      ) ||
      !meetsLandingWindowDuration(moment.startSeconds, moment.endSeconds) ||
      (index > 0 && moment.startSeconds < landingMoments[index - 1].endSeconds)
    ) {
      return null
    }
    landingMoments.push({
      startSeconds: moment.startSeconds,
      endSeconds: moment.endSeconds,
    })
  }

  const settlementKindsByLanding = new Map<
    number,
    Array<'approach' | 'settling-window'>
  >()
  const lastMomentByLanding = new Map<number, { endSeconds: number }>()
  let previousLandingIndex = 0
  for (const moment of settled.moments) {
    if (!isRecord(moment) || typeof moment.id !== 'string') return null
    const match =
      /^pitch-centre\.moment\.([1-3])-(approach|settling-window)-([1-2])$/.exec(
        moment.id,
      )
    if (match === null) return null
    const landingIndex = Number(match[1])
    const kind = match[2] as 'approach' | 'settling-window'
    const momentIndex = Number(match[3])
    const landing = landingMoments[landingIndex - 1]
    const kinds = settlementKindsByLanding.get(landingIndex) ?? []
    if (
      landing === undefined ||
      landingIndex < previousLandingIndex ||
      momentIndex !== kinds.length + 1 ||
      (kind === 'approach' && kinds.length !== 0) ||
      (kind === 'settling-window' && kinds.includes('settling-window')) ||
      !isPersistedMoment(
        moment,
        {
          id: moment.id,
          labelId: `pitch-centre.evidence.${kind}`,
        },
        input.captureDurationSeconds,
      ) ||
      moment.startSeconds < landing.startSeconds ||
      moment.endSeconds > landing.endSeconds ||
      (lastMomentByLanding.get(landingIndex)?.endSeconds ?? 0) >
        moment.startSeconds
    ) {
      return null
    }
    kinds.push(kind)
    settlementKindsByLanding.set(landingIndex, kinds)
    lastMomentByLanding.set(landingIndex, { endSeconds: moment.endSeconds })
    previousLandingIndex = landingIndex
  }
  if (
    settlementKindsByLanding.size !== settled.numerator ||
    [...settlementKindsByLanding.values()].some(
      (kinds) => kinds.at(-1) !== 'settling-window',
    )
  ) {
    return null
  }

  const medianErrorExpected = {
    id: 'pitch-centre.evidence.median-absolute-error',
    measurementKey: 'pitch-centre.median-absolute-error',
    comparisonFamily: 'pitch' as const,
    unit: 'cents' as const,
  }
  const settlingTimeExpected = {
    id: 'pitch-centre.evidence.median-settling-time',
    measurementKey: 'pitch-centre.median-settling-time',
    comparisonFamily: 'timing' as const,
    unit: 'milliseconds' as const,
  }
  if (settled.numerator === 0) {
    return isPersistedUnavailableEvidence(
      input.evidence[2],
      medianErrorExpected,
    ) &&
      isPersistedUnavailableEvidence(input.evidence[3], {
        ...settlingTimeExpected,
        comparisonFamily: 'pitch',
      })
      ? { settledRepetitions: 0, medianAbsoluteErrorCents: null }
      : null
  }

  const medianError = readPersistedScalarEvidence(
    input.evidence[2],
    medianErrorExpected,
  )
  const medianSettlingTime = readPersistedScalarEvidence(
    input.evidence[3],
    settlingTimeExpected,
  )
  if (
    medianError === null ||
    medianSettlingTime === null ||
    medianError.confidence !== measured.confidence ||
    medianSettlingTime.confidence !== measured.confidence ||
    !sameJsonValue(medianError.moments, settled.moments) ||
    !sameJsonValue(medianSettlingTime.moments, settled.moments)
  ) {
    return null
  }

  return {
    settledRepetitions: settled.numerator,
    medianAbsoluteErrorCents: medianError.value,
  }
}

/**
 * Revalidate a parsed Focus Take against the exact deterministic pilot output.
 * Generic contract validity is necessary but not sufficient at this boundary:
 * persisted JSON must still describe a result this versioned assessor can emit.
 */
export function isPersistedPitchCentrePilotFocus(input: {
  assessment: GuidedPersistedAssessmentContext
  reading: GuidedFocusReading
  captureDurationSeconds: number
}): boolean {
  try {
    return validatesPersistedPitchCentrePilotFocus(input)
  } catch {
    return false
  }
}

function validatesPersistedPitchCentrePilotFocus(input: {
  assessment: GuidedPersistedAssessmentContext
  reading: GuidedFocusReading
  captureDurationSeconds: number
}): boolean {
  const assessment = input.assessment
  if (
    !Number.isFinite(input.captureDurationSeconds) ||
    input.captureDurationSeconds <= 0 ||
    !hasExactKeys(assessment, [
      'runId',
      'identity',
      'task',
      'captureSource',
      'comparisonFingerprint',
      'quality',
      'evidence',
      'recommendation',
      'singerEffort',
      'captureContext',
    ]) ||
    !isGuidedIdentifier(assessment.runId) ||
    assessment.captureSource !== 'dry-microphone' ||
    !isPitchCentrePilotProtocol({
      identity: assessment.identity,
      task: assessment.task,
      comparisonFingerprint: assessment.comparisonFingerprint,
    }) ||
    input.captureDurationSeconds * 1000 <
      assessment.task.durationMilliseconds ||
    !isCanonicalPersistedQuality(assessment.quality) ||
    assessment.recommendation === null ||
    (assessment.singerEffort !== 'easy' &&
      assessment.singerEffort !== 'workable' &&
      assessment.singerEffort !== 'effortful') ||
    !hasExactKeys(assessment.captureContext, [
      'inputContextKey',
      'detectorId',
      'detectorVersion',
      'sampleRateHz',
    ]) ||
    !validCaptureContext(assessment.captureContext)
  ) {
    return false
  }

  const evidenceSummary = readPersistedPitchCentreEvidence({
    evidence: assessment.evidence,
    captureDurationSeconds: input.captureDurationSeconds,
  })
  if (evidenceSummary === null) return false

  const findings = buildPitchCentrePilotFindings(
    assessment.runId,
    shouldReinforcePitchCentre(
      evidenceSummary.settledRepetitions,
      evidenceSummary.medianAbsoluteErrorCents,
    ),
  )
  const outcome = resolveGuidedRecommendationOutcome(
    {
      definition: PITCH_CENTRE_PILOT_DEFINITION_V1,
      quality: assessment.quality,
      safety: {
        preCapture: 'proceed',
        singerEffort: assessment.singerEffort,
      },
      evidence: assessment.evidence,
      findings,
      analysisFailureReasonCode: null,
      originatingCapture: {
        assessmentRunId: assessment.runId,
        protocol: {
          identity: assessment.identity,
          task: assessment.task,
          comparisonFingerprint: assessment.comparisonFingerprint,
        },
      },
    },
    PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1,
  )
  if (outcome.kind !== 'focus-reading') return false

  return (
    validateGuidedFocusReadingContract({
      assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
      captureDurationSeconds: input.captureDurationSeconds,
      evidence: assessment.evidence,
      reading: input.reading,
    }).valid &&
    sameJsonValue(input.reading, outcome.reading) &&
    sameJsonValue(assessment.recommendation, outcome.reading.recommendation)
  )
}

function unavailableQuality(): GuidedQualityGateResult {
  return evaluateGuidedQualityGate(
    PITCH_CENTRE_PILOT_DEFINITION_V1.requiredQualityChecks,
    [],
  )
}

function failedAssessment(
  protocol: Readonly<GuidedRetakeProtocol>,
  reasonCode: string,
): PitchCentrePilotAssessmentResult {
  return freezeDeep({
    definition: PITCH_CENTRE_PILOT_DEFINITION_V1,
    protocol: cloneProtocol(protocol),
    landings: [],
    aggregate: aggregatePitchCentreLandings([]),
    quality: unavailableQuality(),
    evidence: [],
    findings: [],
    outcome: { kind: 'analysis-failed', reasonCode },
    persistedContext: null,
    reading: null,
  })
}

/**
 * Resolve one complete pilot run. All frame times are normalized per landing
 * before measurement, then converted back to full-recording evidence moments.
 */
export function assessPitchCentrePilot(
  input: PitchCentrePilotAssessmentInput,
): PitchCentrePilotAssessmentResult {
  if (
    !isGuidedIdentifier(input.runId) ||
    !isPitchCentrePilotProtocol(input.protocol) ||
    !Number.isFinite(input.captureDurationMilliseconds) ||
    input.captureDurationMilliseconds <= 0 ||
    !validCaptureContext(input.captureContext) ||
    !validSafetyContext(input.safety)
  ) {
    return failedAssessment(
      input.protocol,
      'pitch-centre.invalid-assessment-input',
    )
  }

  try {
    const protocol = cloneProtocol(input.protocol)
    const captureDurationSeconds = input.captureDurationMilliseconds / 1000
    const normalized = input.landingWindows.map((window) =>
      normalizeLandingWindow(window, captureDurationSeconds),
    )
    const landings = normalized.map((window, index) =>
      measurePitchCentreLanding(
        window.frames,
        protocol.task.targetMidiCents[index] ?? 0,
        PITCH_CENTRE_PILOT_THRESHOLDS_V1.measurement,
      ),
    )
    const aggregate = aggregatePitchCentreLandings(landings)
    const quality = evaluateGuidedQualityGate(
      PITCH_CENTRE_PILOT_DEFINITION_V1.requiredQualityChecks,
      captureQualityObservations({
        facts: input.quality,
        normalized,
        landings,
        captureDurationMilliseconds: input.captureDurationMilliseconds,
        task: protocol.task,
      }),
    )
    const evidence = buildEvidence({ normalized, aggregate, landings })
    const findings = buildFindings(input.runId, aggregate)
    const outcome = resolveGuidedRecommendationOutcome(
      {
        definition: PITCH_CENTRE_PILOT_DEFINITION_V1,
        quality,
        safety: input.safety,
        evidence,
        findings,
        analysisFailureReasonCode: null,
        originatingCapture: {
          assessmentRunId: input.runId,
          protocol,
        },
      },
      PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1,
    )
    const evidenceValidation = validateGuidedEvidenceContract({
      assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
      captureDurationSeconds,
      evidence,
    })
    const reading = outcome.kind === 'focus-reading' ? outcome.reading : null
    const readingValidation =
      reading === null
        ? null
        : validateGuidedFocusReadingContract({
            assessmentId: PITCH_CENTRE_PILOT_IDENTITY_V1.assessmentId,
            captureDurationSeconds,
            evidence,
            reading,
          })
    if (
      !evidenceValidation.valid ||
      (readingValidation !== null && !readingValidation.valid)
    ) {
      return failedAssessment(
        input.protocol,
        'pitch-centre.contract-validation-failed',
      )
    }

    const persistedContext: GuidedPersistedAssessmentContext | null =
      outcome.kind === 'focus-reading'
        ? {
            runId: input.runId,
            identity: { ...protocol.identity },
            task: protocol.task,
            captureSource: 'dry-microphone',
            comparisonFingerprint: protocol.comparisonFingerprint,
            quality,
            evidence,
            recommendation: outcome.reading.recommendation,
            singerEffort: input.safety.singerEffort,
            captureContext: { ...input.captureContext },
          }
        : null

    return freezeDeep({
      definition: PITCH_CENTRE_PILOT_DEFINITION_V1,
      protocol,
      landings,
      aggregate,
      quality,
      evidence,
      findings,
      outcome,
      persistedContext,
      reading,
    })
  } catch {
    return failedAssessment(input.protocol, 'pitch-centre.analysis-failed')
  }
}
