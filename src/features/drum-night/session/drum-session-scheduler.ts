// Drum Night session scheduler — canonical hits onto one transport/audio clock.
// ============================================================
//
// The transport owns musical time. This consumer performs binary range queries
// over canonical percussion hits, converts each occurrence into route-owned
// AudioContext time, and never invents a sound for an unsupported GM key.

import { isGeneralMidiDrumKey } from '../runtime/drum-pad-layout'
import type { DrumKitChoke, DrumKitChokeOutcome, DrumKitPlayerPort, DrumKitTrigger, DrumKitTriggerOutcome, } from '../runtime/drum-runtime-types'
import { DRUM_KIT_AUTHORED_CHOKE_TAIL_SECONDS } from '../runtime/drum-runtime-types'
import type { DrumAuthoredSchedulingWindow, DrumTransport, } from '../runtime/drum-transport'
import type { DrumSessionDocument } from './drum-session'

export const DEFAULT_DRUM_SESSION_LOOKAHEAD_MS = 100
/** Humanized playback needs early-shift headroom inside the lookahead. */
export const HUMANIZED_DRUM_SESSION_LOOKAHEAD_MS = 120
/** Feel can lead 14 ms and its bounded flam can lead another 35 ms. */
export const MAX_DRUM_SESSION_ACTION_EARLY_MS = 49
/** A hit carries at most one flam plus one drag grace. */
export const MAX_DRUM_SESSION_ORNAMENTS_PER_HIT = 2
/** Matches the player's default voice ceiling for one authored attack. */
export const MAX_DRUM_SESSION_OCCURRENCES_PER_TIMESTAMP = 48
/** One synchronous pass cannot enqueue an unbounded authored range. */
export const MAX_DRUM_SESSION_OCCURRENCES_PER_SCHEDULE = 256
/** Future overlap proof stays bounded even under repeated manual scheduling. */
export const MAX_DRUM_SESSION_DEDUPE_LEDGER = 512
/** GP choked cymbals strike normally, then receive this bounded grab tail. */
export const AUTHORED_CYMBAL_CHOKE_TAIL_SECONDS =
  DRUM_KIT_AUTHORED_CHOKE_TAIL_SECONDS
/** Ranges, rather than individual hits, keep deferred work bounded. */
const MAX_DRUM_SESSION_DEFERRED_RANGES = 1_024

export type DrumSessionSchedulerStatus =
  | 'disposed'
  | 'empty'
  | 'playing'
  | 'ready'
  | 'waiting-for-audio'

export type DrumSessionTriggerTruth = DrumKitTriggerOutcome | 'unreported'
export type DrumSessionChokeTruth = DrumKitChokeOutcome | 'unreported'

export interface DrumSessionTriggerCounts {
  readonly sampled: number
  /** An explicitly selected zero-byte synth model rendered the attack. */
  readonly synthesized: number
  readonly synthFallback: number
  readonly unmapped: number
  readonly dropped: number
  /** A legacy/test player accepted the hit without returning routing truth. */
  readonly unreported: number
}

export interface DrumScheduledSessionOccurrence {
  readonly id: string
  readonly sessionRevision: number
  readonly transportRevision: number
  readonly trackId: string
  readonly sourceHitId: string | null
  readonly gmKey: number
  readonly velocity: number
  readonly articulation?: 'choke'
  readonly authoredBeat: number
  /** Monotonic across loop repetitions even though authoredBeat wraps. */
  readonly timelineBeat: number
  readonly loopIteration: number
  readonly performanceTimestampMs: number
  readonly atContextTime: number
  readonly triggerTruth: DrumSessionTriggerTruth
  /** Release routing only; `choked` does not claim the attack was audible. */
  readonly chokeTruth: DrumSessionChokeTruth | null
}

export interface DrumSessionSchedulerSnapshot {
  readonly status: DrumSessionSchedulerStatus
  readonly sessionRevision: number
  readonly transportRevision: number
  readonly indexedHitCount: number
  readonly playableHitCount: number
  /** Canonical boundary violation: retained and reported, never remapped. */
  readonly unsupportedGmHitCount: number
  /** Source events the MIDI/GP projector already proved it could not map. */
  readonly sourceDroppedHitCount: number
  readonly scheduledOccurrenceCount: number
  /** Future/current overlap ledger; pruned behind the monotonic playhead. */
  readonly dedupeLedgerSize: number
  /** Simultaneous hits beyond the declared audio burst ceiling. */
  readonly overloadOmittedOccurrenceCount: number
  /** In-range hits left for a later scheduler pass due to bounded work. */
  readonly deferredOccurrenceCount: number
  /** Deferred hits whose authored time passed before capacity became free. */
  readonly capacityOmittedOccurrenceCount: number
  readonly appliedTempoChangeCount: number
  readonly omittedTempoChangeCount: number
  readonly adjustedTempoChangeCount: number
  readonly triggerCounts: DrumSessionTriggerCounts
  readonly lastOccurrence: DrumScheduledSessionOccurrence | null
}

