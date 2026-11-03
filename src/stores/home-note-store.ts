// ============================================================
// Home note's records — the best at each level, the demo seen
// ============================================================
//
// A best is the most rounds found in a run, and among runs that found as
// many, the quickest to find them on average. Kept per level, as Echo keeps
// its own: Learning sings home after Merc, Professional hears only two
// chords, and a best at one is no measure of the other.
//
// The room records it; the Sing screen's picker and the Ear Lab's row read
// it, through here and never through the room's feature (the picker would
// otherwise load the room to draw its card).
//
// The bests follow the account, as Long note's and Echo's do: what a best
// is and which of two is better are the room's rule in
// src/lib/ear-room-bests.ts, where the settings sync's pull reads it to
// keep the better best at each level. What this device kept before they
// synced, under the old `mp_` key, is adopted on the first read and let go.
//
// Whether this device has seen the "how it works" demo is a device fact,
// set the way the demo kit sets every room's (demo-kit/demo-seen.ts). It
// lives here so the ways in (home-entry.ts) can say the demo plays by
// itself without loading the room.
//
// Built on first read, not on import, so nothing at this module's top
// level touches storage.

import type { Signal } from 'solid-js'
import type { HomeNoteBest } from '@/lib/ear-room-bests'
import { HOME_NOTE_BEST_RULES, HOME_NOTE_BESTS_KEY, HOME_NOTE_DEVICE_BESTS_KEY, } from '@/lib/ear-room-bests'
import type { LevelBestTable } from '@/lib/level-bests'
import { adoptDeviceBests, isLevelBestTable } from '@/lib/level-bests'
import { createPersistedSignal } from '@/lib/storage'
import type { ExerciseLevel } from './exercise-level'
import { EXERCISE_LEVELS } from './exercise-level'

/** Where the demo's seen flag lives: on this device only. */
export const HOME_NOTE_DEMO_SEEN_KEY = 'mp_home_note_demo_seen'

export type { HomeNoteBest } from '@/lib/ear-room-bests'
export { HOME_NOTE_BESTS_KEY } from '@/lib/ear-room-bests'

export type HomeNoteBestTable = LevelBestTable<HomeNoteBest>

export function isHomeNoteBestTable(
  value: unknown,
): value is HomeNoteBestTable {
  return isLevelBestTable(value, HOME_NOTE_BEST_RULES)
}

/** Whether `run` beats `previous`, by the room's rule (ear-room-bests.ts). */
export function homeNoteBeats(
  run: HomeNoteBest,
  previous: HomeNoteBest | null,
): boolean {
  return HOME_NOTE_BEST_RULES.beats(run, previous)
}

let table: Signal<HomeNoteBestTable> | undefined

function bests(): Signal<HomeNoteBestTable> {
  if (table === undefined) {
    const made = createPersistedSignal<HomeNoteBestTable>(
      HOME_NOTE_BESTS_KEY,
      {},
      {
        validator: isHomeNoteBestTable,
      },
    )
    table = made
    // What this device kept before the bests followed the account.
    adoptDeviceBests(HOME_NOTE_DEVICE_BESTS_KEY, HOME_NOTE_BEST_RULES, made[1])
  }
  return table
}

/** The level's best, or null before its first run that found home. */
export function homeNoteBest(level: ExerciseLevel): HomeNoteBest | null {
  return bests()[0]()[level] ?? null
}

export interface HomeNoteBestOutcome {
  /** The best before this run, or null for the level's first. */
  readonly previous: HomeNoteBest | null
  /** This run beat a previous best (never true on a first). */
  readonly improved: boolean
}

/** Keep the run if it is the level's new best, and say how it compared. */
export function recordHomeNoteBest(
  level: ExerciseLevel,
  run: HomeNoteBest,
): HomeNoteBestOutcome {
  const previous = homeNoteBest(level)
  if (!homeNoteBeats(run, previous)) return { previous, improved: false }
  bests()[1]((current) => ({ ...current, [level]: run }))
  return { previous, improved: previous !== null }
}

let demoSeen: Signal<boolean> | undefined

function demoSeenSignal(): Signal<boolean> {
  demoSeen ??= createPersistedSignal<boolean>(HOME_NOTE_DEMO_SEEN_KEY, false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })
  return demoSeen
}

/** This device has seen the demo: its end card, Skip or Not now. */
export function homeNoteDemoSeen(): boolean {
  return demoSeenSignal()[0]()
}

export function markHomeNoteDemoSeen(): void {
  if (!homeNoteDemoSeen()) demoSeenSignal()[1](true)
}

/**
 * The demo plays by itself on the way in: a first visit, the demo unseen
 * and no run kept yet (no best at any level). One rule for the room
 * (demo/useHomeNoteDemo.ts) and its ways in (home-entry.ts).
 */
export function homeNoteDemoAutoPlays(): boolean {
  if (homeNoteDemoSeen()) return false
  return EXERCISE_LEVELS.every((level) => homeNoteBest(level) === null)
}

/** Drop the signals read so far: the next read takes storage as it is now. */
export function resetHomeNoteStoreForTests(): void {
  table = undefined
  demoSeen = undefined
}
