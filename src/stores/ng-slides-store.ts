// ============================================================
// Ng slides' records: the best at each level, the singer's easy note
// ============================================================
//
// The live table of Ng slides' bests (its shape, its ordering and how a
// settings pull merges another device's copy are in
// src/lib/glide/ng-bests.ts), and the easy note the singer settled on when
// there was no voiceprint, so the next run fits its slides there without
// asking for a note again (fitNgSlides puts the first root four semitones
// under it). Both follow the account (`pitchperfect_` keys, synced by
// settings-service.ts). The room records them; the Sing screen's card
// reads them. Built on first read, not on import, so nothing at this
// module's top level touches storage.
//
// The demo's seen flag joins here with the demo (PR 9), as Echo's did.

import type { Signal } from 'solid-js'
import type { GlideLevelId } from '@/lib/glide/glide-presets'
import type { NgBest, NgBestTable } from '@/lib/glide/ng-bests'
import { isNgBestTable, NG_BESTS_KEY, ngBeats } from '@/lib/glide/ng-bests'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { createPersistedSignal } from '@/lib/storage'

export type { NgBest } from '@/lib/glide/ng-bests'

/** Where the remembered easy note lives, and the settings row it syncs as. */
export const NG_NOTE_KEY = 'pitchperfect_ng_slides_note'

let table: Signal<NgBestTable> | undefined
let note: Signal<number | null> | undefined

function bests(): Signal<NgBestTable> {
  table ??= createPersistedSignal<NgBestTable>(
    NG_BESTS_KEY,
    {},
    {
      validator: isNgBestTable,
    },
  )
  return table
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

function noteSignal(): Signal<number | null> {
  note ??= createPersistedSignal<number | null>(NG_NOTE_KEY, null, {
    validator: isNote,
  })
  return note
}

/** The best at this level, or null before the first run there. */
export function ngBest(level: GlideLevelId): NgBest | null {
  return bests()[0]()[level] ?? null
}

export interface NgBestOutcome {
  /** The best before this run, or null for the first run at the level. */
  readonly previous: NgBest | null
  /** This run beat a previous best (never true on a first run). */
  readonly improved: boolean
}

/** Keep the run if it is the level's new best, and say how it compared. */
export function recordNgBest(level: GlideLevelId, run: NgBest): NgBestOutcome {
  const previous = ngBest(level)
  if (!ngBeats(run, previous)) return { previous, improved: false }
  bests()[1]((current) => ({ ...current, [level]: run }))
  return { previous, improved: previous !== null }
}

/** The easy note the singer settled on last, MIDI, or null. */
export function rememberedNgNote(): number | null {
  return noteSignal()[0]()
}

export function rememberNgNote(midi: number): void {
  if (isNote(midi)) noteSignal()[1](midi)
}

/** Drop the signals read so far: the next read takes storage as it is now. */
export function resetNgStoreForTests(): void {
  table = undefined
  note = undefined
}
