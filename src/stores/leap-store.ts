// ============================================================
// Leap's records — the best at each level, the demo seen
// ============================================================
//
// A best is the most leaps landed in a run, and among runs that landed as
// many, the quickest from Merc's note to the target on average. Kept per
// level, as Home note keeps its own: Learning hears both notes first,
// Professional leaps both ways by the interval's name alone, and a best at
// one is no measure of the other.
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
// lives here so the ways in (leap-entry.ts) can say the demo plays by
// itself without loading the room.
//
// Built on first read, not on import, so nothing at this module's top
// level touches storage.

import type { Signal } from 'solid-js'
import type { LeapBest } from '@/lib/ear-room-bests'
import { LEAP_BEST_RULES, LEAP_BESTS_KEY, LEAP_DEVICE_BESTS_KEY, } from '@/lib/ear-room-bests'
import type { LevelBestTable } from '@/lib/level-bests'
import { adoptDeviceBests, isLevelBestTable } from '@/lib/level-bests'
import { createPersistedSignal } from '@/lib/storage'
import type { ExerciseLevel } from './exercise-level'
import { EXERCISE_LEVELS } from './exercise-level'

/** Where the demo's seen flag lives: on this device only. */
export const LEAP_DEMO_SEEN_KEY = 'mp_leap_demo_seen'

export type { LeapBest } from '@/lib/ear-room-bests'
export { LEAP_BESTS_KEY } from '@/lib/ear-room-bests'

export type LeapBestTable = LevelBestTable<LeapBest>

export function isLeapBestTable(value: unknown): value is LeapBestTable {
  return isLevelBestTable(value, LEAP_BEST_RULES)
}

/** Whether `run` beats `previous`, by the room's rule (ear-room-bests.ts). */
export function leapBeats(run: LeapBest, previous: LeapBest | null): boolean {
  return LEAP_BEST_RULES.beats(run, previous)
}

let table: Signal<LeapBestTable> | undefined

function bests(): Signal<LeapBestTable> {
  if (table === undefined) {
    const made = createPersistedSignal<LeapBestTable>(
      LEAP_BESTS_KEY,
      {},
      {
        validator: isLeapBestTable,
      },
    )
    table = made
    // What this device kept before the bests followed the account.
    adoptDeviceBests(LEAP_DEVICE_BESTS_KEY, LEAP_BEST_RULES, made[1])
  }
  return table
}

/** The level's best, or null before its first run that landed a leap. */
export function leapBest(level: ExerciseLevel): LeapBest | null {
  return bests()[0]()[level] ?? null
}

export interface LeapBestOutcome {
  /** The best before this run, or null for the level's first. */
  readonly previous: LeapBest | null
  /** This run beat a previous best (never true on a first). */
  readonly improved: boolean
}

/** Keep the run if it is the level's new best, and say how it compared. */
export function recordLeapBest(
  level: ExerciseLevel,
  run: LeapBest,
): LeapBestOutcome {
  const previous = leapBest(level)
  if (!leapBeats(run, previous)) return { previous, improved: false }
  bests()[1]((current) => ({ ...current, [level]: run }))
  return { previous, improved: previous !== null }
}

let demoSeen: Signal<boolean> | undefined

function demoSeenSignal(): Signal<boolean> {
  demoSeen ??= createPersistedSignal<boolean>(LEAP_DEMO_SEEN_KEY, false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })
  return demoSeen
}

/** This device has seen the demo: its end card, Skip or Not now. */
export function leapDemoSeen(): boolean {
  return demoSeenSignal()[0]()
}

export function markLeapDemoSeen(): void {
  if (!leapDemoSeen()) demoSeenSignal()[1](true)
}

/**
 * The demo plays by itself on the way in: a first visit, the demo unseen
 * and no run kept yet (no best at any level). One rule for the room
 * (demo/useLeapDemo.ts) and its ways in (leap-entry.ts).
 */
export function leapDemoAutoPlays(): boolean {
  if (leapDemoSeen()) return false
  return EXERCISE_LEVELS.every((level) => leapBest(level) === null)
}

/** Drop the signals read so far: the next read takes storage as it is now. */
export function resetLeapStoreForTests(): void {
  table = undefined
  demoSeen = undefined
}
