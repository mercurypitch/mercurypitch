// ============================================================
// Guided Voice validation — fail closed at persisted-data boundaries
// ============================================================
//
// TypeScript describes trusted in-memory contracts; kept takes and worker
// responses still need runtime checks. These validators report every detected
// contract violation in stable traversal order and never repair input.

import { buildGuidedComparisonFingerprint } from './comparison'
import type { GuidedProtocolIdentity, GuidedTaskConfiguration, } from './contracts'
import { isGuidedIdentifier } from './identifiers'

export type GuidedContractViolationCode =
  | 'invalid-capture-duration'
  | 'invalid-evidence'
  | 'invalid-evidence-id'
  | 'duplicate-evidence-id'
  | 'assessment-mismatch'
  | 'invalid-measurement'
  | 'nonfinite-measurement'
  | 'invalid-measurement-unit'
  | 'invalid-fraction'
  | 'invalid-confidence'
  | 'invalid-comparison-family'
  | 'missing-proxy-caveat'
  | 'invalid-proxy-input-sensitivity'
  | 'invalid-evidence-moment'
  | 'duplicate-evidence-moment-id'
  | 'malformed-focus-reading'
  | 'invalid-primary-evidence'
  | 'dangling-evidence-reference'
  | 'unavailable-evidence-reference'
  | 'malformed-recommendation'

export interface GuidedContractViolation {
  code: GuidedContractViolationCode
  path: string
}

export interface GuidedContractValidation {
  valid: boolean
  violations: readonly GuidedContractViolation[]
}

export interface GuidedEvidenceValidationInput {
  assessmentId: string
  captureDurationSeconds: number
  /** Unknown is intentional: kept evidence may come from parsed JSON. */
  evidence: readonly unknown[]
}

