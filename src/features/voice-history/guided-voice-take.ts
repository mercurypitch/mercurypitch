// ============================================================
// Guided Voice Take — validated local persistence for Focus Takes
// ============================================================
//
// Kept guided recordings store their immutable assessment provenance beside
// the dry audio. Every read crosses the same fail-closed runtime boundary so a
// damaged or stale context can never drive findings, advice, or comparisons.

import type { VoiceTakeRecord } from '@/db/entities'
import type { SaveVoiceTakeResult } from '@/db/services/voice-take-service'
import { saveVoiceTake } from '@/db/services/voice-take-service'
import { takeSupportsVoiceAnalysis } from '@/lib/domain/performance-take'
import type { GuidedFocusReading, GuidedPersistedAssessmentContext, GuidedProtocolIdentity, GuidedQualityCheckId, GuidedQualityGateResult, GuidedQualityRequirement, GuidedResolvedQualityObservation, GuidedTaskConfiguration, } from '@/lib/guided-voice'
import { buildGuidedComparisonFingerprint, evaluateGuidedQualityGate, isGuidedIdentifier, PITCH_CENTRE_PILOT_DEFINITION_V1, } from '@/lib/guided-voice'
import { isPersistedPitchCentrePilotFocus } from '@/lib/guided-voice/pitch-centre-assessment'
import type { VoiceAtlasContourPayloadV1 } from '@/lib/voice-contour'

export const GUIDED_VOICE_TAKE_CONTEXT_VERSION = 1 as const
export const GUIDED_VOICE_TAKE_TITLE = 'Pitch Centre'

const GUIDED_VOICE_TAKE_KIND = 'guided-focus-take'

const QUALITY_CHECK_IDS = new Set<GuidedQualityCheckId>([
  'microphone-continuity',
  'clipping',
  'noise-separation',
  'signal-coverage',
  'pitch-confidence',
  'task-completion',
  'duration',
  'repetitions',
  'analysis-capability',
])

const QUALITY_OUTCOMES = new Set<GuidedQualityGateResult['outcome']>([
  'ready',
  'partial',
  'needs-another-recording',
  'unavailable',
])

const QUALITY_STATUSES = new Set<GuidedResolvedQualityObservation['status']>([
  'pass',
  'fail',
  'unavailable',
  'not-required',
])

const SINGER_EFFORTS = new Set([
  'easy',
  'workable',
  'effortful',
  'uncomfortable',
])

export interface GuidedVoiceTakeCapture {
  blob: Blob
  durationMs: number
  peaks: Float32Array
  capturedAt: string
  contour: VoiceAtlasContourPayloadV1
}

export interface GuidedVoiceTakeContextV1 extends Record<string, unknown> {
  kind: typeof GUIDED_VOICE_TAKE_KIND
  version: typeof GUIDED_VOICE_TAKE_CONTEXT_VERSION
  assessment: GuidedPersistedAssessmentContext
  reading: GuidedFocusReading
}

export type GuidedVoiceTakeRecordInput = Pick<
  VoiceTakeRecord,
  | 'source'
  | 'comparisonKey'
  | 'contextVersion'
  | 'durationMs'
  | 'title'
  | 'contextJson'
>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonblankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasOnlyUniqueQualityIds(
  value: unknown,
): value is GuidedQualityCheckId[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry): entry is GuidedQualityCheckId =>
        typeof entry === 'string' &&
        QUALITY_CHECK_IDS.has(entry as GuidedQualityCheckId),
    ) &&
    new Set(value).size === value.length
  )
}

function isQualityObservation(
  value: unknown,
): value is GuidedResolvedQualityObservation {
  if (!isRecord(value)) return false
  const required = value.required
  const failureDisposition = value.failureDisposition
  return (
    typeof value.id === 'string' &&
    QUALITY_CHECK_IDS.has(value.id as GuidedQualityCheckId) &&
    typeof value.status === 'string' &&
    QUALITY_STATUSES.has(
      value.status as GuidedResolvedQualityObservation['status'],
    ) &&
    (value.reasonCode === null || isGuidedIdentifier(value.reasonCode)) &&
    typeof required === 'boolean' &&
    (failureDisposition === null ||
      failureDisposition === 'retry-recording' ||
      failureDisposition === 'unavailable-here') &&
    (required ? failureDisposition !== null : failureDisposition === null)
  )
}

