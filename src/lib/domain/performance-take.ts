// ============================================================
// Performance Take — local replay and scored-result contract
// ============================================================
//
// Hear Yourself still uses its original VoiceTake stores internally, but a
// kept Night-stage performance is not vocal evidence. This boundary keeps the
// compatible storage shape while declaring which sources may enter Voice
// Atlas and how each versioned score is read defensively.

import type { VoiceTakeRecord, VoiceTakeSource } from '@/db/entities'
import type { SaveVoiceTakeResult } from '@/db/services/voice-take-service'

export const PERFORMANCE_TAKE_CONTEXT_VERSION = 1
export const PERFORMANCE_TAKE_METRICS_VERSION = 1

// Keep the v1 projection self-contained: standalone Night rooms statically
// import this boundary, so importing feature implementations would join their
// bundles. These values mirror the producer contracts for persisted v1 takes.
const GUITAR_GRADE_MINIMUM_TARGETS_V1 = 4
const PIANO_HIT_SCORE_MINIMUM_V1 = 70
const PIANO_HIT_SCORE_MAXIMUM_V1 = 100
const PIANO_CAPTURE_MAX_NOTES_V1 = 10_000
const PIANO_CAPTURE_MAX_DURATION_MS_V1 = 5 * 60 * 1000
const DRUM_METRICS_MAX_COUNT_V1 = 1_000_000
const DRUM_READY_MINIMUM_MATCHED_HITS_V1 = 2

export type InstrumentNightTakeSource =
  | 'guitar-night'
  | 'piano-night'
  | 'drum-night'

export interface PreparedPerformanceTakeAudio {
  blob: Blob
  durationMs: number
  peaks: readonly number[] | Float32Array
  capturedAt: string
}

export interface KeepInstrumentNightTakeInput {
  source: InstrumentNightTakeSource
  comparisonKey: string
  title: string
  audio: PreparedPerformanceTakeAudio
  context: Record<string, unknown>
  metrics: Record<string, number | string | boolean | null>
}

export interface PerformanceTakeScoreStat {
  label: string
  value: string
}

export interface PerformanceTakeScoreSummary {
  eyebrow: string
  primaryValue: string
  primaryLabel: string
  grade: string | null
  stats: readonly PerformanceTakeScoreStat[]
}

export function isInstrumentNightTakeSource(
  source: VoiceTakeSource,
): source is InstrumentNightTakeSource {
  return (
    source === 'guitar-night' ||
    source === 'piano-night' ||
    source === 'drum-night'
  )
}

export function takeSupportsVoiceAnalysis(source: VoiceTakeSource): boolean {
  return !isInstrumentNightTakeSource(source)
}

export function performanceTakeSourceLabel(source: VoiceTakeSource): string {
  if (source === 'freeform') return 'Free practice'
  if (source === 'guided') return 'Guided check'
  if (source === 'legend') return 'Weekly Legend'
  if (source === 'guitar-night') return 'Guitar Night'
  if (source === 'piano-night') return 'Piano Night'
  if (source === 'drum-night') return 'Drum Night'
  return source[0]!.toUpperCase() + source.slice(1)
}

export async function keepInstrumentNightTake(
  input: KeepInstrumentNightTakeInput,
): Promise<SaveVoiceTakeResult> {
  const { saveVoiceTake } = await import('@/db/services/voice-take-service')
  return saveVoiceTake({
    source: input.source,
    comparisonKey: input.comparisonKey,
    contextVersion: PERFORMANCE_TAKE_CONTEXT_VERSION,
    capturedAt: input.audio.capturedAt,
    durationMs: input.audio.durationMs,
    blob: input.audio.blob,
    peaks: input.audio.peaks,
    title: input.title,
    context: input.context,
    metrics: input.metrics,
    metricsVersion: PERFORMANCE_TAKE_METRICS_VERSION,
  })
}

function parseMetrics(take: VoiceTakeRecord): Record<string, unknown> | null {
  if (
    take.metricsVersion !== PERFORMANCE_TAKE_METRICS_VERSION ||
    take.metricsJson === undefined
  ) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(take.metricsJson)
    return parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
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

function isSafeCount(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  )
}

function isNullableSafeCount(value: unknown): value is number | null {
  return value === null || isSafeCount(value)
}

type PerformanceGrade = 'S' | 'A' | 'B' | 'C' | 'D'

