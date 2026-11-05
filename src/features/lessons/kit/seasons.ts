// ============================================================
// Seasons — every season of Find Your Pitch, for what lists them all
// ============================================================
//
// Season 1's map is season.ts and each later season's is a module of its
// own (season-2.ts), so a lesson page carries only the seasons it draws.
// What lists every season reads them here: the hub (tools/learn-hub.ts),
// the site worker (src/lesson-gate.ts), the listings, the admin console and
// the tests. No lesson page imports this module, since it would carry every
// season's data on first paint: a Season 1 page loads Season 2 only when its
// explorer's Season 2 tab opens, and a Season 2 page carries its season
// itself (page-state.ts `carrySeason`).

import type { Lesson, Prereqs, Season } from './season'
import { SEASON_1 } from './season'
import { SEASON_2 } from './season-2'

/** Every season, in order. */
export const SEASONS: readonly Season[] = [SEASON_1, SEASON_2]

/** Every lesson of every season, in lesson order: the trailer, then Lessons 1 to 28. */
export const ALL_LESSONS: readonly Lesson[] = SEASONS.flatMap((s) => s.lessons)

/** Every lesson's direct prerequisites, across seasons. */
export const ALL_PREREQ: Prereqs = Object.assign(
  {},
  ...SEASONS.map((s) => s.prereq),
) as Prereqs

/** The season lesson `n` belongs to; undefined for a number no season holds. */
export function seasonOf(n: number): Season | undefined {
  return SEASONS.find((s) => s.lessons.some((L) => L.n === n))
}

/** Seasons `ns`, every season by default, as a heading names them: "Season 1", "Seasons 1 and 2". */
export function seasonsTitle(
  ns: readonly number[] = SEASONS.map((s) => s.n),
): string {
  if (ns.length === 1) return `Season ${ns[0]}`
  return `Seasons ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`
}

/** A topic's name in the words of lesson `n`'s own season: Season 2's T22 is not Season 1's. */
export function topicName(n: number, topic: string): string {
  return seasonOf(n)?.topics[topic] ?? topic
}
