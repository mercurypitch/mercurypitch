// ============================================================
// Guided Voice comparison — exact protocols, device gates, neutral deltas
// ============================================================
//
// Compatibility is structural rather than a short hash: a collision must
// never place two materially different tasks in Twin Trails. Comparison can
// describe change or similarity, but this layer never calls change better.

import type { GuidedCaptureContext, GuidedComparisonFamily, GuidedContextualProxyEvidence, GuidedDirectMeasurementEvidence, GuidedEvidence, GuidedNumericMeasurement, GuidedProtocolIdentity, GuidedTaskConfiguration, } from './contracts'

export interface GuidedComparisonBasis {
  identity: GuidedProtocolIdentity
  task: GuidedTaskConfiguration
}

export type GuidedComparisonEligibility =
  | 'comparable'
  | 'comparable-with-input-caveat'
  | 'incompatible-protocol'
  | 'suppressed-input-change'
  | 'suppressed-input-unknown'

export type GuidedMeasurementComparison =
  | {
      status: 'changed' | 'similar' | 'raw-difference'
      eligibility: 'comparable' | 'comparable-with-input-caveat'
      earlier: number
      later: number
      delta: number
      direction: 'higher' | 'lower' | 'similar' | null
      uncertainty: number | null
    }
  | {
      status: 'unavailable' | 'incompatible' | 'suppressed'
      eligibility: GuidedComparisonEligibility
      reason:
        | 'evidence-unavailable'
        | 'measurement-mismatch'
        | 'invalid-measurement'
        | 'protocol-mismatch'
        | 'input-context-changed'
        | 'input-context-unknown'
    }

type AvailableGuidedEvidence =
  | GuidedDirectMeasurementEvidence
  | GuidedContextualProxyEvidence

