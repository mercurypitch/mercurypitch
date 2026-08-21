// ============================================================
// Drum Night coaching — bounded timing and dynamics evidence
// ============================================================
//
// Direct attacks match only the exact authored GM articulation, in source
// order. Room-mic onsets match simultaneous authored onset clusters because a
// single microphone cannot honestly separate instruments. Uncertainty lowers
// confidence and can withhold direction; it never widens the fixed window.

import { createBeatClock } from '@/lib/midi-tempo-clock'
import type { DrumScoreDocument, DrumScoreEvent, DrumScoreIndex, } from './drum-score'
import { createDrumScoreIndex, queryDrumScoreRange } from './drum-score'
import type { DrumSessionDocument } from './drum-session'

export type DrumDirectEvidenceSource = 'midi' | 'touch' | 'keyboard'

interface DrumCapturedHitBase {
  readonly id: string
  readonly beat: number
  /** Explicit source reliability, from zero to one. */
  readonly confidence?: number
  readonly timingUncertaintyMs?: number
}

export interface DrumCapturedDirectHit extends DrumCapturedHitBase {
  readonly source: DrumDirectEvidenceSource
  readonly gmKey: number
  readonly velocity: number
}

export interface DrumCapturedMicOnset extends DrumCapturedHitBase {
  readonly source: 'room-mic'
  /** A microphone onset needs an explicit detector confidence. */
  readonly confidence: number
  readonly timingUncertaintyMs: number
  readonly gmKey?: never
  readonly velocity?: never
}

export type DrumCapturedHit = DrumCapturedDirectHit | DrumCapturedMicOnset

export interface DrumCoachingMatch {
  /** First target, retained as a convenient representative. */
  readonly target: DrumScoreEvent
  /** One item for direct input; possibly simultaneous items for room mic. */
  readonly targetCluster: readonly DrumScoreEvent[]
  readonly captured: DrumCapturedHit
  readonly timingOffsetMs: number
  readonly timingUncertaintyMs: number
  readonly velocityOffset: number | null
  readonly confidence: number
}

export interface DrumRecoveryLoop {
  readonly startBeat: number
  readonly endBeat: number
  readonly barNumber: number
  readonly focus: 'timing' | 'dynamics'
  readonly label: string
  readonly instruction: string
}

export type DrumCoachingStatus =
  | 'ready'
  | 'no-targets'
  | 'no-captures'
  | 'insufficient-evidence'

export interface DrumCoachingResult {
  readonly status: DrumCoachingStatus
  readonly dataSourceLabel: string
  readonly confidenceLabel: string
  readonly confidence: number | null
  readonly evidenceScope: 'timing-only' | 'timing-and-dynamics'
  readonly targetHitCount: number
  /** Requested-range hits beyond this bounded coaching analysis. */
  readonly unindexedTargetHitCount: number
  readonly capturedHitCount: number
  readonly unprocessedCaptureHitCount: number
  /** Number of authored hits covered; a mic onset may cover a cluster. */
  readonly matchedHitCount: number
  readonly unmatchedTargetCount: number
  readonly unmatchedCaptureCount: number
  readonly matches: readonly DrumCoachingMatch[]
  readonly meanTimingOffsetMs: number | null
  readonly meanAbsoluteTimingOffsetMs: number | null
  readonly earlyCount: number
  readonly centredCount: number
  readonly lateCount: number
  readonly uncertainTimingCount: number
  readonly meanVelocityOffset: number | null
  readonly meanAbsoluteVelocityOffset: number | null
  readonly observation: string
  readonly recovery: DrumRecoveryLoop | null
}

export interface DrumCoachingOptions {
  readonly startBeat?: number
  readonly endBeat?: number
  readonly matchWindowMs?: number
  readonly centredWindowMs?: number
  readonly minimumConfidence?: number
  readonly minimumMatchedHits?: number
}

const MAX_COACHING_CAPTURES = 4096
const ONSET_CLUSTER_WINDOW_MS = 8
const VELOCITY_CENTRED_WINDOW = 14

const SOURCE_LABELS: Readonly<Record<DrumCapturedHit['source'], string>> = {
  midi: 'E-kit MIDI · mapped timing and velocity',
  touch: 'Touch kit · selected timing and velocity',
  keyboard: 'Keyboard kit · selected timing and velocity',
  'room-mic': 'Room mic · onset timing only',
}

interface TimedTarget {
  readonly index: number
  readonly event: DrumScoreEvent
  readonly milliseconds: number
}

