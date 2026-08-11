// Guitar phrase review — evidence-bounded comparison of one take with one pinned score range.
// ============================================================
//
// The score clock is converted to integer transport frames when the assessment
// is scheduled. Review never rereads tempo, latency, or a live transport, so a
// later setting change cannot rewrite what the take meant. Unsupported claims
// remain explicit unavailable metrics instead of silently becoming zeroes.

import type { GuitarTakeEvent, GuitarTakeSnapshot, } from './guitar-take-recorder'
import type { GuitarInputHealthReading } from './input-events'
import { PITCH_ATTACH_WINDOW_MS } from './input-events'

export const GUITAR_PHRASE_REVIEW_SCHEMA_VERSION = 1
export const GUITAR_PHRASE_REVIEW_MIN_CLARITY = 0.6
export const GUITAR_PHRASE_REVIEW_MATCH_TOLERANCE_MS = 180
export const GUITAR_PHRASE_REVIEW_MAX_CALIBRATION_UNCERTAINTY_MS = 25

const MIN_OFFSET_MATCHES = 3
const MIN_CONSISTENCY_MATCHES = 4

export interface GuitarPhraseTargetInput {
  id: string
  midi: number
  startBeat: number
}

export interface GuitarPhraseTargetFrame extends GuitarPhraseTargetInput {
  /** Integer frame from the assessment range's exact score epoch. */
  onsetFrame: number
}

export interface GuitarPhraseAssessmentWindow {
  schemaVersion: typeof GUITAR_PHRASE_REVIEW_SCHEMA_VERSION
  id: string
  takeId: string
  referenceId: string
  trackId: string
  range: { startBeat: number; endBeat: number }
  sampleRate: number
  /** Absolute audio frame at the range's score epoch. */
  startedAtFrame: number
  /** Half-open length of the range, in the pinned score clock's frames. */
  durationFrames: number
  matchToleranceFrames: number
  minimumPitchClarity: number
  targets: readonly GuitarPhraseTargetFrame[]
}

export interface CreateGuitarPhraseAssessmentWindowOptions {
  id: string
  takeId: string
  referenceId: string
  trackId: string
  range: { startBeat: number; endBeat: number }
  startedAtSeconds: number
  sampleRate: number
  beatToSeconds(beat: number): number
  targets: readonly GuitarPhraseTargetInput[]
  matchToleranceMs?: number
  minimumPitchClarity?: number
}

export type GuitarPhraseMetricConfidence = 'limited' | 'supported'

export interface GuitarPhraseMetricEvidence {
  eventIds: readonly string[]
  targetIds: readonly string[]
}

export interface GuitarPhraseAvailableMetric<T> {
  status: 'available'
  value: T
  confidence: GuitarPhraseMetricConfidence
  evidence: GuitarPhraseMetricEvidence
}

export type GuitarPhraseUnavailableReason =
  | 'take-mismatch'
  | 'take-not-completed'
  | 'take-cancelled'
  | 'partial-take'
  | 'truncated-take'
  | 'input-health-unavailable'
  | 'input-silent'
  | 'input-clipping'
  | 'input-noisy'
  | 'input-uncertain'
  | 'no-targets'
  | 'no-attacks'
  | 'too-few-matched-attacks'
  | 'coarse-attack-clock'
  | 'uncalibrated-input'
  | 'calibration-uncertainty-unavailable'
  | 'calibration-too-variable'
  | 'insufficient-pitch-evidence'
  | 'polyphonic-target'
  | 'fast-passage-unverified'
  | 'reference-lacks-articulation'
  | 'release-evidence-unavailable'
  | 'continuous-pitch-unavailable'

export interface GuitarPhraseUnavailableMetric {
  status: 'unavailable'
  reason: GuitarPhraseUnavailableReason
  detail: string
}

export type GuitarPhraseReviewMetric<T> =
  | GuitarPhraseAvailableMetric<T>
  | GuitarPhraseUnavailableMetric

export interface GuitarPhraseTimingConsistency {
  matchedAttacks: number
  /** Median absolute deviation around the take's own median offset. */
  medianAbsoluteDeviationMs: number
}

export interface GuitarPhraseCalibratedOffset {
  matchedAttacks: number
  /** Negative is early, positive is late relative to the authored onset. */
  medianOffsetMs: number
  direction: 'early' | 'centered' | 'late'
}