function finiteNumber(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Guided comparison ${field} must be finite`)
  }
  return Object.is(value, -0) ? 0 : value
}

function finiteInteger(value: number, field: string): number {
  const finite = finiteNumber(value, field)
  if (!Number.isSafeInteger(finite)) {
    throw new Error(`Guided comparison ${field} must be a safe integer`)
  }
  return finite
}

function compareCanonicalKeys(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function requireNonblank(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new Error(`Guided comparison ${field} cannot be blank`)
  }
  return value
}

function canonicalParameter(key: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.some(Array.isArray)) {
      throw new Error(`Guided comparison parameter ${key} must be scalar`)
    }
    return value.map((entry) => canonicalParameter(key, entry))
  }
  if (typeof value === 'number') return finiteNumber(value, `parameter ${key}`)
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  throw new Error(`Guided comparison parameter ${key} must be scalar`)
}

function canonicalTask(task: GuidedTaskConfiguration): readonly unknown[] {
  const parameters = Object.entries(task.parameters)
    .sort(([left], [right]) => compareCanonicalKeys(left, right))
    .map(([key, value]) => [
      requireNonblank(key, 'parameter key'),
      canonicalParameter(key, value),
    ])

  const range = task.comfortableRangeMidiCents
  if (range !== null && range[0] > range[1]) {
    throw new Error('Guided comparison comfortable range must be ordered')
  }
  if (task.tempoBpm !== null && task.tempoBpm <= 0) {
    throw new Error('Guided comparison tempo must be positive')
  }
  if (task.durationMilliseconds <= 0) {
    throw new Error('Guided comparison duration must be positive')
  }
  if (task.repetitions <= 0) {
    throw new Error('Guided comparison repetitions must be positive')
  }

  return [
    requireNonblank(task.taskId, 'task ID'),
    requireNonblank(task.cueId, 'cue ID'),
    range === null
      ? null
      : [
          finiteInteger(range[0], 'range low cents'),
          finiteInteger(range[1], 'range high cents'),
        ],
    task.targetMidiCents.map((target) =>
      finiteInteger(target, 'target MIDI-cents'),
    ),
    task.tempoBpm === null ? null : finiteNumber(task.tempoBpm, 'tempo'),
    finiteInteger(task.durationMilliseconds, 'duration milliseconds'),
    finiteInteger(task.repetitions, 'repetitions'),
    parameters,
  ]
}

/** Collision-free canonical identity for assessment-scoped voice threads. */
export function buildGuidedComparisonFingerprint(
  basis: GuidedComparisonBasis,
): string {
  const identity = basis.identity
  return `guided-voice:${JSON.stringify([
    requireNonblank(identity.assessmentId, 'assessment ID'),
    requireNonblank(identity.protocolVersion, 'protocol version'),
    requireNonblank(identity.instructionVersion, 'instruction version'),
    requireNonblank(identity.targetVersion, 'target version'),
    requireNonblank(identity.analysisVersion, 'analysis version'),
    requireNonblank(identity.scoringVersion, 'scoring version'),
    canonicalTask(basis.task),
  ])}`
}

export function guidedComparisonEligibility(input: {
  earlierFingerprint: string
  laterFingerprint: string
  family: GuidedComparisonFamily
  earlierCapture: GuidedCaptureContext
  laterCapture: GuidedCaptureContext
  /** Defaults to family semantics for direct measurements. */
  inputSensitivity?: 'input-sensitive' | 'input-stable'
}): GuidedComparisonEligibility {
  if (input.earlierFingerprint !== input.laterFingerprint) {
    return 'incompatible-protocol'
  }

  const earlierInput = input.earlierCapture.inputContextKey
  const laterInput = input.laterCapture.inputContextKey
  const inputSensitive =
    input.inputSensitivity === 'input-sensitive' ||
    (input.inputSensitivity === undefined &&
      (input.family === 'relative-level' || input.family === 'spectrum'))
  if (earlierInput === null || laterInput === null) {
    return inputSensitive
      ? 'suppressed-input-unknown'
      : 'comparable-with-input-caveat'
  }
  if (earlierInput !== laterInput) {
    return inputSensitive
      ? 'suppressed-input-change'
      : 'comparable-with-input-caveat'
  }
  return 'comparable'
}

function isAvailable(
  evidence: GuidedEvidence,
): evidence is AvailableGuidedEvidence {
  return (
    evidence.availability === 'available' &&
    (evidence.evidenceClass === 'direct-measurement' ||
      evidence.evidenceClass === 'contextual-acoustic-proxy')
  )
}

function comparableMeasurement(
  measurement: GuidedNumericMeasurement,
): { value: number; unitKey: string } | null {
  if (measurement.kind === 'scalar') {
    return Number.isFinite(measurement.value)
      ? { value: measurement.value, unitKey: measurement.unit }
      : null
  }
  if (
    !Number.isFinite(measurement.numerator) ||
    !Number.isFinite(measurement.denominator) ||
    measurement.numerator < 0 ||
    measurement.denominator <= 0 ||
    measurement.numerator > measurement.denominator ||
    measurement.numeratorUnit !== measurement.denominatorUnit
  ) {
    return null
  }
  return {
    value: measurement.numerator / measurement.denominator,
    unitKey: `${measurement.numeratorUnit}/${measurement.denominatorUnit}`,
  }
}

/**
 * Compare one compatible numeric measurement against a validated uncertainty
 * floor. The result is deliberately neutral: direction is not improvement.
 */
export function compareGuidedMeasurement(input: {
  earlier: GuidedEvidence
  later: GuidedEvidence
  earlierFingerprint: string
  laterFingerprint: string
  earlierCapture: GuidedCaptureContext
  laterCapture: GuidedCaptureContext
  /** Null when this metric has no validated uncertainty for the context. */
  uncertainty: number | null
}): GuidedMeasurementComparison {
  if (input.earlierFingerprint !== input.laterFingerprint) {
    return {
      status: 'incompatible',
      eligibility: 'incompatible-protocol',
      reason: 'protocol-mismatch',
    }
  }

  if (!isAvailable(input.earlier) || !isAvailable(input.later)) {
    return {
      status: 'unavailable',
      eligibility: 'comparable',
      reason: 'evidence-unavailable',
    }
  }
  if (
    !Number.isFinite(input.earlier.confidence) ||
    input.earlier.confidence < 0 ||
    input.earlier.confidence > 1 ||
    !Number.isFinite(input.later.confidence) ||
    input.later.confidence < 0 ||
    input.later.confidence > 1 ||
    (input.earlier.evidenceClass === 'contextual-acoustic-proxy' &&
      input.earlier.caveatId.trim().length === 0) ||
    (input.later.evidenceClass === 'contextual-acoustic-proxy' &&
      input.later.caveatId.trim().length === 0)
  ) {
    return {
      status: 'unavailable',
      eligibility: 'comparable',
      reason: 'invalid-measurement',
    }
  }
  const earlierMeasurement = comparableMeasurement(input.earlier.measurement)
  const laterMeasurement = comparableMeasurement(input.later.measurement)
  if (earlierMeasurement === null || laterMeasurement === null) {
    return {
      status: 'unavailable',
      eligibility: 'comparable',
      reason: 'invalid-measurement',
    }
  }
  if (
    input.earlier.measurementKey !== input.later.measurementKey ||
    earlierMeasurement.unitKey !== laterMeasurement.unitKey ||
    input.earlier.evidenceClass !== input.later.evidenceClass ||
    input.earlier.comparisonFamily !== input.later.comparisonFamily ||
    (input.earlier.evidenceClass === 'contextual-acoustic-proxy' &&
      input.later.evidenceClass === 'contextual-acoustic-proxy' &&
      input.earlier.inputSensitivity !== input.later.inputSensitivity)
  ) {
    return {
      status: 'incompatible',
      eligibility: 'incompatible-protocol',
      reason: 'measurement-mismatch',
    }
  }

  const eligibility = guidedComparisonEligibility({
    earlierFingerprint: input.earlierFingerprint,
    laterFingerprint: input.laterFingerprint,
    family: input.earlier.comparisonFamily,
    earlierCapture: input.earlierCapture,
    laterCapture: input.laterCapture,
    inputSensitivity:
      input.earlier.evidenceClass === 'contextual-acoustic-proxy'
        ? input.earlier.inputSensitivity
        : undefined,
  })
  if (eligibility === 'incompatible-protocol') {
    return {
      status: 'incompatible',
      eligibility,
      reason: 'protocol-mismatch',
    }
  }
  if (eligibility === 'suppressed-input-change') {
    return {
      status: 'suppressed',
      eligibility,
      reason: 'input-context-changed',
    }
  }
  if (eligibility === 'suppressed-input-unknown') {
    return {
      status: 'suppressed',
      eligibility,
      reason: 'input-context-unknown',
    }
  }

  const delta = laterMeasurement.value - earlierMeasurement.value
  if (!Number.isFinite(delta)) {
    return {
      status: 'unavailable',
      eligibility,
      reason: 'invalid-measurement',
    }
  }
  if (input.uncertainty === null) {
    return {
      status: 'raw-difference',
      eligibility,
      earlier: earlierMeasurement.value,
      later: laterMeasurement.value,
      delta,
      direction: null,
      uncertainty: null,
    }
  }
  if (!Number.isFinite(input.uncertainty) || input.uncertainty < 0) {
    return {
      status: 'unavailable',
      eligibility,
      reason: 'invalid-measurement',
    }
  }
  const uncertainty = input.uncertainty
  if (Math.abs(delta) <= uncertainty) {
    return {
      status: 'similar',
      eligibility,
      earlier: earlierMeasurement.value,
      later: laterMeasurement.value,
      delta,
      direction: 'similar',
      uncertainty,
    }
  }
  return {
    status: 'changed',
    eligibility,
    earlier: earlierMeasurement.value,
    later: laterMeasurement.value,
    delta,
    direction: delta > 0 ? 'higher' : 'lower',
    uncertainty,
  }
}
