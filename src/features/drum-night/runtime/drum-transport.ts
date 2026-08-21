// Drum Night transport — count-in, authored tempo, loops and takes on one clock.
// ============================================================

import type { MidiTempoChange } from '@/lib/midi-song'
import { createBeatClock, createSecondsToBeatClock } from '@/lib/midi-song'
import type { DrumLiveHit } from './drum-runtime-types'

export const DRUM_TEMPO_MIN_BPM = 40
export const DRUM_TEMPO_MAX_BPM = 280
export const DRUM_COUNT_IN_MAX_BEATS = 8
export const DRUM_SPEED_SCALE_MIN = 0.25
export const DRUM_SPEED_SCALE_MAX = 2
export const DRUM_SCHEDULING_LOOKAHEAD_MAX_MS = 2_000
/** Raw map intake samples across the source list before bounded sorting. */
export const MAX_DRUM_RAW_TEMPO_CHANGES = 4_096
export const MAX_DRUM_AUTHORED_TEMPO_CHANGES = 128

const TIMELINE_EPSILON = 1e-9
const MIN_TEMPO_CHANGE_SPACING_BEATS = 1 / 16
const MIN_AUTHORED_US_PER_BEAT = 60_000_000 / DRUM_TEMPO_MAX_BPM
const MAX_AUTHORED_US_PER_BEAT = 60_000_000 / DRUM_TEMPO_MIN_BPM
// At the maximum 560 effective BPM, a 2s lookahead crosses fewer than 75
// quarter-beat loops. Tempo spacing permits at most four segments per loop.
const MAX_SCHEDULING_WINDOWS = 512

export type DrumTransportPhase = 'stopped' | 'count-in' | 'playing' | 'paused'

export interface DrumLoopRange {
  readonly startBeat: number
  readonly endBeat: number
}

/** Canonical song timing retained independently from a user's speed choice. */
export interface DrumAuthoredTiming {
  readonly tempoBpm: number
  readonly tempoChanges?: readonly MidiTempoChange[]
  /** Last authored attack plus its written duration, in quarter-note beats. */
  readonly durationBeats: number
}

export interface DrumTransportState {
  readonly phase: DrumTransportPhase
  /** Effective tempo at the visible authored position (local tempo x speed). */
  readonly tempoBpm: number
  /** Tempo written at the visible authored position, before user speed. */
  readonly localTempoBpm: number
  readonly speedScale: number
  readonly authoredDurationBeats: number | null
  readonly appliedTempoChangeCount: number
  /** Source changes omitted by validation, dedupe, density, or complexity. */
  readonly omittedTempoChangeCount: number
  /** Applied source changes whose tempo was clamped to the playable range. */
  readonly adjustedTempoChangeCount: number
  readonly countInBeats: number
  readonly countInBeat: number | null
  readonly positionBeats: number
  /** Monotonic playhead before an enabled loop wraps it for display. */
  readonly timelineBeats: number
  readonly loopIteration: number
  readonly loop: DrumLoopRange | null
  readonly recording: boolean
  /** A paused count-in restarts from beat one; paused playback resumes in place. */
  readonly pausedFromPhase: Extract<
    DrumTransportPhase,
    'count-in' | 'playing'
  > | null
}

export interface DrumRecordedHit extends DrumLiveHit {
  readonly id: number
  readonly transportBeat: number
  readonly timelineBeat: number
  readonly loopIteration: number
  /** Nearest sixteenth-note grid position in transport beats. */
  readonly nearestGridBeat: number
  /** Positive is late; negative is early. */
  readonly timingOffsetMs: number
}

export interface DrumRuntimeClock {
  nowMs(): number
  requestFrame(callback: (timestampMs: number) => void): number
  cancelFrame(handle: number): void
}

/** Backward-compatible aggregate lookahead on the shared performance clock. */
export interface DrumSchedulingWindow {
  readonly fromTimestampMs: number
  readonly toTimestampMs: number
  readonly fromTimelineBeat: number
  readonly toTimelineBeat: number
  readonly loop: DrumLoopRange | null
}

export type DrumSchedulingBoundary = 'duration' | 'lookahead' | 'loop' | 'tempo'

