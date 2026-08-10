// Guitar Doctor history keeps a bounded, scalar-only record of local reviews.
// ============================================================
//
// A history entry is deliberately rebuilt from a phrase review instead of
// serialising that review. Evidence identifiers, event streams, recovery copy,
// and audio can therefore never cross this storage boundary by accident.

import type { GuitarPhraseAvailableMetric, GuitarPhraseMetricConfidence, GuitarPhraseReview, } from './guitar-phrase-review'
import type { GuitarTakeClockSnapshot, GuitarTakeLatencyProvenance, } from './guitar-take-recorder'

export const GUITAR_DOCTOR_HISTORY_SCHEMA_VERSION = 1
export const GUITAR_DOCTOR_HISTORY_STORAGE_KEY =
  'mercurypitch.guitar-doctor-history.v1'
export const GUITAR_DOCTOR_HISTORY_LIMIT = 8

const MAX_STORED_BYTES = 32_768

export interface GuitarDoctorHistoryContext {
  tempoBpm: number
  playbackRate: number
  completed: boolean
  nonTruncated: boolean
  sampleRate: number
  attackPrecision: GuitarTakeClockSnapshot['attack']['precision']
  latencyProvenance: GuitarTakeLatencyProvenance
}

export interface GuitarDoctorEvidenceQuality {
  confidence: GuitarPhraseMetricConfidence
  eventCount: number
  targetCount: number
}

export interface GuitarDoctorTimingSummary extends GuitarDoctorEvidenceQuality {
  matchedAttacks: number
  medianAbsoluteDeviationMs: number
}

export interface GuitarDoctorOffsetSummary extends GuitarDoctorEvidenceQuality {
  matchedAttacks: number
  medianOffsetMs: number
}

export interface GuitarDoctorPitchSummary extends GuitarDoctorEvidenceQuality {
  comparedEvents: number
  exactMidiMatches: number
  differentMidiEvents: number
  exactMatchRatio: number
  medianClarity: number
}

export interface GuitarDoctorHistorySummary {
  schemaVersion: typeof GUITAR_DOCTOR_HISTORY_SCHEMA_VERSION
  savedAt: number
  referenceId: string
  trackId: string
  range: { startBeat: number; endBeat: number }
  tempoBpm: number
  playbackRate: number
  provenance: {
    completed: boolean
    nonTruncated: boolean
    sampleRate: number
    attackPrecision: GuitarTakeClockSnapshot['attack']['precision']
    latencyProvenance: GuitarTakeLatencyProvenance
  }
  counts: {
    targets: number
    events: number
    attacks: number
  }
  metrics: {
    timingConsistency?: GuitarDoctorTimingSummary
    calibratedOffset?: GuitarDoctorOffsetSummary
    pitchRelationship?: GuitarDoctorPitchSummary
  }
}

type AvailableMetric = GuitarPhraseAvailableMetric<unknown>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNonNegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && isNonNegative(value)
}

function isPositive(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512
}

function isConfidence(value: unknown): value is GuitarPhraseMetricConfidence {
  return value === 'limited' || value === 'supported'
}

function isAttackPrecision(
  value: unknown,
): value is GuitarTakeClockSnapshot['attack']['precision'] {
  return value === 'sample-exact' || value === 'coarse-frame-loop'
}

function isLatencyProvenance(
  value: unknown,
): value is GuitarTakeLatencyProvenance {
  return value === 'stored-round-trip' || value === 'none'
}

function evidenceQuality(metric: AvailableMetric): GuitarDoctorEvidenceQuality {
  return {
    confidence: metric.confidence,
    eventCount: metric.evidence.eventIds.length,
    targetCount: metric.evidence.targetIds.length,
  }
}

