// ============================================================
// Lesson 23 sounds — every fixed sound on the page, at FACTS 66 to 73's notes and timings
// ============================================================
//
// Written for the higher voice, C4 up to C5 with B3 below (FACTS 66); the
// staff toy sounds them an octave lower on the bass staff, the learner's
// octave, and the cold open plays them as they are, for everyone, in
// Tavi's register (FACTS 8). A pair is Lesson 6's, 0.6 s, 0.15 s of quiet,
// then 0.8 s, 1.55 s in all (kit/pair.ts); two pairs are 0.5 s apart,
// 3.6 s; two notes together sound 1.5 s, and two such pairs back to back
// 3.0 s (FACTS 70). Each step's state and its plays are here, with the
// plays that wait for the cold open's choice (FACTS 1a, 70).

import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import type { IntervalPlay, IntervalState, } from '@/features/lessons/kit/staff-interval'

/** A note written for the higher voice. */
export const note = (letter: Letter, alter = 0, octave = 4): Spelled => ({
  letter,
  alter,
  octave,
})

const C4 = note('C')
const C5 = note('C', 0, 5)

/** Each step's state: the top note it opens on, unwritten, and Step 4's B lane and ring (WEB-SPEC, Toys 1). */
export const STEP_STATE: Readonly<Record<number, IntervalState>> = {
  1: { top: note('E') },
  2: { top: note('F') },
  3: { top: note('G') },
  4: { top: note('E'), bLane: true, ring: true },
}

/** Free play's state: every control, the ring among them, with no B lane (WEB-SPEC, Toys 1, state 5). */
export const FREE_STATE: IntervalState = { top: note('E'), ring: true }

/** Each step's plays, by their buttons' keys (LESSON.md; FACTS 70). */
export const STEP_PLAYS: Readonly<Record<string, IntervalPlay>> = {
  'c-e': { pairs: [{ lo: C4, hi: note('E') }] },
  'c-eb': { pairs: [{ lo: C4, hi: note('E', -1) }] },
  'c-f-fs': {
    pairs: [
      { lo: C4, hi: note('F') },
      { lo: C4, hi: note('F', 1) },
    ],
  },
  'c-g-gb': {
    pairs: [
      { lo: C4, hi: note('G') },
      { lo: C4, hi: note('G', -1) },
    ],
  },
  'fold-g': {
    pairs: [
      { lo: C4, hi: note('G') },
      { lo: note('G'), hi: C5 },
    ],
    fold: true,
  },
  'fold-e': {
    pairs: [
      { lo: C4, hi: note('E') },
      { lo: note('E'), hi: C5 },
    ],
    fold: true,
  },
  'b-f': {
    pairs: [
      { lo: note('B', 0, 3), hi: note('F'), together: true },
      { lo: C4, hi: note('E'), together: true },
    ],
  },
}

/** The plays that wait for the cold open's choice: every one but Step 1's (FACTS 1a, 70). */
export const HELD_PLAYS: readonly string[] = [
  'c-f-fs',
  'c-g-gb',
  'fold-g',
  'fold-e',
  'b-f',
]