function isQualityGate(
  value: unknown,
  requirements: readonly GuidedQualityRequirement[],
): value is GuidedQualityGateResult {
  if (
    !isRecord(value) ||
    typeof value.outcome !== 'string' ||
    !QUALITY_OUTCOMES.has(
      value.outcome as GuidedQualityGateResult['outcome'],
    ) ||
    !Array.isArray(value.observations) ||
    !value.observations.every(isQualityObservation) ||
    !hasOnlyUniqueQualityIds(value.blockingCheckIds) ||
    !hasOnlyUniqueQualityIds(value.partialCheckIds)
  ) {
    return false
  }

  const observationIds = value.observations.map((observation) => observation.id)
  if (new Set(observationIds).size !== observationIds.length) return false
  const knownIds = new Set(observationIds)
  if (
    !value.blockingCheckIds.every((id) => knownIds.has(id)) ||
    !value.partialCheckIds.every((id) => knownIds.has(id))
  ) {
    return false
  }

  const recomputed = evaluateGuidedQualityGate(
    requirements,
    value.observations.map(({ id, status, reasonCode }) => ({
      id,
      status,
      reasonCode,
    })),
  )

  return sameJsonValue(value, recomputed)
}

function isProtocolIdentity(value: unknown): value is GuidedProtocolIdentity {
  return (
    isRecord(value) &&
    isGuidedIdentifier(value.assessmentId) &&
    isNonblankString(value.protocolVersion) &&
    isNonblankString(value.instructionVersion) &&
    isNonblankString(value.targetVersion) &&
    isNonblankString(value.analysisVersion) &&
    isNonblankString(value.scoringVersion)
  )
}

function isGuidedScalar(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
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
    (typeof value.tempoBpm === 'number' &&
      Number.isFinite(value.tempoBpm) &&
      value.tempoBpm > 0)
  const parameters = value.parameters
  const validParameters =
    isRecord(parameters) &&
    Object.entries(parameters).every(
      ([key, parameter]) =>
        isGuidedIdentifier(key) &&
        (isGuidedScalar(parameter) ||
          (Array.isArray(parameter) && parameter.every(isGuidedScalar))),
    )

  return (
    isGuidedIdentifier(value.taskId) &&
    isGuidedIdentifier(value.cueId) &&
    validRange &&
    Array.isArray(value.targetMidiCents) &&
    value.targetMidiCents.every(Number.isSafeInteger) &&
    validTempo &&
    Number.isSafeInteger(value.durationMilliseconds) &&
    (value.durationMilliseconds as number) > 0 &&
    Number.isSafeInteger(value.repetitions) &&
    (value.repetitions as number) > 0 &&
    validParameters
  )
}

function isCaptureContext(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.inputContextKey === null ||
      isNonblankString(value.inputContextKey)) &&
    isGuidedIdentifier(value.detectorId) &&
    isNonblankString(value.detectorVersion) &&
    (value.sampleRateHz === null ||
      (typeof value.sampleRateHz === 'number' &&
        Number.isFinite(value.sampleRateHz) &&
        value.sampleRateHz > 0))
  )
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

