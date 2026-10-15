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
// on the bay.
//
// Whether this device has seen the "how it works" demo is a device fact,
// not a preference: an `mp_` key, kept out of the settings sync, as Ng's
// and Echo's are. It lives here, with the records it is read beside, so
// the Sing screen's picker can say the demo plays by itself without
// loading the room.

import type { Signal } from 'solid-js'
import type { GlideLevelId } from '@/lib/glide/glide-presets'
import { LIP_ROLL_LEVELS } from '@/lib/glide/glide-presets'
import type { LipBest, LipBestTable } from '@/lib/glide/lip-bests'
import { isLipBestTable, LIP_BESTS_KEY, lipBeats } from '@/lib/glide/lip-bests'
import { HOLD_TARGET_MAX_MIDI, HOLD_TARGET_MIN_MIDI, } from '@/lib/hold/hold-target'
import { createPersistedSignal } from '@/lib/storage'

export type { LipBest } from '@/lib/glide/lip-bests'

/** Where the remembered easy note lives, and the settings row it syncs as. */
export const LIP_NOTE_KEY = 'pitchperfect_lip_roll_note'

/** Where the demo's seen flag lives: on this device only. */
export const LIP_DEMO_SEEN_KEY = 'mp_lip_demo_seen'

let table: Signal<LipBestTable> | undefined
let note: Signal<number | null> | undefined
let demoSeen: Signal<boolean> | undefined

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

function demoSeenSignal(): Signal<boolean> {
  demoSeen ??= createPersistedSignal<boolean>(LIP_DEMO_SEEN_KEY, false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })
  return demoSeen
}

/** This device has seen the demo: its end card, Skip or Not now. */
export function lipDemoSeen(): boolean {
  return demoSeenSignal()[0]()
}

export function markLipDemoSeen(): void {
  if (!lipDemoSeen()) demoSeenSignal()[1](true)
}

/**
 * The demo plays by itself on the way in: a first visit, the demo unseen
 * and no run kept (no best at any level, no easy note kept). One rule for
 * the room (demo/useLipDemo.ts) and the Sing screen's picker.
 */
export function lipDemoAutoPlays(): boolean {
  if (lipDemoSeen() || rememberedLipNote() !== null) return false
  const levels = Object.keys(LIP_ROLL_LEVELS) as GlideLevelId[]
  return levels.every((level) => lipBest(level) === null)
}

/** Drop the signals read so far: the next read takes storage as it is now. */
export function resetLipStoreForTests(): void {
  table = undefined
  note = undefined
  demoSeen = undefined
}
