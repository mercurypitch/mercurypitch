// Drum Night session scheduler — canonical hits onto one transport/audio clock.
// ============================================================
//
// The transport owns musical time. This consumer performs binary range queries
// over canonical percussion hits, converts each occurrence into route-owned
// AudioContext time, and never invents a sound for an unsupported GM key.

import { isGeneralMidiDrumKey } from '../runtime/drum-pad-layout'
import type { DrumKitPlayerPort, DrumKitTriggerOutcome, } from '../runtime/drum-runtime-types'
import type { DrumAuthoredSchedulingWindow, DrumTransport, } from '../runtime/drum-transport'
import type { DrumSessionDocument } from './drum-session'

export const DEFAULT_DRUM_SESSION_LOOKAHEAD_MS = 100
/** Humanized playback needs early-shift headroom inside the lookahead. */
export const HUMANIZED_DRUM_SESSION_LOOKAHEAD_MS = 120
/** A hit carries at most one flam plus one drag grace. */
export const MAX_DRUM_SESSION_ORNAMENTS_PER_HIT = 2
/** Matches the player's default voice ceiling for one authored attack. */
export const MAX_DRUM_SESSION_OCCURRENCES_PER_TIMESTAMP = 48
/** One synchronous pass cannot enqueue an unbounded authored range. */
export const MAX_DRUM_SESSION_OCCURRENCES_PER_SCHEDULE = 256
/** Future overlap proof stays bounded even under repeated manual scheduling. */
export const MAX_DRUM_SESSION_DEDUPE_LEDGER = 512
/** Ranges, rather than individual hits, keep deferred work bounded. */
const MAX_DRUM_SESSION_DEFERRED_RANGES = 1_024

export type DrumSessionSchedulerStatus =
  | 'disposed'
  | 'empty'
  | 'playing'
  | 'ready'
  | 'waiting-for-audio'

export type DrumSessionTriggerTruth = DrumKitTriggerOutcome | 'unreported'

export interface DrumSessionTriggerCounts {
  readonly sampled: number
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
  readonly authoredBeat: number
  /** Monotonic across loop repetitions even though authoredBeat wraps. */
  readonly timelineBeat: number
  readonly loopIteration: number
  readonly performanceTimestampMs: number
  readonly atContextTime: number
  readonly triggerTruth: DrumSessionTriggerTruth
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
}

interface DeferredSessionRange {
  readonly fromIndex: number
  readonly toIndex: number
  readonly fromPositionBeat: number
  readonly fromTimelineBeat: number
}

function emptyTriggerCounts(): DrumSessionTriggerCounts {
  return {
    sampled: 0,
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
        }),
      )
    }
  }
  indexed.sort(
    (left, right) =>
      left.startBeat - right.startBeat || left.sequence - right.sequence,
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
    result === 'synth-fallback' ||
    result === 'unmapped' ||
    result === 'dropped'
    ? result
    : 'unreported'
}

/** Schedule canonical MIDI/GP percussion without constructing audio resources. */
export function createDrumSessionScheduler(
  options: DrumSessionSchedulerOptions,
): DrumSessionScheduler {
  const listeners = new Set<() => void>()
  const occurrenceKeys = new Map<string, number>()
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
          let ornaments: DrumSessionHumanizeDecision['ornaments'] = []
          if (options.humanize !== undefined) {
            try {
              const decision = options.humanize({
                gmKey: hit.gmKey,
                velocity: hit.velocity,
                startBeat: hit.startBeat,
                timelineBeat: hitTimelineBeat,
                loopIteration: window.loopIteration,
              })
              if (decision !== null) {
                if (Number.isFinite(decision.timeOffsetMs)) {
                  playedContextTime = Math.max(
                    0,
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
          for (const ornament of ornaments) {
            if (
              !Number.isFinite(ornament.leadMs) ||
              !Number.isFinite(ornament.velocity)
            ) {
              continue
            }
            try {
              options.player.trigger({
                gmKey: hit.gmKey,
                velocity: Math.min(
                  127,
                  Math.max(1, Math.round(ornament.velocity)),
                ),
                atContextTime: Math.max(
                  0,
                  playedContextTime - ornament.leadMs / 1_000,
                ),
                sourceId: `${hitSourceId}:ornament`,
                lane: 'authored',
              })
            } catch {
              // Ornaments are decoration; a failed grace never blocks the hit.
            }
          }
          let truth: DrumSessionTriggerTruth = 'dropped'
          try {
            truth = truthFromPlayerResult(
              options.player.trigger({
                gmKey: hit.gmKey,
                velocity: playedVelocity,
                atContextTime: playedContextTime,
                sourceId: hitSourceId,
                lane: 'authored',
              }),
            )
          } catch {
            truth = 'dropped'
          }
          incrementTruth(truth)
          const occurrence = Object.freeze({
            id: occurrenceKey,
            sessionRevision: currentSessionRevision,
            transportRevision: currentTransportRevision,
            trackId: hit.trackId,
            sourceHitId: hit.sourceHitId,
            gmKey: hit.gmKey,
            velocity: playedVelocity,
            authoredBeat: hit.startBeat,
            timelineBeat: hitTimelineBeat,
            loopIteration: window.loopIteration,
            performanceTimestampMs,
            atContextTime: playedContextTime,
            triggerTruth: truth,
          })
          scheduledThisPass += 1
          scheduledOccurrenceCount += 1
          lastOccurrence = occurrence
          scheduled.push(occurrence)
        }
        hitIndex = groupEnd
      }
    }
    deferredRanges = Object.freeze(nextDeferredRanges)
    if (
      scheduled.length > 0 ||
      waitingForAudioClock ||
      stoppedEarly ||
      overloadOmittedOccurrenceCount > 0 ||
      capacityTruthChanged
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
