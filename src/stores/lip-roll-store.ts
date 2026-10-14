// ============================================================
// Lip roll's records: the best at each level, the singer's easy note
// ============================================================
//
// The live table of Lip roll's bests (its shape, its ordering and how a
// settings pull merges another device's copy are in
// src/lib/glide/lip-bests.ts), and the easy note the singer settled on
// when there was no voiceprint, so the next run sets its waves there
// without asking for a note again (fitLipRoll puts the first root four
// semitones under it). Both follow the account (`pitchperfect_` keys,
// synced by settings-service.ts). The room records them; the Sing screen's
// card reads them. Built on first read, not on import, so nothing at this
// module's top level touches storage. Ng slides' store (ng-slides-store.ts)
// before its demo.

import type { Signal } from 'solid-js'
import type { GlideLevelId } from '@/lib/glide/glide-presets'
import type { LipBest, LipBestTable } from '@/lib/glide/lip-bests'
import { isLipBestTable, LIP_BESTS_KEY, lipBeats } from '@/lib/glide/lip-bests'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { createPersistedSignal } from '@/lib/storage'

export type { LipBest } from '@/lib/glide/lip-bests'

/** Where the remembered easy note lives, and the settings row it syncs as. */
export const LIP_NOTE_KEY = 'pitchperfect_lip_roll_note'

let table: Signal<LipBestTable> | undefined
let note: Signal<number | null> | undefined

function bests(): Signal<LipBestTable> {
  table ??= createPersistedSignal<LipBestTable>(
    LIP_BESTS_KEY,
    {},
    { validator: isLipBestTable },
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
  note ??= createPersistedSignal<number | null>(LIP_NOTE_KEY, null, {
    validator: isNote,
  })
  return note
}

/** The best at this level, or null before the first run there. */
export function lipBest(level: GlideLevelId): LipBest | null {
  return bests()[0]()[level] ?? null
}

export interface LipBestOutcome {
  /** The best before this run, or null for the first run at the level. */
  readonly previous: LipBest | null
  /** This run beat a previous best (never true on a first run). */
  readonly improved: boolean
}

/** Keep the run if it is the level's new best, and say how it compared. */
export function recordLipBest(
  level: GlideLevelId,
  run: LipBest,
): LipBestOutcome {
  const previous = lipBest(level)
  if (!lipBeats(run, previous)) return { previous, improved: false }
  bests()[1]((current) => ({ ...current, [level]: run }))
  return { previous, improved: previous !== null }
}

/** The easy note the singer settled on last, MIDI, or null. */
export function rememberedLipNote(): number | null {
  return noteSignal()[0]()
}

export function rememberLipNote(midi: number): void {
  if (isNote(midi)) noteSignal()[1](midi)
}

/** Drop the signals read so far: the next read takes storage as it is now. */
export function resetLipStoreForTests(): void {
  table = undefined
  note = undefined
}
