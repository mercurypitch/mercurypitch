// ============================================================
// Drum arrangement scheduler — pitched backing on the Drum transport clock
// ============================================================
//
// Percussion stays under DrumSessionScheduler. This sibling performs bounded
// binary range queries over canonical pitched notes and maps the existing
// transport's performance windows onto the already-active route AudioContext.

import type { DrumAuthoredSchedulingWindow, DrumTransport, } from '../runtime/drum-transport'
import type { DrumArrangement } from './drum-arrangement'
import type { DrumArrangementBackingPlayerPort, DrumArrangementBackingTriggerOutcome, DrumArrangementBackingVoice, } from './drum-arrangement-player'

export const DEFAULT_DRUM_BACKING_LOOKAHEAD_MS = 100
export const MAX_DRUM_BACKING_OCCURRENCES_PER_TIMESTAMP = 48
export const MAX_DRUM_BACKING_OCCURRENCES_PER_SCHEDULE = 256
export const MAX_DRUM_BACKING_DEDUPE_LEDGER = 512
const MAX_DRUM_BACKING_DEFERRED_RANGES = 1_024

export type DrumArrangementSchedulerStatus =
  | 'disposed'
  | 'empty'
  | 'playing'
  | 'ready'
  | 'waiting-for-audio'

export type DrumArrangementTriggerTruth =
  | DrumArrangementBackingTriggerOutcome
  | 'unreported'

export interface DrumArrangementTriggerCounts {
  readonly synthesized: number
  readonly synthesizedWithSteal: number
  readonly dropped: number
  readonly unreported: number
}

export interface DrumScheduledBackingOccurrence {
  readonly id: string
  readonly sessionRevision: number
  readonly transportRevision: number
  readonly trackId: string
  readonly sourceNoteId: string
  readonly midi: number
  readonly authoredBeat: number
  readonly timelineBeat: number
  readonly loopIteration: number
  readonly performanceTimestampMs: number
  readonly atContextTime: number
  readonly durationSeconds: number
  readonly triggerTruth: DrumArrangementTriggerTruth
}

export interface DrumArrangementSchedulerSnapshot {
  readonly status: DrumArrangementSchedulerStatus
  readonly sessionRevision: number
  readonly transportRevision: number
  readonly indexedNoteCount: number
  readonly playableNoteCount: number
  readonly invalidNoteCount: number
  readonly scheduledOccurrenceCount: number
  readonly dedupeLedgerSize: number
  readonly overloadOmittedOccurrenceCount: number
  readonly deferredOccurrenceCount: number
  readonly capacityOmittedOccurrenceCount: number
  readonly triggerCounts: DrumArrangementTriggerCounts
  readonly lastOccurrence: DrumScheduledBackingOccurrence | null
}

export interface DrumArrangementSchedulerOptions {
  readonly transport: DrumTransport
  readonly player: DrumArrangementBackingPlayerPort
  readonly performanceTimestampToContextTime: (
    timestampMs: number,
  ) => number | null
  readonly lookaheadMs?: number
}

export interface DrumArrangementScheduler {
  snapshot(): DrumArrangementSchedulerSnapshot
  sessionRevision(): number
  subscribe(listener: () => void): () => void
  /** Does not alter transport timing; DrumSessionScheduler remains authority. */
  setArrangement(arrangement: DrumArrangement | null): void
  schedule(lookaheadMs?: number): readonly DrumScheduledBackingOccurrence[]
  clear(): void
  dispose(): void
}

interface IndexedBackingNote {
  readonly sequence: number
  readonly trackId: string
  readonly sourceNoteId: string
  readonly midi: number
  readonly startBeat: number
  readonly durationBeats: number
  readonly voice: DrumArrangementBackingVoice
}

interface DeferredBackingRange {
  readonly fromIndex: number
  readonly toIndex: number
  readonly fromPositionBeat: number
  readonly fromTimelineBeat: number
}

function emptyTriggerCounts(): DrumArrangementTriggerCounts {
  return {
    synthesized: 0,
    synthesizedWithSteal: 0,
    dropped: 0,
    unreported: 0,
  }
}

function boundedLookahead(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_DRUM_BACKING_LOOKAHEAD_MS
  return Math.min(2_000, Math.max(0, value as number))
}

