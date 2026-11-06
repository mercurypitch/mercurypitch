// ============================================================
// Pair tests — an interval's two notes, at Lesson 6's lengths
// ============================================================

import { describe, expect, it } from 'vitest'
import { PAIR, pair, PAIR_SEC } from './pair'

describe('pair', () => {
  it('plays the first note 0.6 s, then 0.15 s of quiet, then the second 0.8 s: 1.55 s', () => {
    // Assert: Lesson 6 FACTS 64; Lesson 23 FACTS 66
    expect(pair(60, 65)).toEqual([
      { midi: 60, at: 0, dur: 0.6 },
      { midi: 65, at: 0.75, dur: 0.8 },
    ])
    expect(PAIR).toEqual({ first: 0.6, second: 0.8, gap: 0.15 })
    expect(PAIR_SEC).toBeCloseTo(1.55, 9)
  })

  it('plays a missed round slower, every length times the same', () => {
    // Act
    const slow = pair(60, 67, 1.5)

    // Assert: Lesson 6 FACTS 67
    expect(slow.map((n) => n.at)).toEqual([0, 0.75 * 1.5])
    expect(slow.map((n) => n.dur)).toEqual([0.6 * 1.5, 0.8 * 1.5])
  })
})
