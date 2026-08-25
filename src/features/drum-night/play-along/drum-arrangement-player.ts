// ============================================================
// Drum arrangement player — inert pitched guides on the route audio graph
// ============================================================
//
// The scheduler injects exact AudioContext times. This player owns only
// bounded synth voices and pop-free track gates; the Drum Night route still
// owns the AudioContext, output, transport, activation gesture, and teardown.

import type { GuitarVariant, GuitarVoice } from '@/lib/guitar/guitar-synth'
import { sliderToGain } from '@/lib/volume-curve'

export const DEFAULT_DRUM_BACKING_MAX_VOICES = 48
export const MAXIMUM_DRUM_BACKING_MAX_VOICES = 96

type TimerHandle = ReturnType<typeof globalThis.setTimeout>

const MINIMUM_GAIN = 0.0001
const ATTACK_SECONDS = 0.006
const RELEASE_SECONDS = 0.09
const RELEASE_SLACK_SECONDS = 0.03
const LIVE_GAIN_TIME_CONSTANT_SECONDS = 0.012
const MAXIMUM_NOTE_DURATION_SECONDS = 12

export type DrumArrangementBackingVoice = GuitarVariant

export interface DrumArrangementBackingTrigger {
  readonly trackId: string
  readonly sourceId: string
  readonly midi: number
  readonly atContextTime: number
  readonly durationSeconds: number
  readonly voice: DrumArrangementBackingVoice
}

export type DrumArrangementBackingTriggerOutcome =
  | 'dropped'
  | 'synthesized'
  | 'synthesized-with-steal'

export interface DrumArrangementBackingPlayerPort {
  /** Passive: succeeds only after the route's gesture-owned graph exists. */
  activate(): boolean | Promise<boolean>
  trigger(
    note: DrumArrangementBackingTrigger,
  ): DrumArrangementBackingTriggerOutcome | undefined
  /** Slider position in the 0–1 perceptual domain. */
  setTrackLevel(trackId: string, position: number): void
  panic(): void
  dispose(): void | Promise<void>
}

export interface DrumArrangementBackingPlayerOptions {
  /** Passive getters: these must never create or resume an AudioContext. */
  readonly getAudioContext: () => AudioContext | null
  readonly getOutput: () => AudioNode | null
  readonly maxVoices?: number
  readonly createVoice?: (
    context: AudioContext,
    frequency: number,
    durationMs: number,
    voice: DrumArrangementBackingVoice,
    atContextTime: number,
  ) => GuitarVoice
  readonly setTimer?: (callback: () => void, delayMs: number) => TimerHandle
  readonly clearTimer?: (handle: TimerHandle) => void
}

interface PlayerGraph {
  readonly context: AudioContext
  readonly output: AudioNode
  readonly master: GainNode
  readonly tracks: Map<string, GainNode>
}

interface ActiveVoice {
  readonly sequence: number
  readonly voice: GuitarVoice
  cleanupTimer: TimerHandle | null
  releasing: boolean
  cleaned: boolean
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}

function boundedPositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback
  }
  return Math.min(maximum, Math.max(1, Math.floor(value)))
}

function safeDisconnect(node: AudioNode): void {
  try {
    node.disconnect()
  } catch {
    // Route teardown and a scheduled cleanup may race.
  }
}

function holdParameter(parameter: AudioParam, at: number): void {
  const held = Math.max(MINIMUM_GAIN, parameter.value)
  try {
    if (typeof parameter.cancelAndHoldAtTime === 'function') {
      parameter.cancelAndHoldAtTime(at)
    } else {
      parameter.cancelScheduledValues(at)
      parameter.setValueAtTime(held, at)
    }
  } catch {
    // A closed route context is already silent.
  }
}

function setLiveGain(parameter: AudioParam, target: number, at: number): void {
  holdParameter(parameter, at)
  try {
    parameter.setTargetAtTime(target, at, LIVE_GAIN_TIME_CONSTANT_SECONDS)
  } catch {
    // A closed route context is already silent.
  }
}

