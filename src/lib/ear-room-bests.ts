// ============================================================
// The Ear rooms' bests: what each room's best is, and which is better
// ============================================================
//
// Home note, First note, Leap and Harmony each keep their best run at each
// level (level-bests.ts), as Echo does, and each table follows the account
// under a `pitchperfect_` key: a pull keeps the better best at each level,
// by the room's own rule, never the newest device's table. The rooms' stores
// record and read them (src/stores/<room>-store.ts); the settings sync names
// the merges (src/db/services/settings-progress.ts), in a build with the
// premium exercises only.
//
// Until 3 Nov 2026 they were kept on the device only, under `mp_` keys. A
// store adopts what a device kept there once, merged into the table that
// syncs (level-bests.ts, adoptDeviceBests), and lets the old key go.
//
// Nothing here runs on import (the merges are functions, not calls), so a
// build without the premium exercises, whose settings sync names none of
// them, drops the module whole.

import type { BestRules } from './level-bests'
import { isCount, isFiniteNumber, levelBestsOnPull } from './level-bests'

// ── Home note ──────────────────────────────────────────────

/** Where Home note's table lives, and the settings row it syncs as. */
export const HOME_NOTE_BESTS_KEY = 'pitchperfect_home_note_bests'
/** Where a device kept it before it synced. */
export const HOME_NOTE_DEVICE_BESTS_KEY = 'mp_home_note_bests'

/** A level's best Home note run. */
export interface HomeNoteBest {
  /** Rounds found. */
  readonly found: number
  /** Rounds in the run. */
  readonly rounds: number
  /** The found rounds' mean time to home, s. */
  readonly seconds: number
  readonly at: number
}

export const HOME_NOTE_BEST_RULES: BestRules<HomeNoteBest> = {
  isBest: (value): value is HomeNoteBest => {
    if (typeof value !== 'object' || value === null) return false
    const best = value as Record<string, unknown>
    return (
      isCount(best.found) &&
      isCount(best.rounds) &&
      best.found <= best.rounds &&
      isFiniteNumber(best.seconds) &&
      best.seconds >= 0 &&
      isFiniteNumber(best.at)
    )
  },
  // More found, or as many found sooner.
  beats: (run, previous) => {
    if (run.found === 0) return false
    if (previous === null) return true
    if (run.found !== previous.found) return run.found > previous.found
    return run.seconds < previous.seconds
  },
}

/** Home note's resolver for the settings pull (level-bests.ts). */
export function mergeHomeNoteBestsOnPull(
  local: string | null,
  cloud: string,
): string {
  return levelBestsOnPull(HOME_NOTE_BEST_RULES)(local, cloud)
}

// ── First note ─────────────────────────────────────────────

/** Where First note's table lives, and the settings row it syncs as. */
export const FIRST_NOTE_BESTS_KEY = 'pitchperfect_first_note_bests'
/** Where a device kept it before it synced. */
export const FIRST_NOTE_DEVICE_BESTS_KEY = 'mp_first_note_bests'

/** A level's best First note run. */
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

export const FIRST_NOTE_BEST_RULES: BestRules<FirstNoteBest> = {
  isBest: (value): value is FirstNoteBest => {
    if (typeof value !== 'object' || value === null) return false
    const best = value as Record<string, unknown>
    return (
      isCount(best.onNote) &&
      isCount(best.found) &&
      isCount(best.rounds) &&
      best.onNote <= best.rounds &&
      best.found <= best.rounds &&
      isFiniteNumber(best.cents) &&
      best.cents >= 0 &&
      isFiniteNumber(best.at)
    )
  },
  // More on the note, then more found, then closer.
  beats: (run, previous) => {
    if (run.found === 0 && run.onNote === 0) return false
    if (previous === null) return true
    if (run.onNote !== previous.onNote) return run.onNote > previous.onNote
    if (run.found !== previous.found) return run.found > previous.found
    return run.cents < previous.cents
  },
}

/** First note's resolver for the settings pull (level-bests.ts). */
export function mergeFirstNoteBestsOnPull(
  local: string | null,
  cloud: string,
): string {
  return levelBestsOnPull(FIRST_NOTE_BEST_RULES)(local, cloud)
}