function compactMetrics(
  review: GuitarPhraseReview,
  context: GuitarDoctorHistoryContext,
): GuitarDoctorHistorySummary['metrics'] {
  const metrics: GuitarDoctorHistorySummary['metrics'] = {}
  if (!context.completed || !context.nonTruncated) return metrics

  const timing = review.metrics.timingConsistency
  if (
    context.attackPrecision === 'sample-exact' &&
    timing.status === 'available' &&
    isCount(timing.value.matchedAttacks) &&
    isNonNegative(timing.value.medianAbsoluteDeviationMs)
  ) {
    metrics.timingConsistency = {
      ...evidenceQuality(timing),
      matchedAttacks: timing.value.matchedAttacks,
      medianAbsoluteDeviationMs: timing.value.medianAbsoluteDeviationMs,
    }
  }

  const offset = review.metrics.calibratedOffset
  if (
    context.attackPrecision === 'sample-exact' &&
    context.latencyProvenance === 'stored-round-trip' &&
    offset.status === 'available' &&
    isCount(offset.value.matchedAttacks) &&
    isFiniteNumber(offset.value.medianOffsetMs)
  ) {
    metrics.calibratedOffset = {
      ...evidenceQuality(offset),
      matchedAttacks: offset.value.matchedAttacks,
      medianOffsetMs: offset.value.medianOffsetMs,
    }
  }

  const pitch = review.metrics.pitchRelationship
  if (
    pitch.status === 'available' &&
    isCount(pitch.value.comparedEvents) &&
    isCount(pitch.value.exactMidiMatches) &&
    isCount(pitch.value.differentMidiEvents) &&
    isFiniteNumber(pitch.value.exactMatchRatio) &&
    pitch.value.exactMatchRatio >= 0 &&
    pitch.value.exactMatchRatio <= 1 &&
    isFiniteNumber(pitch.value.medianClarity) &&
    pitch.value.medianClarity >= 0 &&
    pitch.value.medianClarity <= 1
  ) {
    metrics.pitchRelationship = {
      ...evidenceQuality(pitch),
      comparedEvents: pitch.value.comparedEvents,
      exactMidiMatches: pitch.value.exactMidiMatches,
      differentMidiEvents: pitch.value.differentMidiEvents,
      exactMatchRatio: pitch.value.exactMatchRatio,
      medianClarity: pitch.value.medianClarity,
    }
  }

  return metrics
}

/** Build the only shape that may cross the Guitar Doctor storage boundary. */
export function summarizeGuitarDoctorReview(
  review: GuitarPhraseReview,
  context: GuitarDoctorHistoryContext,
  savedAt: number = Date.now(),
): GuitarDoctorHistorySummary | null {
  if (
    review.schemaVersion !== 1 ||
    !isIdentifier(review.referenceId) ||
    !isIdentifier(review.trackId) ||
    !isFiniteNumber(review.range.startBeat) ||
    !isFiniteNumber(review.range.endBeat) ||
    review.range.endBeat <= review.range.startBeat ||
    !isCount(review.targetCount) ||
    !isCount(review.eventCount) ||
    !isCount(review.attackCount) ||
    !isNonNegative(savedAt) ||
    !isPositive(context.tempoBpm) ||
    !isPositive(context.playbackRate) ||
    typeof context.completed !== 'boolean' ||
    typeof context.nonTruncated !== 'boolean' ||
    !isPositive(context.sampleRate) ||
    !isAttackPrecision(context.attackPrecision) ||
    !isLatencyProvenance(context.latencyProvenance)
  ) {
    return null
  }

  return {
    schemaVersion: GUITAR_DOCTOR_HISTORY_SCHEMA_VERSION,
    savedAt,
    referenceId: review.referenceId,
    trackId: review.trackId,
    range: { ...review.range },
    tempoBpm: context.tempoBpm,
    playbackRate: context.playbackRate,
    provenance: {
      completed: context.completed,
      nonTruncated: context.nonTruncated,
      sampleRate: context.sampleRate,
      attackPrecision: context.attackPrecision,
      latencyProvenance: context.latencyProvenance,
    },
    counts: {
      targets: review.targetCount,
      events: review.eventCount,
      attacks: review.attackCount,
    },
    metrics: compactMetrics(review, context),
  }
}

function readQuality(value: unknown): GuitarDoctorEvidenceQuality | null {
  if (
    !isRecord(value) ||
    !isConfidence(value.confidence) ||
    !isCount(value.eventCount) ||
    !isCount(value.targetCount)
  ) {
    return null
  }
  return {
    confidence: value.confidence,
    eventCount: value.eventCount,
    targetCount: value.targetCount,
  }
}

function readTiming(value: unknown): GuitarDoctorTimingSummary | undefined {
  const quality = readQuality(value)
  if (
    quality === null ||
    !isRecord(value) ||
    !isCount(value.matchedAttacks) ||
    !isNonNegative(value.medianAbsoluteDeviationMs)
  ) {
    return undefined
  }
  return {
    ...quality,
    matchedAttacks: value.matchedAttacks,
    medianAbsoluteDeviationMs: value.medianAbsoluteDeviationMs,
  }
}

function readOffset(value: unknown): GuitarDoctorOffsetSummary | undefined {
  const quality = readQuality(value)
  if (
    quality === null ||
    !isRecord(value) ||
    !isCount(value.matchedAttacks) ||
    !isFiniteNumber(value.medianOffsetMs)
  ) {
    return undefined
  }
  return {
    ...quality,
    matchedAttacks: value.matchedAttacks,
    medianOffsetMs: value.medianOffsetMs,
  }
}

