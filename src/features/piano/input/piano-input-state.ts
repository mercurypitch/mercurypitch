// ============================================================
// Piano input state — polyphonic note and pedal authority
// ============================================================
//
// MIDI keyboards and touch surfaces feed the same normalized event stream.
// Pedals are scoped to one source and channel, and audible note lifetimes are
// reported separately from physical key releases so adapters cannot create
// stuck notes by guessing at damper semantics.

export type PianoInputSourceKind = 'midi' | 'touch'

export interface PianoInputSource {
  readonly kind: PianoInputSourceKind
  readonly id: string
  readonly name?: string
}

export type PianoPedalKind = 'sustain' | 'sostenuto' | 'soft'

interface PianoInputEventBase {
  readonly source: PianoInputSource
  /** Zero-based MIDI channel. Touch ports conventionally use channel zero. */
  readonly channel: number
  readonly timestampMs: number
}

export interface PianoNoteOnInputEvent extends PianoInputEventBase {
  readonly type: 'note-on'
  readonly midi: number
  /** Normalized velocity in the inclusive range 0..1. */
  readonly velocity: number
  /** Source-local physical key identity. MIDI events default to their pitch. */
  readonly keyId?: string
}

export interface PianoNoteOffInputEvent extends PianoInputEventBase {
  readonly type: 'note-off'
  readonly midi: number
  /** Normalized release velocity in the inclusive range 0..1. */
  readonly velocity: number
  readonly keyId?: string
}

export interface PianoPedalInputEvent extends PianoInputEventBase {
  readonly type: 'pedal'
  readonly pedal: PianoPedalKind
  /** Normalized controller value in the inclusive range 0..1. */
  readonly value: number
}

export interface PianoAllNotesOffInputEvent extends PianoInputEventBase {
  readonly type: 'all-notes-off'
}

export interface PianoResetControllersInputEvent extends PianoInputEventBase {
  readonly type: 'reset-controllers'
}

export interface PianoPanicInputEvent {
  readonly type: 'panic'
  readonly timestampMs: number
  /** Omit the source for a global panic. */
  readonly source?: PianoInputSource
  /** Omit the channel to clear every channel on the matching source. */
  readonly channel?: number
}

export interface PianoSourceDisconnectedInputEvent {
  readonly type: 'source-disconnected'
  readonly source: PianoInputSource
  readonly timestampMs: number
}

export type PianoInputEvent =
  | PianoNoteOnInputEvent
  | PianoNoteOffInputEvent
  | PianoPedalInputEvent
  | PianoAllNotesOffInputEvent
  | PianoResetControllersInputEvent
  | PianoPanicInputEvent
  | PianoSourceDisconnectedInputEvent

export interface PianoInputVoice {
  readonly id: string
  readonly source: PianoInputSource
  readonly channel: number
  readonly midi: number
  readonly velocity: number
  readonly keyId: string
  readonly startedAtMs: number
  readonly pressed: boolean
  readonly heldBySustain: boolean
  readonly heldBySostenuto: boolean
  /** Soft-pedal value when this voice began. */
  readonly softPedalValue: number
}

export interface PianoInputPedalState {
  readonly source: PianoInputSource
  readonly channel: number
  readonly sustain: number
  readonly sostenuto: number
  readonly soft: number
}

export interface PianoInputSnapshot {
  readonly revision: number
  readonly pressedNotes: readonly PianoInputVoice[]
  readonly soundingNotes: readonly PianoInputVoice[]
  /** Latest sounding voice, useful for the legacy monophonic pitch view. */
  readonly primaryNote: PianoInputVoice | null
  readonly pedals: readonly PianoInputPedalState[]
}

export interface PianoInputUpdate {
  readonly event: PianoInputEvent
  readonly snapshot: PianoInputSnapshot
  /** Voices whose audible lifetime began during this event. */
  readonly soundingStarted: readonly PianoInputVoice[]
  /** Voices whose audible lifetime ended during this event. */
  readonly soundingStopped: readonly PianoInputVoice[]
}

export type PianoInputListener = (update: PianoInputUpdate) => void

export interface PianoInputState {
  apply(event: PianoInputEvent): PianoInputUpdate
  snapshot(): PianoInputSnapshot
  subscribe(listener: PianoInputListener): () => void
}

export interface PianoInputStateOptions {
  now?: () => number
}

interface MutableVoice {
  id: string
  serial: number
  source: PianoInputSource
  channel: number
  midi: number
  velocity: number
  keyId: string
  startedAtMs: number
  pressed: boolean
  heldBySustain: boolean
  heldBySostenuto: boolean
  softPedalValue: number
}