export interface DrumSessionHumanizeHit {
  readonly gmKey: number
  readonly velocity: number
  readonly startBeat: number
  readonly articulation?: 'choke'
  readonly timelineBeat: number
  readonly loopIteration: number
}

export interface DrumSessionHumanizeDecision {
  /** Milliseconds relative to the grid time; positive plays late. */
  readonly timeOffsetMs: number
  readonly velocity: number
  /** Grace notes before the main hit; bounded, same GM key. */
  readonly ornaments: readonly {
    readonly leadMs: number
    readonly velocity: number
  }[]
}

/** Null keeps the authored values; a throwing hook is treated the same. */
export type DrumSessionHumanize = (
  hit: DrumSessionHumanizeHit,
) => DrumSessionHumanizeDecision | null

export interface DrumSessionSchedulerOptions {
  readonly transport: DrumTransport
  readonly player: DrumKitPlayerPort
  /**
   * Map a DOMHighResTimeStamp on the transport clock to AudioContext seconds.
   * Return null while the gesture-owned audio session is not active.
   */
  readonly performanceTimestampToContextTime: (
    timestampMs: number,
  ) => number | null
  readonly lookaheadMs?: number
  readonly humanize?: DrumSessionHumanize
}

export interface DrumSessionScheduler {
  snapshot(): DrumSessionSchedulerSnapshot
  sessionRevision(): number
  subscribe(listener: () => void): () => void
  /** Replaces the canonical session, resets to beat zero, and invalidates audio. */
  setSession(document: DrumSessionDocument | null): void
  /** Reindexes an edit in the same session without moving or stopping transport. */
  updateSession(document: DrumSessionDocument): void
  /** Schedule one bounded lookahead immediately; normally transport emits it. */
  schedule(lookaheadMs?: number): readonly DrumScheduledSessionOccurrence[]
  /** Cancel queued/tailing authored audio without changing the session. */
  clear(): void
  /** Releases only this consumer; the injected transport/player keep their owner. */
  dispose(): void
}

interface IndexedSessionHit {
  readonly sequence: number
  readonly trackId: string
  readonly sourceHitId: string | null
  readonly gmKey: number
  readonly velocity: number
  readonly startBeat: number
  readonly articulation?: 'choke'
}

interface PendingSessionOccurrence {
  readonly discoverySequence: number
  readonly id: string
  readonly sessionRevision: number
  readonly transportRevision: number
  readonly trackId: string
  readonly sourceHitId: string | null
  readonly gmKey: number
  readonly velocity: number
  readonly articulation?: 'choke'
  readonly authoredBeat: number
  readonly timelineBeat: number
  readonly loopIteration: number
  readonly performanceTimestampMs: number
  readonly atContextTime: number
  triggerTruth: DrumSessionTriggerTruth
  chokeTruth: DrumSessionChokeTruth | null
  mainDispatched: boolean
}

interface ResolvedTriggerAction {
  readonly kind: 'trigger'
  readonly atContextTime: number
  readonly semanticTiePriority: number
  readonly sequence: number
  readonly request: DrumKitTrigger
  /** Ornaments remain intentionally absent from occurrence truth. */
  readonly occurrence: PendingSessionOccurrence | null
}

interface ResolvedChokeAction {
  readonly kind: 'choke'
  readonly atContextTime: number
  readonly semanticTiePriority: number
  readonly sequence: number
  readonly request: DrumKitChoke
  readonly occurrence: PendingSessionOccurrence
}

type ResolvedSessionAction = ResolvedTriggerAction | ResolvedChokeAction

interface DeferredSessionRange {
  readonly fromIndex: number
  readonly toIndex: number
  readonly fromPositionBeat: number
  readonly fromTimelineBeat: number
}

function emptyTriggerCounts(): DrumSessionTriggerCounts {
  return {
    sampled: 0,
    synthesized: 0,
    synthFallback: 0,
    unmapped: 0,
    dropped: 0,
    unreported: 0,
  }
}

function boundedLookahead(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_DRUM_SESSION_LOOKAHEAD_MS
  return Math.min(2_000, Math.max(0, value as number))
}

