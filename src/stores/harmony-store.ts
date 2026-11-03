// ============================================================
// Harmony's records — the best at each level, and how it is sung
// ============================================================
//
// A best is the most lines sung in harmony (every note a third from
// Merc's) in a run, and among runs with as many, the most notes. Kept per
// level, as the other Ear rooms keep theirs: Learning hears the harmony
// first and Professional sings some lines a third below, so a best at one
// is no measure of the other.
//
// The way the singer sings (taking turns on the speaker, or together in
// headphones) is kept too: the room keeps the choice for next time, as the
// sheet that sets it says.
//
// The room records them; the Sing screen's picker and the Ear Lab's row
// read the best through here and never through the room's feature (the
// picker would otherwise load the room to draw its card).
//
// The bests follow the account, as Long note's and Echo's do: what a best
// is and which of two is better are the room's rule in
// src/lib/ear-room-bests.ts, where the settings sync's pull reads it to
// keep the better best at each level. What this device kept before they
// synced, under the old `mp_` key, is adopted on the first read and let go.
// The way it is sung stays on the device (an `mp_` key, out of the sync):
// headphones belong to a phone, not to the singer.
//
// Whether this device has seen the "how it works" demo is a device fact,
// set the way the demo kit sets every room's (demo-kit/demo-seen.ts). It
// lives here so the ways in (harmony-entry.ts) can say the demo plays by
// itself without loading the room.
//
// Built on first read, not on import, so nothing at this module's top
// level touches storage.

import type { Signal } from 'solid-js'
import type { HarmonyBest } from '@/lib/ear-room-bests'
import { HARMONY_BEST_RULES, HARMONY_BESTS_KEY, HARMONY_DEVICE_BESTS_KEY, } from '@/lib/ear-room-bests'
import type { LevelBestTable } from '@/lib/level-bests'
import { adoptDeviceBests, isLevelBestTable } from '@/lib/level-bests'
import { createPersistedSignal } from '@/lib/storage'
import type { ExerciseLevel } from './exercise-level'
import { EXERCISE_LEVELS } from './exercise-level'

/** Where the way the singer sings is kept. */
export const HARMONY_WAY_KEY = 'mp_harmony_way'
/** Where the demo's seen flag lives: on this device only. */
export const HARMONY_DEMO_SEEN_KEY = 'mp_harmony_demo_seen'

/** Taking turns with Merc, or singing with him in headphones. */
export type HarmonyWayId = 'turns' | 'together'

export type { HarmonyBest } from '@/lib/ear-room-bests'
export { HARMONY_BESTS_KEY } from '@/lib/ear-room-bests'

export type HarmonyBestTable = LevelBestTable<HarmonyBest>

export function isHarmonyBestTable(value: unknown): value is HarmonyBestTable {
  return isLevelBestTable(value, HARMONY_BEST_RULES)
}

/** Whether `run` beats `previous`, by the room's rule (ear-room-bests.ts). */
export function harmonyBeats(
  run: HarmonyBest,
  previous: HarmonyBest | null,
): boolean {
  return HARMONY_BEST_RULES.beats(run, previous)
}

let table: Signal<HarmonyBestTable> | undefined
let way: Signal<HarmonyWayId> | undefined

function bests(): Signal<HarmonyBestTable> {
  if (table === undefined) {
    const made = createPersistedSignal<HarmonyBestTable>(
      HARMONY_BESTS_KEY,
      {},
      {
        validator: isHarmonyBestTable,
      },
    )
    table = made
    // What this device kept before the bests followed the account.
    adoptDeviceBests(HARMONY_DEVICE_BESTS_KEY, HARMONY_BEST_RULES, made[1])
  }
  return table
}

function waySignal(): Signal<HarmonyWayId> {
  way ??= createPersistedSignal<HarmonyWayId>(HARMONY_WAY_KEY, 'turns', {
    validator: (value): value is HarmonyWayId =>
      value === 'turns' || value === 'together',
  })
  return way
}

/** The level's best, or null before its first run that sang a note. */
export function harmonyBest(level: ExerciseLevel): HarmonyBest | null {
  return bests()[0]()[level] ?? null
}

export interface HarmonyBestOutcome {
  /** The best before this run, or null for the level's first. */
  readonly previous: HarmonyBest | null
  /** This run beat a previous best (never true on a first). */
  readonly improved: boolean
}

/** Keep the run if it is the level's new best, and say how it compared. */
export function recordHarmonyBest(
  level: ExerciseLevel,
  run: HarmonyBest,
): HarmonyBestOutcome {
  const previous = harmonyBest(level)
  if (!harmonyBeats(run, previous)) return { previous, improved: false }
  bests()[1]((current) => ({ ...current, [level]: run }))
  return { previous, improved: previous !== null }
}

/** How the singer sings: kept for next time. */
export function harmonyWay(): HarmonyWayId {
  return waySignal()[0]()
}

export function setHarmonyWay(next: HarmonyWayId): void {
  waySignal()[1](next)
}

/** Drop the signals read so far: the next read takes storage as it is now. */
let demoSeen: Signal<boolean> | undefined

function demoSeenSignal(): Signal<boolean> {
  demoSeen ??= createPersistedSignal<boolean>(HARMONY_DEMO_SEEN_KEY, false, {
    validator: (value): value is boolean => typeof value === 'boolean',
  })
  return demoSeen
}

/** This device has seen the demo: its end card, Skip or Not now. */
export function harmonyDemoSeen(): boolean {
  return demoSeenSignal()[0]()
}

export function markHarmonyDemoSeen(): void {
  if (!harmonyDemoSeen()) demoSeenSignal()[1](true)
}

/**
 * The demo plays by itself on the way in: a first visit, the demo unseen
 * and no run kept yet (no best at any level). One rule for the room
 * (demo/useHarmonyDemo.ts) and its ways in (harmony-entry.ts).
 */
export function harmonyDemoAutoPlays(): boolean {
  if (harmonyDemoSeen()) return false
  return EXERCISE_LEVELS.every((level) => harmonyBest(level) === null)
}

export function resetHarmonyStoreForTests(): void {
  table = undefined
  way = undefined
  demoSeen = undefined
}