/** A constant-tempo, non-wrapping authored range safe for audio scheduling. */
export interface DrumAuthoredSchedulingWindow extends DrumSchedulingWindow {
  readonly fromPositionBeat: number
  readonly toPositionBeat: number
  readonly loopIteration: number
  readonly localTempoBpm: number
  readonly effectiveTempoBpm: number
  readonly speedScale: number
  readonly endsAt: DrumSchedulingBoundary
  /** Only a terminal song-duration boundary includes an attack at its end. */
  readonly includeEndBeat: boolean
}

export interface DrumTransportOptions {
  readonly clock?: DrumRuntimeClock
  readonly tempoBpm?: number
  readonly countInBeats?: number
  readonly speedScale?: number
  readonly authoredTiming?: DrumAuthoredTiming | null
}

export interface DrumTransport {
  state(): DrumTransportState
  recordedHits(): readonly DrumRecordedHit[]
  /** Changes only when queued authored audio must be invalidated. */
  scheduleRevision(): number
  subscribe(listener: () => void): () => void
  start(): void
  pause(): void
  stop(): void
  seek(beat: number): void
  setTempoBpm(tempoBpm: number): void
  setSpeedScale(speedScale: number): void
  setAuthoredTiming(timing: DrumAuthoredTiming | null): void
  setCountInBeats(countInBeats: number): void
  setLoop(loop: DrumLoopRange | null): boolean
  setRecording(recording: boolean): void
  clearRecording(): void
  captureHit(hit: DrumLiveHit): DrumRecordedHit | null
  schedulingWindow(lookaheadMs?: number): DrumSchedulingWindow | null
  schedulingWindows(
    lookaheadMs?: number,
  ): readonly DrumAuthoredSchedulingWindow[]
  dispose(): void
}

interface NormalizedTiming {
  readonly openingBpm: number
  readonly tempoChanges: readonly MidiTempoChange[]
  readonly durationBeats: number | null
  readonly appliedTempoChangeCount: number
  readonly omittedTempoChangeCount: number
  readonly adjustedTempoChangeCount: number
  readonly beatToSeconds: (beat: number) => number
  readonly secondsToBeat: (seconds: number) => number
}

interface VisibleTimelinePosition {
  readonly positionBeat: number
  readonly iteration: number
}

