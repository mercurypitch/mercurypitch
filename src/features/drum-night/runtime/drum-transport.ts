// Drum Night transport — count-in, loop, playhead and takes on one clock.
// ============================================================

import type { DrumLiveHit } from './drum-runtime-types'

export const DRUM_TEMPO_MIN_BPM = 40
export const DRUM_TEMPO_MAX_BPM = 280
export const DRUM_COUNT_IN_MAX_BEATS = 8

export type DrumTransportPhase = 'stopped' | 'count-in' | 'playing' | 'paused'

export interface DrumLoopRange {
  readonly startBeat: number
  readonly endBeat: number
}

export interface DrumTransportState {
  readonly phase: DrumTransportPhase
  readonly tempoBpm: number
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

/** One performance-clock window for scheduling authored hits into audio. */
export interface DrumSchedulingWindow {
  readonly fromTimestampMs: number
  readonly toTimestampMs: number
  readonly fromTimelineBeat: number
  readonly toTimelineBeat: number
  readonly loop: DrumLoopRange | null
}

export interface DrumTransportOptions {
  readonly clock?: DrumRuntimeClock
  readonly tempoBpm?: number
  readonly countInBeats?: number
}

export interface DrumTransport {
  state(): DrumTransportState
  recordedHits(): readonly DrumRecordedHit[]
  subscribe(listener: () => void): () => void
  start(): void
  pause(): void
  stop(): void
  seek(beat: number): void
  setTempoBpm(tempoBpm: number): void
  setCountInBeats(countInBeats: number): void
  setLoop(loop: DrumLoopRange | null): boolean
  setRecording(recording: boolean): void
  clearRecording(): void
  captureHit(hit: DrumLiveHit): DrumRecordedHit | null
  schedulingWindow(lookaheadMs?: number): DrumSchedulingWindow | null
  dispose(): void
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

function boundedCountIn(value: number): number {
  return Number.isFinite(value)
    ? Math.round(clamp(value, 0, DRUM_COUNT_IN_MAX_BEATS))
    : 4
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus
}

function loopedPosition(
  timelineBeat: number,
  loop: DrumLoopRange | null,
): { positionBeat: number; iteration: number } {
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

export function createDrumTransport(
  options: DrumTransportOptions = {},
): DrumTransport {
  const clock = options.clock ?? createBrowserDrumRuntimeClock()
  const listeners = new Set<() => void>()
  let tempoBpm = boundedTempo(options.tempoBpm ?? 96)
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
  let frame: number | null = null
  let disposed = false
  let nextHitId = 1
  let capturedHits: DrumRecordedHit[] = []

  const beatDurationMs = (): number => 60_000 / tempoBpm

  const snapshot = (): DrumTransportState => {
    const visible = loopedPosition(timelineBeats, loop)
    return Object.freeze({
      phase,
      tempoBpm,
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

  const cancelFrame = (): void => {
    if (frame === null) return
    clock.cancelFrame(frame)
    frame = null
  }

  const advance = (timestampMs: number): void => {
    const elapsedMs = Math.max(0, timestampMs - anchorTimestampMs)
    if (phase === 'count-in') {
      const progress = anchorCountInProgressBeats + elapsedMs / beatDurationMs()
      if (progress < countInBeats) {
        countInProgressBeats = progress
        return
      }
      const overshootBeats = progress - countInBeats
      countInProgressBeats = countInBeats
      phase = 'playing'
      pausedFromPhase = null
      timelineBeats = anchorTimelineBeats + overshootBeats
      anchorTimelineBeats = timelineBeats
      anchorTimestampMs = timestampMs
      return
    }
    if (phase === 'playing') {
      timelineBeats = anchorTimelineBeats + elapsedMs / beatDurationMs()
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

  return {
    state: snapshot,
    recordedHits: () => Object.freeze([...capturedHits]),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      if (disposed || phase === 'playing' || phase === 'count-in') return
      const nowMs = clock.nowMs()
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
      }
      pausedFromPhase = null
      emit()
      scheduleFrame()
    },
    pause() {
      if (phase !== 'playing' && phase !== 'count-in') return
      const nowMs = clock.nowMs()
      advance(nowMs)
      pausedFromPhase = phase === 'count-in' ? 'count-in' : 'playing'
      anchorTimestampMs = nowMs
      anchorTimelineBeats = timelineBeats
      phase = 'paused'
      cancelFrame()
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
      anchorTimestampMs = clock.nowMs()
      emit()
    },
    seek(beat) {
      if (!Number.isFinite(beat)) return
      const nowMs = clock.nowMs()
      timelineBeats = Math.max(0, beat)
      anchorTimelineBeats = timelineBeats
      anchorTimestampMs = nowMs
      emit()
    },
    setTempoBpm(value) {
      const nowMs = clock.nowMs()
      reanchor(nowMs)
      tempoBpm = boundedTempo(value)
      emit()
    },
    setCountInBeats(value) {
      countInBeats = boundedCountIn(value)
      if (phase === 'count-in') {
        countInProgressBeats = Math.min(countInProgressBeats, countInBeats)
        anchorCountInProgressBeats = countInProgressBeats
        anchorTimestampMs = clock.nowMs()
      }
      emit()
    },
    setLoop(nextLoop) {
      if (nextLoop === null) {
        loop = null
        emit()
        return true
      }
      if (
        !Number.isFinite(nextLoop.startBeat) ||
        !Number.isFinite(nextLoop.endBeat) ||
        nextLoop.startBeat < 0 ||
        nextLoop.endBeat - nextLoop.startBeat < 0.25
      ) {
        return false
      }
      loop = Object.freeze({ ...nextLoop })
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
      const hitTimelineBeats = Math.max(
        0,
        anchorTimelineBeats +
          (hit.timestampMs - anchorTimestampMs) / beatDurationMs(),
      )
      const visible = loopedPosition(hitTimelineBeats, loop)
      const nearestGridBeat = Math.round(visible.positionBeat * 4) / 4
      const recorded: DrumRecordedHit = Object.freeze({
        ...hit,
        id: nextHitId++,
        transportBeat: visible.positionBeat,
        timelineBeat: hitTimelineBeats,
        loopIteration: visible.iteration,
        nearestGridBeat,
        timingOffsetMs:
          (visible.positionBeat - nearestGridBeat) * beatDurationMs(),
      })
      capturedHits = [...capturedHits, recorded]
      emit()
      return recorded
    },
    schedulingWindow(lookaheadMs = 100) {
      const nowMs = clock.nowMs()
      advance(nowMs)
      if (phase !== 'playing') return null
      const boundedLookaheadMs = Number.isFinite(lookaheadMs)
        ? clamp(lookaheadMs, 0, 2_000)
        : 100
      return Object.freeze({
        fromTimestampMs: nowMs,
        toTimestampMs: nowMs + boundedLookaheadMs,
        fromTimelineBeat: timelineBeats,
        toTimelineBeat: timelineBeats + boundedLookaheadMs / beatDurationMs(),
        loop,
      })
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelFrame()
      listeners.clear()
    },
  }
}