/** Create a bounded guide player without touching audio on construction. */
export function createDrumArrangementBackingPlayer(
  options: DrumArrangementBackingPlayerOptions,
): DrumArrangementBackingPlayerPort {
  const maxVoices = boundedPositiveInteger(
    options.maxVoices,
    DEFAULT_DRUM_BACKING_MAX_VOICES,
    MAXIMUM_DRUM_BACKING_MAX_VOICES,
  )
  const setTimer =
    options.setTimer ??
    ((callback, delayMs) => globalThis.setTimeout(callback, delayMs))
  const clearTimer =
    options.clearTimer ?? ((handle) => globalThis.clearTimeout(handle))
  const trackLevels = new Map<string, number>()
  const activeVoices = new Map<number, ActiveVoice>()
  const releasingVoices = new Set<ActiveVoice>()
  const retiredGraphs = new Map<PlayerGraph, TimerHandle>()
  let graph: PlayerGraph | null = null
  let createVoice = options.createVoice ?? null
  let activation: Promise<boolean> | null = null
  let nextVoiceSequence = 1
  let disposed = false

  const cleanVoice = (active: ActiveVoice): void => {
    if (active.cleaned) return
    active.cleaned = true
    activeVoices.delete(active.sequence)
    releasingVoices.delete(active)
    if (active.cleanupTimer !== null) {
      clearTimer(active.cleanupTimer)
      active.cleanupTimer = null
    }
    try {
      active.voice.dispose()
    } catch {
      // A source ending naturally may already have detached its nodes.
    }
  }

  const releaseVoice = (active: ActiveVoice, at: number): void => {
    if (active.cleaned || active.releasing) return
    active.releasing = true
    activeVoices.delete(active.sequence)
    releasingVoices.add(active)
    if (active.cleanupTimer !== null) clearTimer(active.cleanupTimer)
    holdParameter(active.voice.gain.gain, at)
    try {
      active.voice.gain.gain.setTargetAtTime(0, at, RELEASE_SECONDS / 5)
    } catch {
      // A closed context is already silent.
    }
    const delayMs = Math.max(
      0,
      (at +
        RELEASE_SECONDS +
        RELEASE_SLACK_SECONDS -
        (graph?.context.currentTime ?? at)) *
        1_000,
    )
    active.cleanupTimer = setTimer(() => {
      active.cleanupTimer = null
      cleanVoice(active)
    }, delayMs)
  }

  const releaseAll = (): void => {
    const now = graph?.context.currentTime ?? 0
    for (const active of [...activeVoices.values()]) releaseVoice(active, now)
  }

  const disconnectGraph = (current: PlayerGraph): void => {
    for (const track of current.tracks.values()) safeDisconnect(track)
    safeDisconnect(current.master)
  }

  const retireGraph = (): void => {
    const current = graph
    graph = null
    if (current === null) return
    const timer = setTimer(
      () => {
        retiredGraphs.delete(current)
        disconnectGraph(current)
      },
      (RELEASE_SECONDS + RELEASE_SLACK_SECONDS) * 1_000,
    )
    retiredGraphs.set(current, timer)
  }

  const ensureGraph = (): PlayerGraph | null => {
    if (disposed) return null
    const context = options.getAudioContext()
    const output = options.getOutput()
    if (context === null || output === null || context.state === 'closed') {
      return null
    }
    if (graph?.context === context && graph.output === output) return graph
    releaseAll()
    retireGraph()
    const master = context.createGain()
    master.gain.setValueAtTime(1, context.currentTime)
    master.connect(output)
    graph = { context, output, master, tracks: new Map() }
    return graph
  }

  const trackOutput = (trackId: string, current: PlayerGraph): GainNode => {
    const existing = current.tracks.get(trackId)
    if (existing !== undefined) return existing
    const created = current.context.createGain()
    created.gain.setValueAtTime(
      sliderToGain(trackLevels.get(trackId) ?? 1),
      current.context.currentTime,
    )
    created.connect(current.master)
    current.tracks.set(trackId, created)
    return created
  }

  return {
    activate(): boolean | Promise<boolean> {
      if (ensureGraph() === null) return false
      if (createVoice !== null) return true
      if (activation !== null) return activation
      const pending = (async () => {
        try {
          const synth = await import('@/lib/guitar/guitar-synth')
          if (disposed) return false
          createVoice = (
            context,
            frequency,
            durationMs,
            voice,
            atContextTime,
          ) =>
            voice === 'bass'
              ? synth.createBassVoice(
                  context,
                  frequency,
                  durationMs,
                  atContextTime,
                )
              : synth.createGuitarVoice(
                  context,
                  frequency,
                  durationMs,
                  voice,
                  atContextTime,
                )
          return ensureGraph() !== null
        } catch {
          return false
        }
      })()
      activation = pending
      void pending.finally(() => {
        if (activation === pending) activation = null
      })
      return pending
    },
    trigger(note): DrumArrangementBackingTriggerOutcome {
      const current = graph
      if (
        disposed ||
        current === null ||
        current.context !== options.getAudioContext() ||
        current.output !== options.getOutput() ||
        current.context.state === 'closed' ||
        note.trackId.length === 0 ||
        !Number.isInteger(note.midi) ||
        note.midi < 0 ||
        note.midi > 127 ||
        !Number.isFinite(note.atContextTime) ||
        note.atContextTime < current.context.currentTime - 0.05
      ) {
        return 'dropped'
      }

      let stoleVoice = false
      if (activeVoices.size >= maxVoices) {
        const oldest = activeVoices.values().next().value as
          | ActiveVoice
          | undefined
        if (oldest !== undefined) {
          releaseVoice(oldest, current.context.currentTime)
          stoleVoice = true
        }
      }

      const durationSeconds = clamp(
        note.durationSeconds,
        ATTACK_SECONDS + 0.01,
        MAXIMUM_NOTE_DURATION_SECONDS,
      )
      const frequency = 440 * Math.pow(2, (note.midi - 69) / 12)
      if (!Number.isFinite(frequency) || frequency <= 0) return 'dropped'

      let voice: GuitarVoice
      try {
        const voiceFactory = createVoice
        if (voiceFactory === null) return 'dropped'
        voice = voiceFactory(
          current.context,
          frequency,
          durationSeconds * 1_000,
          note.voice,
          note.atContextTime,
        )
        voice.gain.gain.cancelScheduledValues(note.atContextTime)
        voice.gain.gain.setValueAtTime(MINIMUM_GAIN, note.atContextTime)
        voice.gain.gain.exponentialRampToValueAtTime(
          1,
          note.atContextTime + ATTACK_SECONDS,
        )
        const releaseAt = note.atContextTime + durationSeconds
        voice.gain.gain.setValueAtTime(1, releaseAt)
        voice.gain.gain.setTargetAtTime(0, releaseAt, RELEASE_SECONDS / 5)
        voice.gain.connect(trackOutput(note.trackId, current))
      } catch {
        return 'dropped'
      }

      const disposeAt =
        note.atContextTime +
        durationSeconds +
        RELEASE_SECONDS +
        RELEASE_SLACK_SECONDS
      const active: ActiveVoice = {
        sequence: nextVoiceSequence++,
        voice,
        cleanupTimer: null,
        releasing: false,
        cleaned: false,
      }
      const delayMs = Math.max(
        0,
        (disposeAt - current.context.currentTime) * 1_000,
      )
      active.cleanupTimer = setTimer(() => {
        active.cleanupTimer = null
        cleanVoice(active)
      }, delayMs)
      activeVoices.set(active.sequence, active)
      return stoleVoice ? 'synthesized-with-steal' : 'synthesized'
    },
    setTrackLevel(trackId, position) {
      if (trackId.length === 0) return
      const bounded = clamp(position, 0, 1)
      trackLevels.set(trackId, bounded)
      const current = graph
      const track = current?.tracks.get(trackId)
      if (current === null || track === undefined) return
      setLiveGain(
        track.gain,
        sliderToGain(bounded),
        current.context.currentTime,
      )
    },
    panic: releaseAll,
    async dispose(): Promise<void> {
      if (disposed) return
      disposed = true
      releaseAll()
      const pending = new Set([...activeVoices.values(), ...releasingVoices])
      const waitMs = (RELEASE_SECONDS + RELEASE_SLACK_SECONDS) * 1_000
      await new Promise<void>((resolve) => setTimer(resolve, waitMs))
      for (const active of pending) cleanVoice(active)
      for (const active of activeVoices.values()) cleanVoice(active)
      for (const active of releasingVoices) cleanVoice(active)
      const current = graph
      graph = null
      if (current !== null) disconnectGraph(current)
      for (const [retired, timer] of retiredGraphs) {
        clearTimer(timer)
        disconnectGraph(retired)
      }
      retiredGraphs.clear()
      trackLevels.clear()
      createVoice = null
    },
  }
}