export function createBrowserDrumRuntimeClock(): DrumRuntimeClock {
  return {
    nowMs: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function boundedTempo(value: number): number {
  return Number.isFinite(value)
    ? clamp(value, DRUM_TEMPO_MIN_BPM, DRUM_TEMPO_MAX_BPM)
    : 96
}

function boundedSpeedScale(value: number): number {
  return Number.isFinite(value)
    ? clamp(value, DRUM_SPEED_SCALE_MIN, DRUM_SPEED_SCALE_MAX)
    : 1
}

function boundedCountIn(value: number): number {
  return Number.isFinite(value)
    ? Math.round(clamp(value, 0, DRUM_COUNT_IN_MAX_BEATS))
    : 4
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function normalizedSourceBpm(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? boundedTempo(value) : fallback
}

interface TempoCandidate extends MidiTempoChange {
  readonly adjusted: boolean
}

function evenlyBoundedTempoChanges(
  changes: readonly TempoCandidate[],
): readonly TempoCandidate[] {
  if (changes.length <= MAX_DRUM_AUTHORED_TEMPO_CHANGES) return changes
  const selected: TempoCandidate[] = []
  const lastIndex = changes.length - 1
  for (let index = 0; index < MAX_DRUM_AUTHORED_TEMPO_CHANGES; index += 1) {
    const sourceIndex = Math.round(
      (index * lastIndex) / (MAX_DRUM_AUTHORED_TEMPO_CHANGES - 1),
    )
    const change = changes[sourceIndex]
    if (change !== undefined) selected.push(change)
  }
  return selected
}

function evenlyBoundedRawTempoChanges(
  changes: readonly MidiTempoChange[],
): readonly MidiTempoChange[] {
  if (changes.length <= MAX_DRUM_RAW_TEMPO_CHANGES) return changes
  const selected: MidiTempoChange[] = []
  const lastIndex = changes.length - 1
  for (let index = 0; index < MAX_DRUM_RAW_TEMPO_CHANGES; index += 1) {
    const sourceIndex = Math.round(
      (index * lastIndex) / (MAX_DRUM_RAW_TEMPO_CHANGES - 1),
    )
    const change = changes[sourceIndex]
    if (change !== undefined) selected.push(change)
  }
  return selected
}

function normalizeTiming(
  authored: DrumAuthoredTiming | null,
  constantTempoBpm: number,
): NormalizedTiming {
  const openingBpm =
    authored === null
      ? constantTempoBpm
      : normalizedSourceBpm(authored.tempoBpm, constantTempoBpm)
  const rawChanges = authored?.tempoChanges ?? []
  const byBeat = new Map<number, TempoCandidate>()
  // Sample across the whole canonical map before sorting. This keeps intake
  // bounded without silently retaining only the opening of a long song.
  for (const change of evenlyBoundedRawTempoChanges(rawChanges)) {
    if (
      !Number.isFinite(change.beat) ||
      change.beat < 0 ||
      !Number.isFinite(change.usPerBeat) ||
      change.usPerBeat <= 0
    ) {
      continue
    }
    const usPerBeat = clamp(
      change.usPerBeat,
      MIN_AUTHORED_US_PER_BEAT,
      MAX_AUTHORED_US_PER_BEAT,
    )
    byBeat.set(change.beat, {
      beat: change.beat,
      usPerBeat,
      adjusted: usPerBeat !== change.usPerBeat,
    })
  }
  const sortedCandidates = [...byBeat.values()].sort(
    (left, right) => left.beat - right.beat,
  )
  const spacedCandidates: TempoCandidate[] = []
  for (const candidate of sortedCandidates) {
    const previous = spacedCandidates.at(-1)
    if (
      previous !== undefined &&
      candidate.beat - previous.beat < MIN_TEMPO_CHANGE_SPACING_BEATS
    ) {
      continue
    }
    spacedCandidates.push(candidate)
  }
  const selectedCandidates = evenlyBoundedTempoChanges(spacedCandidates)
  const tempoChanges: MidiTempoChange[] = selectedCandidates.map(
    ({ beat, usPerBeat }) => ({ beat, usPerBeat }),
  )
  if (!tempoChanges.some((change) => change.beat === 0)) {
    tempoChanges.unshift({ beat: 0, usPerBeat: 60_000_000 / openingBpm })
  }
  const source = { bpm: openingBpm, tempoChanges }
  return Object.freeze({
    openingBpm,
    tempoChanges: Object.freeze(tempoChanges),
    durationBeats:
      authored !== null && Number.isFinite(authored.durationBeats)
        ? Math.max(0, authored.durationBeats)
        : null,
    appliedTempoChangeCount: selectedCandidates.length,
    omittedTempoChangeCount: Math.max(
      0,
      rawChanges.length - selectedCandidates.length,
    ),
    adjustedTempoChangeCount: selectedCandidates.reduce(
      (count, change) => count + (change.adjusted ? 1 : 0),
      0,
    ),
    beatToSeconds: createBeatClock(source),
    secondsToBeat: createSecondsToBeatClock(source),
  })
}

function loopedPosition(
  timelineBeat: number,
  loop: DrumLoopRange | null,
): VisibleTimelinePosition {
  if (loop === null || timelineBeat < loop.startBeat) {
    return { positionBeat: timelineBeat, iteration: 0 }
  }
  const length = loop.endBeat - loop.startBeat
  return {
    positionBeat:
      loop.startBeat + positiveModulo(timelineBeat - loop.startBeat, length),
    iteration: Math.floor((timelineBeat - loop.startBeat) / length),
  }
}

function localTempoBpm(timing: NormalizedTiming, beat: number): number {
  let usPerBeat = 60_000_000 / timing.openingBpm
  for (const change of timing.tempoChanges) {
    if (change.beat > beat + TIMELINE_EPSILON) break
    usPerBeat = change.usPerBeat
  }
  return 60_000_000 / usPerBeat
}

function occurrenceSecondsAt(
  timelineBeat: number,
  timing: NormalizedTiming,
  loop: DrumLoopRange | null,
): number {
  const boundedBeat = Math.max(0, timelineBeat)
  if (loop === null || boundedBeat < loop.startBeat) {
    return timing.beatToSeconds(boundedBeat)
  }
  const loopLengthBeats = loop.endBeat - loop.startBeat
  const loopStartSeconds = timing.beatToSeconds(loop.startBeat)
  const loopDurationSeconds = Math.max(
    Number.EPSILON,
    timing.beatToSeconds(loop.endBeat) - loopStartSeconds,
  )
  const distance = boundedBeat - loop.startBeat
  const iteration = Math.floor(distance / loopLengthBeats)
  const positionBeat =
    loop.startBeat + positiveModulo(distance, loopLengthBeats)
  return (
    loopStartSeconds +
    iteration * loopDurationSeconds +
    (timing.beatToSeconds(positionBeat) - loopStartSeconds)
  )
}

function timelineBeatAtOccurrenceSeconds(
  occurrenceSeconds: number,
  timing: NormalizedTiming,
  loop: DrumLoopRange | null,
): number {
  const boundedSeconds = Math.max(0, occurrenceSeconds)
  if (loop === null) return Math.max(0, timing.secondsToBeat(boundedSeconds))
  const loopStartSeconds = timing.beatToSeconds(loop.startBeat)
  if (boundedSeconds < loopStartSeconds - TIMELINE_EPSILON) {
    return Math.max(0, timing.secondsToBeat(boundedSeconds))
  }
  const loopLengthBeats = loop.endBeat - loop.startBeat
  const loopDurationSeconds = Math.max(
    Number.EPSILON,
    timing.beatToSeconds(loop.endBeat) - loopStartSeconds,
  )
  const distanceSeconds = Math.max(0, boundedSeconds - loopStartSeconds)
  const iteration = Math.floor(
    (distanceSeconds + TIMELINE_EPSILON) / loopDurationSeconds,
  )
  const withinLoopSeconds = positiveModulo(distanceSeconds, loopDurationSeconds)
  const positionBeat = timing.secondsToBeat(
    loopStartSeconds + withinLoopSeconds,
  )
  return (
    loop.startBeat +
    iteration * loopLengthBeats +
    (positionBeat - loop.startBeat)
  )
}

function nextTempoChangeBeat(
  timing: NormalizedTiming,
  positionBeat: number,
  maximumBeat: number,
): number | null {
  for (const change of timing.tempoChanges) {
    if (
      change.beat > positionBeat + TIMELINE_EPSILON &&
      change.beat < maximumBeat - TIMELINE_EPSILON
    ) {
      return change.beat
    }
  }
  return null
}

/**
 * One route-owned timeline. Constant-tempo callers retain Phase 3 behavior;
 * authored timing adds a score-time curve without adding another clock.
 */
export function createDrumTransport(
  options: DrumTransportOptions = {},
): DrumTransport {
  const clock = options.clock ?? createBrowserDrumRuntimeClock()
  const listeners = new Set<() => void>()
  let constantTempoBpm = boundedTempo(options.tempoBpm ?? 96)
  let speedScale = boundedSpeedScale(options.speedScale ?? 1)
  let authoredTiming = options.authoredTiming ?? null
  let timing = normalizeTiming(authoredTiming, constantTempoBpm)
  let countInBeats = boundedCountIn(options.countInBeats ?? 4)
  let phase: DrumTransportPhase = 'stopped'
  let pausedFromPhase: Extract<
    DrumTransportPhase,
    'count-in' | 'playing'
  > | null = null
  let loop: DrumLoopRange | null = null
  let recording = false
  let timelineBeats = 0
  let anchorTimelineBeats = 0
  let anchorTimestampMs = clock.nowMs()
  let countInProgressBeats = 0
  let anchorCountInProgressBeats = 0
  let countInTempoBpm = constantTempoBpm
  let frame: number | null = null
  let disposed = false
  let nextHitId = 1
  let capturedHits: DrumRecordedHit[] = []
  let currentScheduleRevision = 0
  let naturalEndReached = false

  const visiblePosition = (beat = timelineBeats): VisibleTimelinePosition =>
    loopedPosition(beat, loop)

  const effectiveTempoAt = (positionBeat: number): number =>
    localTempoBpm(timing, positionBeat) * speedScale

  const countInBeatDurationMs = (): number =>
    60_000 / Math.max(1, countInTempoBpm)

  const timelineAtElapsedMs = (
    fromTimelineBeat: number,
    elapsedMs: number,
  ): number => {
    const fromSeconds = occurrenceSecondsAt(fromTimelineBeat, timing, loop)
    const targetSeconds = fromSeconds + (elapsedMs / 1_000) * speedScale
    let targetTimeline = timelineBeatAtOccurrenceSeconds(
      targetSeconds,
      timing,
      loop,
    )
    if (loop === null && timing.durationBeats !== null) {
      targetTimeline = Math.min(timing.durationBeats, targetTimeline)
    }
    return Math.max(0, targetTimeline)
  }

  const snapshot = (): DrumTransportState => {
    const visible = visiblePosition()
    const sourceTempo = localTempoBpm(timing, visible.positionBeat)
    return Object.freeze({
      phase,
      tempoBpm: sourceTempo * speedScale,
      localTempoBpm: sourceTempo,
      speedScale,
      authoredDurationBeats: timing.durationBeats,
      appliedTempoChangeCount: timing.appliedTempoChangeCount,
      omittedTempoChangeCount: timing.omittedTempoChangeCount,
      adjustedTempoChangeCount: timing.adjustedTempoChangeCount,
      countInBeats,
      countInBeat:
        phase === 'count-in'
          ? Math.min(
              countInBeats,
              Math.max(1, Math.floor(countInProgressBeats) + 1),
            )
          : null,
      positionBeats: visible.positionBeat,
      timelineBeats,
      loopIteration: visible.iteration,
      loop,
      recording,
      pausedFromPhase,
    })
  }

  const emit = (): void => {
    for (const listener of listeners) listener()
  }

  const invalidateScheduledAudio = (): void => {
    currentScheduleRevision += 1
  }

  const cancelFrame = (): void => {
    if (frame === null) return
    clock.cancelFrame(frame)
    frame = null
  }

  const advance = (timestampMs: number): void => {
    const elapsedMs = Math.max(0, timestampMs - anchorTimestampMs)
    if (phase === 'count-in') {
      const remainingCountInBeats = Math.max(
        0,
        countInBeats - anchorCountInProgressBeats,
      )
      const remainingCountInMs = remainingCountInBeats * countInBeatDurationMs()
      if (elapsedMs < remainingCountInMs - TIMELINE_EPSILON) {
        countInProgressBeats =
          anchorCountInProgressBeats + elapsedMs / countInBeatDurationMs()
        return
      }
      const playbackElapsedMs = Math.max(0, elapsedMs - remainingCountInMs)
      countInProgressBeats = countInBeats
      phase = 'playing'
      pausedFromPhase = null
      timelineBeats = timelineAtElapsedMs(
        anchorTimelineBeats,
        playbackElapsedMs,
      )
      anchorTimelineBeats = timelineBeats
      anchorTimestampMs = timestampMs
      return
    }
    if (phase !== 'playing') return
    const nextTimelineBeats = timelineAtElapsedMs(
      anchorTimelineBeats,
      elapsedMs,
    )
    timelineBeats = nextTimelineBeats
    if (
      elapsedMs > 0 &&
      loop === null &&
      timing.durationBeats !== null &&
      timelineBeats >= timing.durationBeats - TIMELINE_EPSILON
    ) {
      timelineBeats = timing.durationBeats
      anchorTimelineBeats = timelineBeats
      anchorTimestampMs = timestampMs
      phase = 'stopped'
      pausedFromPhase = null
      naturalEndReached = true
      cancelFrame()
    }
  }

  const scheduleFrame = (): void => {
    if (frame !== null || disposed) return
    if (phase !== 'count-in' && phase !== 'playing') return
    frame = clock.requestFrame(onFrame)
  }

  function onFrame(timestampMs: number): void {
    frame = null
    if (disposed) return
    advance(timestampMs)
    emit()
    scheduleFrame()
  }

  const reanchor = (timestampMs: number): void => {
    advance(timestampMs)
    anchorTimestampMs = timestampMs
    anchorTimelineBeats = timelineBeats
    anchorCountInProgressBeats = countInProgressBeats
  }

  const detailedSchedulingWindows = (
    lookaheadMs = 100,
  ): readonly DrumAuthoredSchedulingWindow[] => {
    const nowMs = clock.nowMs()
    advance(nowMs)
    if (phase !== 'playing' && phase !== 'count-in') return Object.freeze([])
    const boundedLookaheadMs = Number.isFinite(lookaheadMs)
      ? clamp(lookaheadMs, 0, DRUM_SCHEDULING_LOOKAHEAD_MAX_MS)
      : 100
    let remainingMs = boundedLookaheadMs
    let fromTimestampMs =
      phase === 'count-in'
        ? nowMs +
          Math.max(0, countInBeats - countInProgressBeats) *
            countInBeatDurationMs()
        : nowMs
    let fromTimelineBeat = timelineBeats
    const windows: DrumAuthoredSchedulingWindow[] = []

    while (windows.length < MAX_SCHEDULING_WINDOWS) {
      const visible = visiblePosition(fromTimelineBeat)
      const sourceTempo = localTempoBpm(timing, visible.positionBeat)
      const effectiveTempoBpm = sourceTempo * speedScale
      const beatDurationMs = 60_000 / effectiveTempoBpm
      let boundaryTimelineBeat = Number.POSITIVE_INFINITY
      let boundaryPositionBeat = Number.POSITIVE_INFINITY
      let boundary: DrumSchedulingBoundary = 'lookahead'

      if (loop !== null && fromTimelineBeat < loop.startBeat) {
        boundaryTimelineBeat = loop.startBeat
        boundaryPositionBeat = loop.startBeat
        boundary = 'loop'
      } else if (loop !== null) {
        const loopLength = loop.endBeat - loop.startBeat
        boundaryTimelineBeat =
          loop.startBeat + (visible.iteration + 1) * loopLength
        boundaryPositionBeat = loop.endBeat
        boundary = 'loop'
      } else if (timing.durationBeats !== null) {
        boundaryTimelineBeat = timing.durationBeats
        boundaryPositionBeat = timing.durationBeats
        boundary = 'duration'
      }

      const nextTempoBeat = nextTempoChangeBeat(
        timing,
        visible.positionBeat,
        boundaryPositionBeat,
      )
      if (nextTempoBeat !== null) {
        const tempoBoundaryTimeline =
          fromTimelineBeat + (nextTempoBeat - visible.positionBeat)
        if (tempoBoundaryTimeline < boundaryTimelineBeat - TIMELINE_EPSILON) {
          boundaryTimelineBeat = tempoBoundaryTimeline
          boundaryPositionBeat = nextTempoBeat
          boundary = 'tempo'
        }
      }

      const beatsToBoundary = Math.max(
        0,
        boundaryTimelineBeat - fromTimelineBeat,
      )
      const millisecondsToBoundary = beatsToBoundary * beatDurationMs
      const reachesBoundary =
        Number.isFinite(boundaryTimelineBeat) &&
        millisecondsToBoundary <= remainingMs + TIMELINE_EPSILON
      const segmentMs = reachesBoundary
        ? Math.max(0, millisecondsToBoundary)
        : remainingMs
      const segmentBeats = segmentMs / beatDurationMs
      const toTimelineBeat = reachesBoundary
        ? boundaryTimelineBeat
        : fromTimelineBeat + segmentBeats
      const toPositionBeat = reachesBoundary
        ? boundaryPositionBeat
        : visible.positionBeat + segmentBeats
      const endsAt = reachesBoundary ? boundary : 'lookahead'

      windows.push(
        Object.freeze({
          fromTimestampMs,
          toTimestampMs: fromTimestampMs + segmentMs,
          fromTimelineBeat,
          toTimelineBeat,
          fromPositionBeat: visible.positionBeat,
          toPositionBeat,
          loopIteration: visible.iteration,
          localTempoBpm: sourceTempo,
          effectiveTempoBpm,
          speedScale,
          endsAt,
          includeEndBeat: endsAt === 'duration',
          loop,
        }),
      )

      remainingMs = Math.max(0, remainingMs - segmentMs)
      if (
        remainingMs <= TIMELINE_EPSILON ||
        endsAt === 'lookahead' ||
        endsAt === 'duration'
      ) {
        break
      }
      if (segmentMs <= TIMELINE_EPSILON) {
        // A zero-length boundary is represented once; step over it so a
        // fractional seek directly onto a loop/tempo edge cannot spin.
        fromTimelineBeat = boundaryTimelineBeat + TIMELINE_EPSILON
      } else {
        fromTimelineBeat = boundaryTimelineBeat
      }
      fromTimestampMs += segmentMs
    }
    return Object.freeze(windows)
  }

  return {
    state: snapshot,
    recordedHits: () => Object.freeze([...capturedHits]),
    scheduleRevision: () => currentScheduleRevision,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      if (disposed || phase === 'playing' || phase === 'count-in') return
      const nowMs = clock.nowMs()
      if (naturalEndReached) {
        timelineBeats = 0
        anchorTimelineBeats = 0
        countInProgressBeats = 0
        anchorCountInProgressBeats = 0
      }
      naturalEndReached = false
      anchorTimestampMs = nowMs
      anchorTimelineBeats = timelineBeats
      const restartInterruptedCountIn =
        phase === 'paused' && pausedFromPhase === 'count-in'
      if (
        (phase === 'paused' && !restartInterruptedCountIn) ||
        countInBeats === 0
      ) {
        phase = 'playing'
      } else {
        phase = 'count-in'
        countInProgressBeats = 0
        anchorCountInProgressBeats = 0
        countInTempoBpm = effectiveTempoAt(
          visiblePosition(anchorTimelineBeats).positionBeat,
        )
      }
      pausedFromPhase = null
      invalidateScheduledAudio()
      emit()
      scheduleFrame()
    },
    pause() {
      if (phase !== 'playing' && phase !== 'count-in') return
      const nowMs = clock.nowMs()
      advance(nowMs)
      if (phase !== 'playing' && phase !== 'count-in') {
        emit()
        return
      }
      pausedFromPhase = phase === 'count-in' ? 'count-in' : 'playing'
      anchorTimestampMs = nowMs
      anchorTimelineBeats = timelineBeats
      anchorCountInProgressBeats = countInProgressBeats
      phase = 'paused'
      cancelFrame()
      invalidateScheduledAudio()
      emit()
    },
    stop() {
      if (disposed) return
      cancelFrame()
      phase = 'stopped'
      pausedFromPhase = null
      timelineBeats = 0
      anchorTimelineBeats = 0
      countInProgressBeats = 0
      anchorCountInProgressBeats = 0
      naturalEndReached = false
      anchorTimestampMs = clock.nowMs()
      invalidateScheduledAudio()
      emit()
    },
    seek(beat) {
      if (!Number.isFinite(beat)) return
      const nowMs = clock.nowMs()
      const maximum =
        loop === null && timing.durationBeats !== null
          ? timing.durationBeats
          : Number.POSITIVE_INFINITY
      timelineBeats = clamp(beat, 0, maximum)
      naturalEndReached = false
      anchorTimelineBeats = timelineBeats
      anchorTimestampMs = nowMs
      if (phase === 'count-in') {
        countInProgressBeats = 0
        anchorCountInProgressBeats = 0
        countInTempoBpm = effectiveTempoAt(
          visiblePosition(timelineBeats).positionBeat,
        )
      }
      invalidateScheduledAudio()
      emit()
    },
    setTempoBpm(value) {
      const nowMs = clock.nowMs()
      reanchor(nowMs)
      const nextTempo = boundedTempo(value)
      if (authoredTiming === null) {
        constantTempoBpm = nextTempo
        timing = normalizeTiming(null, constantTempoBpm)
      } else {
        const visible = visiblePosition()
        const sourceTempo = localTempoBpm(timing, visible.positionBeat)
        speedScale = boundedSpeedScale(nextTempo / sourceTempo)
      }
      if (phase === 'count-in') {
        countInTempoBpm = effectiveTempoAt(visiblePosition().positionBeat)
      }
      invalidateScheduledAudio()
      emit()
    },
    setSpeedScale(value) {
      const nowMs = clock.nowMs()
      reanchor(nowMs)
      speedScale = boundedSpeedScale(value)
      if (phase === 'count-in') {
        countInTempoBpm = effectiveTempoAt(visiblePosition().positionBeat)
      }
      invalidateScheduledAudio()
      emit()
    },
    setAuthoredTiming(nextTiming) {
      const nowMs = clock.nowMs()
      reanchor(nowMs)
      authoredTiming = nextTiming
      naturalEndReached = false
      speedScale = 1
      timing = normalizeTiming(authoredTiming, constantTempoBpm)
      if (
        loop !== null &&
        timing.durationBeats !== null &&
        loop.endBeat > timing.durationBeats + TIMELINE_EPSILON
      ) {
        loop = null
      }
      if (loop === null && timing.durationBeats !== null) {
        timelineBeats = Math.min(timelineBeats, timing.durationBeats)
      }
      anchorTimelineBeats = timelineBeats
      anchorTimestampMs = nowMs
      if (phase === 'count-in') {
        countInProgressBeats = 0
        anchorCountInProgressBeats = 0
        countInTempoBpm = effectiveTempoAt(visiblePosition().positionBeat)
      }
      invalidateScheduledAudio()
      emit()
    },
    setCountInBeats(value) {
      countInBeats = boundedCountIn(value)
      if (phase === 'count-in') {
        countInProgressBeats = Math.min(countInProgressBeats, countInBeats)
        anchorCountInProgressBeats = countInProgressBeats
        anchorTimestampMs = clock.nowMs()
      }
      invalidateScheduledAudio()
      emit()
    },
    setLoop(nextLoop) {
      const nowMs = clock.nowMs()
      reanchor(nowMs)
      const currentVisibleBeat = visiblePosition().positionBeat
      if (nextLoop === null) {
        loop = null
        naturalEndReached = false
        // Leaving iteration N resumes from what the player could actually see,
        // not from the unwrapped occurrence beat used for deduplication.
        timelineBeats = currentVisibleBeat
        anchorTimelineBeats = currentVisibleBeat
        anchorTimestampMs = nowMs
        invalidateScheduledAudio()
        emit()
        return true
      }
      if (
        !Number.isFinite(nextLoop.startBeat) ||
        !Number.isFinite(nextLoop.endBeat) ||
        nextLoop.startBeat < 0 ||
        nextLoop.endBeat - nextLoop.startBeat < 0.25 ||
        (timing.durationBeats !== null &&
          nextLoop.endBeat > timing.durationBeats + TIMELINE_EPSILON)
      ) {
        return false
      }
      loop = Object.freeze({ ...nextLoop })
      naturalEndReached = false
      // A loop edit is a control boundary. Keep the authored position when it
      // lies before/inside the new range; clamp a position beyond its end to
      // the new start rather than manufacturing an arbitrary iteration.
      timelineBeats =
        currentVisibleBeat < loop.endBeat ? currentVisibleBeat : loop.startBeat
      anchorTimelineBeats = timelineBeats
      anchorTimestampMs = nowMs
      invalidateScheduledAudio()
      emit()
      return true
    },
    setRecording(nextRecording) {
      recording = nextRecording
      emit()
    },
    clearRecording() {
      capturedHits = []
      nextHitId = 1
      emit()
    },
    captureHit(hit) {
      const phaseBeforeAdvance = phase
      if (phase === 'count-in') advance(hit.timestampMs)
      if (!recording || phase !== 'playing') {
        if (phase !== phaseBeforeAdvance) emit()
        return null
      }
      const hitTimelineBeats = timelineAtElapsedMs(
        anchorTimelineBeats,
        hit.timestampMs - anchorTimestampMs,
      )
      const visible = visiblePosition(hitTimelineBeats)
      const nearestGridBeat = Math.round(visible.positionBeat * 4) / 4
      const recorded: DrumRecordedHit = Object.freeze({
        ...hit,
        id: nextHitId++,
        transportBeat: visible.positionBeat,
        timelineBeat: hitTimelineBeats,
        loopIteration: visible.iteration,
        nearestGridBeat,
        timingOffsetMs:
          (visible.positionBeat - nearestGridBeat) *
          (60_000 / effectiveTempoAt(visible.positionBeat)),
      })
      capturedHits = [...capturedHits, recorded]
      emit()
      return recorded
    },
    schedulingWindow(lookaheadMs = 100) {
      const windows = detailedSchedulingWindows(lookaheadMs)
      const first = windows[0]
      const last = windows.at(-1)
      if (first === undefined || last === undefined) return null
      return Object.freeze({
        fromTimestampMs: first.fromTimestampMs,
        toTimestampMs: last.toTimestampMs,
        fromTimelineBeat: first.fromTimelineBeat,
        toTimelineBeat: last.toTimelineBeat,
        loop,
      })
    },
    schedulingWindows: detailedSchedulingWindows,
    dispose() {
      if (disposed) return
      disposed = true
      cancelFrame()
      listeners.clear()
    },
  }
}