interface MutablePedalState {
  source: PianoInputSource
  channel: number
  sustain: number
  sostenuto: number
  soft: number
  sostenutoCaptured: Set<string>
}

const PEDAL_DOWN_THRESHOLD = 0.5

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function normalizeSource(source: PianoInputSource): PianoInputSource {
  return Object.freeze({
    kind: source.kind,
    id: source.id,
    ...(source.name === undefined ? {} : { name: source.name }),
  })
}

function sourceKey(source: PianoInputSource): string {
  return `${source.kind}\u0000${source.id}`
}

function scopeKey(source: PianoInputSource, channel: number): string {
  return `${sourceKey(source)}\u0000${channel}`
}

function physicalKey(
  source: PianoInputSource,
  channel: number,
  keyId: string,
): string {
  return `${scopeKey(source, channel)}\u0000${keyId}`
}

function sameSource(left: PianoInputSource, right: PianoInputSource): boolean {
  return left.kind === right.kind && left.id === right.id
}

function publicVoice(voice: MutableVoice): PianoInputVoice {
  return Object.freeze({
    id: voice.id,
    source: voice.source,
    channel: voice.channel,
    midi: voice.midi,
    velocity: voice.velocity,
    keyId: voice.keyId,
    startedAtMs: voice.startedAtMs,
    pressed: voice.pressed,
    heldBySustain: voice.heldBySustain,
    heldBySostenuto: voice.heldBySostenuto,
    softPedalValue: voice.softPedalValue,
  })
}

function shouldStop(voice: MutableVoice): boolean {
  return !voice.pressed && !voice.heldBySustain && !voice.heldBySostenuto
}

