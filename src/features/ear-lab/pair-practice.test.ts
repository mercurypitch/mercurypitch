// A pair practice's questions: each of the two as often as the other, in
// an order the last question does not give away. A lesson's set of more
// than two is asked the same way.

import { describe, expect, it } from 'vitest'
import { balancedOrder, PAIR_PRACTICE_ROUNDS, pairOrder } from './pair-practice'

/** A seeded generator, so each order is the same on every run. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 48271) % 2147483647
    return state / 2147483647
  }
}

const count = (order: readonly string[], id: string): number =>
  order.filter((entry) => entry === id).length

describe('a pair practice', () => {
  it('asks each of the two equally often', () => {
    const order = pairOrder(['fa', 'sol'], PAIR_PRACTICE_ROUNDS, seeded(7))
    expect(order).toHaveLength(PAIR_PRACTICE_ROUNDS)
    expect(count(order, 'fa')).toBe(PAIR_PRACTICE_ROUNDS / 2)
    expect(count(order, 'sol')).toBe(PAIR_PRACTICE_ROUNDS / 2)
  })

  it('leaves an odd round to a coin', () => {
    const order = pairOrder(['fa', 'sol'], 7, seeded(11))
    expect(order).toHaveLength(7)
    expect([3, 4]).toContain(count(order, 'fa'))
  })

  it('shuffles, rather than taking turns', () => {
    const alternating = (order: readonly string[]): boolean =>
      order.every((entry, i) => i === 0 || entry !== order[i - 1])
    const orders = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
      pairOrder(['fa', 'sol'], PAIR_PRACTICE_ROUNDS, seeded(seed)).join(' '),
    )
    // Strict turns would give every answer after the first away.
    expect(
      orders.filter((order) => alternating(order.split(' '))),
    ).toHaveLength(0)
    expect(new Set(orders).size).toBeGreaterThan(4)
    // Either may come first.
    expect(new Set(orders.map((order) => order.split(' ')[0])).size).toBe(2)
  })
})

describe("a lesson's set", () => {
  it('asks each of four equally often in twelve rounds', () => {
    const order = balancedOrder(['P4', 'TT', 'P5', 'P8'], 12, seeded(3))

    expect(order).toHaveLength(12)
    expect(['P4', 'TT', 'P5', 'P8'].map((id) => count(order, id))).toEqual([
      3, 3, 3, 3,
    ])
  })

  it('gives the rounds left over to different items', () => {
    // Twelve rounds over eight charts: each once, and four of them twice.
    const charts = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const order = balancedOrder(charts, 12, seeded(5))

    expect(order).toHaveLength(12)
    expect(charts.map((id) => count(order, id)).sort()).toEqual([
      1, 1, 1, 1, 2, 2, 2, 2,
    ])
  })
})
