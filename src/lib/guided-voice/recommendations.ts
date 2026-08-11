// ============================================================
// Guided Voice recommendation policy — deterministic evidence-bound outcomes
// ============================================================
//
// Assessment modules own validated thresholds, exercise doses, and reviewed
// copy identifiers. This pure policy only applies an explicitly ordered rule
// table, preserves evidence provenance, and fails closed when any rule input
// is missing or ambiguous.

import { buildGuidedComparisonFingerprint } from './comparison'
import type { GuidedAssessmentDefinition, GuidedAssessmentOutcome, GuidedEvidence, GuidedEvidenceClass, GuidedFinding, GuidedOriginatingCapture, GuidedPracticeRecommendation, GuidedQualityGateResult, GuidedRetakeProtocol, GuidedSafetyContext, } from './contracts'
import { isGuidedIdentifier } from './identifiers'
import { evaluateGuidedQualityGate } from './quality-gate'

type GuidedAvailableEvidenceClass = Exclude<GuidedEvidenceClass, 'not-measured'>

export interface GuidedRuleEvidenceRequirement {
  /** Exact evidence identity emitted by the assessment analyser. */
  evidenceId: string
  evidenceClass: GuidedAvailableEvidenceClass
  /** Exact reviewed finding codes that must be present for this evidence. */
  requiredFindingCodes: readonly string[]
}

export interface GuidedRuleFindingSelector {
  evidenceId: string
  findingCode: string
}

export type GuidedPracticeRecommendationTemplate = Omit<
  GuidedPracticeRecommendation,
  | 'originatingAssessmentId'
  | 'originatingEvidenceIds'
  | 'returnDestination'
  | 'retake'
>

/**
 * A rule is data, not executable copy or scoring logic. Its explicit order
 * makes selection stable even when registration order changes.
 */
export interface GuidedRecommendationRule {
  id: string
  version: string
  order: number
  assessmentId: string
  primaryEvidenceId: string
  evidenceRequirements: readonly GuidedRuleEvidenceRequirement[]
  positiveFinding: GuidedRuleFindingSelector
  focusFinding: GuidedRuleFindingSelector
  recommendation: GuidedPracticeRecommendationTemplate
}

export interface GuidedRecommendationPolicyInput {
  definition: GuidedAssessmentDefinition
  quality: GuidedQualityGateResult
  safety: GuidedSafetyContext
  evidence: readonly GuidedEvidence[]
  findings: readonly GuidedFinding[]
  /** A reason emitted by the analyser; null means analysis completed. */
  analysisFailureReasonCode: string | null
  /** Frozen task provenance saved when the assessment take was captured. */
  originatingCapture: GuidedOriginatingCapture
}

export type GuidedRecommendationValidationIssue =
  | 'missing-recommendation-id'
  | 'missing-recommendation-version'
  | 'missing-originating-assessment'
  | 'missing-originating-evidence'
  | 'duplicate-originating-evidence'
  | 'unknown-originating-evidence'
  | 'missing-exercise-id'
  | 'missing-exercise-version'
  | 'invalid-exercise-configuration'
  | 'missing-reason-id'
  | 'invalid-reason-id'
  | 'invalid-dose'
  | 'missing-stop-rule-id'
  | 'invalid-stop-rule-id'
  | 'invalid-alternative-recommendation-id'
  | 'missing-return-destination'
  | 'invalid-retake-protocol'

function isNonBlank(value: string): boolean {
  return value.trim().length > 0
}