export interface GuitarPhrasePitchRelationship {
  comparedEvents: number
  exactMidiMatches: number
  differentMidiEvents: number
  exactMatchRatio: number
  medianClarity: number
}

export interface GuitarPhraseReviewMetrics {
  timingConsistency: GuitarPhraseReviewMetric<GuitarPhraseTimingConsistency>
  calibratedOffset: GuitarPhraseReviewMetric<GuitarPhraseCalibratedOffset>
  pitchRelationship: GuitarPhraseReviewMetric<GuitarPhrasePitchRelationship>
  attackCompleteness: GuitarPhraseUnavailableMetric
  sustain: GuitarPhraseUnavailableMetric
  pitchCenter: GuitarPhraseUnavailableMetric
  pitchStability: GuitarPhraseUnavailableMetric
}

export type GuitarPhraseRecovery =
  | {
      kind: 'replay'
      label: string
      range: { startBeat: number; endBeat: number }
      countInBeats: number
    }
  | {
      kind: 'calibrate'
      label: string
      range: { startBeat: number; endBeat: number }
    }
  | {
      kind: 'slow-down'
      label: string
      range: { startBeat: number; endBeat: number }
      tempoScale: number
    }
  | {
      kind: 'shorten-range'
      label: string
      range: { startBeat: number; endBeat: number }
    }
  | {
      kind: 'choose-range'
      label: string
      range: { startBeat: number; endBeat: number }
    }

export interface GuitarPhraseReviewInput {
  window: GuitarPhraseAssessmentWindow
  take: GuitarTakeSnapshot
  /** A health verdict retained from this assessment, never the later live meter. */
  inputHealth: GuitarInputHealthReading | null
}

export interface GuitarPhraseReview {
  schemaVersion: typeof GUITAR_PHRASE_REVIEW_SCHEMA_VERSION
  windowId: string
  takeId: string
  referenceId: string
  trackId: string
  range: { startBeat: number; endBeat: number }
  targetCount: number
  eventCount: number
  attackCount: number
  metrics: GuitarPhraseReviewMetrics
  recovery: GuitarPhraseRecovery
}

interface TargetOnset {
  frame: number
  targets: readonly GuitarPhraseTargetFrame[]
}

interface TimedEvidence<T> {
  id: string
  frame: number
  value: T
}

interface MonotonicPair<TTarget, TEvent> {
  target: TimedEvidence<TTarget>
  event: TimedEvidence<TEvent>
}

const UNAVAILABLE_DETAIL: Record<GuitarPhraseUnavailableReason, string> = {
  'take-mismatch': 'This take does not belong to the scheduled review range.',
  'take-not-completed': 'Finish the take before opening its full review.',
  'take-cancelled': 'The take ended before any reviewable result was kept.',
  'partial-take': 'The take ended before the selected beat range finished.',
  'truncated-take':
    'Earlier events left the bounded review window, so the whole range cannot be judged.',
  'input-health-unavailable':
    'This take has no retained input-health reading, so its signal quality cannot be verified.',
  'input-silent': 'The assessment input did not contain a usable signal.',
  'input-clipping':
    'The assessment input clipped, so its timing and pitch evidence are not dependable.',
  'input-noisy':
    'The background was too close to the guitar level for a dependable review.',
  'input-uncertain':
    'The signal was present, but its pitch was too unstable for a dependable review.',
  'no-targets': 'The selected beat range contains no authored target onsets.',
  'no-attacks': 'No fresh attacks were retained inside this beat range.',
  'too-few-matched-attacks':
    'Too few attacks aligned with authored onsets for this timing measurement.',
  'coarse-attack-clock':
    'Precise attack timing was not available for this take.',
  'uncalibrated-input':
    'This input has no measured delay, so early or late offset is not shown.',
  'calibration-uncertainty-unavailable':
    'This timing calibration has no measured spread, so early or late offset is not shown.',
  'calibration-too-variable':
    'This timing calibration varied too much for dependable early or late feedback.',
  'insufficient-pitch-evidence':
    'Too few clear pitch readings aligned with this beat range.',
  'polyphonic-target':
    'This range contains simultaneous notes, while this review path is single-note only.',
  'fast-passage-unverified':
    'These note onsets are too close together for a dependable microphone pitch relationship.',
  'reference-lacks-articulation':
    'This reference does not retain pick-versus-legato intent, so attack completeness is not scored.',
  'release-evidence-unavailable':
    'This take does not contain note-release evidence, so sustain is not measured.',
  'continuous-pitch-unavailable':
    'This take contains identified events rather than a continuous pitch trace.',
}

