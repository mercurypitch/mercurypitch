// ============================================================
// Drum take summaries — compact scalar-only rehearsal evidence
// ============================================================
//
// These rows deliberately exclude captured events, matches, device identity,
// MIDI data, media and free-form observations. They retain only bounded
// aggregate evidence from a deliberately finished take.

import { DRUM_SPEED_SCALE_MAX, DRUM_SPEED_SCALE_MIN, DRUM_TEMPO_MAX_BPM, DRUM_TEMPO_MIN_BPM, } from '@/features/drum-night/runtime/drum-transport'
import type { FirstPocketVariantId } from '@/features/drum-night/session/prepared-grooves'
import { FIRST_POCKET_VARIANTS } from '@/features/drum-night/session/prepared-grooves'

export const DRUM_TAKE_SUMMARY_SCHEMA_VERSION = 1
export const DRUM_TAKE_SUMMARY_LIMIT_PER_PROJECT = 100
export const DRUM_TAKE_SUMMARY_MAX_BYTES = 16 * 1024

const ID_MAX_LENGTH = 128
const MAX_COUNT = 1_000_000
const MAX_EVIDENCE_WINDOW_MS = 2_000
const MAX_MEAN_TIMING_OFFSET_MS = 2_000
const MAX_MEAN_VELOCITY_OFFSET = 127
const STEP_BEATS = 0.25
const PROJECT_FINGERPRINT = /^drum-v1-[a-f\d]{16}$/
const INPUT_SOURCE_ORDER = ['keyboard', 'midi', 'touch'] as const

export type DrumTakeInputSource = (typeof INPUT_SOURCE_ORDER)[number]
export type DrumTakeSummaryStatus =
  | 'ready'
  | 'no-targets'
  | 'no-captures'
  | 'insufficient-evidence'
export type DrumTakeEvidenceScope = 'timing-only' | 'timing-and-dynamics'

export interface DrumTakeEvidencePolicy {
  readonly version: 1
  readonly matchWindowMs: number
  readonly centredWindowMs: number
  readonly minimumConfidence: number
  readonly minimumMatchedHits: number
}

export interface DrumTakeRecovery {
  readonly focus: 'timing' | 'dynamics'
  readonly barNumber: number
}

export interface DrumTakeSummary {
  readonly schemaVersion: typeof DRUM_TAKE_SUMMARY_SCHEMA_VERSION
  readonly id: string
  readonly projectId: string
  readonly projectRevision: number
  readonly projectFingerprint: string
  readonly completedAt: string
  readonly variationId: FirstPocketVariantId
  readonly startBeat: number
  readonly endBeat: number
  readonly tempoBpm: number
  readonly speedScale: number
  readonly inputSources: readonly DrumTakeInputSource[]
  readonly evidencePolicy: DrumTakeEvidencePolicy
  readonly status: DrumTakeSummaryStatus
  readonly evidenceScope: DrumTakeEvidenceScope
  readonly confidence: number | null
  readonly targetHitCount: number
  readonly capturedHitCount: number
  readonly omittedCaptureHitCount: number
  readonly matchedHitCount: number
  readonly unmatchedTargetCount: number
  readonly unmatchedCaptureCount: number
  readonly uncertainTimingCount: number
  readonly earlyCount: number
  readonly centredCount: number
  readonly lateCount: number
  readonly meanTimingOffsetMs: number | null
  readonly meanAbsoluteTimingOffsetMs: number | null
  readonly meanVelocityOffset: number | null
  readonly meanAbsoluteVelocityOffset: number | null
  readonly recovery: DrumTakeRecovery | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => key in value)
}

function isBoundedId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= ID_MAX_LENGTH
  )
}

function isSafeCount(value: unknown, maximum = MAX_COUNT): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  )
}

function isFiniteBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  )
}

function isNullableFiniteBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number | null {
  return value === null || isFiniteBetween(value, minimum, maximum)
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    return new Date(value).toISOString() === value
  } catch {
    return false
  }
}

function jsonByteLength(value: unknown): number | null {
  try {
    const json = JSON.stringify(value)
    return typeof json === 'string'
      ? new TextEncoder().encode(json).byteLength
      : null
  } catch {
    return null
  }
}

function isVariantId(value: unknown): value is FirstPocketVariantId {
  return FIRST_POCKET_VARIANTS.some((variant) => variant.id === value)
}

function isInputSource(value: unknown): value is DrumTakeInputSource {
  return INPUT_SOURCE_ORDER.some((source) => source === value)
}

function readInputSources(
  value: unknown,
): readonly DrumTakeInputSource[] | null {
  if (!Array.isArray(value) || value.length > INPUT_SOURCE_ORDER.length) {
    return null
  }
  if (!value.every(isInputSource) || new Set(value).size !== value.length) {
    return null
  }
  const sorted = [...value].sort()
  if (sorted.some((source, index) => source !== value[index])) return null
  return Object.freeze(sorted)
}