function readPitch(value: unknown): GuitarDoctorPitchSummary | undefined {
  const quality = readQuality(value)
  if (
    quality === null ||
    !isRecord(value) ||
    !isCount(value.comparedEvents) ||
    !isCount(value.exactMidiMatches) ||
    !isCount(value.differentMidiEvents) ||
    !isFiniteNumber(value.exactMatchRatio) ||
    value.exactMatchRatio < 0 ||
    value.exactMatchRatio > 1 ||
    !isFiniteNumber(value.medianClarity) ||
    value.medianClarity < 0 ||
    value.medianClarity > 1
  ) {
    return undefined
  }
  return {
    ...quality,
    comparedEvents: value.comparedEvents,
    exactMidiMatches: value.exactMidiMatches,
    differentMidiEvents: value.differentMidiEvents,
    exactMatchRatio: value.exactMatchRatio,
    medianClarity: value.medianClarity,
  }
}

function readSummary(value: unknown): GuitarDoctorHistorySummary | null {
  if (!isRecord(value)) return null
  const range = value.range
  const provenance = value.provenance
  const counts = value.counts
  const metricInput = value.metrics
  if (
    value.schemaVersion !== GUITAR_DOCTOR_HISTORY_SCHEMA_VERSION ||
    !isNonNegative(value.savedAt) ||
    !isIdentifier(value.referenceId) ||
    !isIdentifier(value.trackId) ||
    !isRecord(range) ||
    !isFiniteNumber(range.startBeat) ||
    !isFiniteNumber(range.endBeat) ||
    range.endBeat <= range.startBeat ||
    !isPositive(value.tempoBpm) ||
    !isPositive(value.playbackRate) ||
    !isRecord(provenance) ||
    typeof provenance.completed !== 'boolean' ||
    typeof provenance.nonTruncated !== 'boolean' ||
    !isPositive(provenance.sampleRate) ||
    !isAttackPrecision(provenance.attackPrecision) ||
    !isLatencyProvenance(provenance.latencyProvenance) ||
    !isRecord(counts) ||
    !isCount(counts.targets) ||
    !isCount(counts.events) ||
    !isCount(counts.attacks) ||
    !isRecord(metricInput)
  ) {
    return null
  }

  const metrics: GuitarDoctorHistorySummary['metrics'] = {}
  if (provenance.completed && provenance.nonTruncated) {
    if (provenance.attackPrecision === 'sample-exact') {
      const timing = readTiming(metricInput.timingConsistency)
      if (timing !== undefined) metrics.timingConsistency = timing
      if (provenance.latencyProvenance === 'stored-round-trip') {
        const offset = readOffset(metricInput.calibratedOffset)
        if (offset !== undefined) metrics.calibratedOffset = offset
      }
    }
    const pitch = readPitch(metricInput.pitchRelationship)
    if (pitch !== undefined) metrics.pitchRelationship = pitch
  }

  return {
    schemaVersion: GUITAR_DOCTOR_HISTORY_SCHEMA_VERSION,
    savedAt: value.savedAt,
    referenceId: value.referenceId,
    trackId: value.trackId,
    range: { startBeat: range.startBeat, endBeat: range.endBeat },
    tempoBpm: value.tempoBpm,
    playbackRate: value.playbackRate,
    provenance: {
      completed: provenance.completed,
      nonTruncated: provenance.nonTruncated,
      sampleRate: provenance.sampleRate,
      attackPrecision: provenance.attackPrecision,
      latencyProvenance: provenance.latencyProvenance,
    },
    counts: {
      targets: counts.targets,
      events: counts.events,
      attacks: counts.attacks,
    },
    metrics,
  }
}

/** Load only canonical v1 summaries; corrupt or unavailable storage is empty. */
export function loadGuitarDoctorHistory(
  storage: Pick<Storage, 'getItem'>,
): GuitarDoctorHistorySummary[] {
  try {
    const raw = storage.getItem(GUITAR_DOCTOR_HISTORY_STORAGE_KEY)
    if (raw === null || raw.length > MAX_STORED_BYTES) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(readSummary)
      .filter(
        (summary): summary is GuitarDoctorHistorySummary => summary !== null,
      )
      .slice(-GUITAR_DOCTOR_HISTORY_LIMIT)
  } catch {
    return []
  }
}

/** Append one compact review, pruning oldest entries. Storage failures are soft. */
export function saveGuitarDoctorHistory(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  review: GuitarPhraseReview,
  context: GuitarDoctorHistoryContext,
  savedAt: number = Date.now(),
): GuitarDoctorHistorySummary | null {
  const summary = summarizeGuitarDoctorReview(review, context, savedAt)
  if (summary === null) return null
  const history = [...loadGuitarDoctorHistory(storage), summary].slice(
    -GUITAR_DOCTOR_HISTORY_LIMIT,
  )
  try {
    storage.setItem(GUITAR_DOCTOR_HISTORY_STORAGE_KEY, JSON.stringify(history))
    return summary
  } catch {
    return null
  }
}

