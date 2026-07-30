// ============================================================
// Ear Report maths — matrix building and the ranked confusions.
// ============================================================

import { describe, expect, it } from 'vitest'
import { buildConfusionMatrix, topConfusions } from './confusion-report'

const LABELS = ['deg-1', 'deg-2', 'deg-3']

describe('buildConfusionMatrix', () => {
  it('places counts at [expected][answered]', () => {
    const matrix = buildConfusionMatrix(
      { 'deg-1>deg-2': 3, 'deg-2>deg-1': 1 },
      LABELS,
    )
    expect(matrix.cells[0][1]).toBe(3)
    expect(matrix.cells[1][0]).toBe(1)
    expect(matrix.cells[2][2]).toBe(0)
    expect(matrix.maxCount).toBe(3)
    expect(matrix.totalMisses).toBe(4)
  })

  it('drops pairs naming unknown labels instead of crashing', () => {
    const matrix = buildConfusionMatrix(
      { 'deg-1>deg-2': 2, 'old-label>deg-1': 5, garbage: 9 },
      LABELS,
    )
    expect(matrix.totalMisses).toBe(2)
  })

  it('is all zeros for a clean record', () => {
    const matrix = buildConfusionMatrix({}, LABELS)
    expect(matrix.maxCount).toBe(0)
    expect(matrix.totalMisses).toBe(0)
    expect(matrix.cells.flat().every((c) => c === 0)).toBe(true)
  })
})

describe('topConfusions', () => {
  const data = { 'deg-4>deg-5': 7, 'deg-7>deg-1': 3, 'deg-2>deg-3': 1 }

  it('ranks by count and honours the limit', () => {
    const top = topConfusions(data, { limit: 2 })
    expect(top).toHaveLength(2)
    expect(top[0]).toMatchObject({
      expected: 'deg-4',
      answered: 'deg-5',
      count: 7,
    })
    expect(top[1]).toMatchObject({ expected: 'deg-7', count: 3 })
  })

  it('computes the rate against the item’s attempts', () => {
    const top = topConfusions(data, {
      attemptsFor: (expected) => (expected === 'deg-4' ? 20 : 0),
    })
    expect(top[0].rate).toBeCloseTo(7 / 20, 6)
    // No attempts known → rate is unknown, not zero.
    expect(top[1].rate).toBeNull()
  })

  it('caps a stale-attempts rate at 100%', () => {
    const top = topConfusions({ 'deg-4>deg-5': 9 }, { attemptsFor: () => 4 })
    expect(top[0].rate).toBe(1)
  })

  it('ignores zero counts and malformed keys', () => {
    expect(topConfusions({ 'deg-1>deg-2': 0, junk: 5 })).toHaveLength(0)
  })
})