export interface GuidedFocusReadingValidationInput extends GuidedEvidenceValidationInput {
  /** Unknown is intentional: this boundary may receive parsed persisted JSON. */
  reading: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const GUIDED_MEASUREMENT_UNITS = new Set([
  'cents',
  'milliseconds',
  'seconds',
  'ratio',
  'count',
  'hertz',
  'decibels',
  'relative-level',
])

const GUIDED_FRACTION_UNITS = new Set([
  'frames',
  'milliseconds',
  'seconds',
  'repetitions',
  'targets',
])

const GUIDED_COMPARISON_FAMILIES = new Set([
  'pitch',
  'timing',
  'relative-level',
  'spectrum',
])

const GUIDED_SINGER_EFFORTS = new Set([
  'easy',
  'workable',
  'effortful',
  'uncomfortable',
])

const GUIDED_UNAVAILABLE_REASONS = new Set([
  'insufficient-signal',
  'insufficient-duration',
  'insufficient-repetitions',
  'unsupported-capability',
  'quality-gate',
])

const GUIDED_NOT_MEASURED_REASONS = new Set([
  'outside-task-contract',
  'unsupported-construct',
])

function pushViolation(
  violations: GuidedContractViolation[],
  code: GuidedContractViolationCode,
  path: string,
): void {
  violations.push({ code, path })
}

function validateConfidence(
  confidence: unknown,
  path: string,
  violations: GuidedContractViolation[],
): void {
  if (!isFiniteNumber(confidence) || confidence < 0 || confidence > 1) {
    pushViolation(violations, 'invalid-confidence', path)
  }
}

function validateEvidenceMeasurement(
  evidence: Record<string, unknown>,
  path: string,
  violations: GuidedContractViolation[],
): void {
  const measurement: unknown = evidence.measurement
  if (!isRecord(measurement)) {
    pushViolation(violations, 'invalid-measurement', `${path}.measurement`)
    return
  }

  if (measurement.kind === 'scalar') {
    if (!isFiniteNumber(measurement.value)) {
      pushViolation(
        violations,
        'nonfinite-measurement',
        `${path}.measurement.value`,
      )
    }
    if (
      typeof measurement.unit !== 'string' ||
      !GUIDED_MEASUREMENT_UNITS.has(measurement.unit)
    ) {
      pushViolation(
        violations,
        'invalid-measurement-unit',
        `${path}.measurement.unit`,
      )
    }
    return
  }
  if (measurement.kind !== 'fraction') {
    pushViolation(violations, 'invalid-measurement', `${path}.measurement`)
    return
  }

  const validFraction =
    isFiniteNumber(measurement.numerator) &&
    isFiniteNumber(measurement.denominator) &&
    measurement.numerator >= 0 &&
    measurement.denominator > 0 &&
    measurement.numerator <= measurement.denominator &&
    typeof measurement.numeratorUnit === 'string' &&
    GUIDED_FRACTION_UNITS.has(measurement.numeratorUnit) &&
    typeof measurement.denominatorUnit === 'string' &&
    GUIDED_FRACTION_UNITS.has(measurement.denominatorUnit) &&
    measurement.numeratorUnit === measurement.denominatorUnit
  if (!validFraction) {
    pushViolation(violations, 'invalid-fraction', `${path}.measurement`)
  }
}

function validateEvidenceMoments(
  evidence: Record<string, unknown>,
  path: string,
  captureDurationSeconds: number | null,
  violations: GuidedContractViolation[],
): void {
  const momentIds = new Set<string>()
  const moments: unknown = evidence.moments
  if (!Array.isArray(moments)) {
    pushViolation(violations, 'invalid-evidence-moment', `${path}.moments`)
    return
  }

  for (const [index, moment] of moments.entries()) {
    const momentPath = `${path}.moments[${index}]`
    if (!isRecord(moment)) {
      pushViolation(violations, 'invalid-evidence-moment', momentPath)
      continue
    }
    if (isNonemptyString(moment.id)) {
      if (momentIds.has(moment.id)) {
        pushViolation(
          violations,
          'duplicate-evidence-moment-id',
          `${momentPath}.id`,
        )
      } else {
        momentIds.add(moment.id)
      }
    }
    const validBounds =
      isFiniteNumber(moment.startSeconds) &&
      isFiniteNumber(moment.endSeconds) &&
      moment.startSeconds >= 0 &&
      moment.endSeconds >= moment.startSeconds &&
      (captureDurationSeconds === null ||
        moment.endSeconds <= captureDurationSeconds)
    if (
      !isNonemptyString(moment.id) ||
      !isGuidedIdentifier(moment.labelId) ||
      !validBounds
    ) {
      pushViolation(violations, 'invalid-evidence-moment', momentPath)
    }
  }
}

function validateComparisonFamily(
  value: unknown,
  path: string,
  allowNull: boolean,
  violations: GuidedContractViolation[],
): void {
  if (
    (allowNull && value === null) ||
    (typeof value === 'string' && GUIDED_COMPARISON_FAMILIES.has(value))
  ) {
    return
  }
  pushViolation(violations, 'invalid-comparison-family', path)
}

function validateAvailableNumericEvidence(
  evidence: Record<string, unknown>,
  path: string,
  violations: GuidedContractViolation[],
): void {
  validateEvidenceMeasurement(evidence, path, violations)
  validateConfidence(evidence.confidence, `${path}.confidence`, violations)
  validateComparisonFamily(
    evidence.comparisonFamily,
    `${path}.comparisonFamily`,
    false,
    violations,
  )

  if (evidence.evidenceClass !== 'contextual-acoustic-proxy') return

  if (!isGuidedIdentifier(evidence.caveatId)) {
    pushViolation(violations, 'missing-proxy-caveat', `${path}.caveatId`)
  }
  if (
    evidence.inputSensitivity !== 'input-sensitive' &&
    evidence.inputSensitivity !== 'input-stable'
  ) {
    pushViolation(
      violations,
      'invalid-proxy-input-sensitivity',
      `${path}.inputSensitivity`,
    )
  }
}

function validateAvailableSingerReport(
  evidence: Record<string, unknown>,
  path: string,
  violations: GuidedContractViolation[],
): void {
  if (evidence.comparisonFamily !== null) {
    pushViolation(
      violations,
      'invalid-comparison-family',
      `${path}.comparisonFamily`,
    )
  }
  if (
    typeof evidence.value !== 'string' ||
    !GUIDED_SINGER_EFFORTS.has(evidence.value)
  ) {
    pushViolation(violations, 'invalid-evidence', `${path}.value`)
  }
}

function validateUnavailableEvidence(
  evidence: Record<string, unknown>,
  path: string,
  violations: GuidedContractViolation[],
): void {
  if (
    evidence.evidenceClass === 'direct-measurement' ||
    evidence.evidenceClass === 'contextual-acoustic-proxy'
  ) {
    validateComparisonFamily(
      evidence.comparisonFamily,
      `${path}.comparisonFamily`,
      true,
      violations,
    )
    if (
      typeof evidence.reason !== 'string' ||
      !GUIDED_UNAVAILABLE_REASONS.has(evidence.reason)
    ) {
      pushViolation(violations, 'invalid-evidence', `${path}.reason`)
    }
    return
  }

  if (evidence.evidenceClass === 'not-measured') {
    if (evidence.comparisonFamily !== null) {
      pushViolation(
        violations,
        'invalid-comparison-family',
        `${path}.comparisonFamily`,
      )
    }
    if (
      typeof evidence.reason !== 'string' ||
      !GUIDED_NOT_MEASURED_REASONS.has(evidence.reason)
    ) {
      pushViolation(violations, 'invalid-evidence', `${path}.reason`)
    }
    return
  }

  pushViolation(violations, 'invalid-evidence', `${path}.evidenceClass`)
}

function collectEvidenceViolations(
  input: GuidedEvidenceValidationInput,
): GuidedContractViolation[] {
  const violations: GuidedContractViolation[] = []
  const validCaptureDuration =
    Number.isFinite(input.captureDurationSeconds) &&
    input.captureDurationSeconds > 0
  if (!validCaptureDuration) {
    pushViolation(
      violations,
      'invalid-capture-duration',
      'captureDurationSeconds',
    )
  }

  if (!Array.isArray(input.evidence)) {
    pushViolation(violations, 'invalid-evidence', 'evidence')
    return violations
  }

  const evidenceIds = new Set<string>()
  for (const [index, evidence] of input.evidence.entries()) {
    const path = `evidence[${index}]`
    if (!isRecord(evidence)) {
      pushViolation(violations, 'invalid-evidence', path)
      continue
    }

    if (!isNonemptyString(evidence.id)) {
      pushViolation(violations, 'invalid-evidence-id', `${path}.id`)
    } else if (evidenceIds.has(evidence.id)) {
      pushViolation(violations, 'duplicate-evidence-id', `${path}.id`)
    } else {
      evidenceIds.add(evidence.id)
    }

    if (evidence.assessmentId !== input.assessmentId) {
      pushViolation(violations, 'assessment-mismatch', `${path}.assessmentId`)
    }
    if (!isNonemptyString(evidence.measurementKey)) {
      pushViolation(violations, 'invalid-evidence', `${path}.measurementKey`)
    }

    if (evidence.availability === 'available') {
      validateEvidenceMoments(
        evidence,
        path,
        validCaptureDuration ? input.captureDurationSeconds : null,
        violations,
      )
      if (
        evidence.evidenceClass === 'direct-measurement' ||
        evidence.evidenceClass === 'contextual-acoustic-proxy'
      ) {
        validateAvailableNumericEvidence(evidence, path, violations)
      } else if (evidence.evidenceClass === 'singer-report') {
        validateAvailableSingerReport(evidence, path, violations)
      } else {
        pushViolation(violations, 'invalid-evidence', `${path}.evidenceClass`)
      }
    } else if (evidence.availability === 'unavailable') {
      validateUnavailableEvidence(evidence, path, violations)
    } else {
      pushViolation(violations, 'invalid-evidence', `${path}.availability`)
    }
  }

  return violations
}

interface EvidenceReferenceIndex {
  byId: ReadonlyMap<string, Record<string, unknown>>
  availableIds: ReadonlySet<string>
}

function buildEvidenceReferenceIndex(
  evidenceItems: readonly unknown[],
): EvidenceReferenceIndex {
  const byId = new Map<string, Record<string, unknown>>()
  const availableIds = new Set<string>()

  for (const evidence of evidenceItems) {
    if (!isRecord(evidence) || !isNonemptyString(evidence.id)) continue
    if (!byId.has(evidence.id)) byId.set(evidence.id, evidence)
    if (evidence.availability === 'available') availableIds.add(evidence.id)
  }

  return { byId, availableIds }
}

function validateEvidenceReference(
  evidenceId: string,
  path: string,
  evidenceIndex: EvidenceReferenceIndex,
  violations: GuidedContractViolation[],
): void {
  if (!evidenceIndex.byId.has(evidenceId)) {
    pushViolation(violations, 'dangling-evidence-reference', path)
  } else if (!evidenceIndex.availableIds.has(evidenceId)) {
    pushViolation(violations, 'unavailable-evidence-reference', path)
  }
}

/** Validate evidence independently before it can drive any finding. */
export function validateGuidedEvidenceContract(
  input: GuidedEvidenceValidationInput,
): GuidedContractValidation {
  const violations = collectEvidenceViolations(input)
  return { valid: violations.length === 0, violations }
}

function validateFinding(
  value: unknown,
  expectedRole: 'positive' | 'focus',
  path: string,
  assessmentId: string,
  evidenceIndex: EvidenceReferenceIndex,
  violations: GuidedContractViolation[],
): void {
  if (!isRecord(value)) {
    pushViolation(violations, 'malformed-focus-reading', path)
    return
  }

  if (
    !isNonemptyString(value.id) ||
    value.assessmentId !== assessmentId ||
    value.role !== expectedRole ||
    !isGuidedIdentifier(value.findingCode) ||
    !isFiniteNumber(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    !isNonemptyString(value.evidenceId)
  ) {
    pushViolation(violations, 'malformed-focus-reading', path)
  }

  if (isNonemptyString(value.evidenceId)) {
    validateEvidenceReference(
      value.evidenceId,
      `${path}.evidenceId`,
      evidenceIndex,
      violations,
    )
  }
}

function validateNullablePositiveInteger(
  value: unknown,
): value is number | null {
  return (
    value === null ||
    (isFiniteNumber(value) && Number.isSafeInteger(value) && value > 0)
  )
}

function isGuidedScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    isFiniteNumber(value)
  )
}