function unavailable(
  reason: GuitarPhraseUnavailableReason,
): GuitarPhraseUnavailableMetric {
  return { status: 'unavailable', reason, detail: UNAVAILABLE_DETAIL[reason] }
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must not be empty.`)
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`)
}

function rounded(value: number, digits = 1): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0)
}

/**
 * Freeze score time into the integer frames the take recorder uses. Targets
 * follow the half-open `[A, B)` rule: an onset at B belongs to the next range.
 */
export function createGuitarPhraseAssessmentWindow(
  options: CreateGuitarPhraseAssessmentWindowOptions,
): GuitarPhraseAssessmentWindow {
  assertNonEmpty(options.id, 'id')
  assertNonEmpty(options.takeId, 'takeId')
  assertNonEmpty(options.referenceId, 'referenceId')
  assertNonEmpty(options.trackId, 'trackId')
  assertFinite(options.range.startBeat, 'range.startBeat')
  assertFinite(options.range.endBeat, 'range.endBeat')
  assertFinite(options.startedAtSeconds, 'startedAtSeconds')
  assertFinite(options.sampleRate, 'sampleRate')
  if (options.range.endBeat <= options.range.startBeat) {
    throw new RangeError('The assessment range must end after it starts.')
  }
  if (options.startedAtSeconds < 0) {
    throw new RangeError('startedAtSeconds must be non-negative.')
  }
  if (options.sampleRate <= 0) {
    throw new RangeError('sampleRate must be positive.')
  }

  const matchToleranceMs =
    options.matchToleranceMs ?? GUITAR_PHRASE_REVIEW_MATCH_TOLERANCE_MS
  const minimumPitchClarity =
    options.minimumPitchClarity ?? GUITAR_PHRASE_REVIEW_MIN_CLARITY
  assertFinite(matchToleranceMs, 'matchToleranceMs')
  assertFinite(minimumPitchClarity, 'minimumPitchClarity')
  if (matchToleranceMs <= 0) {
    throw new RangeError('matchToleranceMs must be positive.')
  }
  if (minimumPitchClarity < 0 || minimumPitchClarity > 1) {
    throw new RangeError('minimumPitchClarity must be between zero and one.')
  }

  const rangeStartSeconds = options.beatToSeconds(options.range.startBeat)
  const rangeEndSeconds = options.beatToSeconds(options.range.endBeat)
  assertFinite(rangeStartSeconds, 'beatToSeconds(range.startBeat)')
  assertFinite(rangeEndSeconds, 'beatToSeconds(range.endBeat)')
  if (rangeEndSeconds <= rangeStartSeconds) {
    throw new RangeError(
      'The pinned beat clock must increase across the range.',
    )
  }

  // Use the recorder's exact conversion: round each absolute clock boundary,
  // then subtract. Rounding the duration independently can differ by one frame
  // when the audio epoch itself falls between sample boundaries.
  const startedAtFrame = Math.round(
    options.startedAtSeconds * options.sampleRate,
  )
  const completedAtSeconds =
    options.startedAtSeconds + rangeEndSeconds - rangeStartSeconds
  const completedAtFrame = Math.round(completedAtSeconds * options.sampleRate)
  const durationFrames = completedAtFrame - startedAtFrame
  if (durationFrames < 1) {
    throw new RangeError('The assessment range must occupy at least one frame.')
  }

  const targetIds = new Set<string>()
  const targets: GuitarPhraseTargetFrame[] = []
  for (const target of options.targets) {
    assertNonEmpty(target.id, 'target.id')
    if (targetIds.has(target.id)) {
      throw new Error(`Duplicate phrase target id: ${target.id}`)
    }
    targetIds.add(target.id)
    assertFinite(target.midi, `target ${target.id} midi`)
    assertFinite(target.startBeat, `target ${target.id} startBeat`)
    if (
      !Number.isInteger(target.midi) ||
      target.midi < 0 ||
      target.midi > 127
    ) {
      throw new RangeError(
        `target ${target.id} midi must be an integer from 0 to 127.`,
      )
    }
    if (
      target.startBeat < options.range.startBeat ||
      target.startBeat >= options.range.endBeat
    ) {
      continue
    }
    const targetSeconds = options.beatToSeconds(target.startBeat)
    assertFinite(targetSeconds, `beatToSeconds(${target.startBeat})`)
    const targetAtSeconds =
      options.startedAtSeconds + targetSeconds - rangeStartSeconds
    const onsetFrame = Math.min(
      durationFrames - 1,
      Math.max(
        0,
        Math.round(targetAtSeconds * options.sampleRate) - startedAtFrame,
      ),
    )
    targets.push({ ...target, onsetFrame })
  }
  targets.sort(
    (left, right) =>
      left.onsetFrame - right.onsetFrame || left.id.localeCompare(right.id),
  )

  return {
    schemaVersion: GUITAR_PHRASE_REVIEW_SCHEMA_VERSION,
    id: options.id,
    takeId: options.takeId,
    referenceId: options.referenceId,
    trackId: options.trackId,
    range: { ...options.range },
    sampleRate: options.sampleRate,
    startedAtFrame,
    durationFrames,
    matchToleranceFrames: Math.max(
      1,
      Math.round((matchToleranceMs / 1000) * options.sampleRate),
    ),
    minimumPitchClarity,
    targets,
  }
}

