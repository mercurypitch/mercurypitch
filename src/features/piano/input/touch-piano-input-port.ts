// ============================================================
// Touch piano input port — pointer-to-note lifecycle adapter
// ============================================================
//
// Canvas and DOM keyboards can share this DOM-neutral adapter. Pointer ids
// become physical key identities, so independent fingers remain polyphonic
// even when two pointers land on the same pitch.

import type { PianoInputSource, PianoInputState, PianoInputUpdate, } from './piano-input-state'

export interface TouchPianoPointer {
  readonly pointerId: number
  readonly midi: number
  readonly velocity: number
}

export interface TouchPianoInputPort {
  press(
    pointerId: number,
    midi: number,
    velocity?: number,
    timestampMs?: number,
  ): readonly PianoInputUpdate[]
  move(
    pointerId: number,
    midi: number,
    velocity?: number,
    timestampMs?: number,
  ): readonly PianoInputUpdate[]
  release(pointerId: number, timestampMs?: number): readonly PianoInputUpdate[]
  cancel(pointerId: number, timestampMs?: number): readonly PianoInputUpdate[]
  releaseAll(timestampMs?: number): readonly PianoInputUpdate[]
  activePointers(): readonly TouchPianoPointer[]
  dispose(): void
}

export interface TouchPianoInputPortOptions {
  input: PianoInputState
  sourceId: string
  sourceName?: string
  channel?: number
  defaultVelocity?: number
  now?: () => number
}

interface MutableTouchPointer {
  pointerId: number
  midi: number
  velocity: number
}

function clampVelocity(velocity: number): number {
  if (!Number.isFinite(velocity)) return 0
  return Math.min(1, Math.max(0, velocity))
}

function clampMidi(midi: number): number {
  if (!Number.isFinite(midi)) return 0
  return Math.min(127, Math.max(0, Math.round(midi)))
}

/** Create one reusable pointer lifecycle over the normalized Piano input state. */
export function createTouchPianoInputPort(
  options: TouchPianoInputPortOptions,
): TouchPianoInputPort {
  const source: PianoInputSource = Object.freeze({
    kind: 'touch',
    id: options.sourceId,
    ...(options.sourceName === undefined ? {} : { name: options.sourceName }),
  })
  const requestedChannel = options.channel ?? 0
  const channel = Number.isFinite(requestedChannel)
    ? Math.min(15, Math.max(0, Math.round(requestedChannel)))
    : 0
  const defaultVelocity = clampVelocity(options.defaultVelocity ?? 0.8)
  const now = options.now ?? (() => performance.now())
  const pointers = new Map<number, MutableTouchPointer>()
  let disposed = false

  function eventTime(timestampMs: number | undefined): number {
    return timestampMs === undefined ? now() : timestampMs
  }

  function keyId(pointerId: number): string {
    return `pointer:${pointerId}`
  }

  function releasePointer(
    pointerId: number,
    timestampMs: number,
  ): PianoInputUpdate | null {
    const pointer = pointers.get(pointerId)
    if (pointer === undefined) return null
    pointers.delete(pointerId)
    return options.input.apply({
      type: 'note-off',
      source,
      channel,
      midi: pointer.midi,
      velocity: 0,
      keyId: keyId(pointerId),
      timestampMs,
    })
  }

  function pressPointer(
    pointerId: number,
    midi: number,
    velocity: number,
    timestampMs: number,
  ): PianoInputUpdate {
    const pointer: MutableTouchPointer = {
      pointerId,
      midi,
      velocity,
    }
    pointers.set(pointerId, pointer)
    return options.input.apply({
      type: 'note-on',
      source,
      channel,
      midi,
      velocity,
      keyId: keyId(pointerId),
      timestampMs,
    })
  }

  return {
    press(pointerId, midi, velocity = defaultVelocity, timestampMs) {
      if (disposed) return []
      const timestamp = eventTime(timestampMs)
      const normalizedMidi = clampMidi(midi)
      const current = pointers.get(pointerId)
      if (current?.midi === normalizedMidi) return []
      const updates: PianoInputUpdate[] = []
      const released = releasePointer(pointerId, timestamp)
      if (released !== null) updates.push(released)
      updates.push(
        pressPointer(
          pointerId,
          normalizedMidi,
          clampVelocity(velocity),
          timestamp,
        ),
      )
      return updates
    },
    move(pointerId, midi, velocity = defaultVelocity, timestampMs) {
      if (disposed) return []
      const normalizedMidi = clampMidi(midi)
      const current = pointers.get(pointerId)
      if (current === undefined || current.midi === normalizedMidi) return []
      const timestamp = eventTime(timestampMs)
      const released = releasePointer(pointerId, timestamp)
      const pressed = pressPointer(
        pointerId,
        normalizedMidi,
        clampVelocity(velocity),
        timestamp,
      )
      return released === null ? [pressed] : [released, pressed]
    },
    release(pointerId, timestampMs) {
      if (disposed) return []
      const released = releasePointer(pointerId, eventTime(timestampMs))
      return released === null ? [] : [released]
    },
    cancel(pointerId, timestampMs) {
      if (disposed) return []
      const released = releasePointer(pointerId, eventTime(timestampMs))
      return released === null ? [] : [released]
    },
    releaseAll(timestampMs) {
      if (disposed) return []
      pointers.clear()
      return [
        options.input.apply({
          type: 'panic',
          source,
          channel,
          timestampMs: eventTime(timestampMs),
        }),
      ]
    },
    activePointers() {
      return Object.freeze(
        Array.from(pointers.values()).map((pointer) =>
          Object.freeze({ ...pointer }),
        ),
      )
    },
    dispose() {
      if (disposed) return
      pointers.clear()
      options.input.apply({
        type: 'panic',
        source,
        channel,
        timestampMs: now(),
      })
      disposed = true
    },
  }
}