function isGuidedParameters(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (parameter) =>
        isGuidedScalar(parameter) ||
        (Array.isArray(parameter) && parameter.every(isGuidedScalar)),
    )
  )
}

function isExerciseConfigurationReference(value: unknown): boolean {
  return (
    isRecord(value) &&
    isGuidedIdentifier(value.configurationId) &&
    isGuidedIdentifier(value.configurationVersion)
  )
}

function isProtocolIdentity(
  value: unknown,
  assessmentId: string,
): value is GuidedProtocolIdentity {
  return (
    isRecord(value) &&
    value.assessmentId === assessmentId &&
    isNonemptyString(value.protocolVersion) &&
    isNonemptyString(value.instructionVersion) &&
    isNonemptyString(value.targetVersion) &&
    isNonemptyString(value.analysisVersion) &&
    isNonemptyString(value.scoringVersion)
  )
}

function isTaskConfiguration(value: unknown): value is GuidedTaskConfiguration {
  if (!isRecord(value)) return false

  const comfortableRange = value.comfortableRangeMidiCents
  const validRange =
    comfortableRange === null ||
    (Array.isArray(comfortableRange) &&
      comfortableRange.length === 2 &&
      Number.isSafeInteger(comfortableRange[0]) &&
      Number.isSafeInteger(comfortableRange[1]) &&
      comfortableRange[0] <= comfortableRange[1])
  const validTempo =
    value.tempoBpm === null ||
    (isFiniteNumber(value.tempoBpm) && value.tempoBpm > 0)

  return (
    isNonemptyString(value.taskId) &&
    isNonemptyString(value.cueId) &&
    validRange &&
    Array.isArray(value.targetMidiCents) &&
    value.targetMidiCents.every(Number.isSafeInteger) &&
    validTempo &&
    isFiniteNumber(value.durationMilliseconds) &&
    Number.isSafeInteger(value.durationMilliseconds) &&
    value.durationMilliseconds > 0 &&
    isFiniteNumber(value.repetitions) &&
    Number.isInteger(value.repetitions) &&
    value.repetitions > 0 &&
    isGuidedParameters(value.parameters)
  )
}