function attackTiePriority(
  gmKey: number,
  articulation: IndexedSessionHit['articulation'],
): number {
  if (gmKey === 42 || gmKey === 44) return 2
  return articulation === 'choke' ? 1 : 0
}

function indexSession(document: DrumSessionDocument): {
  readonly playable: readonly IndexedSessionHit[]
  readonly total: number
  readonly unsupported: number
} {
  const indexed: IndexedSessionHit[] = []
  let sequence = 0
  let unsupported = 0
  for (const track of document.percussionTracks) {
    for (const hit of track.percussionHits) {
      const currentSequence = sequence++
      if (
        !isGeneralMidiDrumKey(hit.gmKey) ||
        !Number.isFinite(hit.startBeat) ||
        hit.startBeat < 0 ||
        !Number.isFinite(hit.velocity) ||
        hit.velocity < 1 ||
        hit.velocity > 127
      ) {
        unsupported += 1
        continue
      }
      indexed.push(
        Object.freeze({
          sequence: currentSequence,
          trackId: track.id,
          sourceHitId: hit.id ?? null,
          gmKey: hit.gmKey,
          velocity: Math.round(hit.velocity),
          startBeat: hit.startBeat,
          ...(hit.articulation === undefined
            ? {}
            : { articulation: hit.articulation }),
        }),
      )
    }
  }
  indexed.sort(
    (left, right) =>
      left.startBeat - right.startBeat ||
      attackTiePriority(left.gmKey, left.articulation) -
        attackTiePriority(right.gmKey, right.articulation) ||
      left.sequence - right.sequence,
  )
  return {
    playable: Object.freeze(indexed),
    total: sequence,
    unsupported,
  }
}

function lowerBound(
  hits: readonly IndexedSessionHit[],
  startBeat: number,
): number {
  let low = 0
  let high = hits.length
  while (low < high) {
    const middle = (low + high) >>> 1
    const hit = hits[middle]
    if (hit !== undefined && hit.startBeat < startBeat) low = middle + 1
    else high = middle
  }
  return low
}

function upperBound(
  hits: readonly IndexedSessionHit[],
  endBeat: number,
  includeEndBeat: boolean,
): number {
  let low = 0
  let high = hits.length
  while (low < high) {
    const middle = (low + high) >>> 1
    const hit = hits[middle]
    const belongsBeforeEnd =
      hit !== undefined &&
      (includeEndBeat ? hit.startBeat <= endBeat : hit.startBeat < endBeat)
    if (belongsBeforeEnd) low = middle + 1
    else high = middle
  }
  return low
}

function truthFromPlayerResult(
  result: DrumKitTriggerOutcome | undefined,
): DrumSessionTriggerTruth {
  return result === 'sampled' ||
    result === 'synthesized' ||
    result === 'synth-fallback' ||
    result === 'unmapped' ||
    result === 'dropped'
    ? result
    : 'unreported'
}

function freezeOccurrence(
  pending: PendingSessionOccurrence,
): DrumScheduledSessionOccurrence {
  return Object.freeze({
    id: pending.id,
    sessionRevision: pending.sessionRevision,
    transportRevision: pending.transportRevision,
    trackId: pending.trackId,
    sourceHitId: pending.sourceHitId,
    gmKey: pending.gmKey,
    velocity: pending.velocity,
    ...(pending.articulation === undefined
      ? {}
      : { articulation: pending.articulation }),
    authoredBeat: pending.authoredBeat,
    timelineBeat: pending.timelineBeat,
    loopIteration: pending.loopIteration,
    performanceTimestampMs: pending.performanceTimestampMs,
    atContextTime: pending.atContextTime,
    triggerTruth: pending.triggerTruth,
    chokeTruth: pending.chokeTruth,
  })
}