function sameComparisonFrame(
  previous: GuitarDoctorHistorySummary,
  current: GuitarDoctorHistorySummary,
): boolean {
  return (
    previous.schemaVersion === current.schemaVersion &&
    previous.referenceId === current.referenceId &&
    previous.trackId === current.trackId &&
    previous.range.startBeat === current.range.startBeat &&
    previous.range.endBeat === current.range.endBeat &&
    previous.tempoBpm === current.tempoBpm &&
    previous.playbackRate === current.playbackRate &&
    previous.provenance.completed &&
    current.provenance.completed &&
    previous.provenance.nonTruncated &&
    current.provenance.nonTruncated &&
    previous.provenance.sampleRate === current.provenance.sampleRate &&
    previous.provenance.attackPrecision ===
      current.provenance.attackPrecision &&
    previous.provenance.latencyProvenance ===
      current.provenance.latencyProvenance &&
    previous.counts.targets === current.counts.targets
  )
}

function compatibleEvidence(
  previous: GuitarDoctorEvidenceQuality,
  current: GuitarDoctorEvidenceQuality,
): boolean {
  return (
    previous.confidence === current.confidence &&
    previous.eventCount > 0 &&
    current.eventCount > 0 &&
    previous.targetCount > 0 &&
    current.targetCount > 0
  )
}

function readable(value: number, decimals = 1): string {
  return Number(value.toFixed(decimals)).toString()
}

/** Compare two reviews only when their score, transport and evidence agree. */
export function compareGuitarDoctorSummaries(
  previous: GuitarDoctorHistorySummary,
  current: GuitarDoctorHistorySummary,
): string | null {
  if (!sameComparisonFrame(previous, current)) return null

  const previousOffset = previous.metrics.calibratedOffset
  const currentOffset = current.metrics.calibratedOffset
  if (
    previousOffset !== undefined &&
    currentOffset !== undefined &&
    compatibleEvidence(previousOffset, currentOffset)
  ) {
    const distanceChange =
      Math.abs(previousOffset.medianOffsetMs) -
      Math.abs(currentOffset.medianOffsetMs)
    if (Math.abs(distanceChange) >= 0.05) {
      return `Timing center moved ${readable(Math.abs(distanceChange))} ms ${distanceChange > 0 ? 'closer to' : 'farther from'} the beat.`
    }
    const signedChange =
      currentOffset.medianOffsetMs - previousOffset.medianOffsetMs
    if (Math.abs(signedChange) >= 0.05) {
      return `Timing center shifted ${readable(Math.abs(signedChange))} ms ${signedChange > 0 ? 'later' : 'earlier'}.`
    }
  }

  const previousTiming = previous.metrics.timingConsistency
  const currentTiming = current.metrics.timingConsistency
  if (
    previousTiming !== undefined &&
    currentTiming !== undefined &&
    compatibleEvidence(previousTiming, currentTiming)
  ) {
    const spreadChange =
      previousTiming.medianAbsoluteDeviationMs -
      currentTiming.medianAbsoluteDeviationMs
    if (Math.abs(spreadChange) >= 0.05) {
      return `Timing spread ${spreadChange > 0 ? 'narrowed' : 'widened'} by ${readable(Math.abs(spreadChange))} ms.`
    }
  }

  const previousPitch = previous.metrics.pitchRelationship
  const currentPitch = current.metrics.pitchRelationship
  if (
    previousPitch !== undefined &&
    currentPitch !== undefined &&
    compatibleEvidence(previousPitch, currentPitch)
  ) {
    const pointChange = Math.round(
      (currentPitch.exactMatchRatio - previousPitch.exactMatchRatio) * 100,
    )
    if (pointChange !== 0) {
      return `Exact-note matches ${pointChange > 0 ? 'rose' : 'fell'} by ${Math.abs(pointChange)} percentage ${Math.abs(pointChange) === 1 ? 'point' : 'points'}.`
    }
  }

  return null
}

/** Compare with the newest earlier entry from the same compatible range. */
export function compareGuitarDoctorWithHistory(
  history: readonly GuitarDoctorHistorySummary[],
  current: GuitarDoctorHistorySummary,
): string | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const previous = history[index]
    if (previous !== undefined && sameComparisonFrame(previous, current)) {
      return compareGuitarDoctorSummaries(previous, current)
    }
  }
  return null
}
