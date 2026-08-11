// Guitar take recorder — bounded, frame-stable input evidence for one local take.
// ============================================================
//
// This recorder owns metadata only: event clocks, identified pitches, and
// levels. It never receives raw audio and never persists anything. The route's
// latency and primary timing source are copied at start so a calibration or
// device change cannot rewrite the meaning of evidence already in flight.

import type { GuitarInputProfileSnapshot } from './guitar-input-profile'
import type { GuitarInputCapture, GuitarInputEvent, GuitarInputHealth, GuitarInputTimingSource, } from './input-events'

export type GuitarTakeLifecycle = 'recording' | 'completed' | 'cancelled'

export type GuitarTakeLatencyProvenance =
  | 'stored-round-trip'
  | 'midi-route-unmeasured'
  | 'none'

export interface GuitarTakeLatencyInput {
  seconds: number
  provenance: GuitarTakeLatencyProvenance
  /** Null means the calibration route did not quantify uncertainty. */
  uncertaintySeconds: number | null
}

export interface GuitarTakeLatencySnapshot extends GuitarTakeLatencyInput {
  frames: number
}

export interface GuitarTakeClockSnapshot {
  /** Absolute audio frame at the take's transport zero. */
  startedAtFrame: number
  sampleRate: number
  attack: {
    timingSource: GuitarInputTimingSource
    precision: 'sample-exact' | 'coarse-frame-loop' | 'high-resolution-midi'
  }
  latency: GuitarTakeLatencySnapshot
}

export interface GuitarTakeEvent extends GuitarInputEvent {
  /** Raw capture-clock frame relative to this take's transport zero. */
  rawTransportFrame: number
  /** Player-time frame after the take's pinned latency is removed. */
  compensatedTransportFrame: number
}

export interface GuitarTakeSnapshot {
  id: string
  lifecycle: GuitarTakeLifecycle
  input: GuitarInputProfileSnapshot
  clock: GuitarTakeClockSnapshot
  events: readonly GuitarTakeEvent[]
  /** Length from transport zero to completion; absent until completed. */
  durationFrames: number | null
  filteredBeforeStart: number
  filteredAfterEnd: number
  truncated: boolean
  droppedEventCount: number
  /** Aggregated states only; no samples or raw input ever enter the take. */
  inputHealth: {
    readings: number
    states: Readonly<Record<GuitarInputHealth, number>>
  }
}

export interface GuitarTakeRecorderOptions {
  takeId: string
  startedAtSeconds: number
  sampleRate: number
  latency: GuitarTakeLatencyInput
  input: GuitarInputProfileSnapshot
  attackTimingSource: GuitarInputTimingSource
  maxEvents?: number
}

export interface GuitarTakeRecorder {
  append(capture: GuitarInputCapture): GuitarTakeEvent | null
  observeHealth(state: GuitarInputHealth): void
  /** Replace metadata for one retained event without changing identity/time. */
  replace(
    eventId: string,
    replacement: GuitarInputEvent,
  ): GuitarTakeEvent | null
  complete(endedAtSeconds: number): GuitarTakeSnapshot
  cancel(): GuitarTakeSnapshot
  snapshot(): GuitarTakeSnapshot
}

const DEFAULT_MAX_EVENTS = 256

