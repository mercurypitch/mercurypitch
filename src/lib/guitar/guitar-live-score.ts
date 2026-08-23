// ============================================================
// Guitar live score — bounded, evidence-honest feedback while a take is running.
// ============================================================
//
// This is deliberately not phrase review: it owns no diagnosis, history, or
// recovery advice. A room adapter gives it successive recorder snapshots and
// an explicit transport frame; it returns one small immutable display model.
// Missing recorder pages and input states that make pitch untrustworthy become
// skipped targets, never invented mistakes.

import type { GuitarInputProfileKind } from './guitar-input-profile'
import type { GuitarTakeEvent, GuitarTakeSnapshot, } from './guitar-take-recorder'
import type { GuitarInputHealth, GuitarInputHealthReading, } from './input-events'
import { PITCH_ATTACH_WINDOW_MS } from './input-events'

export const GUITAR_LIVE_SCORE_MATCH_TOLERANCE_MS = 180
export const GUITAR_LIVE_SCORE_MINIMUM_PITCH_CLARITY = 0.6
export const GUITAR_LIVE_SCORE_GRADE_MINIMUM_TARGETS = 4
export const GUITAR_LIVE_SCORE_ROLLING_TARGETS = 16

const RECENT_EVENT_IDENTITIES = 512

export type GuitarLiveScoreGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface GuitarLiveScoreTargetInput {
  id: string
  midi: number
  startBeat: number
}

export interface GuitarLiveScoreSource {
  referenceId: string
  trackId: string
  range: { startBeat: number; endBeat: number }
}

/** Optional deterministic counters for complexity regressions and profiling. */
export interface GuitarLiveScoreInstrumentation {
  onRetainedEventVisit?(): void
  onTargetVisit?(): void
}

export interface CreateGuitarLiveScoreEngineOptions {
  source: GuitarLiveScoreSource
  sampleRate: number
  beatToSeconds(beat: number): number
  targets: readonly GuitarLiveScoreTargetInput[]
  inputKind: GuitarInputProfileKind
  matchToleranceMs?: number
  minimumPitchClarity?: number
  instrumentation?: GuitarLiveScoreInstrumentation
}

export type GuitarLiveScoreSkipReason =
  | 'polyphonic-onset'
  | 'fast-passage'
  | 'input-clipping'
  | 'input-noisy'
  | 'input-uncertain'
  | 'event-gap'

export type GuitarLiveScoreJudgment = Readonly<
  | {
      targetId: string
      midi: number
      onsetFrame: number
      outcome: 'hit'
      score: number
      eventId: string
      timingOffsetMs: number
      skipReason: null
    }
  | {
      targetId: string
      midi: number
      onsetFrame: number
      outcome: 'miss'
      score: 0
      eventId: null
      timingOffsetMs: null
      skipReason: null
    }
  | {
      targetId: string
      midi: number
      onsetFrame: number
      outcome: 'skipped'
      score: null
      eventId: null
      timingOffsetMs: null
      skipReason: GuitarLiveScoreSkipReason
    }
>

export interface GuitarLiveScoreTotals {
  judgedTargets: number
  hitTargets: number
  missedTargets: number
  skippedTargets: number
  points: number
  possiblePoints: number
}

export type GuitarLiveScorePhase = 'active' | 'completed' | 'cancelled'
export type GuitarLiveScoreBasis = 'rolling-16' | 'cumulative'
export type GuitarLiveScoreEvidenceStatus = 'complete' | 'event-gap'

/** One bounded shape intended to be copied directly into a reactive signal. */
export interface GuitarLiveScoreDisplay {
  phase: GuitarLiveScorePhase
  basis: GuitarLiveScoreBasis
  score: number | null
  grade: GuitarLiveScoreGrade | null
  rollingScore: number | null
  rollingGrade: GuitarLiveScoreGrade | null
  cumulativeScore: number | null
  cumulativeGrade: GuitarLiveScoreGrade | null
  currentStreak: number
  bestStreak: number
  targetCount: number
  totals: Readonly<GuitarLiveScoreTotals>
  evidenceStatus: GuitarLiveScoreEvidenceStatus
  detectedGapCount: number
  recentJudgments: readonly GuitarLiveScoreJudgment[]
}

