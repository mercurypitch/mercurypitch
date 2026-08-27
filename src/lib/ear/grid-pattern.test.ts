// ============================================================
// The Grid's stimulus — lattice shape, displacement rules.
// ============================================================

import { describe, expect, it } from 'vitest'
import { generateGridPattern, GRID_ANSWER_POSITIONS, GRID_CLICKS, GRID_IOI_S, gridPatternDuration, } from './grid-pattern'
import { rng } from './test-rng'

describe('generateGridPattern', () => {
  it('lays six clicks on the 500 ms lattice with one nudged', () => {
    const random = rng(4)
    for (let run = 0; run < 100; run++) {
      const pattern = generateGridPattern(40, random)
      expect(pattern.clickTimes).toHaveLength(GRID_CLICKS)

      let displaced = 0
      pattern.clickTimes.forEach((t, i) => {
        const base = i * GRID_IOI_S
        if (Math.abs(t - base) > 1e-9) {
          displaced++
          expect(i).toBe(pattern.displacedIndex)
          expect(Math.abs(t - base)).toBeCloseTo(0.04, 9)
        }
      })
      expect(displaced).toBe(1)
    }
  })

  it('never displaces the two clicks that establish the pulse', () => {
    const random = rng(7)
    for (let run = 0; run < 200; run++) {
      const pattern = generateGridPattern(30, random)
      expect(pattern.displacedIndex).toBeGreaterThanOrEqual(2)
      expect(
        (GRID_ANSWER_POSITIONS as readonly number[]).includes(
          pattern.displacedIndex,
        ),
      ).toBe(true)
    }
  })

  it('nudges early and late about equally often', () => {
    const random = rng(11)
    let early = 0
    for (let run = 0; run < 1000; run++) {
      if (generateGridPattern(30, random).shiftMs < 0) early++
    }
    expect(early).toBeGreaterThan(400)
    expect(early).toBeLessThan(600)
  })

  it('spreads the displaced position across all four slots', () => {
    const random = rng(13)
    const seen = new Set<number>()
    for (let run = 0; run < 200; run++) {
      seen.add(generateGridPattern(30, random).displacedIndex)
    }
    expect(seen.size).toBe(GRID_ANSWER_POSITIONS.length)
  })

  it('reports the duration up to the last click, shift included', () => {
    const random = rng(2)
    const pattern = generateGridPattern(200, random)
    const last = (GRID_CLICKS - 1) * GRID_IOI_S
    const duration = gridPatternDuration(pattern)
    expect(duration).toBeGreaterThanOrEqual(last - 0.2)
    expect(duration).toBeLessThanOrEqual(last + 0.2)
  })
})