interface TimedCapture {
  readonly index: number
  readonly hit: DrumCapturedHit
  readonly milliseconds: number
  readonly confidence: number
  readonly uncertaintyMs: number
}

interface TargetCluster {
  readonly targets: TimedTarget[]
  readonly milliseconds: number
}

function boundedConfidence(hit: DrumCapturedHit): number {
  if (hit.confidence === undefined) return 1
  if (!Number.isFinite(hit.confidence)) return 0
  return Math.min(1, Math.max(0, hit.confidence))
}

function boundedUncertainty(hit: DrumCapturedHit): number {
  if (!Number.isFinite(hit.timingUncertaintyMs)) return 0
  return Math.min(250, Math.max(0, hit.timingUncertaintyMs ?? 0))
}

function effectiveConfidence(hit: DrumCapturedHit, matchWindowMs: number) {
  const uncertaintyRatio = Math.min(
    1,
    boundedUncertainty(hit) / Math.max(1, matchWindowMs),
  )
  return boundedConfidence(hit) * (1 - uncertaintyRatio * uncertaintyRatio)
}

function isValidCapture(hit: DrumCapturedHit): boolean {
  if (!Number.isFinite(hit.beat) || hit.beat < 0) return false
  if (hit.source === 'room-mic') return true
  return (
    Number.isInteger(hit.gmKey) &&
    hit.gmKey >= 35 &&
    hit.gmKey <= 81 &&
    Number.isInteger(hit.velocity) &&
    hit.velocity >= 1 &&
    hit.velocity <= 127
  )
}

function sourceLabel(hits: readonly DrumCapturedHit[]): string {
  const sources = [...new Set(hits.map((hit) => hit.source))]
  if (sources.length === 0) return 'No captured input'
  return sources.map((source) => SOURCE_LABELS[source]).join(' + ')
}

function confidenceCopy(confidence: number | null): string {
  if (confidence === null) return 'No captured evidence'
  if (confidence >= 0.85) return 'High-confidence evidence'
  if (confidence >= 0.65) return 'Moderate-confidence evidence'
  return 'Low-confidence evidence'
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10
}

function emptyResult(options: {
  readonly status: DrumCoachingStatus
  readonly sources: readonly DrumCapturedHit[]
  readonly confidence: number | null
  readonly targetHitCount: number
  readonly unindexedTargetHitCount: number
  readonly capturedHitCount: number
  readonly unprocessedCaptureHitCount: number
  readonly observation: string
}): DrumCoachingResult {
  return {
    status: options.status,
    dataSourceLabel: sourceLabel(options.sources),
    confidenceLabel: confidenceCopy(options.confidence),
    confidence: options.confidence,
    evidenceScope: options.sources.some((hit) => hit.source !== 'room-mic')
      ? 'timing-and-dynamics'
      : 'timing-only',
    targetHitCount: options.targetHitCount,
    unindexedTargetHitCount: options.unindexedTargetHitCount,
    capturedHitCount: options.capturedHitCount,
    unprocessedCaptureHitCount: options.unprocessedCaptureHitCount,
    matchedHitCount: 0,
    unmatchedTargetCount: options.targetHitCount,
    unmatchedCaptureCount: options.capturedHitCount,
    matches: [],
    meanTimingOffsetMs: null,
    meanAbsoluteTimingOffsetMs: null,
    earlyCount: 0,
    centredCount: 0,
    lateCount: 0,
    uncertainTimingCount: 0,
    meanVelocityOffset: null,
    meanAbsoluteVelocityOffset: null,
    observation: options.observation,
    recovery: null,
  }
}

type PairDirection = 1 | 2 | 3

const PAIR_MATCH: PairDirection = 1
const PAIR_LEFT: PairDirection = 2
const PAIR_UP: PairDirection = 3

function pairCandidateWins(
  candidateCount: number,
  candidateCost: number,
  candidateDirection: PairDirection,
  currentCount: number,
  currentCost: number,
  currentDirection: PairDirection,
): boolean {
  if (candidateCount !== currentCount) return candidateCount > currentCount
  if (candidateCost !== currentCost) return candidateCost < currentCost
  // Stable tie: retain earlier authored targets, then earlier captures.
  return candidateDirection > currentDirection
}

/**
 * Match two sorted streams monotonically with an exact lexicographic goal:
 * maximum pair count, then minimum total absolute timing offset.
 *
 * Inputs are capped before this bounded dynamic program. Two score rows hold
 * objective values; one byte per cell retains a deterministic backtrace.
 */