function readEvidencePolicy(value: unknown): DrumTakeEvidencePolicy | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'version',
      'matchWindowMs',
      'centredWindowMs',
      'minimumConfidence',
      'minimumMatchedHits',
    ]) ||
    value.version !== 1 ||
    !isFiniteBetween(value.matchWindowMs, 1, MAX_EVIDENCE_WINDOW_MS) ||
    !isFiniteBetween(value.centredWindowMs, 1, value.matchWindowMs) ||
    !isFiniteBetween(value.minimumConfidence, 0, 1) ||
    !isSafeCount(value.minimumMatchedHits) ||
    value.minimumMatchedHits < 1
  ) {
    return null
  }
  return Object.freeze({
    version: 1,
    matchWindowMs: value.matchWindowMs,
    centredWindowMs: value.centredWindowMs,
    minimumConfidence: value.minimumConfidence,
    minimumMatchedHits: value.minimumMatchedHits,
  })
}

function readRecovery(value: unknown): DrumTakeRecovery | null | undefined {
  if (value === null) return null
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['focus', 'barNumber']) ||
    (value.focus !== 'timing' && value.focus !== 'dynamics') ||
    !isSafeCount(value.barNumber) ||
    value.barNumber < 1
  ) {
    return undefined
  }
  return Object.freeze({ focus: value.focus, barNumber: value.barNumber })
}

