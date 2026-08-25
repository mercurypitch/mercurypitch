// ============================================================
// Drum Night click — a passive consumer of the route transport clock
// ============================================================
//
// The transport remains the only owner of musical time. This controller only
// reacts to its emitted scheduling windows and only uses an already-running,
// gesture-owned audio graph. It never creates or resumes an AudioContext and
// never owns a timer or animation frame.

import type { MidiTimeSignature } from '@/lib/midi-bars'
import { normalizeTimeSignatures, quarterBeatsPerBar } from '@/lib/midi-bars'
import type { DrumAuthoredSchedulingWindow, DrumTransport, DrumTransportPhase, } from './runtime/drum-transport'
import { DRUM_SCHEDULING_LOOKAHEAD_MAX_MS } from './runtime/drum-transport'

export const DEFAULT_DRUM_NIGHT_CLICK_LEVEL = 0.5
export const DEFAULT_DRUM_NIGHT_CLICK_LOOKAHEAD_MS = 100
export const MAX_DRUM_NIGHT_CLICKS_PER_SCHEDULE = 64
export const MAX_DRUM_NIGHT_CLICK_DEDUPE_LEDGER = 256
export const MAX_DRUM_NIGHT_CLICK_METER_CHANGES = 128

const CLICK_GAIN_FLOOR = 0.0001
const CLICK_REGULAR_PEAK = 0.14
const CLICK_ACCENT_PEAK = 0.22
const CLICK_ATTACK_SECONDS = 0.002
const CLICK_RELEASE_START_SECONDS = 0.006
const CLICK_RELEASE_TIME_CONSTANT_SECONDS = 0.005
const CLICK_STOP_SECONDS = 0.06
const CLICK_PANIC_RELEASE_SECONDS = 0.025
const CLICK_PANIC_STOP_SLACK_SECONDS = 0.01
const CLICK_LATE_GRACE_SECONDS = 0.012
const CLICK_TIMELINE_EPSILON = 1e-7

export type DrumNightClickStatus =
  | 'disabled'
  | 'disposed'
  | 'error'
  | 'count-in'
  | 'playing'
  | 'ready'
  | 'waiting-for-audio'

export type DrumNightClickKind = 'count-in' | 'playback'

export interface DrumNightScheduledClick {
  readonly id: string
  readonly kind: DrumNightClickKind
  readonly accent: boolean
  /** Null for count-in beats, which precede the authored timeline. */
  readonly authoredBeat: number | null
  /** Null for count-in beats, which precede the authored timeline. */
  readonly timelineBeat: number | null
  readonly performanceTimestampMs: number
  readonly atContextTime: number
}

export interface DrumNightClickSnapshot {
  readonly status: DrumNightClickStatus
  readonly enabled: boolean
  readonly level: number
  readonly transportRevision: number
  /** Scheduled in the current transport revision. */
  readonly scheduledClickCount: number
  /** Clicks intentionally left silent because their audio time had passed. */
  readonly lateOmittedClickCount: number
  readonly dedupeLedgerSize: number
  readonly activeVoiceCount: number
  readonly lastClick: DrumNightScheduledClick | null
  readonly error: string | null
}

export interface DrumNightClickControllerOptions {
  readonly transport: DrumTransport
  /** Passive getter: it must never create or resume an AudioContext. */
  readonly activeContext: () => AudioContext | null
  /** Passive getter for the route-owned output; it must never create a graph. */
  readonly activeOutput: () => AudioNode | null
  /** Maps the transport's performance timestamp onto the same audio clock. */
  readonly performanceTimestampToContextTime: (
    timestampMs: number,
  ) => number | null
  /** Canonical authored meter, when the active document exposes it. */
  readonly timeSignatures?: () =>
    | readonly MidiTimeSignature[]
    | null
    | undefined
  readonly lookaheadMs?: number
  readonly initialLevel?: number
}

export interface DrumNightClickController {
  snapshot(): DrumNightClickSnapshot
  subscribe(listener: () => void): () => void
  enable(enabled: boolean): void
  setLevel(level: number): void
  dispose(): void
}