/** Schedule canonical MIDI/GP percussion without constructing audio resources. */
export function createDrumSessionScheduler(
  options: DrumSessionSchedulerOptions,
): DrumSessionScheduler {
  const listeners = new Set<() => void>()
  const occurrenceKeys = new Map<string, number>()
  const pendingActions: ResolvedSessionAction[] = []
  const defaultLookaheadMs = boundedLookahead(
    options.lookaheadMs ??
      (options.humanize === undefined
        ? undefined
        : HUMANIZED_DRUM_SESSION_LOOKAHEAD_MS),
  )
  let document: DrumSessionDocument | null = null
  let playableHits: readonly IndexedSessionHit[] = Object.freeze([])
  let indexedHitCount = 0
  let unsupportedGmHitCount = 0
  let sourceDroppedHitCount = 0
  let currentSessionRevision = 0
  let currentTransportRevision = options.transport.scheduleRevision()
  let scheduledOccurrenceCount = 0
  let overloadOmittedOccurrenceCount = 0
  let deferredOccurrenceCount = 0
  let capacityOmittedOccurrenceCount = 0
  let deferredRanges: readonly DeferredSessionRange[] = Object.freeze([])
  let triggerCounts = emptyTriggerCounts()
  let lastOccurrence: DrumScheduledSessionOccurrence | null = null
  let waitingForAudioClock = false
  let suppressTransportReaction = false
  let disposed = false
  let nextActionSequence = 0
  let nextOccurrenceSequence = 0

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const panicPlayer = (): void => {
    try {
      options.player.panic('authored')
    } catch {
      // The transport still owns invalidation if a concrete audio graph failed.
    }
  }

  const invalidateQueue = (panic: boolean): void => {
    occurrenceKeys.clear()
    pendingActions.length = 0
    nextActionSequence = 0
    nextOccurrenceSequence = 0
    scheduledOccurrenceCount = 0
    overloadOmittedOccurrenceCount = 0
    deferredOccurrenceCount = 0
    capacityOmittedOccurrenceCount = 0
    deferredRanges = Object.freeze([])
    triggerCounts = emptyTriggerCounts()
    lastOccurrence = null
    waitingForAudioClock = false
    if (panic) panicPlayer()
  }

  const promoteDeferredToCapacityOmissions = (): boolean => {
    if (deferredOccurrenceCount === 0) return false
    capacityOmittedOccurrenceCount += deferredOccurrenceCount
    deferredOccurrenceCount = 0
    deferredRanges = Object.freeze([])
    return true
  }

  const currentStatus = (): DrumSessionSchedulerStatus => {
    if (disposed) return 'disposed'
    if (document === null) return 'empty'
    if (waitingForAudioClock) return 'waiting-for-audio'
    const phase = options.transport.state().phase
    return phase === 'playing' || phase === 'count-in' ? 'playing' : 'ready'
  }

  const snapshot = (): DrumSessionSchedulerSnapshot => {
    const transportState = options.transport.state()
    return Object.freeze({
      status: currentStatus(),
      sessionRevision: currentSessionRevision,
      transportRevision: currentTransportRevision,
      indexedHitCount,
      playableHitCount: playableHits.length,
      unsupportedGmHitCount,
      sourceDroppedHitCount,
      scheduledOccurrenceCount,
      dedupeLedgerSize: occurrenceKeys.size,
      overloadOmittedOccurrenceCount,
      deferredOccurrenceCount,
      capacityOmittedOccurrenceCount,
      appliedTempoChangeCount: transportState.appliedTempoChangeCount,
      omittedTempoChangeCount: transportState.omittedTempoChangeCount,
      adjustedTempoChangeCount: transportState.adjustedTempoChangeCount,
      triggerCounts: Object.freeze({ ...triggerCounts }),
      lastOccurrence,
    })
  }

  const incrementTruth = (truth: DrumSessionTriggerTruth): void => {
    triggerCounts = {
      ...triggerCounts,
      ...(truth === 'synth-fallback'
        ? { synthFallback: triggerCounts.synthFallback + 1 }
        : { [truth]: triggerCounts[truth] + 1 }),
    }
  }

  const flushPendingActions = (
    throughContextTime: number,
  ): {
    readonly occurrences: readonly DrumScheduledSessionOccurrence[]
    readonly diagnosticChanged: boolean
  } => {
    pendingActions.sort(
      (left, right) =>
        left.atContextTime - right.atContextTime ||
        left.semanticTiePriority - right.semanticTiePriority ||
        left.sequence - right.sequence,
    )
    let dueCount = 0
    while (dueCount < pendingActions.length) {
      const actionContextTime =
        pendingActions[dueCount]?.atContextTime ?? Infinity
      // Authored windows are end-exclusive. An undiscovered hit exactly on a
      // finite watermark may tie this action (after Feel or a choke tail), so
      // only a terminal Infinity drain may include the boundary itself.
      if (
        throughContextTime !== Infinity &&
        actionContextTime >= throughContextTime
      ) {
        break
      }
      dueCount += 1
    }
    const dueActions = pendingActions.splice(0, dueCount)
    const dispatchedOccurrences: PendingSessionOccurrence[] = []
    let diagnosticChanged = false
    for (const action of dueActions) {
      if (action.kind === 'choke') {
        try {
          action.occurrence.chokeTruth =
            options.player.choke?.(action.request) ?? 'unreported'
        } catch {
          action.occurrence.chokeTruth = 'dropped'
        }
        if (
          action.occurrence.mainDispatched &&
          lastOccurrence?.id === action.occurrence.id
        ) {
          lastOccurrence = freezeOccurrence(action.occurrence)
          diagnosticChanged = true
        }
        continue
      }
      let truth: DrumSessionTriggerTruth = 'dropped'
      try {
        truth = truthFromPlayerResult(options.player.trigger(action.request))
      } catch {
        // A failed grace stays decorative; a failed main is reported below.
      }
      if (action.occurrence !== null && !action.occurrence.mainDispatched) {
        action.occurrence.triggerTruth = truth
        action.occurrence.mainDispatched = true
        incrementTruth(truth)
        dispatchedOccurrences.push(action.occurrence)
      }
    }
    dispatchedOccurrences.sort(
      (left, right) => left.discoverySequence - right.discoverySequence,
    )
    const occurrences = dispatchedOccurrences.map((pending) => {
      const occurrence = freezeOccurrence(pending)
      scheduledOccurrenceCount += 1
      lastOccurrence = occurrence
      return occurrence
    })
    return {
      occurrences: Object.freeze(occurrences),
      diagnosticChanged,
    }
  }

  const hitRangeInWindow = (
    window: DrumAuthoredSchedulingWindow,
  ): { readonly from: number; readonly to: number } => {
    const from = lowerBound(playableHits, window.fromPositionBeat)
    const to = upperBound(
      playableHits,
      window.toPositionBeat,
      window.includeEndBeat,
    )
    return { from, to }
  }

  const scheduleNow = (
    lookaheadMs = defaultLookaheadMs,
  ): readonly DrumScheduledSessionOccurrence[] => {
    const phase = options.transport.state().phase
    if (disposed || document === null) {
      return Object.freeze([])
    }
    if (phase !== 'playing' && phase !== 'count-in') {
      if (phase === 'stopped' && promoteDeferredToCapacityOmissions()) emit()
      return Object.freeze([])
    }
    const scheduled: DrumScheduledSessionOccurrence[] = []
    const windows = options.transport.schedulingWindows(
      boundedLookahead(lookaheadMs),
    )
    const firstWindow = windows[0]
    const lastWindow = windows.at(-1)
    if (firstWindow !== undefined) {
      for (const [key, occurrenceTimelineBeat] of occurrenceKeys) {
        if (
          occurrenceTimelineBeat <
          firstWindow.fromTimelineBeat - Number.EPSILON
        ) {
          occurrenceKeys.delete(key)
        }
      }
    }
    waitingForAudioClock = false
    const previousDeferredRanges = deferredRanges
    const nextDeferredRanges: DeferredSessionRange[] = []
    deferredOccurrenceCount = 0
    let capacityTruthChanged = false
    let scheduledThisPass = 0
    let stoppedEarly = false

    const retainDeferredRange = (range: DeferredSessionRange): void => {
      const count = Math.max(0, range.toIndex - range.fromIndex)
      if (count === 0) return
      const previous = nextDeferredRanges.at(-1)
      if (
        previous !== undefined &&
        previous.toIndex === range.fromIndex &&
        previous.fromPositionBeat === range.fromPositionBeat &&
        previous.fromTimelineBeat === range.fromTimelineBeat
      ) {
        nextDeferredRanges[nextDeferredRanges.length - 1] = {
          ...previous,
          toIndex: range.toIndex,
        }
        deferredOccurrenceCount += count
        return
      }
      if (nextDeferredRanges.length >= MAX_DRUM_SESSION_DEFERRED_RANGES) {
        capacityOmittedOccurrenceCount += count
        capacityTruthChanged = true
        return
      }
      nextDeferredRanges.push(range)
      deferredOccurrenceCount += count
    }

    const retainWindowRange = (
      window: DrumAuthoredSchedulingWindow,
      fromIndex: number,
      toIndex: number,
    ): void => {
      retainDeferredRange({
        fromIndex,
        toIndex,
        fromPositionBeat: window.fromPositionBeat,
        fromTimelineBeat: window.fromTimelineBeat,
      })
    }

    // A previous pass may have hit its synchronous capacity. Its expired
    // prefix becomes durable omission truth; its still-future suffix is either
    // rediscovered by this lookahead or retained beyond a shorter manual one.
    if (firstWindow !== undefined && lastWindow !== undefined) {
      for (const range of previousDeferredRanges) {
        const authoredStartAtCurrentTimeline =
          range.fromPositionBeat +
          (firstWindow.fromTimelineBeat - range.fromTimelineBeat)
        const expiredTo = Math.min(
          range.toIndex,
          Math.max(
            range.fromIndex,
            lowerBound(
              playableHits,
              authoredStartAtCurrentTimeline - Number.EPSILON,
            ),
          ),
        )
        if (expiredTo > range.fromIndex) {
          capacityOmittedOccurrenceCount += expiredTo - range.fromIndex
          capacityTruthChanged = true
        }

        const authoredEndAtCurrentHorizon =
          range.fromPositionBeat +
          (lastWindow.toTimelineBeat - range.fromTimelineBeat)
        const coveredTo = Math.min(
          range.toIndex,
          Math.max(
            expiredTo,
            upperBound(
              playableHits,
              authoredEndAtCurrentHorizon,
              lastWindow.includeEndBeat,
            ),
          ),
        )
        if (coveredTo < range.toIndex) {
          retainDeferredRange({ ...range, fromIndex: coveredTo })
        }
      }
    } else {
      for (const range of previousDeferredRanges) retainDeferredRange(range)
    }

    const deferRemainingAfterCurrentGroup = (
      windowIndex: number,
      playableIndex: number,
      playableGroupEnd: number,
      groupEnd: number,
    ): void => {
      const currentWindow = windows[windowIndex]!
      const currentRange = hitRangeInWindow(currentWindow)
      retainWindowRange(currentWindow, playableIndex, playableGroupEnd)
      retainWindowRange(currentWindow, groupEnd, currentRange.to)
      for (let index = windowIndex + 1; index < windows.length; index += 1) {
        const laterWindow = windows[index]!
        const range = hitRangeInWindow(laterWindow)
        retainWindowRange(laterWindow, range.from, range.to)
      }
    }

    const deferAllRemaining = (
      windowIndex: number,
      playableIndex: number,
    ): void => {
      const currentWindow = windows[windowIndex]!
      const currentRange = hitRangeInWindow(currentWindow)
      retainWindowRange(currentWindow, playableIndex, currentRange.to)
      for (let index = windowIndex + 1; index < windows.length; index += 1) {
        const laterWindow = windows[index]!
        const range = hitRangeInWindow(laterWindow)
        retainWindowRange(laterWindow, range.from, range.to)
      }
    }

    windowLoop: for (
      let windowIndex = 0;
      windowIndex < windows.length;
      windowIndex += 1
    ) {
      const window = windows[windowIndex]!
      const range = hitRangeInWindow(window)
      let hitIndex = range.from
      while (hitIndex < range.to) {
        const firstInGroup = playableHits[hitIndex]
        if (firstInGroup === undefined) break
        const groupEnd = Math.min(
          range.to,
          upperBound(playableHits, firstInGroup.startBeat, true),
        )
        const groupLength = groupEnd - hitIndex
        const occurrenceTimelineBeat =
          window.fromTimelineBeat +
          (firstInGroup.startBeat - window.fromPositionBeat)
        const overloadKey = `${currentSessionRevision}:${currentTransportRevision}:overload:${firstInGroup.startBeat}:${window.loopIteration}`
        if (
          groupLength > MAX_DRUM_SESSION_OCCURRENCES_PER_TIMESTAMP &&
          !occurrenceKeys.has(overloadKey)
        ) {
          if (occurrenceKeys.size >= MAX_DRUM_SESSION_DEDUPE_LEDGER) {
            deferAllRemaining(windowIndex, hitIndex)
            stoppedEarly = true
            break windowLoop
          }
          occurrenceKeys.set(overloadKey, occurrenceTimelineBeat)
          overloadOmittedOccurrenceCount +=
            groupLength - MAX_DRUM_SESSION_OCCURRENCES_PER_TIMESTAMP
        }
        const playableGroupEnd = Math.min(
          groupEnd,
          hitIndex + MAX_DRUM_SESSION_OCCURRENCES_PER_TIMESTAMP,
        )

        for (
          let playableIndex = hitIndex;
          playableIndex < playableGroupEnd;
          playableIndex += 1
        ) {
          const hit = playableHits[playableIndex]
          if (hit === undefined) continue
          const hitTimelineBeat =
            window.fromTimelineBeat + (hit.startBeat - window.fromPositionBeat)
          const occurrenceKey = `${currentSessionRevision}:${currentTransportRevision}:${hit.sequence}:${window.loopIteration}`
          if (occurrenceKeys.has(occurrenceKey)) continue
          if (
            scheduledThisPass >= MAX_DRUM_SESSION_OCCURRENCES_PER_SCHEDULE ||
            occurrenceKeys.size >= MAX_DRUM_SESSION_DEDUPE_LEDGER
          ) {
            deferRemainingAfterCurrentGroup(
              windowIndex,
              playableIndex,
              playableGroupEnd,
              groupEnd,
            )
            stoppedEarly = true
            break windowLoop
          }
          const performanceTimestampMs =
            window.fromTimestampMs +
            ((hit.startBeat - window.fromPositionBeat) * 60_000) /
              window.effectiveTempoBpm
          let atContextTime: number | null = null
          try {
            atContextTime = options.performanceTimestampToContextTime(
              performanceTimestampMs,
            )
          } catch {
            atContextTime = null
          }
          if (
            atContextTime === null ||
            !Number.isFinite(atContextTime) ||
            atContextTime < 0
          ) {
            waitingForAudioClock = true
            deferRemainingAfterCurrentGroup(
              windowIndex,
              playableIndex,
              playableGroupEnd,
              groupEnd,
            )
            stoppedEarly = true
            break windowLoop
          }

          occurrenceKeys.set(occurrenceKey, hitTimelineBeat)
          let playedVelocity = hit.velocity
          let playedContextTime = atContextTime
          const earliestHumanizedContextTime = Math.max(
            0,
            atContextTime - MAX_DRUM_SESSION_ACTION_EARLY_MS / 1_000,
          )
          let ornaments: DrumSessionHumanizeDecision['ornaments'] = []
          if (options.humanize !== undefined) {
            try {
              const decision = options.humanize({
                gmKey: hit.gmKey,
                velocity: hit.velocity,
                startBeat: hit.startBeat,
                ...(hit.articulation === undefined
                  ? {}
                  : { articulation: hit.articulation }),
                timelineBeat: hitTimelineBeat,
                loopIteration: window.loopIteration,
              })
              if (decision !== null) {
                if (Number.isFinite(decision.timeOffsetMs)) {
                  playedContextTime = Math.max(
                    earliestHumanizedContextTime,
                    atContextTime + decision.timeOffsetMs / 1_000,
                  )
                }
                if (Number.isFinite(decision.velocity)) {
                  playedVelocity = Math.min(
                    127,
                    Math.max(1, Math.round(decision.velocity)),
                  )
                }
                ornaments = decision.ornaments.slice(
                  0,
                  MAX_DRUM_SESSION_ORNAMENTS_PER_HIT,
                )
              }
            } catch {
              playedVelocity = hit.velocity
              playedContextTime = atContextTime
              ornaments = []
            }
          }
          const hitSourceId = `authored:${hit.trackId}:${hit.sourceHitId ?? hit.sequence}`
          const pendingOccurrence: PendingSessionOccurrence = {
            discoverySequence: nextOccurrenceSequence++,
            id: occurrenceKey,
            sessionRevision: currentSessionRevision,
            transportRevision: currentTransportRevision,
            trackId: hit.trackId,
            sourceHitId: hit.sourceHitId,
            gmKey: hit.gmKey,
            velocity: playedVelocity,
            ...(hit.articulation === undefined
              ? {}
              : { articulation: hit.articulation }),
            authoredBeat: hit.startBeat,
            timelineBeat: hitTimelineBeat,
            loopIteration: window.loopIteration,
            performanceTimestampMs,
            atContextTime: playedContextTime,
            triggerTruth: 'dropped',
            chokeTruth: hit.articulation === 'choke' ? 'unreported' : null,
            mainDispatched: false,
          }
          for (const ornament of ornaments) {
            if (
              !Number.isFinite(ornament.leadMs) ||
              !Number.isFinite(ornament.velocity)
            ) {
              continue
            }
            const ornamentContextTime = Math.max(
              earliestHumanizedContextTime,
              playedContextTime - ornament.leadMs / 1_000,
            )
            pendingActions.push({
              kind: 'trigger',
              atContextTime: ornamentContextTime,
              semanticTiePriority: attackTiePriority(
                hit.gmKey,
                hit.articulation,
              ),
              sequence: nextActionSequence++,
              request: {
                gmKey: hit.gmKey,
                velocity: Math.min(
                  127,
                  Math.max(1, Math.round(ornament.velocity)),
                ),
                atContextTime: ornamentContextTime,
                sourceId: `${hitSourceId}:ornament`,
                lane: 'authored',
              },
              occurrence: null,
            })
          }
          pendingActions.push({
            kind: 'trigger',
            atContextTime: playedContextTime,
            semanticTiePriority: attackTiePriority(hit.gmKey, hit.articulation),
            sequence: nextActionSequence++,
            request: {
              gmKey: hit.gmKey,
              velocity: playedVelocity,
              atContextTime: playedContextTime,
              sourceId: hitSourceId,
              lane: 'authored',
            },
            occurrence: pendingOccurrence,
          })
          if (hit.articulation === 'choke') {
            const chokeContextTime =
              playedContextTime + AUTHORED_CYMBAL_CHOKE_TAIL_SECONDS
            pendingActions.push({
              kind: 'choke',
              atContextTime: chokeContextTime,
              // A release exactly on a restrike boundary belongs to the old
              // voice group; run it first so the new attack remains audible.
              semanticTiePriority: -1,
              sequence: nextActionSequence++,
              request: {
                gmKey: hit.gmKey,
                atContextTime: chokeContextTime,
                sourceId: `${hitSourceId}:choke`,
                lane: 'authored',
              },
              occurrence: pendingOccurrence,
            })
          }
          scheduledThisPass += 1
        }
        hitIndex = groupEnd
      }
    }
    // rAF lookaheads overlap. Keep actions across calls until the authored
    // horizon is far enough ahead that no unseen Feel/grace action can cross
    // this watermark and alter choke-group order.
    let flushThroughContextTime: number | null = null
    if (!waitingForAudioClock && pendingActions.length > 0) {
      if (lastWindow?.endsAt === 'duration') {
        flushThroughContextTime = Infinity
      } else if (lastWindow !== undefined) {
        let horizonContextTime: number | null = null
        try {
          horizonContextTime = options.performanceTimestampToContextTime(
            lastWindow.toTimestampMs,
          )
        } catch {
          horizonContextTime = null
        }
        if (
          horizonContextTime === null ||
          !Number.isFinite(horizonContextTime) ||
          horizonContextTime < 0
        ) {
          waitingForAudioClock = true
        } else {
          flushThroughContextTime =
            horizonContextTime -
            (options.humanize === undefined
              ? 0
              : MAX_DRUM_SESSION_ACTION_EARLY_MS / 1_000)
        }
      }
    }
    let diagnosticChanged = false
    if (flushThroughContextTime !== null) {
      const flushed = flushPendingActions(flushThroughContextTime)
      scheduled.push(...flushed.occurrences)
      diagnosticChanged = flushed.diagnosticChanged
    }
    deferredRanges = Object.freeze(nextDeferredRanges)
    if (
      scheduled.length > 0 ||
      waitingForAudioClock ||
      stoppedEarly ||
      overloadOmittedOccurrenceCount > 0 ||
      capacityTruthChanged ||
      diagnosticChanged
    ) {
      emit()
    }
    return Object.freeze(scheduled)
  }

  const unsubscribeTransport = options.transport.subscribe(() => {
    if (disposed || suppressTransportReaction) return
    const nextRevision = options.transport.scheduleRevision()
    if (nextRevision !== currentTransportRevision) {
      currentTransportRevision = nextRevision
      invalidateQueue(true)
    }
    const scheduled = scheduleNow()
    if (scheduled.length === 0) emit()
  })

  const indexDocument = (nextDocument: DrumSessionDocument | null): void => {
    currentSessionRevision += 1
    document = nextDocument
    if (nextDocument === null) {
      playableHits = Object.freeze([])
      indexedHitCount = 0
      unsupportedGmHitCount = 0
      sourceDroppedHitCount = 0
      return
    }
    const index = indexSession(nextDocument)
    playableHits = index.playable
    indexedHitCount = index.total
    unsupportedGmHitCount = index.unsupported
    sourceDroppedHitCount = nextDocument.droppedHitCount
  }

  return {
    snapshot,
    sessionRevision: () => currentSessionRevision,
    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setSession(nextDocument) {
      if (disposed) return
      indexDocument(nextDocument)
      invalidateQueue(true)
      suppressTransportReaction = true
      options.transport.setAuthoredTiming(
        nextDocument === null
          ? null
          : {
              tempoBpm: nextDocument.canonicalSong.bpm,
              tempoChanges: nextDocument.canonicalSong.tempoChanges,
              durationBeats: nextDocument.durationBeats,
            },
      )
      options.transport.seek(0)
      currentTransportRevision = options.transport.scheduleRevision()
      suppressTransportReaction = false
      const scheduled = scheduleNow()
      if (scheduled.length === 0) emit()
    },
    updateSession(nextDocument) {
      if (disposed) return
      indexDocument(nextDocument)
      invalidateQueue(true)
      currentTransportRevision = options.transport.scheduleRevision()
      const scheduled = scheduleNow()
      if (scheduled.length === 0) emit()
    },
    schedule: scheduleNow,
    clear() {
      if (disposed) return
      invalidateQueue(true)
      emit()
    },
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribeTransport()
      invalidateQueue(true)
      listeners.clear()
    },
  }
}