function emptyHealthStates(): Record<GuitarInputHealth, number> {
  return {
    silent: 0,
    quiet: 0,
    good: 0,
    hot: 0,
    clipping: 0,
    noisy: 0,
    uncertain: 0,
  }
}

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite, non-negative number.`)
  }
}

function captureAtSeconds(capture: GuitarInputCapture): number | null {
  if (capture.clock.kind === 'audio-worklet') {
    if (
      !Number.isInteger(capture.clock.atFrame) ||
      capture.clock.atFrame < 0 ||
      !Number.isFinite(capture.clock.sampleRate) ||
      capture.clock.sampleRate <= 0
    ) {
      return null
    }
    return capture.clock.atFrame / capture.clock.sampleRate
  }
  if (capture.clock.kind === 'web-midi') {
    return Number.isFinite(capture.clock.mappedAudioTime) &&
      capture.clock.mappedAudioTime >= 0
      ? capture.clock.mappedAudioTime
      : null
  }
  if (
    !Number.isFinite(capture.clock.observedAt) ||
    !Number.isFinite(capture.clock.windowStartAt) ||
    !Number.isFinite(capture.clock.sampleRate) ||
    capture.clock.sampleRate <= 0 ||
    !Number.isInteger(capture.clock.windowFrames) ||
    capture.clock.windowFrames <= 0
  ) {
    return null
  }
  return capture.clock.windowStartAt
}

export function createGuitarTakeRecorder(
  options: GuitarTakeRecorderOptions,
): GuitarTakeRecorder {
  if (options.takeId.length === 0) {
    throw new Error('A guitar take needs a stable id.')
  }
  if (!Number.isFinite(options.sampleRate) || options.sampleRate <= 0) {
    throw new RangeError('sampleRate must be a finite, positive number.')
  }
  assertFiniteNonNegative(options.startedAtSeconds, 'startedAtSeconds')
  assertFiniteNonNegative(options.latency.seconds, 'latency.seconds')
  if (
    options.latency.uncertaintySeconds !== null &&
    (!Number.isFinite(options.latency.uncertaintySeconds) ||
      options.latency.uncertaintySeconds < 0)
  ) {
    throw new RangeError(
      'latency.uncertaintySeconds must be null or a finite, non-negative number.',
    )
  }
  if (options.latency.provenance === 'none' && options.latency.seconds !== 0) {
    throw new Error('Unmeasured latency cannot apply a timing correction.')
  }
  if (
    options.latency.provenance === 'midi-route-unmeasured' &&
    options.latency.seconds !== 0
  ) {
    throw new Error(
      'A MIDI event timestamp is not a measured route correction.',
    )
  }

  const takeId = options.takeId
  const input = { ...options.input }
  const sampleRate = options.sampleRate
  const startedAtFrame = Math.round(options.startedAtSeconds * sampleRate)
  const latencyFrames = Math.round(options.latency.seconds * sampleRate)
  const requestedMaxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS
  if (!Number.isFinite(requestedMaxEvents)) {
    throw new RangeError('maxEvents must be a finite number.')
  }
  const maxEvents = Math.max(1, Math.floor(requestedMaxEvents))
  const clock: GuitarTakeClockSnapshot = {
    startedAtFrame,
    sampleRate,
    attack: {
      timingSource: options.attackTimingSource,
      precision:
        options.attackTimingSource === 'audio-clock'
          ? 'sample-exact'
          : options.attackTimingSource === 'midi-clock'
            ? 'high-resolution-midi'
            : 'coarse-frame-loop',
    },
    latency: {
      seconds: options.latency.seconds,
      frames: latencyFrames,
      provenance: options.latency.provenance,
      uncertaintySeconds: options.latency.uncertaintySeconds,
    },
  }

  let lifecycle: GuitarTakeLifecycle = 'recording'
  let events: readonly GuitarTakeEvent[] = []
  let durationFrames: number | null = null
  let filteredBeforeStart = 0
  let filteredAfterEnd = 0
  let droppedEventCount = 0
  let nextEvent = 1
  let healthReadings = 0
  const healthStates = emptyHealthStates()

  const snapshot = (): GuitarTakeSnapshot => ({
    id: takeId,
    lifecycle,
    input: { ...input },
    clock: {
      ...clock,
      attack: { ...clock.attack },
      latency: { ...clock.latency },
    },
    events: [...events],
    durationFrames,
    filteredBeforeStart,
    filteredAfterEnd,
    truncated: droppedEventCount > 0,
    droppedEventCount,
    inputHealth: {
      readings: healthReadings,
      states: { ...healthStates },
    },
  })

  const observeHealth = (state: GuitarInputHealth): void => {
    if (lifecycle !== 'recording') return
    healthReadings += 1
    healthStates[state] += 1
  }

  const append = (capture: GuitarInputCapture): GuitarTakeEvent | null => {
    if (lifecycle !== 'recording') return null
    const rawSeconds = captureAtSeconds(capture)
    if (rawSeconds === null) return null

    // Pitch changes are intentionally found on the coarse analyser even in an
    // exact-attack take. Only an attack can weaken the take's attack clock.
    if (capture.kind === 'attack' && capture.clock.kind === 'frame-loop') {
      clock.attack = {
        timingSource: 'frame-loop',
        precision: 'coarse-frame-loop',
      }
    } else if (
      capture.kind === 'attack' &&
      capture.clock.kind === 'web-midi' &&
      clock.attack.precision !== 'coarse-frame-loop'
    ) {
      clock.attack = {
        timingSource: 'midi-clock',
        precision: 'high-resolution-midi',
      }
    }

    const capturedAtFrame = Math.round(rawSeconds * sampleRate)
    const rawTransportFrame = capturedAtFrame - startedAtFrame
    const compensatedTransportFrame = rawTransportFrame - latencyFrames
    if (compensatedTransportFrame < 0) {
      filteredBeforeStart += 1
      return null
    }

    const event: GuitarTakeEvent = {
      id: `${takeId}:event-${nextEvent}`,
      kind: capture.kind,
      source: capture.source,
      voiceId: capture.voiceId,
      at: (startedAtFrame + compensatedTransportFrame) / sampleRate,
      capturedAt: capturedAtFrame / sampleRate,
      rawTransportFrame,
      compensatedTransportFrame,
      level: capture.level,
      clock: { ...capture.clock },
      pitch: capture.pitch,
    }
    nextEvent += 1

    const next = [...events, event]
    if (next.length > maxEvents) {
      events = next.slice(next.length - maxEvents)
      droppedEventCount += 1
    } else {
      events = next
    }
    return event
  }

  const replace = (
    eventId: string,
    replacement: GuitarInputEvent,
  ): GuitarTakeEvent | null => {
    if (lifecycle !== 'recording' || replacement.id !== eventId) return null
    const index = events.findIndex((event) => event.id === eventId)
    const current = events[index]
    if (current === undefined) return null

    // Identity and both clock domains are structural evidence. A late pitch
    // may enrich the event, never move or relabel the strike it belongs to.
    const updated: GuitarTakeEvent = {
      ...current,
      pitch: replacement.pitch,
    }
    const next = [...events]
    next[index] = updated
    events = next
    return updated
  }

  const complete = (endedAtSeconds: number): GuitarTakeSnapshot => {
    if (lifecycle !== 'recording') return snapshot()
    assertFiniteNonNegative(endedAtSeconds, 'endedAtSeconds')
    durationFrames = Math.max(
      0,
      Math.round(endedAtSeconds * sampleRate) - startedAtFrame,
    )
    const retained = events.filter(
      (event) => event.compensatedTransportFrame < (durationFrames ?? 0),
    )
    filteredAfterEnd += events.length - retained.length
    events = retained
    lifecycle = 'completed'
    return snapshot()
  }

  const cancel = (): GuitarTakeSnapshot => {
    if (lifecycle !== 'recording') return snapshot()
    lifecycle = 'cancelled'
    events = []
    durationFrames = null
    return snapshot()
  }

  return { append, observeHealth, replace, complete, cancel, snapshot }
}
