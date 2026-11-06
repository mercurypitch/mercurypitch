// ============================================================
// Lesson 23 sounds — every fixed sound on the page, at FACTS 66 to 73's notes and timings
// ============================================================
//
// Written for the higher voice, C4 up to C5 with B3 below (FACTS 66), and
// Sing it's line in D up to D5 (FACTS 52); the staff toy, the words and
// Sing it sound them an octave lower on the bass staff, the learner's
// octave (`voiced`), and the cold open plays them as they are, for
// everyone, in Tavi's register (FACTS 8). A pair is Lesson 6's, 0.6 s,
// 0.15 s of quiet, then 0.8 s, 1.55 s in all (kit/pair.ts); two pairs are
// 0.5 s apart, 3.6 s; two notes together sound 1.5 s, and two such pairs
// back to back 3.0 s (FACTS 70). Each step's state and its plays are here,
// with the plays that wait for the cold open's choice (FACTS 1a, 70), the
// quick check's B3 and F4 (FACTS 73), and Sing it's line and its listening
// pair (FACTS 55, 57, 72).

import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import type { RunNote } from '@/features/lessons/kit/run'
import type { IntervalPair, IntervalPlay, IntervalState, } from '@/features/lessons/kit/staff-interval'
import { TOGETHER_SEC } from '@/features/lessons/kit/staff-interval'
import type { Clef } from '@/features/lessons/kit/staff-places'
import { midiOf } from '@/features/lessons/kit/staff-places'

/** A note written for the higher voice. */
export const note = (letter: Letter, alter = 0, octave = 4): Spelled => ({
  letter,
  alter,
  octave,
})

/** A note written for the higher voice, as the learner's staff sounds it: an octave lower on the bass staff. */
export const voiced = (n: Spelled, clef: Clef): Spelled =>
  clef === 'bass' ? { ...n, octave: n.octave - 1 } : n

/** A time to the millisecond, so the onsets add up as the facts give them. */
const ms = (t: number): number => Math.round(t * 1000) / 1000

const C4 = note('C')
const C5 = note('C', 0, 5)

/** Each step's state: the top note it opens on, unwritten, Step 3's Fold and Step 4's B lane and ring (WEB-SPEC, Toys 1). */
export const STEP_STATE: Readonly<Record<number, IntervalState>> = {
  1: { top: note('E') },
  2: { top: note('F') },
  3: { top: note('G'), fold: true },
  4: { top: note('E'), bLane: true, ring: true },
}

/** Free play's state: every control, Fold and the ring among them, with no B lane (WEB-SPEC, Toys 1, state 5). */
export const FREE_STATE: IntervalState = {
  top: note('E'),
  ring: true,
  fold: true,
}

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

/** Quick check question 4's interval: B3 and F4 together, 1.5 s, for everyone, the same on every visit (FACTS 73, 78). */
export const QUIZ_TRITONE: readonly RunNote[] = [
  { t: 0, midi: midiOf(note('B', 0, 3)), dur: TOGETHER_SEC },
  { t: 0, midi: midiOf(note('F')), dur: TOGETHER_SEC },
]

/** Sing it's do, so, then so, do in D, written for the higher voice: D4, A4, A4 and D5 (FACTS 52). */
export const SING_NOTES: readonly Spelled[] = [
  note('D'),
  note('A'),
  note('A'),
  note('D', 0, 5),
]

/** Each half's first note held 1.15 s, then a 0.05 s glide; its second held 1.8 s; a breath of 1.0 s between the halves (FACTS 55). */
export const SING_HOLD = 1.15
export const SING_GLIDE = 0.05
export const SING_TOP = 1.8
export const SING_BREATH = 1

/** One half, do up to so or so up to do: 3.0 s. */
export const SING_HALF = ms(SING_HOLD + SING_GLIDE + SING_TOP)

/** When each of the four notes starts, s: 0 and 1.2, then after the breath 4.0 and 5.2. */
export const SING_ONSETS: readonly number[] = [0, 1].flatMap((half) => {
  const at = half * (SING_HALF + SING_BREATH)
  return [ms(at), ms(at + SING_HOLD + SING_GLIDE)]
})

/** Merc's notes, and the guide's sweep after the count-in: 7.0 s (FACTS 55, 72). */
export const SING_SEC = ms(2 * SING_HALF + SING_BREATH)

/** Then just listen: ti and fa together, C♯ and G in D, then do and mi, D and F♯, 1.5 s each, written for the higher voice (FACTS 57, 72). */
export const LISTEN_PAIRS: readonly IntervalPair[] = [
  { lo: note('C', 1), hi: note('G'), together: true },
  { lo: note('D'), hi: note('F', 1), together: true },
]