function indexArrangement(arrangement: DrumArrangement): {
  readonly playable: readonly IndexedBackingNote[]
  readonly total: number
  readonly invalid: number
} {
  const indexed: IndexedBackingNote[] = []
  let sequence = 0
  let invalid = 0
  for (const projectedTrack of arrangement.backingTracks) {
    const voice = projectedTrack.playback.voice
    for (const note of projectedTrack.notes) {
      const currentSequence = sequence++
      if (
        !Number.isInteger(note.midi) ||
        note.midi < 0 ||
        note.midi > 127 ||
        !Number.isFinite(note.startBeat) ||
        note.startBeat < 0 ||
        !Number.isFinite(note.duration) ||
        note.duration <= 0
      ) {
        invalid += 1
        continue
      }
      indexed.push(
        Object.freeze({
          sequence: currentSequence,
          trackId: projectedTrack.id,
          sourceNoteId: note.id ?? `${projectedTrack.id}:${currentSequence}`,
          midi: note.midi,
          startBeat: note.startBeat,
          durationBeats: note.duration,
          voice,
        }),
      )
    }
  }
  indexed.sort(
    (left, right) =>
      left.startBeat - right.startBeat || left.sequence - right.sequence,
  )
  return { playable: Object.freeze(indexed), total: sequence, invalid }
}

function lowerBound(
  notes: readonly IndexedBackingNote[],
  startBeat: number,
): number {
  let low = 0
  let high = notes.length
  while (low < high) {
    const middle = (low + high) >>> 1
    const note = notes[middle]
    if (note !== undefined && note.startBeat < startBeat) low = middle + 1
    else high = middle
  }
  return low
}

function upperBound(
  notes: readonly IndexedBackingNote[],
  endBeat: number,
  includeEndBeat: boolean,
): number {
  let low = 0
  let high = notes.length
  while (low < high) {
    const middle = (low + high) >>> 1
    const note = notes[middle]
    const beforeEnd =
      note !== undefined &&
      (includeEndBeat ? note.startBeat <= endBeat : note.startBeat < endBeat)
    if (beforeEnd) low = middle + 1
    else high = middle
  }
  return low
}

function triggerTruth(
  outcome: DrumArrangementBackingTriggerOutcome | undefined,
): DrumArrangementTriggerTruth {
  return outcome === 'dropped' ||
    outcome === 'synthesized' ||
    outcome === 'synthesized-with-steal'
    ? outcome
    : 'unreported'
}

function noteDurationSeconds(
  transport: DrumTransport,
  note: IndexedBackingNote,
  window: DrumAuthoredSchedulingWindow,
): number {
  const authoredEnd = Math.min(
    note.startBeat + note.durationBeats,
    window.loop?.endBeat ?? Number.POSITIVE_INFINITY,
  )
  const duration =
    transport.secondsForBeat(authoredEnd) -
    transport.secondsForBeat(note.startBeat)
  return Number.isFinite(duration) && duration > 0 ? duration : 0.08
}