function compareStableIds(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function isFinitePositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

function hasValidIdentity(retake: GuidedRetakeProtocol): boolean {
  const identity = retake.identity
  return (
    isNonBlank(identity.assessmentId) &&
    isNonBlank(identity.protocolVersion) &&
    isNonBlank(identity.instructionVersion) &&
    isNonBlank(identity.targetVersion) &&
    isNonBlank(identity.analysisVersion) &&
    isNonBlank(identity.scoringVersion)
  )
}

function hasValidRetake(retake: GuidedRetakeProtocol): boolean {
  const task = retake.task
  const range = task.comfortableRangeMidiCents
  const validRange =
    range === null ||
    (Number.isSafeInteger(range[0]) &&
      Number.isSafeInteger(range[1]) &&
      range[0] <= range[1])
  const validTempo = task.tempoBpm === null || isFinitePositive(task.tempoBpm)

  const structurallyValid =
    hasValidIdentity(retake) &&
    isNonBlank(task.taskId) &&
    isNonBlank(task.cueId) &&
    validRange &&
    task.targetMidiCents.every(Number.isSafeInteger) &&
    validTempo &&
    isFinitePositiveInteger(task.durationMilliseconds) &&
    isFinitePositiveInteger(task.repetitions) &&
    task.parameters !== null &&
    typeof task.parameters === 'object' &&
    isNonBlank(retake.comparisonFingerprint)
  if (!structurallyValid) return false

  try {
    return (
      retake.comparisonFingerprint ===
      buildGuidedComparisonFingerprint({
        identity: retake.identity,
        task: retake.task,
      })
    )
  } catch {
    return false
  }
}

function hasValidDose(recommendation: GuidedPracticeRecommendation): boolean {
  const dose = recommendation.dose
  const validDuration =
    dose.durationMilliseconds === null ||
    isFinitePositiveInteger(dose.durationMilliseconds)
  const validRepetitions =
    dose.repetitions === null || isFinitePositiveInteger(dose.repetitions)
  const validSets = dose.sets === null || isFinitePositiveInteger(dose.sets)
  const validRange =
    dose.comfortableRangeMidiCents === null ||
    (isFiniteNumber(dose.comfortableRangeMidiCents[0]) &&
      isFiniteNumber(dose.comfortableRangeMidiCents[1]) &&
      dose.comfortableRangeMidiCents[0] <= dose.comfortableRangeMidiCents[1])
  const validDemand =
    dose.demand === 'gentler' ||
    dose.demand === 'same' ||
    dose.demand === 'increased'
  const hasActionableDose =
    dose.durationMilliseconds !== null ||
    dose.repetitions !== null ||
    dose.sets !== null ||
    dose.comfortableRangeMidiCents !== null

  return (
    validDuration &&
    validRepetitions &&
    validSets &&
    validRange &&
    validDemand &&
    hasActionableDose
  )
}

/**
 * Validate the handoff fields that must never disappear between assessment,
 * exercise, and matched retake. The validator returns identifiers only; it
 * does not rewrite or invent a fallback recommendation.
 */
export function validateGuidedPracticeRecommendation(
  recommendation: GuidedPracticeRecommendation,
  evidence: readonly GuidedEvidence[],
): readonly GuidedRecommendationValidationIssue[] {
  const issues: GuidedRecommendationValidationIssue[] = []
  const originatingIds = recommendation.originatingEvidenceIds

  if (!isNonBlank(recommendation.id)) issues.push('missing-recommendation-id')
  if (!isNonBlank(recommendation.version)) {
    issues.push('missing-recommendation-version')
  }
  if (!isNonBlank(recommendation.originatingAssessmentId)) {
    issues.push('missing-originating-assessment')
  }
  if (
    originatingIds.length === 0 ||
    originatingIds.some((id) => !isNonBlank(id))
  ) {
    issues.push('missing-originating-evidence')
  }
  if (new Set(originatingIds).size !== originatingIds.length) {
    issues.push('duplicate-originating-evidence')
  }
  if (
    originatingIds.some(
      (id) =>
        evidence.filter(
          (item) =>
            item.id === id &&
            item.assessmentId === recommendation.originatingAssessmentId &&
            item.availability === 'available',
        ).length !== 1,
    )
  ) {
    issues.push('unknown-originating-evidence')
  }
  if (!isNonBlank(recommendation.exercise.exerciseId)) {
    issues.push('missing-exercise-id')
  }
  if (!isNonBlank(recommendation.exercise.exerciseVersion)) {
    issues.push('missing-exercise-version')
  }
  if (
    !isGuidedIdentifier(
      recommendation.exercise.configuration.configurationId,
    ) ||
    !isGuidedIdentifier(
      recommendation.exercise.configuration.configurationVersion,
    )
  ) {
    issues.push('invalid-exercise-configuration')
  }
  if (!isNonBlank(recommendation.reasonId)) issues.push('missing-reason-id')
  else if (!isGuidedIdentifier(recommendation.reasonId)) {
    issues.push('invalid-reason-id')
  }
  if (!hasValidDose(recommendation)) issues.push('invalid-dose')
  if (!isNonBlank(recommendation.stopRuleId)) {
    issues.push('missing-stop-rule-id')
  } else if (!isGuidedIdentifier(recommendation.stopRuleId)) {
    issues.push('invalid-stop-rule-id')
  }
  if (
    recommendation.alternativeRecommendationId !== null &&
    (!isNonBlank(recommendation.alternativeRecommendationId) ||
      recommendation.alternativeRecommendationId === recommendation.id)
  ) {
    issues.push('invalid-alternative-recommendation-id')
  }
  if (
    recommendation.returnDestination.kind !== 'guided-focus-reading' ||
    !isNonBlank(recommendation.returnDestination.assessmentRunId)
  ) {
    issues.push('missing-return-destination')
  }
  if (!hasValidRetake(recommendation.retake)) {
    issues.push('invalid-retake-protocol')
  }

  return issues
}

function identityMatchesDefinition(
  input: GuidedRecommendationPolicyInput,
): boolean {
  const expected = input.definition.identity
  const actual = input.originatingCapture.protocol.identity
  return (
    actual.assessmentId === expected.assessmentId &&
    actual.protocolVersion === expected.protocolVersion &&
    actual.instructionVersion === expected.instructionVersion &&
    actual.targetVersion === expected.targetVersion &&
    actual.analysisVersion === expected.analysisVersion &&
    actual.scoringVersion === expected.scoringVersion
  )
}

function matchedRetakeFromOrigin(
  input: GuidedRecommendationPolicyInput,
): GuidedRetakeProtocol | null {
  const origin = input.originatingCapture
  const protocol = origin.protocol
  if (
    !isGuidedIdentifier(origin.assessmentRunId) ||
    !identityMatchesDefinition(input) ||
    !hasValidRetake(protocol)
  ) {
    return null
  }

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

function isAvailableEvidence(
  evidence: GuidedEvidence,
): evidence is Extract<GuidedEvidence, { availability: 'available' }> {
  return evidence.availability === 'available'
}

function hasUsableConfidence(
  evidence: Extract<GuidedEvidence, { availability: 'available' }>,
): boolean {
  if (evidence.evidenceClass === 'singer-report') return true
  const measurement = evidence.measurement
  const validMeasurement =
    measurement.kind === 'scalar'
      ? Number.isFinite(measurement.value)
      : Number.isFinite(measurement.numerator) &&
        Number.isFinite(measurement.denominator) &&
        measurement.numerator >= 0 &&
        measurement.denominator > 0 &&
        measurement.numerator <= measurement.denominator &&
        measurement.numeratorUnit === measurement.denominatorUnit
  const validProxy =
    evidence.evidenceClass !== 'contextual-acoustic-proxy' ||
    (isNonBlank(evidence.caveatId) &&
      (evidence.inputSensitivity === 'input-sensitive' ||
        evidence.inputSensitivity === 'input-stable'))
  return (
    validMeasurement &&
    validProxy &&
    Number.isFinite(evidence.confidence) &&
    evidence.confidence >= 0 &&
    evidence.confidence <= 1
  )
}

function findUniqueEvidence(
  input: GuidedRecommendationPolicyInput,
  requirement: GuidedRuleEvidenceRequirement,
): GuidedEvidence | null {
  const matches = input.evidence.filter(
    (item) => item.id === requirement.evidenceId,
  )
  const match = matches.length === 1 ? matches[0] : undefined
  if (
    match === undefined ||
    match.assessmentId !== input.definition.identity.assessmentId ||
    match.evidenceClass !== requirement.evidenceClass ||
    !isAvailableEvidence(match) ||
    !hasUsableConfidence(match)
  ) {
    return null
  }
  return match
}

function findUniqueFinding(
  input: GuidedRecommendationPolicyInput,
  selector: GuidedRuleFindingSelector,
  role: GuidedFinding['role'],
): GuidedFinding | null {
  const matches = input.findings.filter(
    (finding) =>
      finding.assessmentId === input.definition.identity.assessmentId &&
      finding.evidenceId === selector.evidenceId &&
      finding.findingCode === selector.findingCode &&
      finding.role === role &&
      Number.isFinite(finding.confidence) &&
      finding.confidence >= 0 &&
      finding.confidence <= 1,
  )
  return matches.length === 1 ? matches[0] : null
}

function ruleIsStructurallyEligible(
  input: GuidedRecommendationPolicyInput,
  rule: GuidedRecommendationRule,
): boolean {
  const assessmentId = input.definition.identity.assessmentId
  if (
    !isGuidedIdentifier(rule.id) ||
    !isGuidedIdentifier(rule.version) ||
    !Number.isSafeInteger(rule.order) ||
    rule.order < 0 ||
    rule.assessmentId !== assessmentId ||
    !input.definition.recommendationRuleIds.includes(rule.id) ||
    rule.evidenceRequirements.length === 0
  ) {
    return false
  }

  const requirementIds = rule.evidenceRequirements.map(
    (requirement) => requirement.evidenceId,
  )
  if (new Set(requirementIds).size !== requirementIds.length) return false

  const primaryRequirement = rule.evidenceRequirements.find(
    (requirement) => requirement.evidenceId === rule.primaryEvidenceId,
  )
  if (primaryRequirement?.evidenceClass !== 'direct-measurement') return false

  for (const requirement of rule.evidenceRequirements) {
    if (
      !isGuidedIdentifier(requirement.evidenceId) ||
      requirement.requiredFindingCodes.length === 0 ||
      new Set(requirement.requiredFindingCodes).size !==
        requirement.requiredFindingCodes.length ||
      requirement.requiredFindingCodes.some(
        (findingCode) =>
          !isGuidedIdentifier(findingCode) ||
          !input.definition.allowedFindingCodes.includes(findingCode),
      ) ||
      findUniqueEvidence(input, requirement) === null
    ) {
      return false
    }
  }

  const selectors = [rule.positiveFinding, rule.focusFinding]
  for (const selector of selectors) {
    const requirement = rule.evidenceRequirements.find(
      (item) => item.evidenceId === selector.evidenceId,
    )
    if (
      requirement === undefined ||
      !requirement.requiredFindingCodes.includes(selector.findingCode)
    ) {
      return false
    }
  }

  for (const requirement of rule.evidenceRequirements) {
    for (const findingCode of requirement.requiredFindingCodes) {
      const matchingFindings = input.findings.filter(
        (finding) =>
          finding.assessmentId === assessmentId &&
          finding.evidenceId === requirement.evidenceId &&
          finding.findingCode === findingCode &&
          Number.isFinite(finding.confidence) &&
          finding.confidence >= 0 &&
          finding.confidence <= 1,
      )
      if (matchingFindings.length !== 1) return false
    }
  }

  return (
    findUniqueFinding(input, rule.positiveFinding, 'positive') !== null &&
    findUniqueFinding(input, rule.focusFinding, 'focus') !== null
  )
}

function orderedRules(
  rules: readonly GuidedRecommendationRule[],
): readonly GuidedRecommendationRule[] {
  return [...rules].sort(
    (left, right) =>
      left.order - right.order ||
      compareStableIds(left.id, right.id) ||
      compareStableIds(left.version, right.version),
  )
}

function hasAvailableDirectEvidence(
  input: GuidedRecommendationPolicyInput,
): boolean {
  return input.evidence.some(
    (item) =>
      item.assessmentId === input.definition.identity.assessmentId &&
      item.evidenceClass === 'direct-measurement' &&
      isAvailableEvidence(item) &&
      hasUsableConfidence(item),
  )
}

function ruleDoesNotIncreaseAfterEffort(
  input: GuidedRecommendationPolicyInput,
  rule: GuidedRecommendationRule,
): boolean {
  if (input.safety.singerEffort !== 'effortful') return true

  const dose = rule.recommendation.dose
  const task = input.originatingCapture.protocol.task
  if (dose.demand === 'increased') return false
  if (
    dose.durationMilliseconds !== null &&
    dose.durationMilliseconds > task.durationMilliseconds
  ) {
    return false
  }
  if (dose.repetitions !== null && dose.repetitions > task.repetitions) {
    return false
  }
  if (dose.sets !== null && dose.sets > 1) return false
  if (dose.comfortableRangeMidiCents !== null) {
    if (task.comfortableRangeMidiCents === null) return false
    if (
      dose.comfortableRangeMidiCents[0] < task.comfortableRangeMidiCents[0] ||
      dose.comfortableRangeMidiCents[1] > task.comfortableRangeMidiCents[1]
    ) {
      return false
    }
  }

  return true
}

/**
 * Resolve exactly one safe outcome. Safety and quality states always win over
 * acoustic evidence; analysis failures are returned verbatim and never
 * replaced with an inferred recommendation.
 */
export function resolveGuidedRecommendationOutcome(
  input: GuidedRecommendationPolicyInput,
  rules: readonly GuidedRecommendationRule[],
): GuidedAssessmentOutcome {
  if (
    input.safety.preCapture === 'stop' ||
    input.safety.singerEffort === 'uncomfortable'
  ) {
    return { kind: 'safety-stop' }
  }

  // The definition owns required-check policy. Recompute instead of trusting
  // a caller-supplied summary that could omit required observations.
  const quality = evaluateGuidedQualityGate(
    input.definition.requiredQualityChecks,
    input.quality.observations,
  )

  if (quality.outcome === 'unavailable') {
    return { kind: 'unavailable-here', quality }
  }
  if (quality.outcome === 'needs-another-recording') {
    return { kind: 'needs-another-recording', quality }
  }
  if (input.analysisFailureReasonCode !== null) {
    return {
      kind: 'analysis-failed',
      reasonCode: input.analysisFailureReasonCode,
    }
  }
  if (!hasAvailableDirectEvidence(input)) {
    return { kind: 'no-reliable-focus', evidence: input.evidence }
  }

  const matchedRetake = matchedRetakeFromOrigin(input)
  if (matchedRetake === null) {
    return { kind: 'no-reliable-focus', evidence: input.evidence }
  }

  const duplicateRuleIds = new Set<string>()
  const seenRuleIds = new Set<string>()
  for (const rule of rules) {
    if (seenRuleIds.has(rule.id)) duplicateRuleIds.add(rule.id)
    else seenRuleIds.add(rule.id)
  }

  for (const rule of orderedRules(rules)) {
    if (
      duplicateRuleIds.has(rule.id) ||
      !ruleIsStructurallyEligible(input, rule) ||
      !ruleDoesNotIncreaseAfterEffort(input, rule)
    ) {
      continue
    }

    const originatingEvidenceIds = [
      ...new Set(
        rule.evidenceRequirements.map((requirement) => requirement.evidenceId),
      ),
    ].sort(compareStableIds)
    const recommendation: GuidedPracticeRecommendation = {
      ...rule.recommendation,
      originatingAssessmentId: input.definition.identity.assessmentId,
      originatingEvidenceIds,
      returnDestination: {
        kind: 'guided-focus-reading',
        assessmentRunId: input.originatingCapture.assessmentRunId,
      },
      retake: matchedRetake,
    }
    if (
      validateGuidedPracticeRecommendation(recommendation, input.evidence)
        .length > 0
    ) {
      continue
    }

    const positiveFinding = findUniqueFinding(
      input,
      rule.positiveFinding,
      'positive',
    )
    const focusFinding = findUniqueFinding(input, rule.focusFinding, 'focus')
    if (positiveFinding === null || focusFinding === null) continue

    return {
      kind: 'focus-reading',
      quality: quality.outcome,
      evidence: input.evidence,
      reading: {
        primaryEvidenceId: rule.primaryEvidenceId,
        positiveFinding,
        focusFinding,
        recommendation,
      },
    }
  }

  return { kind: 'no-reliable-focus', evidence: input.evidence }
}
