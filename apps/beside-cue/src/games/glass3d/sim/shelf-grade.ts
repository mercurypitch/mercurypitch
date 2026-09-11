// The Top Shelf's grade, in the Line's units.
// ============================================================
//
// Two units, no points, and the vocal one leads, as on the Line
// (docs/games/top-shelf.md §7, sorting-line.md §9). Per shelf, the
// first leap aimed at it decides FIRST-TRY: whether it landed (D6).
// OVERSHOOT is how far past the ask the leap that landed was sung, in
// cents -- `(sung - ask) * 100` when that is positive, and 0 for a
// landing within the catch, which is at most half a semitone flat. A
// sharp landing is a first try with a cost, not a miss.
//
// A LEAP IS AIMED AT A SHELF when it reaches the riser: his mitt gets
// to it on the way up, or he lands on the shelf, which needs the same.
// A hop sung in the open, a metre short, is aimed at nothing -- a fifth
// carries 0.62 m (§11, 6b) -- and grading it would mark the first
// sentence of room 1 wrong for where he stood, not for what was sung.
// The stage decides that; this only counts what it is handed.
//
// It is the Line's accumulator in everything but the input: the same
// `qualityFromCents` at the same `LINE_SCORE`, so a whole semitone
// sharp is worth nothing, the same medal, and nothing gated on it.

import { qualityFromCents } from '../../glass/score'
import { LINE_SCORE } from './line-grade'

export interface ShelfGrade {
  /** Leaps aimed at this shelf so far. */
  readonly leaps: number
  /** Whether the first of them landed. A shelf with no leap graded at
   * all counts, as the Line's `NO_STOPS` does: nothing was missed. */
  readonly firstTry: boolean
  /** Cents past the ask the landing leap was sung: 0 within the catch,
   * and 0 until a leap lands. */
  readonly overshootCents: number
  /** Whether a leap has landed him on it. */
  readonly landed: boolean
}

export const NO_LEAPS: ShelfGrade = {
  leaps: 0,
  firstTry: true,
  overshootCents: 0,
  landed: false,
}

/** Cents past the ask (§7), and only past it: flat within the catch
 * lands for nothing, and flat beyond it never lands at all. */
export const overshootOf = (interval: number, ask: number): number =>
  Math.max(0, (interval - ask) * 100)

/**
 * One leap at a shelf's riser: sung `interval` semitones above the
 * reference, for an ask of `ask`, and whether it landed. Once he is on,
 * the shelf's grade is kept -- "past the shelf" is the landing leap's.
 */
export const withLeap = (
  g: ShelfGrade,
  interval: number,
  ask: number,
  landed: boolean,
): ShelfGrade => {
  if (g.landed) return g
  return {
    leaps: g.leaps + 1,
    firstTry: g.leaps === 0 ? landed : g.firstTry,
    overshootCents: landed ? overshootOf(interval, ask) : 0,
    landed,
  }
}

/** Per shelf, `clamp01(1 - overshoot / 100)`: `qualityFromCents` at the
 * Line's zero, a semitone sharp. */
export const shelfQuality = (g: ShelfGrade): number =>
  qualityFromCents(g.overshootCents, LINE_SCORE)

/** What a room keeps of a run. The best run's, by `pct`. */
export interface ShelfStats {
  readonly pct: number
  /** Mean overshoot across the room's shelves, in cents. */
  readonly overshootCents: number
  readonly firstTry: number
  /** Shelves above the floor: the leaps the room asks for. */
  readonly shelves: number
}

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length

export const statsOf = (grades: readonly ShelfGrade[]): ShelfStats => ({
  pct: Math.round(
    Math.min(100, Math.max(0, mean(grades.map(shelfQuality)) * 100)),
  ),
  overshootCents: Math.round(mean(grades.map((g) => g.overshootCents))),
  firstTry: grades.filter((g) => g.firstTry).length,
  shelves: grades.length,
})

/** The room card: `18¢ past the shelf · 3 of 4 first time`. */
export const roomLine = (s: ShelfStats): string =>
  `${String(s.overshootCents)}¢ past the shelf · ${String(s.firstTry)} of ${String(s.shelves)} first time`

/** The walk card: `22¢ past the shelf on average · 8 of 9 first time`,
 * over every room's best, weighted by its shelves. */
export const walkLine = (rooms: readonly ShelfStats[]): string => {
  const shelves = rooms.reduce((n, r) => n + r.shelves, 0)
  if (shelves === 0) return ''
  const cents = Math.round(
    rooms.reduce((n, r) => n + r.overshootCents * r.shelves, 0) / shelves,
  )
  const first = rooms.reduce((n, r) => n + r.firstTry, 0)
  return `${String(cents)}¢ past the shelf on average · ${String(first)} of ${String(shelves)} first time`
}