function orderedPairs<Target, Capture>(options: {
  readonly targets: readonly Target[]
  readonly captures: readonly Capture[]
  readonly targetTime: (target: Target) => number
  readonly captureTime: (capture: Capture) => number
  readonly windowMs: number
}): readonly (readonly [Target, Capture])[] {
  const targetCount = options.targets.length
  const captureCount = options.captures.length
  if (targetCount === 0 || captureCount === 0) return []

  const columns = captureCount + 1
  const directions = new Uint8Array((targetCount + 1) * columns)
  let previousCounts = new Uint16Array(columns)
  let currentCounts = new Uint16Array(columns)
  let previousCosts = new Float64Array(columns)
  let currentCosts = new Float64Array(columns)

  for (let column = 1; column <= captureCount; column += 1) {
    directions[column] = PAIR_LEFT
  }

  for (let row = 1; row <= targetCount; row += 1) {
    currentCounts[0] = 0
    currentCosts[0] = 0
    directions[row * columns] = PAIR_UP
    const target = options.targets[row - 1]!
    const targetTime = options.targetTime(target)

    for (let column = 1; column <= captureCount; column += 1) {
      let bestCount = previousCounts[column] ?? 0
      let bestCost = previousCosts[column] ?? 0
      let bestDirection = PAIR_UP

      const leftCount = currentCounts[column - 1] ?? 0
      const leftCost = currentCosts[column - 1] ?? 0
      if (
        pairCandidateWins(
          leftCount,
          leftCost,
          PAIR_LEFT,
          bestCount,
          bestCost,
          bestDirection,
        )
      ) {
        bestCount = leftCount
        bestCost = leftCost
        bestDirection = PAIR_LEFT
      }

      const capture = options.captures[column - 1]!
      const absoluteOffset = Math.abs(options.captureTime(capture) - targetTime)
      if (absoluteOffset <= options.windowMs) {
        const matchCount = (previousCounts[column - 1] ?? 0) + 1
        const matchCost = (previousCosts[column - 1] ?? 0) + absoluteOffset
        if (
          pairCandidateWins(
            matchCount,
            matchCost,
            PAIR_MATCH,
            bestCount,
            bestCost,
            bestDirection,
          )
        ) {
          bestCount = matchCount
          bestCost = matchCost
          bestDirection = PAIR_MATCH
        }
      }

      currentCounts[column] = bestCount
      currentCosts[column] = bestCost
      directions[row * columns + column] = bestDirection
    }

    ;[previousCounts, currentCounts] = [currentCounts, previousCounts]
    ;[previousCosts, currentCosts] = [currentCosts, previousCosts]
  }

  const reversed: Array<readonly [Target, Capture]> = []
  let row = targetCount
  let column = captureCount
  while (row > 0 && column > 0) {
    const direction = directions[row * columns + column]
    if (direction === PAIR_MATCH) {
      reversed.push([options.targets[row - 1]!, options.captures[column - 1]!])
      row -= 1
      column -= 1
    } else if (direction === PAIR_LEFT) {
      column -= 1
    } else {
      row -= 1
    }
  }
  return reversed.reverse()
}

function groupDirectTargets(
  targets: readonly TimedTarget[],
): Map<number, TimedTarget[]> {
  const groups = new Map<number, TimedTarget[]>()
  for (const target of targets) {
    const group = groups.get(target.event.hit.gmKey) ?? []
    group.push(target)
    groups.set(target.event.hit.gmKey, group)
  }
  return groups
}

function groupDirectCaptures(
  captures: readonly TimedCapture[],
): Map<number, TimedCapture[]> {
  const groups = new Map<number, TimedCapture[]>()
  for (const capture of captures) {
    if (capture.hit.source === 'room-mic') continue
    const group = groups.get(capture.hit.gmKey) ?? []
    group.push(capture)
    groups.set(capture.hit.gmKey, group)
  }
  return groups
}

function clusterTargets(targets: readonly TimedTarget[]): TargetCluster[] {
  const clusters: TargetCluster[] = []
  for (const target of targets) {
    const current = clusters.at(-1)
    if (
      current !== undefined &&
      target.milliseconds - current.milliseconds <= ONSET_CLUSTER_WINDOW_MS
    ) {
      current.targets.push(target)
    } else {
      clusters.push({ milliseconds: target.milliseconds, targets: [target] })
    }
  }
  return clusters
}