function isMatchedRetake(value: unknown, assessmentId: string): boolean {
  if (
    !isRecord(value) ||
    !isProtocolIdentity(value.identity, assessmentId) ||
    !isTaskConfiguration(value.task) ||
    !isNonemptyString(value.comparisonFingerprint)
  ) {
    return false
  }

  try {
    return (
      value.comparisonFingerprint ===
      buildGuidedComparisonFingerprint({
        identity: value.identity,
        task: value.task,
      })
    )
  } catch {
    return false
  }
}

function validateRecommendation(
  value: unknown,
  assessmentId: string,
  evidenceIndex: EvidenceReferenceIndex,
  violations: GuidedContractViolation[],
): void {
  const path = 'reading.recommendation'
  if (!isRecord(value)) {
    pushViolation(violations, 'malformed-recommendation', path)
    return
  }

  const exercise = value.exercise
  const dose = value.dose
  const returnDestination = value.returnDestination
  const retake = value.retake
  const alternativeId = value.alternativeRecommendationId
  const validAlternative =
    alternativeId === null ||
    (isNonemptyString(alternativeId) && alternativeId !== value.id)
  const validExercise =
    isRecord(exercise) &&
    isNonemptyString(exercise.exerciseId) &&
    isNonemptyString(exercise.exerciseVersion) &&
    isExerciseConfigurationReference(exercise.configuration)
  const validDose =
    isRecord(dose) &&
    validateNullablePositiveInteger(dose.durationMilliseconds) &&
    validateNullablePositiveInteger(dose.repetitions) &&
    validateNullablePositiveInteger(dose.sets) &&
    (dose.comfortableRangeMidiCents === null ||
      (Array.isArray(dose.comfortableRangeMidiCents) &&
        dose.comfortableRangeMidiCents.length === 2 &&
        Number.isSafeInteger(dose.comfortableRangeMidiCents[0]) &&
        Number.isSafeInteger(dose.comfortableRangeMidiCents[1]) &&
        dose.comfortableRangeMidiCents[0] <=
          dose.comfortableRangeMidiCents[1])) &&
    (dose.demand === 'gentler' ||
      dose.demand === 'same' ||
      dose.demand === 'increased') &&
    (dose.durationMilliseconds !== null ||
      dose.repetitions !== null ||
      dose.sets !== null ||
      dose.comfortableRangeMidiCents !== null)
  const validReturn =
    isRecord(returnDestination) &&
    returnDestination.kind === 'guided-focus-reading' &&
    isNonemptyString(returnDestination.assessmentRunId)
  const validRetake = isMatchedRetake(retake, assessmentId)
  const evidenceIds = value.originatingEvidenceIds
  const validEvidenceIds =
    Array.isArray(evidenceIds) &&
    evidenceIds.length > 0 &&
    evidenceIds.every(isNonemptyString) &&
    new Set(evidenceIds).size === evidenceIds.length

  if (
    !isNonemptyString(value.id) ||
    !isNonemptyString(value.version) ||
    value.originatingAssessmentId !== assessmentId ||
    !validEvidenceIds ||
    !validExercise ||
    !isGuidedIdentifier(value.reasonId) ||
    !validDose ||
    !isGuidedIdentifier(value.stopRuleId) ||
    !validAlternative ||
    !validReturn ||
    !validRetake
  ) {
    pushViolation(violations, 'malformed-recommendation', path)
  }

  if (Array.isArray(evidenceIds)) {
    for (const [index, evidenceId] of evidenceIds.entries()) {
      if (isNonemptyString(evidenceId)) {
        validateEvidenceReference(
          evidenceId,
          `${path}.originatingEvidenceIds[${index}]`,
          evidenceIndex,
          violations,
        )
      }
    }
  }
}

