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
// picker would otherwise load the room to draw its card). On this device
// only, for now: the `mp_` prefix keeps the keys out of the settings sync.
//
// Whether this device has seen the "how it works" demo is a device fact,
// set the way the demo kit sets every room's (demo-kit/demo-seen.ts). It
// lives here so the ways in (harmony-entry.ts) can say the demo plays by
// itself without loading the room.
//
// Built on first read, not on import, so nothing at this module's top
// level touches storage.

import type { Signal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import type { ExerciseLevel } from './exercise-level'
import { EXERCISE_LEVELS } from './exercise-level'

export const HARMONY_BESTS_KEY = 'mp_harmony_bests'
/** Where the way the singer sings is kept. */
export const HARMONY_WAY_KEY = 'mp_harmony_way'
/** Where the demo's seen flag lives: on this device only. */
export const HARMONY_DEMO_SEEN_KEY = 'mp_harmony_demo_seen'

/** Taking turns with Merc, or singing with him in headphones. */
export type HarmonyWayId = 'turns' | 'together'

/** A level's best run. */
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

export type HarmonyBestTable = Partial<Record<ExerciseLevel, HarmonyBest>>

function isBest(value: unknown): value is HarmonyBest {
  if (typeof value !== 'object' || value === null) return false
  const best = value as Record<string, unknown>
  const count = (n: unknown): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0
  return (
    count(best.inHarmony) &&
    count(best.lines) &&
    best.inHarmony <= best.lines &&
    count(best.notesLanded) &&
    count(best.notes) &&
    best.notesLanded <= best.notes &&
    typeof best.at === 'number' &&
    Number.isFinite(best.at)
  )
}

export function isHarmonyBestTable(value: unknown): value is HarmonyBestTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return Object.entries(value).every(
    ([level, best]) =>
      EXERCISE_LEVELS.includes(level as ExerciseLevel) && isBest(best),
  )
}

/** `run` beats `previous`: more lines in harmony, or as many with more notes. */
export function harmonyBeats(
  run: HarmonyBest,
  previous: HarmonyBest | null,
): boolean {
  if (run.notesLanded === 0) return false
  if (previous === null) return true
  if (run.inHarmony !== previous.inHarmony) {
    return run.inHarmony > previous.inHarmony
  }
  return run.notesLanded > previous.notesLanded
}

let table: Signal<HarmonyBestTable> | undefined
let way: Signal<HarmonyWayId> | undefined

function bests(): Signal<HarmonyBestTable> {
  table ??= createPersistedSignal<HarmonyBestTable>(
    HARMONY_BESTS_KEY,
    {},
    { validator: isHarmonyBestTable },
  )
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