function readSummary(value: unknown): DrumTakeSummary | null {
  const byteLength = jsonByteLength(value)
  if (
    byteLength === null ||
    byteLength > DRUM_TAKE_SUMMARY_MAX_BYTES ||
    !isRecord(value) ||
    !hasExactKeys(value, [
      'schemaVersion',
      'id',
      'projectId',
      'projectRevision',
      'projectFingerprint',
      'completedAt',
      'variationId',
      'startBeat',
      'endBeat',
      'tempoBpm',
      'speedScale',
      'inputSources',
      'evidencePolicy',
      'status',
      'evidenceScope',
      'confidence',
      'targetHitCount',
      'capturedHitCount',
      'omittedCaptureHitCount',
      'matchedHitCount',
      'unmatchedTargetCount',
      'unmatchedCaptureCount',
      'uncertainTimingCount',
      'earlyCount',
      'centredCount',
      'lateCount',
      'meanTimingOffsetMs',
      'meanAbsoluteTimingOffsetMs',
      'meanVelocityOffset',
      'meanAbsoluteVelocityOffset',
      'recovery',
    ]) ||
    value.schemaVersion !== DRUM_TAKE_SUMMARY_SCHEMA_VERSION ||
    !isBoundedId(value.id) ||
    !isBoundedId(value.projectId) ||
    !isSafeCount(value.projectRevision) ||
    typeof value.projectFingerprint !== 'string' ||
    !PROJECT_FINGERPRINT.test(value.projectFingerprint) ||
    !isIsoTimestamp(value.completedAt) ||
    !isVariantId(value.variationId) ||
    !isFiniteBetween(value.startBeat, 0, Number.MAX_SAFE_INTEGER) ||
    !isFiniteBetween(value.endBeat, 0, Number.MAX_SAFE_INTEGER) ||
    value.endBeat <= value.startBeat ||
    !Number.isInteger(value.startBeat / STEP_BEATS) ||
    !Number.isInteger(value.endBeat / STEP_BEATS) ||
    !isFiniteBetween(value.tempoBpm, DRUM_TEMPO_MIN_BPM, DRUM_TEMPO_MAX_BPM) ||
    !isFiniteBetween(
      value.speedScale,
      DRUM_SPEED_SCALE_MIN,
      DRUM_SPEED_SCALE_MAX,
    ) ||
    (value.status !== 'ready' &&
      value.status !== 'no-targets' &&
      value.status !== 'no-captures' &&
      value.status !== 'insufficient-evidence') ||
    (value.evidenceScope !== 'timing-only' &&
      value.evidenceScope !== 'timing-and-dynamics') ||
    !isNullableFiniteBetween(value.confidence, 0, 1) ||
    !isSafeCount(value.targetHitCount) ||
    !isSafeCount(value.capturedHitCount) ||
    !isSafeCount(value.omittedCaptureHitCount) ||
    !isSafeCount(value.matchedHitCount) ||
    !isSafeCount(value.unmatchedTargetCount) ||
    !isSafeCount(value.unmatchedCaptureCount) ||
    !isSafeCount(value.uncertainTimingCount) ||
    !isSafeCount(value.earlyCount) ||
    !isSafeCount(value.centredCount) ||
    !isSafeCount(value.lateCount) ||
    !isNullableFiniteBetween(
      value.meanTimingOffsetMs,
      -MAX_MEAN_TIMING_OFFSET_MS,
      MAX_MEAN_TIMING_OFFSET_MS,
    ) ||
    !isNullableFiniteBetween(
      value.meanAbsoluteTimingOffsetMs,
      0,
      MAX_MEAN_TIMING_OFFSET_MS,
    ) ||
    !isNullableFiniteBetween(
      value.meanVelocityOffset,
      -MAX_MEAN_VELOCITY_OFFSET,
      MAX_MEAN_VELOCITY_OFFSET,
    ) ||
    !isNullableFiniteBetween(
      value.meanAbsoluteVelocityOffset,
      0,
      MAX_MEAN_VELOCITY_OFFSET,
    )
  ) {
    return null
  }
  const inputSources = readInputSources(value.inputSources)
  const evidencePolicy = readEvidencePolicy(value.evidencePolicy)
  const recovery = readRecovery(value.recovery)
  if (
    inputSources === null ||
    evidencePolicy === null ||
    recovery === undefined ||
    value.capturedHitCount + value.omittedCaptureHitCount < 1 ||
    value.matchedHitCount + value.unmatchedTargetCount !==
      value.targetHitCount ||
    value.matchedHitCount > value.capturedHitCount ||
    value.matchedHitCount + value.unmatchedCaptureCount !==
      value.capturedHitCount ||
    (value.meanTimingOffsetMs === null) !==
      (value.meanAbsoluteTimingOffsetMs === null) ||
    (value.meanVelocityOffset === null) !==
      (value.meanAbsoluteVelocityOffset === null) ||
    (value.meanTimingOffsetMs !== null &&
      value.meanAbsoluteTimingOffsetMs !== null &&
      Math.abs(value.meanTimingOffsetMs) >
        value.meanAbsoluteTimingOffsetMs + Number.EPSILON) ||
    (value.meanVelocityOffset !== null &&
      value.meanAbsoluteVelocityOffset !== null &&
      Math.abs(value.meanVelocityOffset) >
        value.meanAbsoluteVelocityOffset + Number.EPSILON) ||
    (value.evidenceScope === 'timing-only' &&
      (value.meanVelocityOffset !== null ||
        value.meanAbsoluteVelocityOffset !== null)) ||
    (value.status === 'no-targets' &&
      (value.targetHitCount !== 0 ||
        value.matchedHitCount !== 0 ||
        value.unmatchedTargetCount !== 0 ||
        recovery !== null)) ||
    (value.status === 'no-captures' &&
      (value.capturedHitCount !== 0 ||
        value.omittedCaptureHitCount === 0 ||
        value.matchedHitCount !== 0 ||
        value.unmatchedCaptureCount !== 0 ||
        value.confidence !== null ||
        value.meanAbsoluteTimingOffsetMs !== null ||
        value.meanAbsoluteVelocityOffset !== null ||
        recovery !== null)) ||
    (value.status === 'ready' &&
      (value.targetHitCount === 0 ||
        value.matchedHitCount < evidencePolicy.minimumMatchedHits ||
        value.confidence === null)) ||
    (value.status !== 'ready' &&
      (value.uncertainTimingCount !== 0 ||
        value.earlyCount !== 0 ||
        value.centredCount !== 0 ||
        value.lateCount !== 0 ||
        value.meanTimingOffsetMs !== null ||
        value.meanVelocityOffset !== null)) ||
    (value.status === 'ready' &&
      value.uncertainTimingCount +
        value.earlyCount +
        value.centredCount +
        value.lateCount !==
        value.matchedHitCount)
  ) {
    return null
  }

  return Object.freeze({
    schemaVersion: DRUM_TAKE_SUMMARY_SCHEMA_VERSION,
    id: value.id,
    projectId: value.projectId,
    projectRevision: value.projectRevision,
    projectFingerprint: value.projectFingerprint,
    completedAt: value.completedAt,
    variationId: value.variationId,
    startBeat: value.startBeat,
    endBeat: value.endBeat,
    tempoBpm: value.tempoBpm,
    speedScale: value.speedScale,
    inputSources,
    evidencePolicy,
    status: value.status,
    evidenceScope: value.evidenceScope,
    confidence: value.confidence,
    targetHitCount: value.targetHitCount,
    capturedHitCount: value.capturedHitCount,
    omittedCaptureHitCount: value.omittedCaptureHitCount,
    matchedHitCount: value.matchedHitCount,
    unmatchedTargetCount: value.unmatchedTargetCount,
    unmatchedCaptureCount: value.unmatchedCaptureCount,
    uncertainTimingCount: value.uncertainTimingCount,
    earlyCount: value.earlyCount,
    centredCount: value.centredCount,
    lateCount: value.lateCount,
    meanTimingOffsetMs: value.meanTimingOffsetMs,
    meanAbsoluteTimingOffsetMs: value.meanAbsoluteTimingOffsetMs,
    meanVelocityOffset: value.meanVelocityOffset,
    meanAbsoluteVelocityOffset: value.meanAbsoluteVelocityOffset,
    recovery,
  })
}

/** Validate and deeply freeze one untrusted scalar-only take row. */
export function validateDrumTakeSummary(value: unknown): DrumTakeSummary {
  const summary = readSummary(value)
  if (summary === null) throw new Error('Invalid Drum Night take summary.')
  return summary
}

/** Canonicalize the semantic input set before strict validation. */
export function normalizeDrumTakeSummary(
  summary: DrumTakeSummary,
): DrumTakeSummary {
  const inputSources = [...new Set(summary.inputSources)].sort()
  return validateDrumTakeSummary({ ...summary, inputSources })
}
