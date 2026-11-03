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
// On this device only, for now: the `mp_` prefix keeps the key out of the
// settings sync. Long note's and Echo's bests follow the account through a
// merge rule of their own (src/lib/hold/hold-bests.ts, echo-bests.ts); Home
// note gets one when it leaves the test builds.
//
// Whether this device has seen the "how it works" demo is a device fact,
// set the way the demo kit sets every room's (demo-kit/demo-seen.ts). It
// lives here so the ways in (home-entry.ts) can say the demo plays by
// itself without loading the room.
//
// Built on first read, not on import, so nothing at this module's top
// level touches storage.

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import type { ExerciseLevel } from './exercise-level'
import { EXERCISE_LEVELS } from './exercise-level'

export const HOME_NOTE_BESTS_KEY = 'mp_home_note_bests'
/** Where the demo's seen flag lives: on this device only. */
export const HOME_NOTE_DEMO_SEEN_KEY = 'mp_home_note_demo_seen'

/** A level's best run. */
export interface HomeNoteBest {
  /** Rounds found. */
  readonly found: number
  /** Rounds in the run. */
  readonly rounds: number
  /** The found rounds' mean time to home, s. */
  readonly seconds: number
  readonly at: number
}

export type HomeNoteBestTable = Partial<Record<ExerciseLevel, HomeNoteBest>>

function isBest(value: unknown): value is HomeNoteBest {
  if (typeof value !== 'object' || value === null) return false
  const best = value as Record<string, unknown>
  const count = (n: unknown): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0
  return (
    count(best.found) &&
    count(best.rounds) &&
    best.found <= best.rounds &&
    typeof best.seconds === 'number' &&
    Number.isFinite(best.seconds) &&
    best.seconds >= 0 &&
    typeof best.at === 'number' &&
    Number.isFinite(best.at)
  )
}

export function isHomeNoteBestTable(
  value: unknown,
): value is HomeNoteBestTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.entries(value).every(
    ([level, best]) =>
      EXERCISE_LEVELS.includes(level as ExerciseLevel) && isBest(best),
  )
}

/** `run` beats `previous`: more found, or as many found sooner. */
export function homeNoteBeats(
  run: HomeNoteBest,
  previous: HomeNoteBest | null,
): boolean {
  if (run.found === 0) return false
  if (previous === null) return true
  if (run.found !== previous.found) return run.found > previous.found
  return run.seconds < previous.seconds
}

let table: Signal<HomeNoteBestTable> | undefined

function bests(): Signal<HomeNoteBestTable> {
  table ??= createPersistedSignal<HomeNoteBestTable>(
    HOME_NOTE_BESTS_KEY,
    {},
    { validator: isHomeNoteBestTable },
  )
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