function targetOnsets(
  targets: readonly GuitarPhraseTargetFrame[],
): TargetOnset[] {
  const groups: TargetOnset[] = []
  for (const target of targets) {
    const latest = groups[groups.length - 1]
    if (latest?.frame === target.onsetFrame) {
      latest.targets = [...latest.targets, target]
    } else {
      groups.push({ frame: target.onsetFrame, targets: [target] })
    }
  }
  return groups
}

function betterCandidate(
  candidateMatches: number,
  candidateCost: number,
  candidatePriority: number,
  currentMatches: number,
  currentCost: number,
  currentPriority: number,
): boolean {
  if (candidateMatches !== currentMatches) {
    return candidateMatches > currentMatches
  }
  if (candidateCost !== currentCost) return candidateCost < currentCost
  return candidatePriority > currentPriority
}

/** Maximum-cardinality, minimum-total-error ordered matching. */
function monotonicMatch<TTarget, TEvent>(
  targets: readonly TimedEvidence<TTarget>[],
  events: readonly TimedEvidence<TEvent>[],
  toleranceFrames: number,
): MonotonicPair<TTarget, TEvent>[] {
  const columns = events.length + 1
  const cells = (targets.length + 1) * columns
  const matches = new Int32Array(cells)
  const costs = new Float64Array(cells)
  const trace = new Uint8Array(cells)

  const cell = (targetIndex: number, eventIndex: number): number =>
    targetIndex * columns + eventIndex

  for (let targetIndex = 1; targetIndex <= targets.length; targetIndex += 1) {
    for (let eventIndex = 1; eventIndex <= events.length; eventIndex += 1) {
      const at = cell(targetIndex, eventIndex)
      const above = cell(targetIndex - 1, eventIndex)
      const left = cell(targetIndex, eventIndex - 1)
      let bestMatches = matches[above] ?? 0
      let bestCost = costs[above] ?? 0
      let bestTrace = 1 // Skip this target.
      let bestPriority = 1

      const leftMatches = matches[left] ?? 0
      const leftCost = costs[left] ?? 0
      if (
        betterCandidate(
          leftMatches,
          leftCost,
          2,
          bestMatches,
          bestCost,
          bestPriority,
        )
      ) {
        bestMatches = leftMatches
        bestCost = leftCost
        bestTrace = 2 // Skip this event.
        bestPriority = 2
      }

      const target = targets[targetIndex - 1]
      const event = events[eventIndex - 1]
      if (target !== undefined && event !== undefined) {
        const error = Math.abs(event.frame - target.frame)
        if (error <= toleranceFrames) {
          const diagonal = cell(targetIndex - 1, eventIndex - 1)
          const matched = (matches[diagonal] ?? 0) + 1
          const cost = (costs[diagonal] ?? 0) + error
          if (
            betterCandidate(
              matched,
              cost,
              3,
              bestMatches,
              bestCost,
              bestPriority,
            )
          ) {
            bestMatches = matched
            bestCost = cost
            bestTrace = 3
          }
        }
      }

      matches[at] = bestMatches
      costs[at] = bestCost
      trace[at] = bestTrace
    }
  }

  const pairs: MonotonicPair<TTarget, TEvent>[] = []
  let targetIndex = targets.length
  let eventIndex = events.length
  while (targetIndex > 0 && eventIndex > 0) {
    const direction = trace[cell(targetIndex, eventIndex)]
    if (direction === 3) {
      const target = targets[targetIndex - 1]
      const event = events[eventIndex - 1]
      if (target !== undefined && event !== undefined) {
        pairs.push({ target, event })
      }
      targetIndex -= 1
      eventIndex -= 1
    } else if (direction === 2) {
      eventIndex -= 1
    } else {
      targetIndex -= 1
    }
  }
  return pairs.reverse()
}

