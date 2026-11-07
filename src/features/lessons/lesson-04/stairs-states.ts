// ============================================================
// Lesson 4 staircase states — what the staircase offers in each step, and in free play
// ============================================================
//
// The kit's staircase (kit/stairs-toy.ts) in the page's five steps and free
// play (WEB-SPEC, Toys 1): on C with the step sizes, where Play up earns the
// gold on the two short steps; Group; the slide with White keys only; the
// names switch; Stop on ti and Land on do. Steps 1 and 2 stand on C, and a
// key of the strip plays its note there; from step 3 on, a key makes do.
// Free play has every control. The starts run C4 to B4.

import type { StairsRange } from '@/features/lessons/kit/stairs-geometry'
import type { StairsState } from '@/features/lessons/kit/stairs-toy'

/** A step of the deck, or the Wrap's free play, which has every control. */
export type StairsStep = 1 | 2 | 3 | 4 | 5 | 'free'

const C4 = 60

/** The starts the staircase slides through: C4 to B4. */
export const STARTS: StairsRange = { lo: C4, hi: 71 }

const NONE: StairsState = {
  group: false,
  white: false,
  slide: false,
  names: false,
  stop: false,
  keysPlay: true,
  gold: false,
}

export const STATES: Readonly<Record<StairsStep, StairsState>> = {
  1: { ...NONE, gold: true, standOn: C4 },
  2: { ...NONE, group: true, gold: true, standOn: C4 },
  3: { ...NONE, white: true, slide: true, keysPlay: false },
  4: { ...NONE, names: true, slide: true, keysPlay: false },
  5: { ...NONE, stop: true, slide: true, keysPlay: false },
  free: {
    group: true,
    white: true,
    slide: true,
    names: true,
    stop: true,
    keysPlay: false,
    gold: false,
  },
}
