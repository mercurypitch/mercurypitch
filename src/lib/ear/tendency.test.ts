import { describe, expect, it } from 'vitest'
import { leaningWord, morePulling, PULL_BANK, pullOf, resolvesTo, } from './tendency'

describe('tendency', () => {
  it('ranks the leading tone hardest, the stable degrees at rest', () => {
    expect(pullOf(7)).toBeGreaterThan(pullOf(4))
    expect(pullOf(4)).toBeGreaterThan(pullOf(6))
    expect(pullOf(6)).toBe(pullOf(2))
    for (const stable of [1, 3, 5]) expect(pullOf(stable)).toBe(0)
    expect(resolvesTo(7)).toBe(8)
    expect(resolvesTo(4)).toBe(3)
    expect(resolvesTo(6)).toBe(5)
    expect(resolvesTo(2)).toBe(1)
    expect(resolvesTo(1)).toBe(1)
  })

  it('picks the harder lean of a pair, first on a tie', () => {
    expect(morePulling(7, 1)).toBe(7)
    expect(morePulling(1, 7)).toBe(7)
    expect(morePulling(4, 6)).toBe(4)
    expect(morePulling(6, 2)).toBe(6)
    expect(leaningWord(7)).toBe('Ti leaning to Do′')
    expect(leaningWord(4)).toBe('Fa leaning to Mi')
    expect(leaningWord(1)).toBe('Do at rest')
  })

  it('banks only pairs with a settled answer, seeds rising with subtlety', () => {
    expect(PULL_BANK).toHaveLength(16)
    const ids = new Set(PULL_BANK.map((item) => item.itemId))
    expect(ids.size).toBe(PULL_BANK.length)
    for (const item of PULL_BANK) {
      const [a, b] = item.payload
      expect(pullOf(a)).not.toBe(pullOf(b))
      expect(pullOf(morePulling(a, b))).toBeGreaterThan(0)
      expect(item.name).toMatch(/ against /)
    }
    const pairs = PULL_BANK.map((item) => item.payload.join('v'))
    expect(pairs).not.toContain('6v2')
    expect(pairs).not.toContain('7v4')
    expect(PULL_BANK[0].seed).toBeLessThan(PULL_BANK[PULL_BANK.length - 1].seed)
  })
})