function commonUnavailableReason(
  input: GuitarPhraseReviewInput,
): GuitarPhraseUnavailableReason | null {
  const window = input.window
  const take = input.take
  if (
    take.id !== window.takeId ||
    take.clock.sampleRate !== window.sampleRate ||
    take.clock.startedAtFrame !== window.startedAtFrame
  ) {
    return 'take-mismatch'
  }
  if (take.lifecycle === 'cancelled') return 'take-cancelled'
  if (take.lifecycle !== 'completed' || take.durationFrames === null) {
    return 'take-not-completed'
  }
  if (take.durationFrames < window.durationFrames) return 'partial-take'
  if (take.truncated || take.droppedEventCount > 0) return 'truncated-take'
  if (window.targets.length === 0) return 'no-targets'
  if (input.inputHealth === null) return 'input-health-unavailable'
  if (input.inputHealth.state === 'silent') return 'input-silent'
  if (input.inputHealth.state === 'clipping') return 'input-clipping'
  if (input.inputHealth.state === 'noisy') return 'input-noisy'
  if (input.inputHealth.state === 'uncertain') return 'input-uncertain'
  return null
}

function confidenceFor(
  evidenceCount: number,
  inputHealth: GuitarInputHealthReading | null,
): GuitarPhraseMetricConfidence {
  return evidenceCount >= 4 && inputHealth?.state === 'good'
    ? 'supported'
    : 'limited'
}

function evidenceFromPairs<
  TTarget extends { targets: readonly GuitarPhraseTargetFrame[] },
  TEvent extends GuitarTakeEvent,
>(
  pairs: readonly MonotonicPair<TTarget, TEvent>[],
): GuitarPhraseMetricEvidence {
  return {
    eventIds: pairs.map((pair) => pair.event.id),
    targetIds: pairs.flatMap((pair) =>
      pair.target.value.targets.map((target) => target.id),
    ),
  }
}

function timingPairs(
  window: GuitarPhraseAssessmentWindow,
  events: readonly GuitarTakeEvent[],
): MonotonicPair<TargetOnset, GuitarTakeEvent>[] {
  const targets = targetOnsets(window.targets).map((target) => ({
    id: target.targets.map((note) => note.id).join('+'),
    frame: target.frame,
    value: target,
  }))
  const attacks = events
    .filter((event) => event.kind === 'attack')
    .map((event) => ({
      id: event.id,
      frame: event.compensatedTransportFrame,
      value: event,
    }))
  return monotonicMatch(targets, attacks, window.matchToleranceFrames)
}

function timingConsistencyMetric(
  input: GuitarPhraseReviewInput,
  events: readonly GuitarTakeEvent[],
  commonReason: GuitarPhraseUnavailableReason | null,
): GuitarPhraseReviewMetric<GuitarPhraseTimingConsistency> {
  if (commonReason !== null) return unavailable(commonReason)
  if (input.take.clock.attack.precision !== 'sample-exact') {
    return unavailable('coarse-attack-clock')
  }
  if (!events.some((event) => event.kind === 'attack')) {
    return unavailable('no-attacks')
  }
  const pairs = timingPairs(input.window, events)
  if (pairs.length < MIN_CONSISTENCY_MATCHES) {
    return unavailable('too-few-matched-attacks')
  }
  const offsets = pairs.map((pair) => pair.event.frame - pair.target.frame)
  const center = median(offsets)
  const deviation = median(offsets.map((offset) => Math.abs(offset - center)))
  return {
    status: 'available',
    value: {
      matchedAttacks: pairs.length,
      medianAbsoluteDeviationMs: rounded(
        (deviation / input.window.sampleRate) * 1000,
      ),
    },
    confidence: confidenceFor(pairs.length, input.inputHealth),
    evidence: evidenceFromPairs(pairs),
  }
}

