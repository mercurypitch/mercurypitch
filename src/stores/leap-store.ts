// ============================================================
// Leap's records — the best at each level
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
// On this device only, for now: the `mp_` prefix keeps the key out of the
// settings sync, as Home note's and First note's are.
//
// Built on first read, not on import, so nothing at this module's top
// level touches storage.

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import type { ExerciseLevel } from './exercise-level'
import { EXERCISE_LEVELS } from './exercise-level'

export const LEAP_BESTS_KEY = 'mp_leap_bests'

/** A level's best run. */
export interface LeapBest {
  /** Leaps landed. */
  readonly landed: number
  /** Leaps in the run. */
  readonly rounds: number
  /** The landed leaps' mean time from Merc's note to the target, s. */
  readonly seconds: number
  readonly at: number
}

export type LeapBestTable = Partial<Record<ExerciseLevel, LeapBest>>

function isBest(value: unknown): value is LeapBest {
  if (typeof value !== 'object' || value === null) return false
  const best = value as Record<string, unknown>
  const count = (n: unknown): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0
  return (
    count(best.landed) &&
    count(best.rounds) &&
    best.landed <= best.rounds &&
    typeof best.seconds === 'number' &&
    Number.isFinite(best.seconds) &&
    best.seconds >= 0 &&
    typeof best.at === 'number' &&
    Number.isFinite(best.at)
  )
}

export function isLeapBestTable(value: unknown): value is LeapBestTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.entries(value).every(
    ([level, best]) =>
      EXERCISE_LEVELS.includes(level as ExerciseLevel) && isBest(best),
  )
}

/** `run` beats `previous`: more landed, or as many landed sooner. */
export function leapBeats(run: LeapBest, previous: LeapBest | null): boolean {
  if (run.landed === 0) return false
  if (previous === null) return true
  if (run.landed !== previous.landed) return run.landed > previous.landed
  return run.seconds < previous.seconds
}

let table: Signal<LeapBestTable> | undefined

function bests(): Signal<LeapBestTable> {
  table ??= createPersistedSignal<LeapBestTable>(
    LEAP_BESTS_KEY,
    {},
    { validator: isLeapBestTable },
  )
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

/** Drop the signal read so far: the next read takes storage as it is now. */
export function resetLeapStoreForTests(): void {
  table = undefined
}
