// ============================================================
// Lesson 23 sounds tests — each step's state and plays, at FACTS 66 to 73's notes and lengths
// ============================================================

import { describe, expect, it } from 'vitest'
// the staff toy's module reads the motion setting as it loads
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { intervalOf, nameOf } from '@/features/lessons/kit/intervals'
import { signName } from '@/features/lessons/kit/notes'
import { playLength } from '@/features/lessons/kit/staff-interval'
import { FREE_STATE, HELD_PLAYS, STEP_PLAYS, STEP_STATE } from './sounds'

/** Each play's pairs, in signs, with each one's interval. */
const heard = (key: string): string[] =>
  STEP_PLAYS[key].pairs.map((p) => {
    const iv = intervalOf(p.lo, p.hi)
    return `${signName(p.lo)}-${signName(p.hi)} ${iv === null ? 'none' : nameOf(iv)}`
  })

describe("the steps' plays", () => {
  it('sound the intervals LESSON.md names, written for the higher voice', () => {
    // Assert: FACTS 66, 70
    expect(heard('c-e')).toEqual(['C4-E4 a major third'])
    expect(heard('c-eb')).toEqual(['C4-E♭4 a minor third'])
    expect(heard('c-f-fs')).toEqual([
      'C4-F4 a perfect fourth',
      'C4-F♯4 an augmented fourth, a tritone',
    ])
    expect(heard('c-g-gb')).toEqual([
      'C4-G4 a perfect fifth',
      'C4-G♭4 a diminished fifth, a tritone',
    ])
    expect(heard('fold-g')).toEqual([
      'C4-G4 a perfect fifth',
      'G4-C5 a perfect fourth',
    ])
    expect(heard('fold-e')).toEqual([
      'C4-E4 a major third',
      'E4-C5 a minor sixth',
    ])
    expect(heard('b-f')).toEqual([
      'B3-F4 a diminished fifth, a tritone',
      'C4-E4 a major third',
    ])
  })

  it('last 1.55 s a pair, 3.6 s for two, and 3.0 s for two pairs together', () => {
    // Assert: FACTS 70
    const lengths = Object.fromEntries(
      Object.entries(STEP_PLAYS).map(([k, p]) => [k, playLength(p)]),
    )
    expect(lengths['c-e']).toBeCloseTo(1.55, 9)
    expect(lengths['c-eb']).toBeCloseTo(1.55, 9)
    for (const k of ['c-f-fs', 'c-g-gb', 'fold-g', 'fold-e'])
      expect(lengths[k], k).toBeCloseTo(3.6, 9)
    expect(lengths['b-f']).toBeCloseTo(3.0, 9)
  })

  it("hold back every play but Step 1's two until the choice (FACTS 1a)", () => {
    expect([...HELD_PLAYS].sort()).toEqual(
      Object.keys(STEP_PLAYS)
        .filter((k) => k !== 'c-e' && k !== 'c-eb')
        .sort(),
    )
  })

  it('fold only the two plays Step 3 folds', () => {
    expect(
      Object.entries(STEP_PLAYS)
        .filter(([, p]) => p.fold === true)
        .map(([k]) => k),
    ).toEqual(['fold-g', 'fold-e'])
  })
})

describe('the states', () => {
  it('open each step on its top note, Fold in Step 3, the B lane and the ring in Step 4, and free play with Fold and the ring and no B lane', () => {
    // Assert: WEB-SPEC, Toys 1
    const flags = (st: (typeof STEP_STATE)[number]) => [
      st.fold === true,
      st.bLane === true,
      st.ring === true,
    ]
    expect(
      [1, 2, 3, 4].map((n) => [
        signName(STEP_STATE[n].top),
        ...flags(STEP_STATE[n]),
      ]),
    ).toEqual([
      ['E4', false, false, false],
      ['F4', false, false, false],
      ['G4', true, false, false],
      ['E4', false, true, true],
    ])
    expect(flags(FREE_STATE)).toEqual([true, false, true])
  })
})