function toMatch(
  targets: readonly TimedTarget[],
  capture: TimedCapture,
): DrumCoachingMatch | null {
  const representative = targets[0]
  if (representative === undefined) return null
  const hit = capture.hit
  return {
    target: representative.event,
    targetCluster: targets.map((target) => target.event),
    captured: hit,
    timingOffsetMs: rounded(capture.milliseconds - representative.milliseconds),
    timingUncertaintyMs: capture.uncertaintyMs,
    velocityOffset:
      hit.source === 'room-mic'
        ? null
        : hit.velocity - representative.event.hit.velocity,
    confidence: capture.confidence,
  }
}

function timingRecoverySeverity(
  match: DrumCoachingMatch,
  centredWindowMs: number,
): number {
  return Math.max(
    0,
    Math.abs(match.timingOffsetMs) -
      match.timingUncertaintyMs -
      centredWindowMs,
  )
}

type TimingClassification = 'early' | 'centred' | 'late' | 'uncertain'

function timingClassification(
  match: DrumCoachingMatch,
  centredWindowMs: number,
): TimingClassification {
  const offset = match.timingOffsetMs
  const uncertainty = match.timingUncertaintyMs
  if (Math.abs(offset) + uncertainty <= centredWindowMs) return 'centred'
  if (offset < 0 && offset + uncertainty < -centredWindowMs) return 'early'
  if (offset > 0 && offset - uncertainty > centredWindowMs) return 'late'
  return 'uncertain'
}

function dynamicsRecoverySeverity(match: DrumCoachingMatch): number | null {
  if (match.velocityOffset === null) return null
  return Math.max(0, Math.abs(match.velocityOffset) - VELOCITY_CENTRED_WINDOW)
}

function recoveryLoop(
  score: DrumScoreDocument,
  matches: readonly DrumCoachingMatch[],
  centredWindowMs: number,
): DrumRecoveryLoop | null {
  if (matches.length === 0) return null
  const timingSeverity =
    average(
      matches.map((match) => timingRecoverySeverity(match, centredWindowMs)),
    ) ?? 0
  const dynamicsValues = matches.flatMap((match) => {
    const value = dynamicsRecoverySeverity(match)
    return value === null ? [] : [value]
  })
  const dynamicsSeverity = average(dynamicsValues) ?? 0
  if (timingSeverity <= 0 && dynamicsSeverity <= 0) return null

  const focus =
    dynamicsSeverity / VELOCITY_CENTRED_WINDOW >
    timingSeverity / centredWindowMs
      ? 'dynamics'
      : 'timing'
  const bars = new Map<number, { total: number; count: number }>()
  for (const match of matches) {
    const severity =
      focus === 'timing'
        ? timingRecoverySeverity(match, centredWindowMs)
        : dynamicsRecoverySeverity(match)
    if (severity === null) continue
    const barIndex = match.target.barIndex
    const aggregate = bars.get(barIndex) ?? { total: 0, count: 0 }
    aggregate.total += severity
    aggregate.count += 1
    bars.set(barIndex, aggregate)
  }

  let selectedBarIndex: number | null = null
  let selectedAverage = Number.NEGATIVE_INFINITY
  for (const [barIndex, aggregate] of bars) {
    if (aggregate.count === 0) continue
    const barAverage = aggregate.total / aggregate.count
    if (
      barAverage > selectedAverage ||
      (barAverage === selectedAverage &&
        (selectedBarIndex === null || barIndex < selectedBarIndex))
    ) {
      selectedBarIndex = barIndex
      selectedAverage = barAverage
    }
  }
  if (selectedBarIndex === null || selectedAverage <= 0) return null
  const bar = score.bars[selectedBarIndex]
  if (bar === undefined) return null
  const barNumber = bar.index + 1
  return {
    startBeat: bar.startBeat,
    endBeat: bar.startBeat + bar.beats,
    barNumber,
    focus,
    label: `Repeat bar ${barNumber}`,
    instruction:
      focus === 'timing'
        ? 'Repeat this bar and place the captured attacks closer to the authored grid.'
        : 'Repeat this bar and keep the captured velocities closer to the authored accents.',
  }
}