function validatedContext(input: {
  context: unknown
  durationMs: number
  comparisonKey: string
}): GuidedVoiceTakeContextV1 | null {
  const context = input.context
  if (
    !isRecord(context) ||
    context.kind !== GUIDED_VOICE_TAKE_KIND ||
    context.version !== GUIDED_VOICE_TAKE_CONTEXT_VERSION ||
    !isRecord(context.assessment) ||
    !isRecord(context.reading) ||
    !Number.isFinite(input.durationMs) ||
    input.durationMs <= 0
  ) {
    return null
  }

  const assessment = context.assessment
  if (
    !isGuidedIdentifier(assessment.runId) ||
    !isProtocolIdentity(assessment.identity) ||
    !sameJsonValue(
      assessment.identity,
      PITCH_CENTRE_PILOT_DEFINITION_V1.identity,
    ) ||
    !isTaskConfiguration(assessment.task) ||
    assessment.captureSource !== 'dry-microphone' ||
    !isNonblankString(assessment.comparisonFingerprint) ||
    !isQualityGate(
      assessment.quality,
      PITCH_CENTRE_PILOT_DEFINITION_V1.requiredQualityChecks,
    ) ||
    !Array.isArray(assessment.evidence) ||
    (assessment.recommendation !== null &&
      !isRecord(assessment.recommendation)) ||
    (assessment.singerEffort !== null &&
      (typeof assessment.singerEffort !== 'string' ||
        !SINGER_EFFORTS.has(assessment.singerEffort))) ||
    !isCaptureContext(assessment.captureContext)
  ) {
    return null
  }

  let recomputedFingerprint: string
  try {
    recomputedFingerprint = buildGuidedComparisonFingerprint({
      identity: assessment.identity,
      task: assessment.task,
    })
  } catch {
    return null
  }
  if (
    assessment.comparisonFingerprint !== recomputedFingerprint ||
    input.comparisonKey !== recomputedFingerprint
  ) {
    return null
  }

  if (
    !isPersistedPitchCentrePilotFocus({
      assessment: assessment as unknown as GuidedPersistedAssessmentContext,
      reading: context.reading as unknown as GuidedFocusReading,
      captureDurationSeconds: input.durationMs / 1000,
    })
  ) {
    return null
  }

  return context as unknown as GuidedVoiceTakeContextV1
}

/**
 * Parse a kept guided take only when its row metadata, protocol identity,
 * evidence graph, and required Focus Reading still agree exactly.
 */
export function parseGuidedVoiceTakeContext(
  record: GuidedVoiceTakeRecordInput,
): GuidedVoiceTakeContextV1 | null {
  if (
    record.source !== 'guided' ||
    record.contextVersion !== GUIDED_VOICE_TAKE_CONTEXT_VERSION ||
    record.title !== GUIDED_VOICE_TAKE_TITLE
  ) {
    return null
  }

  try {
    return validatedContext({
      context: JSON.parse(record.contextJson) as unknown,
      durationMs: record.durationMs,
      comparisonKey: record.comparisonKey,
    })
  } catch {
    return null
  }
}

/**
 * A guided take may enter Twin Trails or Practice Loom only after its entire
 * persisted context validates against the row metadata and shared contracts.
 * Instrument Night replays stay in All Takes because vocal Atlas and Loom
 * analysis do not describe guitar, piano, or drum evidence.
 */
export function isVoiceTakeComparisonEligible(
  record: GuidedVoiceTakeRecordInput,
): boolean {
  return (
    takeSupportsVoiceAnalysis(record.source) &&
    (record.source !== 'guided' || parseGuidedVoiceTakeContext(record) !== null)
  )
}

/** Keep one explicitly accepted, dry guided capture in local voice history. */
export async function keepGuidedVoiceTake(input: {
  take: GuidedVoiceTakeCapture
  assessment: GuidedPersistedAssessmentContext
  reading: GuidedFocusReading
}): Promise<SaveVoiceTakeResult> {
  const context: GuidedVoiceTakeContextV1 = {
    kind: GUIDED_VOICE_TAKE_KIND,
    version: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
    assessment: input.assessment,
    reading: input.reading,
  }
  if (
    validatedContext({
      context,
      durationMs: input.take.durationMs,
      comparisonKey: input.assessment.comparisonFingerprint,
    }) === null
  ) {
    throw new Error('Guided voice take context failed validation')
  }

  return saveVoiceTake({
    source: 'guided',
    comparisonKey: input.assessment.comparisonFingerprint,
    contextVersion: GUIDED_VOICE_TAKE_CONTEXT_VERSION,
    capturedAt: input.take.capturedAt,
    durationMs: input.take.durationMs,
    blob: input.take.blob,
    peaks: input.take.peaks,
    contour: input.take.contour,
    title: GUIDED_VOICE_TAKE_TITLE,
    context,
  })
}
