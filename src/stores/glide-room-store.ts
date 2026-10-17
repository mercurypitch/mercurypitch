// ============================================================
// A glide room's records: its bests, the easy note, the demo seen
// ============================================================
//
// What each glide room keeps, made once for both (Lip roll's
// lip-roll-store.ts, Ng slides' ng-slides-store.ts): the live table of the
// room's bests, one per level (the row's shape, its ordering and how a
// settings pull merges another device's copy are in src/lib/glide), and
// the easy note the singer settled on when there was no voiceprint, so the
// next run fits its arches there without asking for a note again. Both
// follow the account (`pitchperfect_` keys, synced by
// settings-service.ts).
//
// Whether this device has seen the "how it works" demo is a device fact,
// not a preference: an `mp_` key, kept out of the settings sync. It lives
// with the records it is read beside, so the Sing screen's picker can say
// the demo plays by itself without loading the room.
//
// Every signal is built on first read, not when the store is made, so
// nothing at a room store's top level touches storage.

import type { Signal } from 'solid-js'
import type { GlideLevelId } from '@/lib/glide/glide-presets'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { createPersistedSignal } from '@/lib/storage'

/** A room's bests: one row per level, none before the first run there. */
export type GlideBestTable<B> = Readonly<Partial<Record<GlideLevelId, B>>>

export interface GlideRoomStoreSetup<B> {
  /** Where the bests live, and the settings row they sync as. */
  readonly bestsKey: string
  readonly isBestTable: (value: unknown) => value is GlideBestTable<B>
  /** Whether `run` beats `previous` (src/lib/glide). */
  readonly beats: (run: B, previous: B | null) => boolean
  /** Where the remembered easy note lives, and the settings row it syncs as. */
  readonly noteKey: string
  /** Where the demo's seen flag lives: on this device only. */
  readonly demoSeenKey: string
  /** The room's levels (glide-presets.ts), for the demo's first-visit rule. */
  readonly levels: Readonly<Record<GlideLevelId, unknown>>
}

export interface GlideBestOutcome<B> {
  /** The best before this run, or null for the first run at the level. */
  readonly previous: B | null
  /** This run beat a previous best (never true on a first run). */
  readonly improved: boolean
}

export interface GlideRoomStore<B> {
  /** The best at this level, or null before the first run there. */
  best: (level: GlideLevelId) => B | null
  /** Keep the run if it is the level's new best, and say how it compared. */
  recordBest: (level: GlideLevelId, run: B) => GlideBestOutcome<B>
  /** The easy note the singer settled on last, MIDI, or null. */
  rememberedNote: () => number | null
  rememberNote: (midi: number) => void
  /** This device has seen the demo: its end card, Skip or Not now. */
  demoSeen: () => boolean
  markDemoSeen: () => void
  /**
   * The demo plays by itself on the way in: a first visit, the demo unseen
   * and no run kept (no best at any level, no easy note kept). One rule for
   * the room and the Sing screen's picker.
   */
  demoAutoPlays: () => boolean
  /** Drop the signals read so far: the next read takes storage as it is now. */
  resetForTests: () => void
}

function isNote(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= HOLD_TARGET_MIN_MIDI &&
      value <= HOLD_TARGET_MAX_MIDI)
  )
}

export function createGlideRoomStore<B>(
  setup: GlideRoomStoreSetup<B>,
): GlideRoomStore<B> {
  let table: Signal<GlideBestTable<B>> | undefined
  let note: Signal<number | null> | undefined
  let demoSeen: Signal<boolean> | undefined

  const bests = (): Signal<GlideBestTable<B>> => {
    table ??= createPersistedSignal<GlideBestTable<B>>(
      setup.bestsKey,
      {},
      { validator: setup.isBestTable },
    )
    return table
  }

  const noteSignal = (): Signal<number | null> => {
    note ??= createPersistedSignal<number | null>(setup.noteKey, null, {
      validator: isNote,
    })
    return note
  }

  const demoSeenSignal = (): Signal<boolean> => {
    demoSeen ??= createPersistedSignal<boolean>(setup.demoSeenKey, false, {
      validator: (value): value is boolean => typeof value === 'boolean',
    })
    return demoSeen
  }

  const best = (level: GlideLevelId): B | null => bests()[0]()[level] ?? null
  const rememberedNote = (): number | null => noteSignal()[0]()
  const seen = (): boolean => demoSeenSignal()[0]()

  return {
    best,
    recordBest: (level, run) => {
      const previous = best(level)
      if (!setup.beats(run, previous)) return { previous, improved: false }
      bests()[1]((current) => ({ ...current, [level]: run }))
      return { previous, improved: previous !== null }
    },
    rememberedNote,
    rememberNote: (midi) => {
      if (isNote(midi)) noteSignal()[1](midi)
    },
    demoSeen: seen,
    markDemoSeen: () => {
      if (!seen()) demoSeenSignal()[1](true)
    },
    demoAutoPlays: () => {
      if (seen() || rememberedNote() !== null) return false
      const levels = Object.keys(setup.levels) as GlideLevelId[]
      return levels.every((level) => best(level) === null)
    },
    resetForTests: () => {
      table = undefined
      note = undefined
      demoSeen = undefined
    },
  }
}
