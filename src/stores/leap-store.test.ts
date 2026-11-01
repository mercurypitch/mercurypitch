import { beforeEach, describe, expect, it } from 'vitest'
import { isLeapBestTable, LEAP_BESTS_KEY, leapBeats, leapBest, recordLeapBest, resetLeapStoreForTests, } from './leap-store'

const best = (landed: number, seconds: number) => ({
  landed,
  rounds: 6,
  seconds,
  at: 1,
})

describe("Leap's bests", () => {
  beforeEach(() => {
    localStorage.removeItem(LEAP_BESTS_KEY)
    resetLeapStoreForTests()
  })

  it('beats on more landed, then on quicker', () => {
    expect(leapBeats(best(0, 0.4), null)).toBe(false)
    expect(leapBeats(best(1, 2), null)).toBe(true)
    expect(leapBeats(best(5, 1), best(4, 0.5))).toBe(true)
    expect(leapBeats(best(4, 0.4), best(4, 0.5))).toBe(true)
    expect(leapBeats(best(4, 0.6), best(4, 0.5))).toBe(false)
  })

  it('keeps a best per level, and says when it improved', () => {
    expect(recordLeapBest('singer', best(3, 0.9))).toEqual({
      previous: null,
      improved: false,
    })
    expect(recordLeapBest('singer', best(4, 0.9)).improved).toBe(true)
    expect(recordLeapBest('singer', best(2, 0.3)).improved).toBe(false)
    expect(leapBest('singer')?.landed).toBe(4)
    expect(leapBest('learning')).toBeNull()
  })

  it('reads back only a table it would write', () => {
    expect(isLeapBestTable({ singer: best(3, 0.5) })).toBe(true)
    expect(isLeapBestTable({ maestro: best(3, 0.5) })).toBe(false)
    expect(isLeapBestTable({ singer: { ...best(3, 0.5), landed: 9 } })).toBe(
      false,
    )
    expect(isLeapBestTable([])).toBe(false)
  })
})