function calibratedOffsetMetric(
  input: GuitarPhraseReviewInput,
  events: readonly GuitarTakeEvent[],
  commonReason: GuitarPhraseUnavailableReason | null,
): GuitarPhraseReviewMetric<GuitarPhraseCalibratedOffset> {
  if (commonReason !== null) return unavailable(commonReason)
  if (input.take.clock.attack.precision !== 'sample-exact') {
    return unavailable('coarse-attack-clock')
  }
  if (!events.some((event) => event.kind === 'attack')) {
    return unavailable('no-attacks')
  }
  const pairs = timingPairs(input.window, events)
  if (pairs.length < MIN_OFFSET_MATCHES) {
    return unavailable('too-few-matched-attacks')
  }
  if (input.take.clock.latency.provenance !== 'stored-round-trip') {
    return unavailable('uncalibrated-input')
  }
  const uncertaintySeconds = input.take.clock.latency.uncertaintySeconds
  if (
    uncertaintySeconds === null ||
    !Number.isFinite(uncertaintySeconds) ||
    uncertaintySeconds < 0
  ) {
    return unavailable('calibration-uncertainty-unavailable')
  }
  if (
    uncertaintySeconds * 1000 >
    GUITAR_PHRASE_REVIEW_MAX_CALIBRATION_UNCERTAINTY_MS
  ) {
    return unavailable('calibration-too-variable')
  }
  const medianOffsetFrames = median(
    pairs.map((pair) => pair.event.frame - pair.target.frame),
  )
  const medianOffsetMs = rounded(
    (medianOffsetFrames / input.window.sampleRate) * 1000,
  )
  return {
    status: 'available',
    value: {
      matchedAttacks: pairs.length,
      medianOffsetMs,
      direction:
        medianOffsetMs < 0 ? 'early' : medianOffsetMs > 0 ? 'late' : 'centered',
    },
    confidence: confidenceFor(pairs.length, input.inputHealth),
    evidence: evidenceFromPairs(pairs),
  }
}

function hasPolyphonicTarget(onsets: readonly TargetOnset[]): boolean {
  return onsets.some((onset) => onset.targets.length > 1)
}

function hasUnverifiedFastSpacing(
  onsets: readonly TargetOnset[],
  sampleRate: number,
): boolean {
  const minimumFrames = Math.round(
    ((PITCH_ATTACH_WINDOW_MS * 2) / 1000) * sampleRate,
  )
  return onsets.some(
    (onset, index) =>
      index > 0 &&
      onset.frame - (onsets[index - 1]?.frame ?? 0) < minimumFrames,
  )
}

function pitchRelationshipMetric(
  input: GuitarPhraseReviewInput,
  events: readonly GuitarTakeEvent[],
  commonReason: GuitarPhraseUnavailableReason | null,
): GuitarPhraseReviewMetric<GuitarPhrasePitchRelationship> {
  if (commonReason !== null) return unavailable(commonReason)
  const onsets = targetOnsets(input.window.targets)
  if (hasPolyphonicTarget(onsets)) return unavailable('polyphonic-target')

  const pitchedEvents = events
    .filter(
      (event) =>
        event.kind !== 'release' &&
        event.pitch !== null &&
        event.pitch.clarity >= input.window.minimumPitchClarity,
    )
    .map((event) => ({
      id: event.id,
      frame: event.compensatedTransportFrame,
      value: event,
    }))
  if (pitchedEvents.length === 0) {
    return unavailable('insufficient-pitch-evidence')
  }
  if (
    pitchedEvents.some((event) => event.value.source !== 'midi') &&
    hasUnverifiedFastSpacing(onsets, input.window.sampleRate)
  ) {
    return unavailable('fast-passage-unverified')
  }

  const targets = onsets.map((onset) => ({
    id: onset.targets[0]?.id ?? '',
    frame: onset.frame,
    value: onset,
  }))
  const pairs = monotonicMatch(
    targets,
    pitchedEvents,
    input.window.matchToleranceFrames,
  )
  if (pairs.length === 0) return unavailable('insufficient-pitch-evidence')

  const exactMidiMatches = pairs.filter(
    (pair) =>
      pair.event.value.pitch?.midi === pair.target.value.targets[0]?.midi,
  ).length
  const clarityValues = pairs.map(
    (pair) => pair.event.value.pitch?.clarity ?? 0,
  )
  return {
    status: 'available',
    value: {
      comparedEvents: pairs.length,
      exactMidiMatches,
      differentMidiEvents: pairs.length - exactMidiMatches,
      exactMatchRatio: exactMidiMatches / pairs.length,
      medianClarity: rounded(median(clarityValues), 2),
    },
    confidence: confidenceFor(pairs.length, input.inputHealth),
    evidence: evidenceFromPairs(pairs),
  }
}

