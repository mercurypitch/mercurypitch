// ============================================================
// Pitch Centre persistence validation — deterministic Focus Take revalidation
// ============================================================
//
// Parsed IndexedDB JSON must still describe an exact result this assessor can
// emit. These checks reject structurally valid but non-canonical pilot data.

import type { GuidedEvidence, GuidedFocusReading, GuidedPersistedAssessmentContext, GuidedQualityGateResult, } from './contracts'
import { isGuidedIdentifier } from './identifiers'
import { buildPitchCentrePilotFindings, shouldReinforcePitchCentre, } from './pitch-centre-assessment-evidence'
import { meetsPitchCentreLandingWindowDuration, PITCH_CENTRE_PILOT_DEFINITION_V1, PITCH_CENTRE_PILOT_IDENTITY_V1, PITCH_CENTRE_PILOT_RECOMMENDATION_RULES_V1, PITCH_CENTRE_PILOT_THRESHOLDS_V1, } from './pitch-centre-assessment-policy'
import { isPitchCentrePilotProtocol } from './pitch-centre-assessment-protocol'
import { validCaptureContext } from './pitch-centre-assessment-quality'
import { hasExactKeys, isRecord, sameJsonValue, } from './pitch-centre-assessment-utils'
import { evaluateGuidedQualityGate } from './quality-gate'
import { resolveGuidedRecommendationOutcome } from './recommendations'
import { validateGuidedEvidenceContract, validateGuidedFocusReadingContract, } from './validation'

const PITCH_CENTRE_PILOT_QUALITY_OBSERVATIONS = [
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
] as const

function isCanonicalQualityObservation(
  observation: unknown,
  expected: (typeof PITCH_CENTRE_PILOT_QUALITY_OBSERVATIONS)[number],
): boolean {
  if (
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

  if (observation.id !== 'noise-separation') {
    return observation.status === 'pass' && observation.reasonCode === null
  }
  return (
    (observation.status === 'pass' && observation.reasonCode === null) ||
    (observation.status === 'fail' &&
      observation.reasonCode === 'pitch-centre.noise-separation-low') ||
    (observation.status === 'unavailable' &&
      observation.reasonCode === 'pitch-centre.noise-separation-unavailable')
  )
}

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

  const observationsAreCanonical = quality.observations.every(
    (observation, index) => {
      const expected = PITCH_CENTRE_PILOT_QUALITY_OBSERVATIONS[index]
      return (
        expected !== undefined &&
        isCanonicalQualityObservation(observation, expected)
      )
    },
  )
  if (!observationsAreCanonical) return false

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

interface PersistedLandingMoment {
  startSeconds: number
  endSeconds: number
}

function readPersistedLandingMoments(
  moments: readonly unknown[],
  captureDurationSeconds: number,
): PersistedLandingMoment[] | null {
  const landingMoments: PersistedLandingMoment[] = []
  for (const [index, moment] of moments.entries()) {
    const previousMoment = landingMoments[index - 1]
    if (
      !isPersistedMoment(
        moment,
        {
          id: `pitch-centre.moment.landing-${index + 1}`,
          labelId: 'pitch-centre.evidence.landing-window',
        },
        captureDurationSeconds,
      ) ||
      !meetsPitchCentreLandingWindowDuration(
        moment.startSeconds,
        moment.endSeconds,
      ) ||
      (previousMoment !== undefined &&
        moment.startSeconds < previousMoment.endSeconds)
    ) {
      return null
    }
    landingMoments.push({
      startSeconds: moment.startSeconds,
      endSeconds: moment.endSeconds,
    })
  }
  return landingMoments
}

function hasCanonicalSettlingMoments(input: {
  moments: readonly unknown[]
  landingMoments: readonly PersistedLandingMoment[]
  settledRepetitions: number
  captureDurationSeconds: number
}): boolean {
  const settlementKindsByLanding = new Map<
    number,
    Array<'approach' | 'settling-window'>
  >()
  const lastMomentByLanding = new Map<number, { endSeconds: number }>()
  let previousLandingIndex = 0
  for (const moment of input.moments) {
    if (!isRecord(moment) || typeof moment.id !== 'string') return false
    const match =
      /^pitch-centre\.moment\.([1-3])-(approach|settling-window)-([1-2])$/.exec(
        moment.id,
      )
    if (match === null) return false
    const landingIndex = Number(match[1])
    const kind = match[2] as 'approach' | 'settling-window'
    const momentIndex = Number(match[3])
    const landing = input.landingMoments[landingIndex - 1]
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
      return false
    }
    kinds.push(kind)
    settlementKindsByLanding.set(landingIndex, kinds)
    lastMomentByLanding.set(landingIndex, { endSeconds: moment.endSeconds })
    previousLandingIndex = landingIndex
  }
  return (
    settlementKindsByLanding.size === input.settledRepetitions &&
    [...settlementKindsByLanding.values()].every(
      (kinds) => kinds.at(-1) === 'settling-window',
    )
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

  const landingMoments = readPersistedLandingMoments(
    measured.moments,
    input.captureDurationSeconds,
  )
  if (
    landingMoments === null ||
    !hasCanonicalSettlingMoments({
      moments: settled.moments,
      landingMoments,
      settledRepetitions: settled.numerator,
      captureDurationSeconds: input.captureDurationSeconds,
    })
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