// ── Leap ───────────────────────────────────────────────────

/** Where Leap's table lives, and the settings row it syncs as. */
export const LEAP_BESTS_KEY = 'pitchperfect_leap_bests'
/** Where a device kept it before it synced. */
export const LEAP_DEVICE_BESTS_KEY = 'mp_leap_bests'

/** A level's best Leap run. */
export interface LeapBest {
  /** Leaps landed. */
  readonly landed: number
  /** Leaps in the run. */
  readonly rounds: number
  /** The landed leaps' mean time from Merc's note to the target, s. */
  readonly seconds: number
  readonly at: number
}

export const LEAP_BEST_RULES: BestRules<LeapBest> = {
  isBest: (value): value is LeapBest => {
    if (typeof value !== 'object' || value === null) return false
    const best = value as Record<string, unknown>
    return (
      isCount(best.landed) &&
      isCount(best.rounds) &&
      best.landed <= best.rounds &&
      isFiniteNumber(best.seconds) &&
      best.seconds >= 0 &&
      isFiniteNumber(best.at)
    )
  },
  // More landed, or as many landed sooner.
  beats: (run, previous) => {
    if (run.landed === 0) return false
    if (previous === null) return true
    if (run.landed !== previous.landed) return run.landed > previous.landed
    return run.seconds < previous.seconds
  },
}

/** Leap's resolver for the settings pull (level-bests.ts). */
export function mergeLeapBestsOnPull(
  local: string | null,
  cloud: string,
): string {
  return levelBestsOnPull(LEAP_BEST_RULES)(local, cloud)
}

// ── Harmony ────────────────────────────────────────────────

/** Where Harmony's table lives, and the settings row it syncs as. */
export const HARMONY_BESTS_KEY = 'pitchperfect_harmony_bests'
/** Where a device kept it before it synced. */
export const HARMONY_DEVICE_BESTS_KEY = 'mp_harmony_bests'

/** A level's best Harmony run. */
export interface HarmonyBest {
  /** Lines sung in harmony. */
  readonly inHarmony: number
  /** Lines in the run. */
  readonly lines: number
  /** Notes sung in harmony, and all the run's notes. */
  readonly notesLanded: number
  readonly notes: number
  readonly at: number
}

export const HARMONY_BEST_RULES: BestRules<HarmonyBest> = {
  isBest: (value): value is HarmonyBest => {
    if (typeof value !== 'object' || value === null) return false
    const best = value as Record<string, unknown>
    return (
      isCount(best.inHarmony) &&
      isCount(best.lines) &&
      best.inHarmony <= best.lines &&
      isCount(best.notesLanded) &&
      isCount(best.notes) &&
      best.notesLanded <= best.notes &&
      isFiniteNumber(best.at)
    )
  },
  // More lines in harmony, or as many with more notes.
  beats: (run, previous) => {
    if (run.notesLanded === 0) return false
    if (previous === null) return true
    if (run.inHarmony !== previous.inHarmony) {
      return run.inHarmony > previous.inHarmony
    }
    return run.notesLanded > previous.notesLanded
  },
}

/** Harmony's resolver for the settings pull (level-bests.ts). */
export function mergeHarmonyBestsOnPull(
  local: string | null,
  cloud: string,
): string {
  return levelBestsOnPull(HARMONY_BEST_RULES)(local, cloud)
}

// ── For the settings sync ──────────────────────────────────

/** Each Ear room's synced table and its pull's resolver. */
export const EAR_ROOM_BESTS: readonly {
  readonly key: string
  readonly merge: (local: string | null, cloud: string) => string
}[] = [
  { key: HOME_NOTE_BESTS_KEY, merge: mergeHomeNoteBestsOnPull },
  { key: FIRST_NOTE_BESTS_KEY, merge: mergeFirstNoteBestsOnPull },
  { key: LEAP_BESTS_KEY, merge: mergeLeapBestsOnPull },
  { key: HARMONY_BESTS_KEY, merge: mergeHarmonyBestsOnPull },
]