interface ClickGraph {
  readonly context: AudioContext
  readonly output: AudioNode
  readonly master: GainNode
  voiceCount: number
  retired: boolean
  disconnected: boolean
}

interface ClickVoice {
  readonly key: string
  readonly graph: ClickGraph
  readonly oscillator: OscillatorNode
  readonly envelope: GainNode
  readonly startTime: number
  readonly stopTime: number
  cleaned: boolean
}

type ScheduleClickResult =
  | 'capacity'
  | 'duplicate'
  | 'error'
  | 'late'
  | 'outside-horizon'
  | 'scheduled'
  | 'waiting-for-audio'

function clampLevel(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_DRUM_NIGHT_CLICK_LEVEL
  return Math.min(1, Math.max(0, value as number))
}

function boundedLookahead(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_DRUM_NIGHT_CLICK_LOOKAHEAD_MS
  return Math.min(
    DRUM_SCHEDULING_LOOKAHEAD_MAX_MS,
    Math.max(0, value as number),
  )
}

function evenlyBoundedMeters(
  meters: readonly MidiTimeSignature[],
): readonly MidiTimeSignature[] {
  if (meters.length <= MAX_DRUM_NIGHT_CLICK_METER_CHANGES) return meters
  const selected: MidiTimeSignature[] = []
  const lastIndex = meters.length - 1
  for (let index = 0; index < MAX_DRUM_NIGHT_CLICK_METER_CHANGES; index += 1) {
    const sourceIndex = Math.round(
      (index * lastIndex) / (MAX_DRUM_NIGHT_CLICK_METER_CHANGES - 1),
    )
    const meter = meters[sourceIndex]
    if (meter !== undefined) selected.push(meter)
  }
  return selected
}

function phaseStatus(phase: DrumTransportPhase): DrumNightClickStatus {
  if (phase === 'count-in') return 'count-in'
  if (phase === 'playing') return 'playing'
  return 'ready'
}

function disconnect(node: AudioNode): void {
  try {
    node.disconnect()
  } catch {
    // A closed route graph is already disconnected in every meaningful sense.
  }
}

function stopOscillator(oscillator: OscillatorNode, at: number): boolean {
  try {
    oscillator.stop(at)
    return true
  } catch {
    return false
  }
}

function setRelease(param: AudioParam, now: number): void {
  try {
    if (typeof param.cancelAndHoldAtTime === 'function') {
      param.cancelAndHoldAtTime(now)
    } else {
      param.cancelScheduledValues(now)
      param.setValueAtTime(Math.max(CLICK_GAIN_FLOOR, param.value), now)
    }
    param.setTargetAtTime(0, now, CLICK_PANIC_RELEASE_SECONDS / 5)
  } catch {
    // A closing AudioContext may reject automation after it detached the node.
  }
}

/**
 * Create an off-by-default click that borrows the Drum Night transport and
 * gesture-owned audio route without acquiring either resource itself.
 */
