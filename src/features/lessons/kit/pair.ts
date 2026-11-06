// ============================================================
// Pair — an interval's two notes, one after the other
// ============================================================
//
// Lesson 6's pair, moved into the kit for Lesson 23, where every interval
// plays as one (Lesson 23 WEB-SPEC, What the kit and the app still need,
// item 5): the first note 0.6 s, 0.15 s of quiet, then the second 0.8 s,
// 1.55 s in all, each note timed from the one press so nothing drifts
// (Lesson 6 FACTS 64). A missed round of Lesson 6's ear games plays it
// again slower, every length times `slower`. Lesson 6's page imports it from
// here, and Lesson 10's four words time their pairs by it.
//
// Pure: notes as MIDI numbers with their onsets and lengths, seconds.

/** A pair's two notes and the gap between them, s (Lesson 6 FACTS 64). */
export const PAIR = { first: 0.6, second: 0.8, gap: 0.15 } as const

/** A pair's length, s: 1.55. */
export const PAIR_SEC = PAIR.first + PAIR.gap + PAIR.second

/** One note of a pair: its MIDI number, its onset and its length, s. */
export interface PairNote {
  readonly midi: number
  readonly at: number
  readonly dur: number
}

/** Two notes one after the other, 0.6 s and 0.8 s, 0.15 s apart, times `slower`. */
export function pair(a: number, b: number, slower = 1): PairNote[] {
  return [
    { midi: a, at: 0, dur: PAIR.first * slower },
    {
      midi: b,
      at: (PAIR.first + PAIR.gap) * slower,
      dur: PAIR.second * slower,
    },
  ]
}