function isGrade(value: unknown): value is PerformanceGrade {
  return (
    value === 'S' ||
    value === 'A' ||
    value === 'B' ||
    value === 'C' ||
    value === 'D'
  )
}

function gradeForPercentage(percentage: number): PerformanceGrade {
  if (percentage >= 95) return 'S'
  if (percentage >= 85) return 'A'
  if (percentage >= 70) return 'B'
  if (percentage >= 50) return 'C'
  return 'D'
}

function guitarGrade(
  score: number,
  judgedTargets: number,
): PerformanceGrade | null {
  return judgedTargets < GUITAR_GRADE_MINIMUM_TARGETS_V1
    ? null
    : gradeForPercentage(score)
}

function roundedToTenth(value: number): number {
  return Math.round(value * 10) / 10
}

function isNullableFiniteBetween(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number | null {
  return value === null || isFiniteBetween(value, minimum, maximum)
}

function compactStats(
  stats: readonly (PerformanceTakeScoreStat | null)[],
): PerformanceTakeScoreStat[] {
  return stats.filter((stat): stat is PerformanceTakeScoreStat => stat !== null)
}

function parseKaraokeScore(
  metrics: Record<string, unknown>,
): PerformanceTakeScoreSummary | null {
  const accuracy = metrics.accuracyPct
  const hit = metrics.notesHit
  const total = metrics.notesTotal
  const cents = metrics.averageCentsOff
  const matched = metrics.matchedSamples
  const judged = metrics.judgedSamples
  if (
    !isFiniteBetween(accuracy, 0, 100) ||
    !isNullableSafeCount(hit) ||
    !isNullableSafeCount(total) ||
    (hit === null) !== (total === null) ||
    (hit !== null && total !== null && hit > total) ||
    !isSafeCount(cents) ||
    !isSafeCount(matched) ||
    !isSafeCount(judged) ||
    judged === 0 ||
    matched > judged ||
    !isGrade(metrics.grade) ||
    accuracy !== Math.round((matched / judged) * 100) ||
    metrics.grade !== gradeForPercentage((matched / judged) * 100)
  ) {
    return null
  }
  return {
    eyebrow: 'Karaoke score',
    primaryValue: `${Math.round(accuracy)}%`,
    primaryLabel: 'pitch accuracy',
    grade: metrics.grade,
    stats: compactStats([
      hit === null || total === null
        ? null
        : {
            label: 'Notes hit',
            value: `${Math.max(0, Math.round(hit))}/${Math.max(0, Math.round(total))}`,
          },
      { label: 'Average deviation', value: `±${Math.round(cents)}¢` },
      { label: 'Samples matched', value: String(matched) },
    ]),
  }
}

function parseGuitarScore(
  metrics: Record<string, unknown>,
): PerformanceTakeScoreSummary | null {
  const score = metrics.score
  const targetCount = metrics.targetCount
  const judgedTargets = metrics.judgedTargets
  const hitTargets = metrics.hitTargets
  const missedTargets = metrics.missedTargets
  const skippedTargets = metrics.skippedTargets
  const bestStreak = metrics.bestStreak
  const detectedGapCount = metrics.detectedGapCount
  if (
    !(score === null || isFiniteBetween(score, 0, 100)) ||
    !(metrics.grade === null || isGrade(metrics.grade)) ||
    !isSafeCount(targetCount) ||
    !isSafeCount(judgedTargets) ||
    !isSafeCount(hitTargets) ||
    !isSafeCount(missedTargets) ||
    !isSafeCount(skippedTargets) ||
    !isSafeCount(bestStreak) ||
    hitTargets + missedTargets !== judgedTargets ||
    judgedTargets + skippedTargets !== targetCount ||
    bestStreak > hitTargets ||
    metrics.basis !== 'cumulative' ||
    (metrics.evidenceStatus !== 'complete' &&
      metrics.evidenceStatus !== 'event-gap') ||
    !isSafeCount(detectedGapCount) ||
    (metrics.evidenceStatus === 'complete') !== (detectedGapCount === 0) ||
    (judgedTargets === 0) !== (score === null) ||
    (score !== null &&
      score !== roundedToTenth((hitTargets * 100) / judgedTargets)) ||
    metrics.grade !==
      (score === null ? null : guitarGrade(score, judgedTargets))
  ) {
    return null
  }
  return {
    eyebrow: 'Guitar Night score',
    primaryValue: score === null ? 'Unscored' : String(Math.round(score)),
    primaryLabel: score === null ? 'completed take' : 'out of 100',
    grade: metrics.grade,
    stats: [
      { label: 'Hit', value: String(hitTargets) },
      { label: 'Missed', value: String(missedTargets) },
      { label: 'Skipped', value: String(skippedTargets) },
      { label: 'Best streak', value: String(bestStreak) },
    ],
  }
}

function parsePianoScore(
  metrics: Record<string, unknown>,
): PerformanceTakeScoreSummary | null {
  const score = metrics.score
  const accuracy = metrics.accuracyPercent
  const hits = metrics.hits
  const misses = metrics.misses
  const judgedNotes = metrics.judgedNotes
  const skippedNotes = metrics.skippedNotes
  const totalNotes = metrics.totalNotes
  const bestStreak = metrics.bestStreak
  const playedNoteCount = metrics.playedNoteCount
  const capturedDurationMs = metrics.capturedDurationMs
  if (
    !isSafeCount(score) ||
    !isFiniteBetween(accuracy, 0, 100) ||
    !isSafeCount(hits) ||
    !isSafeCount(misses) ||
    !isSafeCount(judgedNotes) ||
    !isSafeCount(skippedNotes) ||
    !isSafeCount(totalNotes) ||
    !isSafeCount(bestStreak) ||
    !isSafeCount(playedNoteCount) ||
    !isSafeCount(capturedDurationMs) ||
    judgedNotes !== hits + misses ||
    totalNotes === 0 ||
    judgedNotes + skippedNotes !== totalNotes ||
    bestStreak > hits ||
    score < hits * PIANO_HIT_SCORE_MINIMUM_V1 ||
    score > hits * PIANO_HIT_SCORE_MAXIMUM_V1 ||
    accuracy !== (judgedNotes === 0 ? 0 : Math.round(score / judgedNotes)) ||
    playedNoteCount < 1 ||
    playedNoteCount > PIANO_CAPTURE_MAX_NOTES_V1 ||
    capturedDurationMs < 1 ||
    capturedDurationMs > PIANO_CAPTURE_MAX_DURATION_MS_V1
  ) {
    return null
  }
  return {
    eyebrow: 'Piano Night score',
    primaryValue: `${Math.round(accuracy)}%`,
    primaryLabel: 'note accuracy',
    grade: null,
    stats: [
      { label: 'Hit', value: String(hits) },
      { label: 'Missed', value: String(misses) },
      { label: 'Skipped', value: String(skippedNotes) },
      { label: 'Best streak', value: String(bestStreak) },
    ],
  }
}

function parseDrumScore(
  metrics: Record<string, unknown>,
): PerformanceTakeScoreSummary | null {
  const status = metrics.status
  const evidenceScope = metrics.evidenceScope
  const confidence = metrics.confidence
  const matched = metrics.matchedHitCount
  const targets = metrics.targetHitCount
  const captured = metrics.capturedHitCount
  const omitted = metrics.omittedCaptureHitCount
  const unmatchedTargets = metrics.unmatchedTargetCount
  const unmatchedCaptures = metrics.unmatchedCaptureCount
  const uncertain = metrics.uncertainTimingCount
  const early = metrics.earlyCount
  const centred = metrics.centredCount
  const late = metrics.lateCount
  const timing = metrics.meanTimingOffsetMs
  const absoluteTiming = metrics.meanAbsoluteTimingOffsetMs
  const velocity = metrics.meanVelocityOffset
  const absoluteVelocity = metrics.meanAbsoluteVelocityOffset
  const recoveryFocus = metrics.recoveryFocus
  const recoveryBarNumber = metrics.recoveryBarNumber
  if (
    (status !== 'ready' &&
      status !== 'no-targets' &&
      status !== 'no-captures' &&
      status !== 'insufficient-evidence') ||
    (evidenceScope !== 'timing-only' &&
      evidenceScope !== 'timing-and-dynamics') ||
    !isNullableFiniteBetween(confidence, 0, 1) ||
    !isSafeCount(matched, DRUM_METRICS_MAX_COUNT_V1) ||
    !isSafeCount(targets, DRUM_METRICS_MAX_COUNT_V1) ||
    !isSafeCount(captured, DRUM_METRICS_MAX_COUNT_V1) ||
    !isSafeCount(omitted, DRUM_METRICS_MAX_COUNT_V1) ||
    !isSafeCount(unmatchedTargets, DRUM_METRICS_MAX_COUNT_V1) ||
    !isSafeCount(unmatchedCaptures, DRUM_METRICS_MAX_COUNT_V1) ||
    !isSafeCount(uncertain, DRUM_METRICS_MAX_COUNT_V1) ||
    !isSafeCount(early, DRUM_METRICS_MAX_COUNT_V1) ||
    !isSafeCount(centred, DRUM_METRICS_MAX_COUNT_V1) ||
    !isSafeCount(late, DRUM_METRICS_MAX_COUNT_V1) ||
    !isNullableFiniteBetween(timing, -2_000, 2_000) ||
    !isNullableFiniteBetween(absoluteTiming, 0, 2_000) ||
    !isNullableFiniteBetween(velocity, -127, 127) ||
    !isNullableFiniteBetween(absoluteVelocity, 0, 127) ||
    (recoveryFocus !== null &&
      recoveryFocus !== 'timing' &&
      recoveryFocus !== 'dynamics') ||
    !(
      recoveryBarNumber === null ||
      (isSafeCount(recoveryBarNumber, DRUM_METRICS_MAX_COUNT_V1) &&
        recoveryBarNumber >= 1)
    ) ||
    (recoveryFocus === null) !== (recoveryBarNumber === null) ||
    captured + omitted < 1 ||
    matched + unmatchedTargets !== targets ||
    matched > captured ||
    matched + unmatchedCaptures !== captured ||
    (timing === null) !== (absoluteTiming === null) ||
    (velocity === null) !== (absoluteVelocity === null) ||
    (timing !== null &&
      absoluteTiming !== null &&
      Math.abs(timing) > absoluteTiming + Number.EPSILON) ||
    (velocity !== null &&
      absoluteVelocity !== null &&
      Math.abs(velocity) > absoluteVelocity + Number.EPSILON) ||
    (evidenceScope === 'timing-only' &&
      (velocity !== null || absoluteVelocity !== null)) ||
    (status === 'no-targets' &&
      (targets !== 0 ||
        matched !== 0 ||
        unmatchedTargets !== 0 ||
        recoveryFocus !== null)) ||
    (status === 'no-captures' &&
      (captured !== 0 ||
        omitted === 0 ||
        matched !== 0 ||
        unmatchedCaptures !== 0 ||
        confidence !== null ||
        absoluteTiming !== null ||
        absoluteVelocity !== null ||
        recoveryFocus !== null)) ||
    (status === 'ready' &&
      (targets === 0 ||
        matched < DRUM_READY_MINIMUM_MATCHED_HITS_V1 ||
        confidence === null)) ||
    (status !== 'ready' &&
      (uncertain !== 0 ||
        early !== 0 ||
        centred !== 0 ||
        late !== 0 ||
        timing !== null ||
        velocity !== null)) ||
    (status === 'ready' && uncertain + early + centred + late !== matched)
  ) {
    return null
  }
  return {
    eyebrow: 'Drum Night evidence',
    primaryValue: `${Math.max(0, Math.round(matched))}/${Math.max(0, Math.round(targets))}`,
    primaryLabel: 'matched attacks',
    grade: null,
    stats: compactStats([
      timing === null
        ? null
        : {
            label: 'Mean timing',
            value: `${timing > 0 ? '+' : ''}${Math.round(timing)} ms`,
          },
      { label: 'Early', value: String(early) },
      { label: 'Centred', value: String(centred) },
      { label: 'Late', value: String(late) },
      velocity === null
        ? null
        : {
            label: 'Mean velocity',
            value: `${velocity > 0 ? '+' : ''}${Math.round(velocity)}`,
          },
    ]),
  }
}

export function parsePerformanceTakeScore(
  take: VoiceTakeRecord,
): PerformanceTakeScoreSummary | null {
  const metrics = parseMetrics(take)
  if (metrics === null) return null
  if (take.source === 'karaoke') return parseKaraokeScore(metrics)
  if (take.source === 'guitar-night') return parseGuitarScore(metrics)
  if (take.source === 'piano-night') return parsePianoScore(metrics)
  if (take.source === 'drum-night') return parseDrumScore(metrics)
  return null
}