/** Schedule non-percussion notes without constructing or activating audio. */
export function createDrumArrangementScheduler(
  options: DrumArrangementSchedulerOptions,
): DrumArrangementScheduler {
  const listeners = new Set<() => void>()
  const occurrenceKeys = new Map<string, number>()
  const defaultLookaheadMs = boundedLookahead(options.lookaheadMs)
  let arrangement: DrumArrangement | null = null
  let playableNotes: readonly IndexedBackingNote[] = Object.freeze([])
  let indexedNoteCount = 0
  let invalidNoteCount = 0
  let currentSessionRevision = 0
  let currentTransportRevision = options.transport.scheduleRevision()
  let scheduledOccurrenceCount = 0
  let overloadOmittedOccurrenceCount = 0
  let deferredOccurrenceCount = 0
  let capacityOmittedOccurrenceCount = 0
  let deferredRanges: readonly DeferredBackingRange[] = Object.freeze([])
  let counts = emptyTriggerCounts()
  let lastOccurrence: DrumScheduledBackingOccurrence | null = null
  let waitingForAudioClock = false
  let disposed = false

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const panicPlayer = (): void => {
    try {
      options.player.panic()
    } catch {
      // The route transport still owns invalidation after a graph failure.
    }
  }

  const invalidateQueue = (panic: boolean): void => {
    occurrenceKeys.clear()
    scheduledOccurrenceCount = 0
    overloadOmittedOccurrenceCount = 0
    deferredOccurrenceCount = 0
    capacityOmittedOccurrenceCount = 0
    deferredRanges = Object.freeze([])
    counts = emptyTriggerCounts()
    lastOccurrence = null
    waitingForAudioClock = false
    if (panic) panicPlayer()
  }

  const promoteDeferredToOmissions = (): boolean => {
    if (deferredOccurrenceCount === 0) return false
    capacityOmittedOccurrenceCount += deferredOccurrenceCount
    deferredOccurrenceCount = 0
    deferredRanges = Object.freeze([])
    return true
  }

  const currentStatus = (): DrumArrangementSchedulerStatus => {
    if (disposed) return 'disposed'
    if (arrangement === null || playableNotes.length === 0) return 'empty'
    if (waitingForAudioClock) return 'waiting-for-audio'
    const phase = options.transport.state().phase
    return phase === 'playing' || phase === 'count-in' ? 'playing' : 'ready'
  }

  const snapshot = (): DrumArrangementSchedulerSnapshot =>
    Object.freeze({
      status: currentStatus(),
      sessionRevision: currentSessionRevision,
      transportRevision: currentTransportRevision,
      indexedNoteCount,
      playableNoteCount: playableNotes.length,
      invalidNoteCount,
      scheduledOccurrenceCount,
      dedupeLedgerSize: occurrenceKeys.size,
      overloadOmittedOccurrenceCount,
      deferredOccurrenceCount,
      capacityOmittedOccurrenceCount,
      triggerCounts: Object.freeze({ ...counts }),
      lastOccurrence,
    })

  const incrementTruth = (truth: DrumArrangementTriggerTruth): void => {
    counts =
      truth === 'synthesized-with-steal'
        ? { ...counts, synthesizedWithSteal: counts.synthesizedWithSteal + 1 }
        : { ...counts, [truth]: counts[truth] + 1 }
  }

  const rangeInWindow = (
    window: DrumAuthoredSchedulingWindow,
  ): { readonly from: number; readonly to: number } => ({
    from: lowerBound(playableNotes, window.fromPositionBeat),
    to: upperBound(playableNotes, window.toPositionBeat, window.includeEndBeat),
  })

  const scheduleNow = (
    lookaheadMs = defaultLookaheadMs,
  ): readonly DrumScheduledBackingOccurrence[] => {
    const phase = options.transport.state().phase
    if (disposed || arrangement === null || playableNotes.length === 0) {
      return Object.freeze([])
    }
    if (phase !== 'playing' && phase !== 'count-in') {
      if (phase === 'stopped' && promoteDeferredToOmissions()) emit()
      return Object.freeze([])
    }

    const windows = options.transport.schedulingWindows(
      boundedLookahead(lookaheadMs),
    )
    const firstWindow = windows[0]
    const lastWindow = windows.at(-1)
    if (firstWindow !== undefined) {
      for (const [key, timelineBeat] of occurrenceKeys) {
        if (timelineBeat < firstWindow.fromTimelineBeat - Number.EPSILON) {
          occurrenceKeys.delete(key)
        }
      }
    }

    const scheduled: DrumScheduledBackingOccurrence[] = []
    const previousDeferredRanges = deferredRanges
    const nextDeferredRanges: DeferredBackingRange[] = []
    waitingForAudioClock = false
    deferredOccurrenceCount = 0
    let capacityTruthChanged = false
    let scheduledThisPass = 0
    let stoppedEarly = false

    const retainDeferredRange = (range: DeferredBackingRange): void => {
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
      if (nextDeferredRanges.length >= MAX_DRUM_BACKING_DEFERRED_RANGES) {
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
              playableNotes,
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
              playableNotes,
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
      const currentRange = rangeInWindow(currentWindow)
      retainWindowRange(currentWindow, playableIndex, playableGroupEnd)
      retainWindowRange(currentWindow, groupEnd, currentRange.to)
      for (let index = windowIndex + 1; index < windows.length; index += 1) {
        const later = windows[index]!
        const range = rangeInWindow(later)
        retainWindowRange(later, range.from, range.to)
      }
    }

    const deferAllRemaining = (
      windowIndex: number,
      playableIndex: number,
    ): void => {
      const currentWindow = windows[windowIndex]!
      const currentRange = rangeInWindow(currentWindow)
      retainWindowRange(currentWindow, playableIndex, currentRange.to)
      for (let index = windowIndex + 1; index < windows.length; index += 1) {
        const later = windows[index]!
        const range = rangeInWindow(later)
        retainWindowRange(later, range.from, range.to)
      }
    }

    windowLoop: for (
      let windowIndex = 0;
      windowIndex < windows.length;
      windowIndex += 1
    ) {
      const window = windows[windowIndex]!
      const range = rangeInWindow(window)
      let noteIndex = range.from
      while (noteIndex < range.to) {
        const firstInGroup = playableNotes[noteIndex]
        if (firstInGroup === undefined) break
        const groupEnd = Math.min(
          range.to,
          upperBound(playableNotes, firstInGroup.startBeat, true),
        )
        const groupLength = groupEnd - noteIndex
        const groupTimelineBeat =
          window.fromTimelineBeat +
          (firstInGroup.startBeat - window.fromPositionBeat)
        const overloadKey = `${currentSessionRevision}:${currentTransportRevision}:overload:${firstInGroup.startBeat}:${window.loopIteration}`
        if (
          groupLength > MAX_DRUM_BACKING_OCCURRENCES_PER_TIMESTAMP &&
          !occurrenceKeys.has(overloadKey)
        ) {
          if (occurrenceKeys.size >= MAX_DRUM_BACKING_DEDUPE_LEDGER) {
            deferAllRemaining(windowIndex, noteIndex)
            stoppedEarly = true
            break windowLoop
          }
          occurrenceKeys.set(overloadKey, groupTimelineBeat)
          overloadOmittedOccurrenceCount +=
            groupLength - MAX_DRUM_BACKING_OCCURRENCES_PER_TIMESTAMP
        }
        const playableGroupEnd = Math.min(
          groupEnd,
          noteIndex + MAX_DRUM_BACKING_OCCURRENCES_PER_TIMESTAMP,
        )

        for (
          let playableIndex = noteIndex;
          playableIndex < playableGroupEnd;
          playableIndex += 1
        ) {
          const note = playableNotes[playableIndex]
          if (note === undefined) continue
          const timelineBeat =
            window.fromTimelineBeat + (note.startBeat - window.fromPositionBeat)
          const occurrenceKey = `${currentSessionRevision}:${currentTransportRevision}:${note.sequence}:${window.loopIteration}`
          if (occurrenceKeys.has(occurrenceKey)) continue
          if (
            scheduledThisPass >= MAX_DRUM_BACKING_OCCURRENCES_PER_SCHEDULE ||
            occurrenceKeys.size >= MAX_DRUM_BACKING_DEDUPE_LEDGER
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
            ((note.startBeat - window.fromPositionBeat) * 60_000) /
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

          occurrenceKeys.set(occurrenceKey, timelineBeat)
          const durationSeconds = noteDurationSeconds(
            options.transport,
            note,
            window,
          )
          let truth: DrumArrangementTriggerTruth = 'dropped'
          try {
            truth = triggerTruth(
              options.player.trigger({
                trackId: note.trackId,
                sourceId: note.sourceNoteId,
                midi: note.midi,
                atContextTime,
                durationSeconds,
                voice: note.voice,
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
            trackId: note.trackId,
            sourceNoteId: note.sourceNoteId,
            midi: note.midi,
            authoredBeat: note.startBeat,
            timelineBeat,
            loopIteration: window.loopIteration,
            performanceTimestampMs,
            atContextTime,
            durationSeconds,
            triggerTruth: truth,
          })
          scheduledThisPass += 1
          scheduledOccurrenceCount += 1
          lastOccurrence = occurrence
          scheduled.push(occurrence)
        }
        noteIndex = groupEnd
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
    if (disposed) return
    const nextRevision = options.transport.scheduleRevision()
    if (nextRevision !== currentTransportRevision) {
      currentTransportRevision = nextRevision
      invalidateQueue(true)
    }
    const scheduled = scheduleNow()
    if (scheduled.length === 0) emit()
  })

  return {
    snapshot,
    sessionRevision: () => currentSessionRevision,
    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setArrangement(nextArrangement) {
      if (disposed) return
      currentSessionRevision += 1
      arrangement = nextArrangement
      if (nextArrangement === null) {
        playableNotes = Object.freeze([])
        indexedNoteCount = 0
        invalidNoteCount = 0
      } else {
        const index = indexArrangement(nextArrangement)
        playableNotes = index.playable
        indexedNoteCount = index.total
        invalidNoteCount = index.invalid
      }
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