/** Create one route-neutral input authority. Construction has no browser side effects. */
export function createPianoInputState(
  options: PianoInputStateOptions = {},
): PianoInputState {
  const now = options.now ?? (() => performance.now())
  const voices = new Map<string, MutableVoice>()
  const pressedVoiceByKey = new Map<string, string>()
  const pedals = new Map<string, MutablePedalState>()
  const listeners = new Set<PianoInputListener>()
  let voiceSerial = 0
  let revision = 0

  function matchingScope(
    voice: MutableVoice,
    source: PianoInputSource | undefined,
    channel: number | undefined,
  ): boolean {
    if (source !== undefined && !sameSource(voice.source, source)) return false
    return channel === undefined || voice.channel === channel
  }

  function getPedals(
    source: PianoInputSource,
    channel: number,
  ): MutablePedalState {
    const key = scopeKey(source, channel)
    const existing = pedals.get(key)
    if (existing !== undefined) return existing

    const created: MutablePedalState = {
      source,
      channel,
      sustain: 0,
      sostenuto: 0,
      soft: 0,
      sostenutoCaptured: new Set(),
    }
    pedals.set(key, created)
    return created
  }

  function stopVoice(voice: MutableVoice, stopped: MutableVoice[]): void {
    voices.delete(voice.id)
    const key = physicalKey(voice.source, voice.channel, voice.keyId)
    if (pressedVoiceByKey.get(key) === voice.id) pressedVoiceByKey.delete(key)
    const pedal = pedals.get(scopeKey(voice.source, voice.channel))
    pedal?.sostenutoCaptured.delete(voice.id)
    voice.pressed = false
    voice.heldBySustain = false
    voice.heldBySostenuto = false
    stopped.push(voice)
  }

  function stopReleasedVoices(
    source: PianoInputSource,
    channel: number,
    stopped: MutableVoice[],
  ): void {
    for (const voice of Array.from(voices.values())) {
      if (
        sameSource(voice.source, source) &&
        voice.channel === channel &&
        shouldStop(voice)
      ) {
        stopVoice(voice, stopped)
      }
    }
  }

  function buildSnapshot(): PianoInputSnapshot {
    const orderedVoices = Array.from(voices.values()).sort(
      (left, right) => left.serial - right.serial,
    )
    const soundingNotes = Object.freeze(orderedVoices.map(publicVoice))
    const pressedNotes = Object.freeze(
      soundingNotes.filter((voice) => voice.pressed),
    )
    const pedalStates = Object.freeze(
      Array.from(pedals.values())
        .sort((left, right) => {
          const sourceOrder = sourceKey(left.source).localeCompare(
            sourceKey(right.source),
          )
          return sourceOrder === 0 ? left.channel - right.channel : sourceOrder
        })
        .map((pedal) =>
          Object.freeze({
            source: pedal.source,
            channel: pedal.channel,
            sustain: pedal.sustain,
            sostenuto: pedal.sostenuto,
            soft: pedal.soft,
          }),
        ),
    )

    return Object.freeze({
      revision,
      pressedNotes,
      soundingNotes,
      primaryNote: soundingNotes.at(-1) ?? null,
      pedals: pedalStates,
    })
  }

  let currentSnapshot = buildSnapshot()

  function normalizedTimestamp(timestampMs: number): number {
    return Number.isFinite(timestampMs) ? timestampMs : now()
  }

  function normalizeEvent(event: PianoInputEvent): PianoInputEvent {
    if (event.type === 'source-disconnected') {
      return Object.freeze({
        type: event.type,
        source: normalizeSource(event.source),
        timestampMs: normalizedTimestamp(event.timestampMs),
      })
    }

    if (event.type === 'panic') {
      return Object.freeze({
        type: event.type,
        timestampMs: normalizedTimestamp(event.timestampMs),
        ...(event.source === undefined
          ? {}
          : { source: normalizeSource(event.source) }),
        ...(event.channel === undefined
          ? {}
          : { channel: Math.round(clamp(event.channel, 0, 15)) }),
      })
    }

    const source = normalizeSource(event.source)
    const channel = Math.round(clamp(event.channel, 0, 15))
    const timestampMs = normalizedTimestamp(event.timestampMs)

    if (event.type === 'note-on' || event.type === 'note-off') {
      return Object.freeze({
        type: event.type,
        source,
        channel,
        timestampMs,
        midi: Math.round(clamp(event.midi, 0, 127)),
        velocity: clamp(event.velocity, 0, 1),
        ...(event.keyId === undefined ? {} : { keyId: event.keyId }),
      })
    }

    if (event.type === 'pedal') {
      return Object.freeze({
        type: event.type,
        source,
        channel,
        timestampMs,
        pedal: event.pedal,
        value: clamp(event.value, 0, 1),
      })
    }

    return Object.freeze({
      type: event.type,
      source,
      channel,
      timestampMs,
    })
  }

  function applyNoteOn(
    event: PianoNoteOnInputEvent,
    started: MutableVoice[],
    stopped: MutableVoice[],
  ): void {
    const keyId = event.keyId ?? String(event.midi)
    const key = physicalKey(event.source, event.channel, keyId)
    const previousId = pressedVoiceByKey.get(key)
    const previous =
      previousId === undefined ? undefined : voices.get(previousId)
    if (previous !== undefined) stopVoice(previous, stopped)

    const pedal = getPedals(event.source, event.channel)
    voiceSerial += 1
    const voice: MutableVoice = {
      id: `${sourceKey(event.source)}:${event.channel}:${keyId}:${voiceSerial}`,
      serial: voiceSerial,
      source: event.source,
      channel: event.channel,
      midi: event.midi,
      velocity: event.velocity,
      keyId,
      startedAtMs: event.timestampMs,
      pressed: true,
      heldBySustain: false,
      heldBySostenuto: false,
      softPedalValue: pedal.soft,
    }
    voices.set(voice.id, voice)
    pressedVoiceByKey.set(key, voice.id)
    started.push(voice)
  }

  function applyNoteOff(
    event: PianoNoteOffInputEvent,
    stopped: MutableVoice[],
  ): void {
    const keyId = event.keyId ?? String(event.midi)
    const key = physicalKey(event.source, event.channel, keyId)
    const voiceId = pressedVoiceByKey.get(key)
    if (voiceId === undefined) return

    pressedVoiceByKey.delete(key)
    const voice = voices.get(voiceId)
    if (voice === undefined) return

    const pedal = getPedals(event.source, event.channel)
    voice.pressed = false
    voice.heldBySustain = pedal.sustain >= PEDAL_DOWN_THRESHOLD
    voice.heldBySostenuto =
      pedal.sostenuto >= PEDAL_DOWN_THRESHOLD &&
      pedal.sostenutoCaptured.has(voice.id)
    if (shouldStop(voice)) stopVoice(voice, stopped)
  }

  function applyPedal(
    event: PianoPedalInputEvent,
    stopped: MutableVoice[],
  ): void {
    const pedal = getPedals(event.source, event.channel)
    const wasDown = pedal[event.pedal] >= PEDAL_DOWN_THRESHOLD
    const isDown = event.value >= PEDAL_DOWN_THRESHOLD
    pedal[event.pedal] = event.value

    if (event.pedal === 'sustain') {
      if (!wasDown && isDown) {
        for (const voice of voices.values()) {
          if (
            sameSource(voice.source, event.source) &&
            voice.channel === event.channel &&
            !voice.pressed
          ) {
            voice.heldBySustain = true
          }
        }
      } else if (wasDown && !isDown) {
        for (const voice of voices.values()) {
          if (
            sameSource(voice.source, event.source) &&
            voice.channel === event.channel
          ) {
            voice.heldBySustain = false
          }
        }
        stopReleasedVoices(event.source, event.channel, stopped)
      }
      return
    }

    if (event.pedal === 'sostenuto') {
      if (!wasDown && isDown) {
        pedal.sostenutoCaptured.clear()
        for (const voice of voices.values()) {
          if (
            sameSource(voice.source, event.source) &&
            voice.channel === event.channel &&
            voice.pressed
          ) {
            voice.heldBySostenuto = true
            pedal.sostenutoCaptured.add(voice.id)
          }
        }
      } else if (wasDown && !isDown) {
        for (const voiceId of pedal.sostenutoCaptured) {
          const voice = voices.get(voiceId)
          if (voice !== undefined) voice.heldBySostenuto = false
        }
        pedal.sostenutoCaptured.clear()
        stopReleasedVoices(event.source, event.channel, stopped)
      }
    }
  }

  function applyAllNotesOff(
    event: PianoAllNotesOffInputEvent,
    stopped: MutableVoice[],
  ): void {
    const pedal = getPedals(event.source, event.channel)
    for (const voice of Array.from(voices.values())) {
      if (
        !sameSource(voice.source, event.source) ||
        voice.channel !== event.channel ||
        !voice.pressed
      ) {
        continue
      }
      pressedVoiceByKey.delete(
        physicalKey(voice.source, voice.channel, voice.keyId),
      )
      voice.pressed = false
      voice.heldBySustain = pedal.sustain >= PEDAL_DOWN_THRESHOLD
      voice.heldBySostenuto =
        pedal.sostenuto >= PEDAL_DOWN_THRESHOLD &&
        pedal.sostenutoCaptured.has(voice.id)
      if (shouldStop(voice)) stopVoice(voice, stopped)
    }
  }

  function applyResetControllers(
    event: PianoResetControllersInputEvent,
    stopped: MutableVoice[],
  ): void {
    const pedal = getPedals(event.source, event.channel)
    pedal.sustain = 0
    pedal.sostenuto = 0
    pedal.soft = 0
    pedal.sostenutoCaptured.clear()
    for (const voice of voices.values()) {
      if (
        sameSource(voice.source, event.source) &&
        voice.channel === event.channel
      ) {
        voice.heldBySustain = false
        voice.heldBySostenuto = false
      }
    }
    stopReleasedVoices(event.source, event.channel, stopped)
  }

  function applyPanic(
    event: PianoPanicInputEvent,
    stopped: MutableVoice[],
  ): void {
    for (const voice of Array.from(voices.values())) {
      if (matchingScope(voice, event.source, event.channel)) {
        stopVoice(voice, stopped)
      }
    }

    for (const [key, pedal] of pedals) {
      const sourceMatches =
        event.source === undefined || sameSource(pedal.source, event.source)
      const channelMatches =
        event.channel === undefined || pedal.channel === event.channel
      if (sourceMatches && channelMatches) pedals.delete(key)
    }
  }

  function applySourceDisconnected(
    event: PianoSourceDisconnectedInputEvent,
    stopped: MutableVoice[],
  ): void {
    for (const voice of Array.from(voices.values())) {
      if (sameSource(voice.source, event.source)) stopVoice(voice, stopped)
    }
    for (const [key, pedal] of pedals) {
      if (sameSource(pedal.source, event.source)) pedals.delete(key)
    }
  }

  function apply(event: PianoInputEvent): PianoInputUpdate {
    let normalized = normalizeEvent(event)
    if (normalized.type === 'note-on' && normalized.velocity === 0) {
      normalized = Object.freeze({
        ...normalized,
        type: 'note-off',
      })
    }

    const started: MutableVoice[] = []
    const stopped: MutableVoice[] = []
    switch (normalized.type) {
      case 'note-on':
        applyNoteOn(normalized, started, stopped)
        break
      case 'note-off':
        applyNoteOff(normalized, stopped)
        break
      case 'pedal':
        applyPedal(normalized, stopped)
        break
      case 'all-notes-off':
        applyAllNotesOff(normalized, stopped)
        break
      case 'reset-controllers':
        applyResetControllers(normalized, stopped)
        break
      case 'panic':
        applyPanic(normalized, stopped)
        break
      case 'source-disconnected':
        applySourceDisconnected(normalized, stopped)
        break
    }

    revision += 1
    currentSnapshot = buildSnapshot()
    const update: PianoInputUpdate = Object.freeze({
      event: normalized,
      snapshot: currentSnapshot,
      soundingStarted: Object.freeze(started.map(publicVoice)),
      soundingStopped: Object.freeze(stopped.map(publicVoice)),
    })
    for (const listener of listeners) listener(update)
    return update
  }

  return {
    apply,
    snapshot: () => currentSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