function shorterRange(range: { startBeat: number; endBeat: number }): {
  startBeat: number
  endBeat: number
} {
  const length = range.endBeat - range.startBeat
  const shorterLength = Math.min(4, length > 1 ? length / 2 : length)
  return {
    startBeat: range.startBeat,
    endBeat: range.startBeat + shorterLength,
  }
}

function recoveryFor(
  input: GuitarPhraseReviewInput,
  commonReason: GuitarPhraseUnavailableReason | null,
  metrics: Pick<
    GuitarPhraseReviewMetrics,
    'calibratedOffset' | 'pitchRelationship'
  >,
): GuitarPhraseRecovery {
  const range = { ...input.window.range }
  if (commonReason === 'truncated-take') {
    return {
      kind: 'shorten-range',
      label: 'Review a shorter range',
      range: shorterRange(range),
    }
  }
  if (commonReason === 'no-targets') {
    return { kind: 'choose-range', label: 'Choose a range with notes', range }
  }
  if (
    commonReason === null &&
    metrics.pitchRelationship.status === 'available' &&
    metrics.pitchRelationship.value.comparedEvents >= 2 &&
    metrics.pitchRelationship.value.differentMidiEvents > 0
  ) {
    return {
      kind: 'slow-down',
      label: 'Slow down and replay',
      range,
      tempoScale: 0.85,
    }
  }
  if (
    commonReason === null &&
    metrics.calibratedOffset.status === 'unavailable' &&
    (metrics.calibratedOffset.reason === 'uncalibrated-input' ||
      metrics.calibratedOffset.reason ===
        'calibration-uncertainty-unavailable' ||
      metrics.calibratedOffset.reason === 'calibration-too-variable')
  ) {
    return { kind: 'calibrate', label: 'Calibrate timing', range }
  }
  return {
    kind: 'replay',
    label: 'Replay this range',
    range,
    countInBeats: 4,
  }
}

/** Review one completed take without rereading any mutable musical clock. */
export function reviewGuitarPhrase(
  input: GuitarPhraseReviewInput,
): GuitarPhraseReview {
  const events = input.take.events.filter(
    (event) =>
      event.compensatedTransportFrame >= 0 &&
      event.compensatedTransportFrame < input.window.durationFrames,
  )
  const commonReason = commonUnavailableReason(input)
  const timingConsistency = timingConsistencyMetric(input, events, commonReason)
  const calibratedOffset = calibratedOffsetMetric(input, events, commonReason)
  const pitchRelationship = pitchRelationshipMetric(input, events, commonReason)
  const metrics: GuitarPhraseReviewMetrics = {
    timingConsistency,
    calibratedOffset,
    pitchRelationship,
    attackCompleteness: unavailable('reference-lacks-articulation'),
    sustain: unavailable('release-evidence-unavailable'),
    pitchCenter: unavailable('continuous-pitch-unavailable'),
    pitchStability: unavailable('continuous-pitch-unavailable'),
  }

  return {
    schemaVersion: GUITAR_PHRASE_REVIEW_SCHEMA_VERSION,
    windowId: input.window.id,
    takeId: input.take.id,
    referenceId: input.window.referenceId,
    trackId: input.window.trackId,
    range: { ...input.window.range },
    targetCount: input.window.targets.length,
    eventCount: events.length,
    attackCount: events.filter((event) => event.kind === 'attack').length,
    metrics,
    recovery: recoveryFor(input, commonReason, metrics),
  }
}