export function createDrumNightClickController(
  options: DrumNightClickControllerOptions,
): DrumNightClickController {
  const listeners = new Set<() => void>()
  const occurrenceKeys = new Map<string, number>()
  const voices = new Map<string, ClickVoice>()
  const lookaheadMs = boundedLookahead(options.lookaheadMs)
  let enabled = false
  let disposed = false
  let level = clampLevel(options.initialLevel)
  let status: DrumNightClickStatus = 'disabled'
  let error: string | null = null
  let currentRevision = options.transport.scheduleRevision()
  let scheduledClickCount = 0
  let lateOmittedClickCount = 0
  let lastClick: DrumNightScheduledClick | null = null
  let graph: ClickGraph | null = null
  let lastPublishedKey = ''
  let cachedMeterSource: readonly MidiTimeSignature[] | null | undefined
  let cachedMeters: readonly MidiTimeSignature[] = Object.freeze([])

  const snapshot = (): DrumNightClickSnapshot =>
    Object.freeze({
      status,
      enabled,
      level,
      transportRevision: currentRevision,
      scheduledClickCount,
      lateOmittedClickCount,
      dedupeLedgerSize: occurrenceKeys.size,
      activeVoiceCount: voices.size,
      lastClick,
      error,
    })

  const snapshotKey = (): string =>
    [
      status,
      enabled ? 1 : 0,
      level,
      currentRevision,
      scheduledClickCount,
      lateOmittedClickCount,
      occurrenceKeys.size,
      voices.size,
      lastClick?.id ?? '',
      error ?? '',
    ].join('|')

  const emitIfChanged = (force = false): void => {
    if (disposed && !force) return
    const nextKey = snapshotKey()
    if (!force && nextKey === lastPublishedKey) return
    lastPublishedKey = nextKey
    for (const listener of listeners) listener()
  }

  const disconnectGraph = (target: ClickGraph): void => {
    if (target.disconnected) return
    target.disconnected = true
    disconnect(target.master)
  }

  const cleanupVoice = (voice: ClickVoice): void => {
    if (voice.cleaned) return
    voice.cleaned = true
    if (voices.get(voice.key) === voice) voices.delete(voice.key)
    disconnect(voice.oscillator)
    disconnect(voice.envelope)
    voice.graph.voiceCount = Math.max(0, voice.graph.voiceCount - 1)
    if (voice.graph.retired && voice.graph.voiceCount === 0) {
      disconnectGraph(voice.graph)
    }
    emitIfChanged()
  }

  const retireGraph = (): void => {
    const retiring = graph
    graph = null
    if (retiring === null || retiring.retired) return
    retiring.retired = true
    const now = retiring.context.currentTime
    setRelease(retiring.master.gain, now)
    for (const voice of [...voices.values()]) {
      if (voice.graph !== retiring) continue
      voices.delete(voice.key)
      const safelyBeforeStart = voice.startTime > now + CLICK_TIMELINE_EPSILON
      const alreadyEnded =
        voice.stopTime <= now + CLICK_TIMELINE_EPSILON ||
        retiring.context.state === 'closed'
      if (safelyBeforeStart || alreadyEnded) {
        stopOscillator(voice.oscillator, now)
        cleanupVoice(voice)
        continue
      }
      setRelease(voice.envelope.gain, now)
      const stopped = stopOscillator(
        voice.oscillator,
        now + CLICK_PANIC_RELEASE_SECONDS + CLICK_PANIC_STOP_SLACK_SECONDS,
      )
      if (!stopped) cleanupVoice(voice)
    }
    if (retiring.voiceCount === 0) disconnectGraph(retiring)
  }

  const invalidateScheduledClicks = (): void => {
    retireGraph()
    occurrenceKeys.clear()
    scheduledClickCount = 0
    lateOmittedClickCount = 0
    lastClick = null
    error = null
  }

  const activeAudio = (): {
    readonly context: AudioContext
    readonly output: AudioNode
  } | null => {
    let context: AudioContext | null = null
    let output: AudioNode | null = null
    try {
      context = options.activeContext()
      if (context === null || context.state !== 'running') return null
      output = options.activeOutput()
    } catch {
      return null
    }
    return output === null ? null : { context, output }
  }

  const ensureGraph = (
    context: AudioContext,
    output: AudioNode,
  ): ClickGraph | null => {
    if (
      graph !== null &&
      graph.context === context &&
      graph.output === output &&
      !graph.retired
    ) {
      return graph
    }
    if (graph !== null) retireGraph()
    let master: GainNode | null = null
    try {
      master = context.createGain()
      master.gain.setValueAtTime(level, context.currentTime)
      master.connect(output)
      graph = {
        context,
        output,
        master,
        voiceCount: 0,
        retired: false,
        disconnected: false,
      }
      return graph
    } catch {
      if (master !== null) disconnect(master)
      graph = null
      status = 'error'
      error = 'The route audio output could not create the click graph.'
      return null
    }
  }

  const authoredMeters = (): readonly MidiTimeSignature[] => {
    let source: readonly MidiTimeSignature[] | null | undefined
    try {
      source = options.timeSignatures?.()
    } catch {
      source = undefined
    }
    if (source === cachedMeterSource) return cachedMeters
    cachedMeterSource = source
    cachedMeters =
      source === null || source === undefined || source.length === 0
        ? Object.freeze([])
        : Object.freeze(
            normalizeTimeSignatures(evenlyBoundedMeters(source)).map((meter) =>
              Object.freeze({ ...meter }),
            ),
          )
    return cachedMeters
  }

  const isDownbeat = (authoredBeat: number): boolean => {
    const meters = authoredMeters()
    if (meters.length === 0) return false
    let selected = meters[0]
    for (const meter of meters) {
      if (meter.beat > authoredBeat + CLICK_TIMELINE_EPSILON) break
      selected = meter
    }
    if (selected === undefined) return false
    const barBeats = quarterBeatsPerBar(selected)
    const distance = authoredBeat - selected.beat
    const nearestBar = Math.round(distance / barBeats)
    return (
      distance >= -CLICK_TIMELINE_EPSILON &&
      Math.abs(distance - nearestBar * barBeats) <= CLICK_TIMELINE_EPSILON
    )
  }

  const pruneLedger = (
    windows: readonly DrumAuthoredSchedulingWindow[],
    phase: DrumTransportPhase,
  ): void => {
    const firstTimelineBeat = windows[0]?.fromTimelineBeat
    if (firstTimelineBeat === undefined) return
    for (const [key, timelineBeat] of occurrenceKeys) {
      if (key.includes(':count-in:')) {
        if (phase === 'playing') occurrenceKeys.delete(key)
        continue
      }
      if (timelineBeat < firstTimelineBeat - CLICK_TIMELINE_EPSILON) {
        occurrenceKeys.delete(key)
      }
    }
  }

  const mapContextTime = (timestampMs: number): number | null => {
    try {
      const mapped = options.performanceTimestampToContextTime(timestampMs)
      return mapped !== null && Number.isFinite(mapped) && mapped >= 0
        ? mapped
        : null
    } catch {
      return null
    }
  }

  const scheduleClick = (
    audio: { readonly context: AudioContext; readonly output: AudioNode },
    input: {
      readonly key: string
      readonly kind: DrumNightClickKind
      readonly accent: boolean
      readonly authoredBeat: number | null
      readonly timelineBeat: number | null
      readonly performanceTimestampMs: number
      readonly maximumContextTime?: number
    },
  ): ScheduleClickResult => {
    if (occurrenceKeys.has(input.key)) return 'duplicate'
    const atContextTime = mapContextTime(input.performanceTimestampMs)
    if (atContextTime === null) return 'waiting-for-audio'
    if (
      input.maximumContextTime !== undefined &&
      atContextTime > input.maximumContextTime + CLICK_TIMELINE_EPSILON
    ) {
      return 'outside-horizon'
    }
    if (atContextTime < audio.context.currentTime - CLICK_LATE_GRACE_SECONDS) {
      if (occurrenceKeys.size < MAX_DRUM_NIGHT_CLICK_DEDUPE_LEDGER) {
        occurrenceKeys.set(
          input.key,
          input.timelineBeat ?? Number.NEGATIVE_INFINITY,
        )
      }
      lateOmittedClickCount += 1
      return 'late'
    }
    if (
      voices.size >= MAX_DRUM_NIGHT_CLICKS_PER_SCHEDULE ||
      occurrenceKeys.size >= MAX_DRUM_NIGHT_CLICK_DEDUPE_LEDGER
    ) {
      return 'capacity'
    }
    const targetGraph = ensureGraph(audio.context, audio.output)
    if (targetGraph === null) return 'error'

    let oscillator: OscillatorNode | null = null
    let envelope: GainNode | null = null
    let voice: ClickVoice | null = null
    try {
      oscillator = audio.context.createOscillator()
      envelope = audio.context.createGain()
      oscillator.type = 'triangle'
      const startTime = Math.max(atContextTime, audio.context.currentTime)
      const stopTime = startTime + CLICK_STOP_SECONDS
      oscillator.frequency.setValueAtTime(input.accent ? 1_320 : 860, startTime)
      envelope.gain.setValueAtTime(CLICK_GAIN_FLOOR, startTime)
      envelope.gain.exponentialRampToValueAtTime(
        input.accent ? CLICK_ACCENT_PEAK : CLICK_REGULAR_PEAK,
        startTime + CLICK_ATTACK_SECONDS,
      )
      envelope.gain.setTargetAtTime(
        0,
        startTime + CLICK_RELEASE_START_SECONDS,
        CLICK_RELEASE_TIME_CONSTANT_SECONDS,
      )
      oscillator.connect(envelope)
      envelope.connect(targetGraph.master)

      const scheduledVoice: ClickVoice = {
        key: input.key,
        graph: targetGraph,
        oscillator,
        envelope,
        startTime,
        stopTime,
        cleaned: false,
      }
      voice = scheduledVoice
      targetGraph.voiceCount += 1
      voices.set(input.key, scheduledVoice)
      oscillator.onended = () => cleanupVoice(scheduledVoice)
      occurrenceKeys.set(
        input.key,
        input.timelineBeat ?? Number.NEGATIVE_INFINITY,
      )
      oscillator.start(startTime)
      oscillator.stop(stopTime)

      lastClick = Object.freeze({
        id: input.key,
        kind: input.kind,
        accent: input.accent,
        authoredBeat: input.authoredBeat,
        timelineBeat: input.timelineBeat,
        performanceTimestampMs: input.performanceTimestampMs,
        atContextTime,
      })
      scheduledClickCount += 1
      return 'scheduled'
    } catch {
      if (voice !== null) cleanupVoice(voice)
      else {
        if (oscillator !== null) disconnect(oscillator)
        if (envelope !== null) disconnect(envelope)
      }
      occurrenceKeys.delete(input.key)
      status = 'error'
      error = 'A metronome click could not be scheduled.'
      return 'error'
    }
  }

  const scheduleCountIn = (
    audio: { readonly context: AudioContext; readonly output: AudioNode },
    windows: readonly DrumAuthoredSchedulingWindow[],
    countInBeats: number,
    effectiveTempoBpm: number,
  ): ScheduleClickResult => {
    const playbackStartTimestampMs = windows[0]?.fromTimestampMs
    if (
      playbackStartTimestampMs === undefined ||
      countInBeats <= 0 ||
      !Number.isFinite(effectiveTempoBpm) ||
      effectiveTempoBpm <= 0
    ) {
      return 'duplicate'
    }
    const beatDurationMs = 60_000 / effectiveTempoBpm
    const maximumContextTime = audio.context.currentTime + lookaheadMs / 1_000
    let result: ScheduleClickResult = 'duplicate'
    for (let beat = 0; beat < countInBeats; beat += 1) {
      const nextResult = scheduleClick(audio, {
        key: `${currentRevision}:count-in:${beat}`,
        kind: 'count-in',
        accent: beat === 0,
        authoredBeat: null,
        timelineBeat: null,
        performanceTimestampMs:
          playbackStartTimestampMs - (countInBeats - beat) * beatDurationMs,
        maximumContextTime,
      })
      if (nextResult === 'waiting-for-audio' || nextResult === 'error') {
        return nextResult
      }
      if (nextResult === 'scheduled' || nextResult === 'late') {
        result = nextResult
      }
    }
    return result
  }

  const schedulePlayback = (
    audio: { readonly context: AudioContext; readonly output: AudioNode },
    windows: readonly DrumAuthoredSchedulingWindow[],
  ): ScheduleClickResult => {
    let candidateCount = 0
    let result: ScheduleClickResult = 'duplicate'
    const maximumContextTime = audio.context.currentTime + lookaheadMs / 1_000
    for (const window of windows) {
      const firstBeat = Math.max(
        0,
        Math.ceil(window.fromPositionBeat - CLICK_TIMELINE_EPSILON),
      )
      for (
        let authoredBeat = firstBeat;
        authoredBeat < window.toPositionBeat - CLICK_TIMELINE_EPSILON;
        authoredBeat += 1
      ) {
        candidateCount += 1
        if (candidateCount > MAX_DRUM_NIGHT_CLICKS_PER_SCHEDULE) {
          return result === 'duplicate' ? 'capacity' : result
        }
        const timelineBeat =
          window.fromTimelineBeat + (authoredBeat - window.fromPositionBeat)
        const performanceTimestampMs =
          window.fromTimestampMs +
          ((authoredBeat - window.fromPositionBeat) * 60_000) /
            window.effectiveTempoBpm
        const nextResult = scheduleClick(audio, {
          key: `${currentRevision}:playback:${window.loopIteration}:${authoredBeat}`,
          kind: 'playback',
          accent: isDownbeat(authoredBeat),
          authoredBeat,
          timelineBeat,
          performanceTimestampMs,
          maximumContextTime,
        })
        if (nextResult === 'waiting-for-audio' || nextResult === 'error') {
          return nextResult
        }
        if (nextResult === 'scheduled' || nextResult === 'late') {
          result = nextResult
        }
      }
    }
    return result
  }

  const reconcile = (): void => {
    if (disposed || !enabled) return
    const nextRevision = options.transport.scheduleRevision()
    if (nextRevision !== currentRevision) {
      currentRevision = nextRevision
      invalidateScheduledClicks()
    }

    const transportState = options.transport.state()
    const running =
      transportState.phase === 'count-in' || transportState.phase === 'playing'
    const audio = activeAudio()
    if (audio === null) {
      if (graph !== null || voices.size > 0) retireGraph()
      status = 'waiting-for-audio'
      error = null
      emitIfChanged()
      return
    }
    if (!running) {
      if (graph !== null || voices.size > 0) retireGraph()
      status = 'ready'
      error = null
      emitIfChanged()
      return
    }

    const windows = options.transport.schedulingWindows(lookaheadMs)
    pruneLedger(windows, transportState.phase)
    status = phaseStatus(transportState.phase)
    error = null
    const countInResult =
      transportState.phase === 'count-in'
        ? scheduleCountIn(
            audio,
            windows,
            transportState.countInBeats,
            transportState.tempoBpm,
          )
        : 'duplicate'
    const playbackResult =
      countInResult === 'waiting-for-audio' || countInResult === 'error'
        ? countInResult
        : schedulePlayback(audio, windows)
    if (
      countInResult === 'waiting-for-audio' ||
      playbackResult === 'waiting-for-audio'
    ) {
      retireGraph()
      status = 'waiting-for-audio'
      error = null
    }
    emitIfChanged()
  }

  const unsubscribeTransport = options.transport.subscribe(reconcile)
  lastPublishedKey = snapshotKey()

  return {
    snapshot,
    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    enable(nextEnabled) {
      if (disposed) return
      if (!nextEnabled) {
        enabled = false
        invalidateScheduledClicks()
        status = 'disabled'
        emitIfChanged()
        return
      }
      enabled = true
      reconcile()
    },
    setLevel(nextLevel) {
      if (disposed) return
      const bounded = clampLevel(nextLevel)
      if (bounded === level) return
      level = bounded
      if (graph !== null) {
        const param = graph.master.gain
        const now = graph.context.currentTime
        try {
          param.cancelScheduledValues(now)
          param.setValueAtTime(param.value, now)
          param.linearRampToValueAtTime(level, now + 0.015)
        } catch {
          param.value = level
        }
      }
      emitIfChanged()
    },
    dispose() {
      if (disposed) return
      unsubscribeTransport()
      enabled = false
      disposed = true
      invalidateScheduledClicks()
      status = 'disposed'
      emitIfChanged(true)
      listeners.clear()
    },
  }
}
