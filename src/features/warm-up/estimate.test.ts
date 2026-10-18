// ============================================================
// The minutes on the path's chip, at each level
// ============================================================

import { describe, expect, it } from 'vitest'
import { EXERCISE_ECHO_STARS, EXERCISE_LIP_ROLL_BAY, EXERCISE_LONG_NOTE_LANTERN, EXERCISE_NG_SLIDES_BRIDGE, } from '@/lib/domain/exercise-contracts'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { stopSeconds, warmUpMinutes, warmUpSeconds } from './estimate'
import type { WarmUpPlan } from './warm-up-plan'
import { OWNER_ROUTINE } from './warm-up-plan'

const LEVELS: readonly ExerciseLevel[] = ['learning', 'singer', 'professional']

describe('a stop at each level', () => {
  // A glide run: the count-in (the 1 s tone and a breath), then every
  // arch (up, top, down, landing) and, between arches, the pause and a
  // breath (glide-presets.ts).
  it('Lip roll: three waves, as its planner times them', () => {
    // Learning: 2.8 + 3 x 5.6 + 2 x 2.8. Singer: 2.5 + 3 x 4.6 + 2 x 2.5.
    // Professional (no pause): 2.2 + 3 x 3.6 + 2 x 1.2.
    const seconds = LEVELS.map((level) =>
      stopSeconds(EXERCISE_LIP_ROLL_BAY, level),
    )
    expect(seconds[0]).toBeCloseTo(25.2, 6)
    expect(seconds[1]).toBeCloseTo(21.3, 6)
    expect(seconds[2]).toBeCloseTo(15.4, 6)
  })

  it('Ng slides: five slides, as its planner times them', () => {
    // Learning: 2.6 + 5 x 4.0 + 4 x 2.6. Singer: 2.3 + 5 x 3.2 + 4 x 2.3.
    // Professional: 2.0 + 5 x 2.4 + 4 x 1.0.
    const seconds = LEVELS.map((level) =>
      stopSeconds(EXERCISE_NG_SLIDES_BRIDGE, level),
    )
    expect(seconds[0]).toBeCloseTo(33.0, 6)
    expect(seconds[1]).toBeCloseTo(27.5, 6)
    expect(seconds[2]).toBeCloseTo(18.0, 6)
  })

  it("Long note and Echo's three phrases: the plan's numbers, at every level", () => {
    for (const level of LEVELS) {
      expect(stopSeconds(EXERCISE_LONG_NOTE_LANTERN, level)).toBe(25)
      expect(stopSeconds(EXERCISE_ECHO_STARS, level)).toBeCloseTo(22.2, 6)
    }
  })
})

describe("the owner's routine", () => {
  it('reads "3 min" at every level', () => {
    // Each stop's singing and 12 s around it: 105.4 + 48, 96 + 48, 80.6 + 48.
    const seconds = LEVELS.map((level) => warmUpSeconds(OWNER_ROUTINE, level))
    expect(seconds[0]).toBeCloseTo(153.4, 6)
    expect(seconds[1]).toBeCloseTo(144.0, 6)
    expect(seconds[2]).toBeCloseTo(128.6, 6)
    expect(LEVELS.map((level) => warmUpMinutes(OWNER_ROUTINE, level))).toEqual([
      3, 3, 3,
    ])
  })
})

describe('another routine', () => {
  it('counts its own stops, and nothing for the song', () => {
    const twice: WarmUpPlan = {
      id: 'twice',
      stops: [
        ...OWNER_ROUTINE.stops.slice(0, 4),
        ...OWNER_ROUTINE.stops.slice(0, 4),
        { kind: 'song', opens: 'song-list' },
      ],
    }
    const one: WarmUpPlan = {
      id: 'one',
      stops: [{ kind: 'room', id: EXERCISE_LONG_NOTE_LANTERN }],
    }
    expect(warmUpSeconds(twice, 'learning')).toBeCloseTo(306.8, 6)
    expect(warmUpMinutes(twice, 'learning')).toBe(6)
    expect(warmUpSeconds(one, 'singer')).toBe(37)
    expect(warmUpMinutes(one, 'singer')).toBe(1)
  })
})
