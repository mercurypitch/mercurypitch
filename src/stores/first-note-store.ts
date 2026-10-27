// ============================================================
// First note's records — the best at each level
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
// On this device only, for now, as Home note's (home-note-store.ts): the
// `mp_` prefix keeps the key out of the settings sync.
//
// Built on first read, not on import, so nothing at this module's top
// level touches storage.

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import type { ExerciseLevel } from './exercise-level'
import { EXERCISE_LEVELS } from './exercise-level'

export const FIRST_NOTE_BESTS_KEY = 'mp_first_note_bests'

/** A level's best run. */
export interface FirstNoteBest {
  /** Entries the singer came in on the note. */
  readonly onNote: number
  /** Entries whose note they found, first try or not. */
  readonly found: number
  /** Entries in the run. */
  readonly rounds: number
  /** The entries' mean distance from their notes, cents. */
  readonly cents: number
  readonly at: number
}

export type FirstNoteBestTable = Partial<Record<ExerciseLevel, FirstNoteBest>>

function isBest(value: unknown): value is FirstNoteBest {
  if (typeof value !== 'object' || value === null) return false
  const best = value as Record<string, unknown>
  const count = (n: unknown): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0
  return (
    count(best.onNote) &&
    count(best.found) &&
    count(best.rounds) &&
    best.onNote <= best.rounds &&
    best.found <= best.rounds &&
    typeof best.cents === 'number' &&
    Number.isFinite(best.cents) &&
    best.cents >= 0 &&
    typeof best.at === 'number' &&
    Number.isFinite(best.at)
  )
}

export function isFirstNoteBestTable(
  value: unknown,
): value is FirstNoteBestTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.entries(value).every(
    ([level, best]) =>
      EXERCISE_LEVELS.includes(level as ExerciseLevel) && isBest(best),
  )
}

/** `run` beats `previous`: more on the note, then more found, then closer. */
export function firstNoteBeats(
  run: FirstNoteBest,
  previous: FirstNoteBest | null,
): boolean {
  if (run.found === 0 && run.onNote === 0) return false
  if (previous === null) return true
  if (run.onNote !== previous.onNote) return run.onNote > previous.onNote
  if (run.found !== previous.found) return run.found > previous.found
  return run.cents < previous.cents
}

let table: Signal<FirstNoteBestTable> | undefined

function bests(): Signal<FirstNoteBestTable> {
  table ??= createPersistedSignal<FirstNoteBestTable>(
    FIRST_NOTE_BESTS_KEY,
    {},
    { validator: isFirstNoteBestTable },
  )
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

/** Drop the signal read so far: the next read takes storage as it is now. */
export function resetFirstNoteStoreForTests(): void {
  table = undefined
}