/** Compare captured attacks with one authored session, without scoring technique. */
export function coachDrumSession(
  document: DrumSessionDocument,
  capturedHits: readonly DrumCapturedHit[],
  options: DrumCoachingOptions = {},
  providedIndex?: DrumScoreIndex,
): DrumCoachingResult {
  const index = providedIndex ?? createDrumScoreIndex(document)
  const score = index.score
  const startBeat = Math.max(0, options.startBeat ?? 0)
  const endBeat = Math.max(
    startBeat,
    Math.min(score.durationBeats, options.endBeat ?? score.durationBeats),
  )
  const matchWindowMs = Math.max(20, options.matchWindowMs ?? 120)
  const centredWindowMs = Math.max(5, options.centredWindowMs ?? 30)
  const minimumConfidence = Math.min(
    1,
    Math.max(0, options.minimumConfidence ?? 0.55),
  )
  const minimumMatchedHits = Math.max(1, options.minimumMatchedHits ?? 2)
  const beatToSeconds = createBeatClock(document.canonicalSong)
  const captureStartSeconds = beatToSeconds(startBeat) - matchWindowMs / 1000
  const captureEndSeconds = beatToSeconds(endBeat) + matchWindowMs / 1000
  const targetQuery = queryDrumScoreRange(index, {
    startBeat,
    endBeat,
    inclusiveEnd: true,
  })
  const targets = targetQuery.events
  const capturesInRange = capturedHits
    .filter(
      (hit) =>
        isValidCapture(hit) &&
        beatToSeconds(hit.beat) >= captureStartSeconds &&
        beatToSeconds(hit.beat) <= captureEndSeconds,
    )
    .sort(
      (left, right) =>
        left.beat - right.beat || left.id.localeCompare(right.id),
    )
  const captures = capturesInRange.slice(0, MAX_COACHING_CAPTURES)
  const unprocessedCaptureHitCount = Math.max(
    0,
    capturesInRange.length - captures.length,
  )
  const unindexedTargetHitCount = targetQuery.omittedEventCount
  const capturedConfidence = average(
    captures.map((hit) => effectiveConfidence(hit, matchWindowMs)),
  )

  if (targets.length === 0) {
    return emptyResult({
      status: 'no-targets',
      sources: captures,
      confidence: capturedConfidence,
      targetHitCount: 0,
      unindexedTargetHitCount,
      capturedHitCount: captures.length,
      unprocessedCaptureHitCount,
      observation: 'This range has no mapped authored drum attacks to compare.',
    })
  }
  if (captures.length === 0) {
    return emptyResult({
      status: 'no-captures',
      sources: [],
      confidence: null,
      targetHitCount: targets.length,
      unindexedTargetHitCount,
      capturedHitCount: 0,
      unprocessedCaptureHitCount,
      observation: 'Play the phrase once to collect timing evidence.',
    })
  }

  const timedTargets: TimedTarget[] = targets.map((event, index) => ({
    index,
    event,
    milliseconds: beatToSeconds(event.hit.startBeat) * 1000,
  }))
  const timedCaptures: TimedCapture[] = captures.map((hit, index) => ({
    index,
    hit,
    milliseconds: beatToSeconds(hit.beat) * 1000,
    confidence: effectiveConfidence(hit, matchWindowMs),
    uncertaintyMs: boundedUncertainty(hit),
  }))
  const eligibleCaptures = timedCaptures.filter(
    (capture) => capture.confidence >= minimumConfidence,
  )
  const directTargets = groupDirectTargets(timedTargets)
  const directCaptures = groupDirectCaptures(eligibleCaptures)
  const matchedTargetIndexes = new Set<number>()
  const matches: DrumCoachingMatch[] = []

  for (const gmKey of [...directTargets.keys()].sort(
    (left, right) => left - right,
  )) {
    const targetGroup = directTargets.get(gmKey) ?? []
    const captureGroup = directCaptures.get(gmKey) ?? []
    for (const [target, capture] of orderedPairs({
      targets: targetGroup,
      captures: captureGroup,
      targetTime: (value) => value.milliseconds,
      captureTime: (value) => value.milliseconds,
      windowMs: matchWindowMs,
    })) {
      const match = toMatch([target], capture)
      if (match === null) continue
      matchedTargetIndexes.add(target.index)
      matches.push(match)
    }
  }

  const remainingTargets = timedTargets.filter(
    (target) => !matchedTargetIndexes.has(target.index),
  )
  const microphoneCaptures = eligibleCaptures.filter(
    (capture) => capture.hit.source === 'room-mic',
  )
  for (const [cluster, capture] of orderedPairs({
    targets: clusterTargets(remainingTargets),
    captures: microphoneCaptures,
    targetTime: (value) => value.milliseconds,
    captureTime: (value) => value.milliseconds,
    windowMs: matchWindowMs,
  })) {
    const match = toMatch(cluster.targets, capture)
    if (match === null) continue
    for (const target of cluster.targets) matchedTargetIndexes.add(target.index)
    matches.push(match)
  }
  matches.sort(
    (left, right) =>
      left.target.hit.startBeat - right.target.hit.startBeat ||
      left.captured.beat - right.captured.beat ||
      left.captured.id.localeCompare(right.captured.id),
  )

  const confidence = average(matches.map((match) => match.confidence))
  const matchedHitCount = matches.reduce(
    (total, match) => total + match.targetCluster.length,
    0,
  )
  if (matches.length < minimumMatchedHits || confidence === null) {
    return {
      ...emptyResult({
        status: 'insufficient-evidence',
        sources: captures,
        confidence: capturedConfidence,
        targetHitCount: targets.length,
        unindexedTargetHitCount,
        capturedHitCount: captures.length,
        unprocessedCaptureHitCount,
        observation:
          'Not enough aligned, confident attacks were captured to make a timing claim.',
      }),
      matchedHitCount,
      unmatchedTargetCount: Math.max(0, targets.length - matchedHitCount),
      unmatchedCaptureCount: Math.max(0, captures.length - matches.length),
      matches,
    }
  }

  const timingOffsets = matches.map((match) => match.timingOffsetMs)
  const meanTimingOffsetMs = rounded(average(timingOffsets) ?? 0)
  const meanAbsoluteTimingOffsetMs = rounded(
    average(timingOffsets.map(Math.abs)) ?? 0,
  )
  const velocityOffsets = matches.flatMap((match) =>
    match.velocityOffset === null ? [] : [match.velocityOffset],
  )
  const meanVelocityOffset =
    velocityOffsets.length === 0 ? null : rounded(average(velocityOffsets) ?? 0)
  const meanAbsoluteVelocityOffset =
    velocityOffsets.length === 0
      ? null
      : rounded(average(velocityOffsets.map(Math.abs)) ?? 0)
  let earlyCount = 0
  let centredCount = 0
  let lateCount = 0
  let uncertainTimingCount = 0
  const earlyOffsets: number[] = []
  const lateOffsets: number[] = []
  for (const match of matches) {
    switch (timingClassification(match, centredWindowMs)) {
      case 'centred':
        centredCount += 1
        break
      case 'uncertain':
        uncertainTimingCount += 1
        break
      case 'early':
        earlyCount += 1
        earlyOffsets.push(Math.abs(match.timingOffsetMs))
        break
      case 'late':
        lateCount += 1
        lateOffsets.push(match.timingOffsetMs)
        break
    }
  }

  let observation: string
  if (earlyCount > matches.length / 2) {
    observation = `Matched attacks landed about ${Math.round(average(earlyOffsets) ?? 0)} ms early.`
  } else if (lateCount > matches.length / 2) {
    observation = `Matched attacks landed about ${Math.round(average(lateOffsets) ?? 0)} ms late.`
  } else if (uncertainTimingCount > 0) {
    observation =
      'Capture uncertainty does not support an early-or-late direction for this take.'
  } else if (
    meanAbsoluteVelocityOffset !== null &&
    meanAbsoluteVelocityOffset >= VELOCITY_CENTRED_WINDOW
  ) {
    observation = `Timing stayed centred; captured velocities differed from the authored accents by ${Math.round(meanAbsoluteVelocityOffset)} on average.`
  } else {
    observation = `Matched attacks stayed within ${Math.round(meanAbsoluteTimingOffsetMs)} ms of the authored grid on average.`
  }

  return {
    status: 'ready',
    dataSourceLabel: sourceLabel(captures),
    confidenceLabel: confidenceCopy(confidence),
    confidence,
    evidenceScope:
      velocityOffsets.length === 0 ? 'timing-only' : 'timing-and-dynamics',
    targetHitCount: targets.length,
    unindexedTargetHitCount,
    capturedHitCount: captures.length,
    unprocessedCaptureHitCount,
    matchedHitCount,
    unmatchedTargetCount: Math.max(0, targets.length - matchedHitCount),
    unmatchedCaptureCount: Math.max(0, captures.length - matches.length),
    matches,
    meanTimingOffsetMs,
    meanAbsoluteTimingOffsetMs,
    earlyCount,
    centredCount,
    lateCount,
    uncertainTimingCount,
    meanVelocityOffset,
    meanAbsoluteVelocityOffset,
    observation,
    recovery: recoveryLoop(score, matches, centredWindowMs),
  }
}