/**
 * Validate the complete one-measurement, two-findings, one-action reading.
 * Evidence violations are returned first, followed by reading violations.
 */
export function validateGuidedFocusReadingContract(
  input: GuidedFocusReadingValidationInput,
): GuidedContractValidation {
  const violations = collectEvidenceViolations(input)
  const evidenceIndex = buildEvidenceReferenceIndex(
    Array.isArray(input.evidence) ? input.evidence : [],
  )

  if (!isRecord(input.reading)) {
    pushViolation(violations, 'malformed-focus-reading', 'reading')
    return { valid: false, violations }
  }

  const primaryEvidenceId = input.reading.primaryEvidenceId
  if (!isNonemptyString(primaryEvidenceId)) {
    pushViolation(
      violations,
      'malformed-focus-reading',
      'reading.primaryEvidenceId',
    )
  } else {
    const primaryEvidence = evidenceIndex.byId.get(primaryEvidenceId)
    if (primaryEvidence === undefined) {
      pushViolation(
        violations,
        'dangling-evidence-reference',
        'reading.primaryEvidenceId',
      )
    } else if (
      primaryEvidence.availability !== 'available' ||
      primaryEvidence.evidenceClass !== 'direct-measurement'
    ) {
      pushViolation(
        violations,
        'invalid-primary-evidence',
        'reading.primaryEvidenceId',
      )
    }
  }

  validateFinding(
    input.reading.positiveFinding,
    'positive',
    'reading.positiveFinding',
    input.assessmentId,
    evidenceIndex,
    violations,
  )
  validateFinding(
    input.reading.focusFinding,
    'focus',
    'reading.focusFinding',
    input.assessmentId,
    evidenceIndex,
    violations,
  )
  validateRecommendation(
    input.reading.recommendation,
    input.assessmentId,
    evidenceIndex,
    violations,
  )

  return { valid: violations.length === 0, violations }
}