export type GuitarLiveScoreHealth =
  | GuitarInputHealth
  | GuitarInputHealthReading
  | null

export interface GuitarLiveScoreEngine {
  sample(
    take: GuitarTakeSnapshot,
    throughFrame: number,
    health: GuitarLiveScoreHealth,
  ): GuitarLiveScoreDisplay
  snapshot(): GuitarLiveScoreDisplay
}

interface TargetFrame extends GuitarLiveScoreTargetInput {
  onsetFrame: number
  skipReason: Extract<
    GuitarLiveScoreSkipReason,
    'polyphonic-onset' | 'fast-passage'
  > | null
}

interface GapInterval {
  startFrame: number
  endFrame: number
}

interface EventIdentity {
  kind: GuitarTakeEvent['kind']
  source: GuitarTakeEvent['source']
  voiceId: string | null
  frame: number
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must not be empty.`)
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`)
}

function scoreGrade(score: number, count: number): GuitarLiveScoreGrade | null {
  if (count < GUITAR_LIVE_SCORE_GRADE_MINIMUM_TARGETS) return null
  if (score >= 95) return 'S'
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}

function average(points: number, count: number): number | null {
  return count === 0 ? null : Math.round((points / count) * 10) / 10
}

function inputHealthState(
  health: GuitarLiveScoreHealth,
): GuitarInputHealth | null {
  return typeof health === 'string' ? health : (health?.state ?? null)
}

function healthSkipReason(
  health: GuitarLiveScoreHealth,
): GuitarLiveScoreSkipReason | null {
  const state = inputHealthState(health)
  if (state === 'clipping') return 'input-clipping'
  if (state === 'noisy') return 'input-noisy'
  if (state === 'uncertain') return 'input-uncertain'
  return null
}

function freezeJudgment(
  judgment: GuitarLiveScoreJudgment,
): GuitarLiveScoreJudgment {
  return Object.freeze(judgment)
}

function sameIdentity(
  identity: EventIdentity,
  event: GuitarTakeEvent,
): boolean {
  return (
    identity.kind === event.kind &&
    identity.source === event.source &&
    identity.voiceId === event.voiceId &&
    identity.frame === event.compensatedTransportFrame
  )
}

function createTargets(
  options: CreateGuitarLiveScoreEngineOptions,
  rangeStartSeconds: number,
): TargetFrame[] {
  const targetIds = new Set<string>()
  const targets: TargetFrame[] = []
  for (const target of options.targets) {
    assertNonEmpty(target.id, 'target.id')
    if (targetIds.has(target.id)) {
      throw new Error(`Duplicate live-score target id: ${target.id}`)
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
      target.startBeat < options.source.range.startBeat ||
      target.startBeat >= options.source.range.endBeat
    ) {
      continue
    }
    const targetSeconds = options.beatToSeconds(target.startBeat)
    assertFinite(targetSeconds, `beatToSeconds(${target.startBeat})`)
    targets.push({
      ...target,
      onsetFrame: Math.max(
        0,
        Math.round((targetSeconds - rangeStartSeconds) * options.sampleRate),
      ),
      skipReason: null,
    })
  }
  targets.sort(
    (left, right) =>
      left.onsetFrame - right.onsetFrame || left.id.localeCompare(right.id),
  )

  if (options.inputKind !== 'midi') {
    const groups = new Map<number, TargetFrame[]>()
    for (const target of targets) {
      const group = groups.get(target.onsetFrame)
      if (group === undefined) groups.set(target.onsetFrame, [target])
      else group.push(target)
    }
    const onsetFrames = [...groups.keys()].sort((left, right) => left - right)
    const minimumSpacingFrames = Math.round(
      ((PITCH_ATTACH_WINDOW_MS * 2) / 1000) * options.sampleRate,
    )
    for (let index = 0; index < onsetFrames.length; index += 1) {
      const onsetFrame = onsetFrames[index]
      if (onsetFrame === undefined) continue
      const group = groups.get(onsetFrame) ?? []
      const previous = onsetFrames[index - 1]
      const next = onsetFrames[index + 1]
      const tooClose =
        (previous !== undefined &&
          onsetFrame - previous < minimumSpacingFrames) ||
        (next !== undefined && next - onsetFrame < minimumSpacingFrames)
      const skipReason =
        group.length > 1 ? 'polyphonic-onset' : tooClose ? 'fast-passage' : null
      for (const target of group) target.skipReason = skipReason
    }
  }
  return targets
}

