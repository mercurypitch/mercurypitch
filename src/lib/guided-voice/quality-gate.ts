// ============================================================
// Guided Voice quality gate — aggregate preclassified input evidence
// ============================================================
//
// Capture adapters own thresholds and measurements. This pure fail-closed
// aggregator receives their observations, refuses interpretation when a
// required check is missing, and never converts poor input into a low singing
// result.

import type { GuidedQualityCheckId, GuidedQualityGateResult, GuidedQualityObservation, GuidedQualityRequirement, GuidedResolvedQualityObservation, } from './contracts'

const QUALITY_STATUSES = new Set([
  'pass',
  'fail',
  'unavailable',
  'not-required',
])
const QUALITY_FAILURE_DISPOSITIONS = new Set([
  'retry-recording',
  'unavailable-here',
])

const QUALITY_CHECK_ORDER: readonly GuidedQualityCheckId[] = [
  'microphone-continuity',
  'clipping',
  'noise-separation',
  'signal-coverage',
  'pitch-confidence',
  'task-completion',
  'duration',
  'repetitions',
  'analysis-capability',
]

function qualityOrder(id: GuidedQualityCheckId): number {
  return QUALITY_CHECK_ORDER.indexOf(id)
}

function sortCheckIds(
  ids: Iterable<GuidedQualityCheckId>,
): GuidedQualityCheckId[] {
  return [...new Set(ids)].sort(
    (left, right) => qualityOrder(left) - qualityOrder(right),
  )
}

/**
 * Resolve required and optional quality observations into one product state.
 * A missing required observation is treated as unavailable capability, not as
 * an implicit pass. Thresholds remain with the capture adapter that measured
 * them; this layer does not invent a second noise floor or clipping policy.
 */
export function evaluateGuidedQualityGate(
  requirements: readonly GuidedQualityRequirement[],
  observations: readonly GuidedQualityObservation[],
): GuidedQualityGateResult {
  const requirementById = new Map<
    GuidedQualityCheckId,
    GuidedQualityRequirement
  >()
  const duplicateRequirementIds = new Set<GuidedQualityCheckId>()
  for (const requirement of requirements) {
    if (requirementById.has(requirement.id)) {
      duplicateRequirementIds.add(requirement.id)
    } else {
      requirementById.set(requirement.id, requirement)
    }
  }
  const byId = new Map<GuidedQualityCheckId, GuidedQualityObservation>()
  const duplicateIds = new Set<GuidedQualityCheckId>()

  for (const observation of observations) {
    if (byId.has(observation.id)) duplicateIds.add(observation.id)
    else byId.set(observation.id, observation)
  }

  const normalized: GuidedResolvedQualityObservation[] = []
  for (const id of QUALITY_CHECK_ORDER) {
    const requirement = requirementById.get(id)
    const observed = byId.get(id)
    if (
      duplicateRequirementIds.has(id) ||
      (requirement !== undefined &&
        !QUALITY_FAILURE_DISPOSITIONS.has(requirement.failureDisposition))
    ) {
      normalized.push({
        id,
        status: 'unavailable',
        required: true,
        failureDisposition: 'unavailable-here',
        reasonCode: duplicateRequirementIds.has(id)
          ? 'duplicate-quality-requirement'
          : 'invalid-quality-requirement',
      })
      continue
    }
    if (duplicateIds.has(id)) {
      normalized.push({
        id,
        status: 'unavailable',
        required: requirement !== undefined,
        failureDisposition:
          requirement?.failureDisposition ?? 'unavailable-here',
        reasonCode: 'duplicate-quality-observation',
      })
      continue
    }
    if (observed !== undefined) {
      if (!QUALITY_STATUSES.has(observed.status)) {
        normalized.push({
          id,
          status: 'unavailable',
          required: requirement !== undefined,
          failureDisposition:
            requirement?.failureDisposition ?? 'unavailable-here',
          reasonCode: 'invalid-quality-observation',
        })
        continue
      }
      normalized.push({
        ...observed,
        required: requirement !== undefined,
        failureDisposition: requirement?.failureDisposition ?? null,
      })
      continue
    }
    if (requirement !== undefined) {
      normalized.push({
        id,
        status: 'unavailable',
        required: true,
        failureDisposition: 'unavailable-here',
        reasonCode: 'missing-quality-observation',
      })
    }
  }

  const requiredProblems = normalized.filter(
    (observation) => observation.required && observation.status !== 'pass',
  )
  const unavailableRequired = requiredProblems.some(
    (observation) =>
      observation.status === 'unavailable' ||
      observation.status === 'not-required' ||
      observation.failureDisposition === 'unavailable-here',
  )
  const retryableRequired = requiredProblems.some(
    (observation) =>
      observation.status === 'fail' &&
      observation.failureDisposition === 'retry-recording',
  )
  const partialProblems = normalized.filter(
    (observation) =>
      !observation.required &&
      (observation.status === 'fail' || observation.status === 'unavailable'),
  )

  const outcome = unavailableRequired
    ? 'unavailable'
    : retryableRequired
      ? 'needs-another-recording'
      : partialProblems.length > 0
        ? 'partial'
        : 'ready'

  return {
    outcome,
    observations: normalized,
    blockingCheckIds: sortCheckIds(
      requiredProblems.map((observation) => observation.id),
    ),
    partialCheckIds: sortCheckIds(
      partialProblems.map((observation) => observation.id),
    ),
  }
}

export function guidedQualityAllowsReading(
  quality: GuidedQualityGateResult,
): boolean {
  return quality.outcome === 'ready' || quality.outcome === 'partial'
}
