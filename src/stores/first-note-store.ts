// ============================================================
// First note's records — the best at each level, the demo seen
// ============================================================
//
// A best is the most entries a run came in on the note, and among runs
// that came in on as many, the most found, then the closest entries on
// average. Kept per level: Learning shows the note's line from the start,
// Professional never until the voice lands, and a best at one is no
// measure of the other.
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
// lives here so the ways in (first-entry.ts) can say the demo plays by
// itself without loading the room.
//
// Built on first read, not on import, so nothing at this module's top
// level touches storage.

import type { Signal } from 'solid-js'
import type { FirstNoteBest } from '@/lib/ear-room-bests'
import { FIRST_NOTE_BEST_RULES, FIRST_NOTE_BESTS_KEY, FIRST_NOTE_DEVICE_BESTS_KEY, } from '@/lib/ear-room-bests'
import type { LevelBestTable } from '@/lib/level-bests'
import { adoptDeviceBests, isLevelBestTable } from '@/lib/level-bests'
import { createPersistedSignal } from '@/lib/storage'
import type { ExerciseLevel } from './exercise-level'
import { EXERCISE_LEVELS } from './exercise-level'

/** Where the demo's seen flag lives: on this device only. */
export const FIRST_NOTE_DEMO_SEEN_KEY = 'mp_first_note_demo_seen'

export type { FirstNoteBest } from '@/lib/ear-room-bests'
export { FIRST_NOTE_BESTS_KEY } from '@/lib/ear-room-bests'

export type FirstNoteBestTable = LevelBestTable<FirstNoteBest>

export function isFirstNoteBestTable(
  value: unknown,
): value is FirstNoteBestTable {
  return isLevelBestTable(value, FIRST_NOTE_BEST_RULES)
}

/** Whether `run` beats `previous`, by the room's rule (ear-room-bests.ts). */
export function firstNoteBeats(
  run: FirstNoteBest,
  previous: FirstNoteBest | null,
): boolean {
  return FIRST_NOTE_BEST_RULES.beats(run, previous)
}

let table: Signal<FirstNoteBestTable> | undefined

function bests(): Signal<FirstNoteBestTable> {
  if (table === undefined) {
    const made = createPersistedSignal<FirstNoteBestTable>(
      FIRST_NOTE_BESTS_KEY,
      {},
      {
        validator: isFirstNoteBestTable,
      },
    )
    table = made
    // What this device kept before the bests followed the account.
    adoptDeviceBests(
      FIRST_NOTE_DEVICE_BESTS_KEY,
      FIRST_NOTE_BEST_RULES,
      made[1],
    )
  }
  return table
}

/** The level's best, or null before its first run that found a note. */
export function firstNoteBest(level: ExerciseLevel): FirstNoteBest | null {
  return bests()[0]()[level] ?? null
}

export interface FirstNoteBestOutcome {
  /** The best before this run, or null for the level's first. */
  readonly previous: FirstNoteBest | null
  /** This run beat a previous best (never true on a first). */
  readonly improved: boolean
}

/** Keep the run if it is the level's new best, and say how it compared. */
export function recordFirstNoteBest(
  level: ExerciseLevel,
  run: FirstNoteBest,
): FirstNoteBestOutcome {
  const previous = firstNoteBest(level)
  if (!firstNoteBeats(run, previous)) return { previous, improved: false }
  bests()[1]((current) => ({ ...current, [level]: run }))
  return { previous, improved: previous !== null }
}

let demoSeen: Signal<boolean> | undefined

function demoSeenSignal(): Signal<boolean> {
  demoSeen ??= createPersistedSignal<boolean>(FIRST_NOTE_DEMO_SEEN_KEY, false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })
  return demoSeen
}

/** This device has seen the demo: its end card, Skip or Not now. */
export function firstNoteDemoSeen(): boolean {
  return demoSeenSignal()[0]()
}

export function markFirstNoteDemoSeen(): void {
  if (!firstNoteDemoSeen()) demoSeenSignal()[1](true)
}

/**
 * The demo plays by itself on the way in: a first visit, the demo unseen
 * and no run kept yet (no best at any level). One rule for the room
 * (demo/useFirstNoteDemo.ts) and its ways in (first-entry.ts).
 */
export function firstNoteDemoAutoPlays(): boolean {
  if (firstNoteDemoSeen()) return false
  return EXERCISE_LEVELS.every((level) => firstNoteBest(level) === null)
}

/** Drop the signals read so far: the next read takes storage as it is now. */
export function resetFirstNoteStoreForTests(): void {
  table = undefined
  demoSeen = undefined
}
