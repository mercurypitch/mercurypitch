// ============================================================
// Piano instrument router — exact-voice routing with a synchronous fallback
// ============================================================
//
// Each accepted note keeps its owning instrument until noteOff, even when the
// selected engine changes in between. Selection subscriptions only publish
// configuration changes so note traffic never drives reactive UI work.

import type { PianoInstrumentDescriptor, PianoInstrumentNoteOff, PianoInstrumentNoteOn, PianoInstrumentPedalEvent, PianoInstrumentPort, } from './piano-instrument-port'

export type PianoInstrumentPreference = 'auto' | 'sampled' | 'fallback'

export interface PianoInstrumentRouterSnapshot {
  readonly preference: PianoInstrumentPreference
  readonly fallback: PianoInstrumentDescriptor
  readonly sampled: PianoInstrumentDescriptor | null
  /** The preferred engine before per-note fallback is attempted. */
  readonly selected: PianoInstrumentDescriptor
  readonly disposed: boolean
}

export interface PianoInstrumentRouter extends PianoInstrumentPort {
  setSampled(instrument: PianoInstrumentPort | null): void
  setPreference(preference: PianoInstrumentPreference): void
  getSnapshot(): PianoInstrumentRouterSnapshot
  subscribe(
    listener: (snapshot: PianoInstrumentRouterSnapshot) => void,
  ): () => void
}

export interface PianoInstrumentRouterOptions {
  fallback: PianoInstrumentPort
  sampled?: PianoInstrumentPort | null
  preference?: PianoInstrumentPreference
}

function callNoteOn(
  instrument: PianoInstrumentPort,
  note: PianoInstrumentNoteOn,
): boolean {
  try {
    return instrument.noteOn(note)
  } catch {
    return false
  }
}

function callNoteOff(
  instrument: PianoInstrumentPort,
  note: PianoInstrumentNoteOff,
): boolean {
  try {
    return instrument.noteOff(note)
  } catch {
    return false
  }
}

/** Create a router that owns and eventually disposes every attached engine. */
export function createPianoInstrumentRouter(
  options: PianoInstrumentRouterOptions,
): PianoInstrumentRouter {
  const knownInstruments = new Set<PianoInstrumentPort>([options.fallback])
  const voiceOwners = new Map<string, PianoInstrumentPort>()
  const pedalState = new Map<
    PianoInstrumentPedalEvent['pedal'],
    PianoInstrumentPedalEvent
  >()
  const listeners = new Set<(snapshot: PianoInstrumentRouterSnapshot) => void>()
  let sampled = options.sampled ?? null
  let preference = options.preference ?? 'auto'
  let disposed = false

  if (sampled !== null) knownInstruments.add(sampled)

  const selectedInstrument = (): PianoInstrumentPort =>
    preference === 'fallback' || sampled === null ? options.fallback : sampled

  const createSnapshot = (): PianoInstrumentRouterSnapshot =>
    Object.freeze({
      preference,
      fallback: options.fallback.descriptor(),
      sampled: sampled?.descriptor() ?? null,
      selected: selectedInstrument().descriptor(),
      disposed,
    })

  let snapshot = createSnapshot()

  const publish = (): void => {
    snapshot = createSnapshot()
    for (const listener of Array.from(listeners)) listener(snapshot)
  }

  const panicAll = (atContextTime?: number): void => {
    voiceOwners.clear()
    for (const instrument of knownInstruments) {
      try {
        instrument.panic(atContextTime)
      } catch {
        // One failed engine must not prevent the remaining voices from stopping.
      }
    }
  }

  const activeIdsByInstrument = (): Map<
    PianoInstrumentPort,
    ReadonlySet<string>
  > => {
    const active = new Map<PianoInstrumentPort, ReadonlySet<string>>()
    for (const instrument of knownInstruments) {
      try {
        active.set(instrument, new Set(instrument.activeVoiceIds()))
      } catch {
        // A failed diagnostic must not discard ownership for that engine.
      }
    }
    for (const [id, owner] of voiceOwners) {
      const ownerIds = active.get(owner)
      if (ownerIds !== undefined && !ownerIds.has(id)) voiceOwners.delete(id)
    }
    return active
  }

  return {
    descriptor() {
      return selectedInstrument().descriptor()
    },

    async load(signal) {
      if (disposed) throw new Error('Piano instrument router is disposed')
      await selectedInstrument().load(signal)
    },

    async prewarm(midis, signal) {
      if (disposed) throw new Error('Piano instrument router is disposed')
      await selectedInstrument().prewarm(midis, signal)
    },

    noteOn(note) {
      if (disposed || note.id.trim() === '') return false

      activeIdsByInstrument()

      const previousOwner = voiceOwners.get(note.id)
      if (previousOwner !== undefined) {
        callNoteOff(previousOwner, {
          id: note.id,
          atContextTime: note.atContextTime,
        })
        voiceOwners.delete(note.id)
      }

      const selected = selectedInstrument()
      if (callNoteOn(selected, note)) {
        voiceOwners.set(note.id, selected)
        return true
      }
      if (selected !== options.fallback && callNoteOn(options.fallback, note)) {
        voiceOwners.set(note.id, options.fallback)
        return true
      }
      return false
    },

    noteOff(note) {
      if (disposed) return false
      const owner = voiceOwners.get(note.id)
      if (owner === undefined) return false
      const released = callNoteOff(owner, note)
      // Scheduler releases are posted ahead of the audio clock. Keep their
      // owner so pause/seek can move that release earlier; later diagnostics
      // prune the entry once the engine reports that the voice has ended.
      if (note.atContextTime === undefined) voiceOwners.delete(note.id)
      return released
    },

    pedal(event: PianoInstrumentPedalEvent) {
      if (disposed) return

      // Pedal state is global performance state, not voice ownership. Keep
      // idle engines synchronized so changing instruments while a pedal is
      // held (or after a controller reset) cannot revive stale pedal values.
      pedalState.set(event.pedal, Object.freeze({ ...event }))
      for (const instrument of knownInstruments) {
        try {
          instrument.pedal(event)
        } catch {
          // Pedal expression is best effort across the remaining engines.
        }
      }
    },

    panic(atContextTime) {
      if (disposed) return
      panicAll(atContextTime)
    },

    activeVoiceIds() {
      const ids = new Set<string>()
      for (const activeIds of activeIdsByInstrument().values()) {
        for (const id of activeIds) ids.add(id)
      }
      return Object.freeze(Array.from(ids))
    },

    setSampled(instrument) {
      if (disposed || sampled === instrument) return
      sampled = instrument
      if (instrument !== null) {
        knownInstruments.add(instrument)
        // The engine may be attached after a hardware pedal moved. Replay the
        // current values before it can be selected so its first notes use the
        // same performance state as the fallback engine.
        for (const event of pedalState.values()) {
          try {
            instrument.pedal(event)
          } catch {
            // A failed expression update must not prevent engine attachment.
          }
        }
      }
      publish()
    },

    setPreference(nextPreference) {
      if (disposed || preference === nextPreference) return
      preference = nextPreference
      publish()
    },

    getSnapshot() {
      return snapshot
    },

    subscribe(listener) {
      if (disposed) return () => undefined
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    dispose() {
      if (disposed) return
      panicAll()
      for (const instrument of knownInstruments) {
        try {
          instrument.dispose()
        } catch {
          // Dispose every owned engine even when one cleanup fails.
        }
      }
      disposed = true
      publish()
      listeners.clear()
    },
  }
}