/** Create one score run from a score clock that will not change underneath it. */
export function createGuitarLiveScoreEngine(
  options: CreateGuitarLiveScoreEngineOptions,
): GuitarLiveScoreEngine {
  assertNonEmpty(options.source.referenceId, 'source.referenceId')
  assertNonEmpty(options.source.trackId, 'source.trackId')
  assertFinite(options.source.range.startBeat, 'source.range.startBeat')
  assertFinite(options.source.range.endBeat, 'source.range.endBeat')
  assertFinite(options.sampleRate, 'sampleRate')
  if (options.source.range.endBeat <= options.source.range.startBeat) {
    throw new RangeError('The live-score range must end after it starts.')
  }
  if (options.sampleRate <= 0) {
    throw new RangeError('sampleRate must be positive.')
  }
  const matchToleranceMs =
    options.matchToleranceMs ?? GUITAR_LIVE_SCORE_MATCH_TOLERANCE_MS
  const minimumPitchClarity =
    options.minimumPitchClarity ?? GUITAR_LIVE_SCORE_MINIMUM_PITCH_CLARITY
  assertFinite(matchToleranceMs, 'matchToleranceMs')
  assertFinite(minimumPitchClarity, 'minimumPitchClarity')
  if (matchToleranceMs <= 0) {
    throw new RangeError('matchToleranceMs must be positive.')
  }
  if (minimumPitchClarity < 0 || minimumPitchClarity > 1) {
    throw new RangeError('minimumPitchClarity must be between zero and one.')
  }
  const rangeStartSeconds = options.beatToSeconds(
    options.source.range.startBeat,
  )
  const rangeEndSeconds = options.beatToSeconds(options.source.range.endBeat)
  assertFinite(rangeStartSeconds, 'beatToSeconds(range.startBeat)')
  assertFinite(rangeEndSeconds, 'beatToSeconds(range.endBeat)')
  if (rangeEndSeconds <= rangeStartSeconds) {
    throw new RangeError(
      'The pinned beat clock must increase across the range.',
    )
  }

  const targets = createTargets(options, rangeStartSeconds)
  const durationFrames = Math.max(
    1,
    Math.round((rangeEndSeconds - rangeStartSeconds) * options.sampleRate),
  )
  const toleranceFrames = Math.max(
    1,
    Math.round((matchToleranceMs / 1000) * options.sampleRate),
  )
  const pitchGraceFrames = Math.max(
    1,
    Math.round((PITCH_ATTACH_WINDOW_MS / 1000) * options.sampleRate),
  )
  const onRetainedEventVisit = options.instrumentation?.onRetainedEventVisit
  const onTargetVisit = options.instrumentation?.onTargetVisit

  let takeId: string | null = null
  let lastIngestedTake: GuitarTakeSnapshot | null = null
  let lastThroughFrame = -1
  let lastTotalEventCount = 0
  let lastFilteredAfterEnd = 0
  let firstUnresolvedTargetIndex = 0
  let phase: GuitarLiveScorePhase = 'active'
  let judgedTargets = 0
  let hitTargets = 0
  let missedTargets = 0
  let skippedTargets = 0
  let cumulativePoints = 0
  let currentStreak = 0
  let bestStreak = 0
  let detectedGapCount = 0
  let recentJudgments: readonly GuitarLiveScoreJudgment[] = []
  let rollingJudgments: readonly GuitarLiveScoreJudgment[] = []
  const consumedEventIds = new Set<string>()
  const activeEvents = new Map<string, GuitarTakeEvent>()
  const eventIdentities = new Map<string, EventIdentity>()
  const gapIntervals: GapInterval[] = []

  const appendJudgment = (judgment: GuitarLiveScoreJudgment): void => {
    const frozen = freezeJudgment(judgment)
    recentJudgments = Object.freeze(
      [...recentJudgments, frozen].slice(-GUITAR_LIVE_SCORE_ROLLING_TARGETS),
    )
    if (frozen.outcome === 'skipped') {
      skippedTargets += 1
      return
    }
    judgedTargets += 1
    rollingJudgments = Object.freeze(
      [...rollingJudgments, frozen].slice(-GUITAR_LIVE_SCORE_ROLLING_TARGETS),
    )
    cumulativePoints += frozen.score
    if (frozen.outcome === 'hit') {
      hitTargets += 1
      currentStreak += 1
      bestStreak = Math.max(bestStreak, currentStreak)
    } else {
      missedTargets += 1
      currentStreak = 0
    }
  }

  const overlapsGap = (target: TargetFrame): boolean =>
    gapIntervals.some(
      (gap) =>
        target.onsetFrame + toleranceFrames >= gap.startFrame &&
        target.onsetFrame - toleranceFrames <= gap.endFrame,
    )

  const matchingEvent = (
    target: TargetFrame,
    throughFrame: number,
  ): GuitarTakeEvent | null => {
    let best: GuitarTakeEvent | null = null
    let bestError = Number.POSITIVE_INFINITY
    for (const event of activeEvents.values()) {
      if (
        consumedEventIds.has(event.id) ||
        event.kind !== 'attack' ||
        event.source !== options.inputKind ||
        event.compensatedTransportFrame > throughFrame ||
        event.compensatedTransportFrame >= durationFrames ||
        Math.abs(event.compensatedTransportFrame - target.onsetFrame) >
          toleranceFrames ||
        event.pitch === null ||
        event.pitch.midi !== target.midi ||
        (options.inputKind !== 'midi' &&
          event.pitch.clarity < minimumPitchClarity)
      ) {
        continue
      }
      const error = Math.abs(
        event.compensatedTransportFrame - target.onsetFrame,
      )
      if (
        error < bestError ||
        (error === bestError && event.id.localeCompare(best?.id ?? '') < 0)
      ) {
        best = event
        bestError = error
      }
    }
    return best
  }

  const hasProvisionalCandidate = (
    target: TargetFrame,
    throughFrame: number,
  ): boolean =>
    [...activeEvents.values()].some((event) => {
      if (
        consumedEventIds.has(event.id) ||
        event.kind !== 'attack' ||
        event.source !== options.inputKind ||
        event.compensatedTransportFrame > throughFrame ||
        event.compensatedTransportFrame >= durationFrames ||
        Math.abs(event.compensatedTransportFrame - target.onsetFrame) >
          toleranceFrames
      ) {
        return false
      }
      const pitchIsProvisional =
        event.pitch === null ||
        (options.inputKind !== 'midi' &&
          event.pitch.clarity < minimumPitchClarity)
      return (
        pitchIsProvisional &&
        throughFrame <= event.compensatedTransportFrame + pitchGraceFrames
      )
    })

  const judgeThrough = (
    throughFrame: number,
    health: GuitarLiveScoreHealth,
    finalize: boolean,
    finalDurationFrames: number,
  ): void => {
    const badHealthReason = healthSkipReason(health)
    while (firstUnresolvedTargetIndex < targets.length) {
      const target = targets[firstUnresolvedTargetIndex]
      if (target === undefined) break
      onTargetVisit?.()
      if (finalize && target.onsetFrame >= finalDurationFrames) {
        firstUnresolvedTargetIndex = targets.length
        break
      }
      const expired = throughFrame > target.onsetFrame + toleranceFrames
      if (!finalize && !expired) break

      if (target.skipReason !== null) {
        appendJudgment({
          targetId: target.id,
          midi: target.midi,
          onsetFrame: target.onsetFrame,
          outcome: 'skipped',
          score: null,
          eventId: null,
          timingOffsetMs: null,
          skipReason: target.skipReason,
        })
        firstUnresolvedTargetIndex += 1
        continue
      }
      if (overlapsGap(target)) {
        appendJudgment({
          targetId: target.id,
          midi: target.midi,
          onsetFrame: target.onsetFrame,
          outcome: 'skipped',
          score: null,
          eventId: null,
          timingOffsetMs: null,
          skipReason: 'event-gap',
        })
        firstUnresolvedTargetIndex += 1
        continue
      }
      if (badHealthReason !== null) {
        appendJudgment({
          targetId: target.id,
          midi: target.midi,
          onsetFrame: target.onsetFrame,
          outcome: 'skipped',
          score: null,
          eventId: null,
          timingOffsetMs: null,
          skipReason: badHealthReason,
        })
        firstUnresolvedTargetIndex += 1
        continue
      }

      const event = matchingEvent(target, throughFrame)
      if (event !== null) {
        consumedEventIds.add(event.id)
        const offsetFrames = event.compensatedTransportFrame - target.onsetFrame
        appendJudgment({
          targetId: target.id,
          midi: target.midi,
          onsetFrame: target.onsetFrame,
          outcome: 'hit',
          // V1 is intentionally notes-only. The association window decides
          // which authored note this event can prove, but unmeasured route
          // delay must not quietly become a timing grade.
          score: 100,
          eventId: event.id,
          timingOffsetMs:
            Math.round((offsetFrames / options.sampleRate) * 10_000) / 10,
          skipReason: null,
        })
        firstUnresolvedTargetIndex += 1
        continue
      }
      if (!finalize && hasProvisionalCandidate(target, throughFrame)) break
      appendJudgment({
        targetId: target.id,
        midi: target.midi,
        onsetFrame: target.onsetFrame,
        outcome: 'miss',
        score: 0,
        eventId: null,
        timingOffsetMs: null,
        skipReason: null,
      })
      firstUnresolvedTargetIndex += 1
    }
  }

  const prune = (throughFrame: number): void => {
    const nextTarget = targets[firstUnresolvedTargetIndex]
    const oldestUsefulFrame =
      nextTarget === undefined
        ? throughFrame
        : nextTarget.onsetFrame - toleranceFrames
    for (const [eventId, event] of activeEvents) {
      if (
        consumedEventIds.has(eventId) ||
        event.compensatedTransportFrame < oldestUsefulFrame
      ) {
        activeEvents.delete(eventId)
      }
    }
    while (
      gapIntervals[0] !== undefined &&
      gapIntervals[0].endFrame < oldestUsefulFrame
    ) {
      gapIntervals.shift()
    }
  }

  const display = (): GuitarLiveScoreDisplay => {
    const rollingPoints = rollingJudgments.reduce(
      (sum, judgment) => sum + (judgment.score ?? 0),
      0,
    )
    const rollingScore = average(rollingPoints, rollingJudgments.length)
    const cumulativeScore = average(cumulativePoints, judgedTargets)
    const basis: GuitarLiveScoreBasis =
      phase === 'active' ? 'rolling-16' : 'cumulative'
    const score = basis === 'rolling-16' ? rollingScore : cumulativeScore
    const grade =
      score === null
        ? null
        : scoreGrade(
            score,
            basis === 'rolling-16' ? rollingJudgments.length : judgedTargets,
          )
    return Object.freeze({
      phase,
      basis,
      score,
      grade,
      rollingScore,
      rollingGrade:
        rollingScore === null
          ? null
          : scoreGrade(rollingScore, rollingJudgments.length),
      cumulativeScore,
      cumulativeGrade:
        cumulativeScore === null
          ? null
          : scoreGrade(cumulativeScore, judgedTargets),
      currentStreak,
      bestStreak,
      targetCount: targets.length,
      totals: Object.freeze({
        judgedTargets,
        hitTargets,
        missedTargets,
        skippedTargets,
        points: cumulativePoints,
        possiblePoints: judgedTargets * 100,
      }),
      evidenceStatus: detectedGapCount > 0 ? 'event-gap' : 'complete',
      detectedGapCount,
      recentJudgments: Object.freeze([...recentJudgments]),
    })
  }

  const sample = (
    take: GuitarTakeSnapshot,
    throughFrame: number,
    health: GuitarLiveScoreHealth,
  ): GuitarLiveScoreDisplay => {
    if (!Number.isInteger(throughFrame) || throughFrame < 0) {
      throw new RangeError('throughFrame must be a non-negative integer.')
    }
    if (throughFrame < lastThroughFrame) {
      throw new RangeError('throughFrame must not move backwards.')
    }
    if (takeId === null) takeId = take.id
    if (take.id !== takeId) {
      throw new Error('A live-score engine cannot switch takes.')
    }
    if (take.clock.sampleRate !== options.sampleRate) {
      throw new Error('The take sample rate does not match the pinned score.')
    }
    if (take.input.kind !== options.inputKind) {
      throw new Error('The take input kind does not match the pinned score.')
    }
    if (phase !== 'active') return display()
    if (take.lifecycle === 'cancelled') {
      phase = 'cancelled'
      lastThroughFrame = throughFrame
      return display()
    }

    if (take !== lastIngestedTake) {
      const totalEventCount =
        take.droppedEventCount + take.filteredAfterEnd + take.events.length
      if (totalEventCount < lastTotalEventCount) {
        throw new Error('The take event sequence moved backwards.')
      }
      if (take.filteredAfterEnd < lastFilteredAfterEnd) {
        throw new Error('The take end-filter sequence moved backwards.')
      }
      let newEventCount = 0
      let oldestNewFrame = Number.POSITIVE_INFINITY
      for (const event of take.events) {
        onRetainedEventVisit?.()
        const identity = eventIdentities.get(event.id)
        if (identity !== undefined && !sameIdentity(identity, event)) {
          throw new Error(`Guitar take event identity changed: ${event.id}`)
        }
        if (identity === undefined) {
          newEventCount += 1
          oldestNewFrame = Math.min(
            oldestNewFrame,
            event.compensatedTransportFrame,
          )
          eventIdentities.set(event.id, {
            kind: event.kind,
            source: event.source,
            voiceId: event.voiceId,
            frame: event.compensatedTransportFrame,
          })
        } else {
          eventIdentities.delete(event.id)
          eventIdentities.set(event.id, identity)
        }
        activeEvents.set(event.id, event)
      }
      while (eventIdentities.size > RECENT_EVENT_IDENTITIES) {
        const oldestId = eventIdentities.keys().next().value as
          | string
          | undefined
        if (oldestId === undefined) break
        eventIdentities.delete(oldestId)
      }

      // Events rejected by the pinned half-open end never belonged to this
      // score's evidence window. Keep them in the monotonic recorder count,
      // but do not mistake their diagnostic counter for a missing in-range
      // page.
      const newlyFilteredAfterEnd = take.filteredAfterEnd - lastFilteredAfterEnd
      const expectedNewEvents = Math.max(
        0,
        totalEventCount - lastTotalEventCount - newlyFilteredAfterEnd,
      )
      if (newEventCount < expectedNewEvents) {
        detectedGapCount += 1
        const interval = {
          startFrame: Math.max(0, lastThroughFrame),
          endFrame: Number.isFinite(oldestNewFrame)
            ? oldestNewFrame
            : throughFrame,
        }
        const previousGap = gapIntervals[gapIntervals.length - 1]
        if (
          previousGap !== undefined &&
          interval.startFrame <= previousGap.endFrame + 1
        ) {
          previousGap.endFrame = Math.max(
            previousGap.endFrame,
            interval.endFrame,
          )
        } else {
          gapIntervals.push(interval)
        }
      }
      lastTotalEventCount = totalEventCount
      lastFilteredAfterEnd = take.filteredAfterEnd
      lastIngestedTake = take
    }

    const finalDurationFrames = Math.min(
      durationFrames,
      take.durationFrames ?? durationFrames,
    )
    const finalize = take.lifecycle !== 'recording'
    if (finalize) {
      // pinEnd may retract an event that a prior recording snapshot exposed.
      // Reconcile the retained page before cumulative judgment so evidence at
      // or beyond the manual half-open boundary cannot score an earlier note.
      for (const [eventId, event] of activeEvents) {
        if (event.compensatedTransportFrame >= finalDurationFrames) {
          activeEvents.delete(eventId)
        }
      }
    }
    const effectiveThroughFrame = finalize
      ? Math.max(throughFrame, finalDurationFrames + toleranceFrames + 1)
      : throughFrame
    judgeThrough(effectiveThroughFrame, health, finalize, finalDurationFrames)
    prune(effectiveThroughFrame)
    lastThroughFrame = throughFrame
    if (take.lifecycle === 'completed') phase = 'completed'
    return display()
  }

  return { sample, snapshot: display }
}
