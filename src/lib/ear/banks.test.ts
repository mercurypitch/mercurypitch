// ============================================================
// Ear Lab identification banks — seed sanity per drill and the
// generic picker's targeting behaviour.
// ============================================================

import { describe, expect, it } from 'vitest'
import { bankItemState, CONTOUR_BANK, LEAP_BANK, pickBankItem, STACK_BANK, } from './banks'

function rng(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('the banks', () => {
  it('give every item a unique, prefixed id', () => {
    const all = [...LEAP_BANK, ...STACK_BANK, ...CONTOUR_BANK]
    expect(new Set(all.map((i) => i.itemId)).size).toBe(all.length)
    for (const item of LEAP_BANK) expect(item.itemId).toMatch(/^leap:/)
    for (const item of STACK_BANK) expect(item.itemId).toMatch(/^stack:/)
    for (const item of CONTOUR_BANK) expect(item.itemId).toMatch(/^contour:/)
  })

  it('covers all twelve intervals in Leap', () => {
    expect(LEAP_BANK.map((i) => i.payload[0])).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ])
  })

  it('seeds the frame intervals easier than the tritone', () => {
    const seed = (label: string) =>
      LEAP_BANK.find((i) => i.label === label)?.seed ?? 0
    expect(seed('P8')).toBeLessThan(seed('TT'))
    expect(seed('P5')).toBeLessThan(seed('m6'))
  })

  it('builds triads (and the seventh) from valid intervals', () => {
    for (const item of STACK_BANK) {
      expect(item.payload.length).toBeGreaterThanOrEqual(2)
      for (const semis of item.payload) {
        expect(semis).toBeGreaterThan(0)
        expect(semis).toBeLessThanOrEqual(12)
      }
    }
    // Major and minor anchor the difficulty scale.
    const aug = STACK_BANK.find((i) => i.label === 'Aug')?.seed ?? 0
    const maj = STACK_BANK.find((i) => i.label === 'Maj')?.seed ?? 0
    expect(maj).toBeLessThan(aug)
  })

  it('orders Contour tiers from wide-easy to hairline-hard', () => {
    const gaps = CONTOUR_BANK.map((i) => i.payload[0])
    const seeds = CONTOUR_BANK.map((i) => i.seed)
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]).toBeLessThan(gaps[i - 1])
      expect(seeds[i]).toBeGreaterThan(seeds[i - 1])
    }
  })
})

describe('bankItemState', () => {
  it('falls back to the seed with zero attempts', () => {
    const item = LEAP_BANK[0]
    expect(bankItemState({}, item)).toEqual({
      rating: item.seed,
      attempts: 0,
    })
  })

  it('prefers a stored override', () => {
    const item = LEAP_BANK[0]
    const stored = { rating: 1500, attempts: 40 }
    expect(bankItemState({ [item.itemId]: stored }, item)).toBe(stored)
  })
})

describe('pickBankItem', () => {
  it('never repeats back-to-back', () => {
    const random = rng(3)
    let last: string | undefined
    for (let i = 0; i < 200; i++) {
      const pick = pickBankItem(LEAP_BANK, {}, 1200, {
        random,
        avoidItemId: last,
      })
      expect(pick.itemId).not.toBe(last)
      last = pick.itemId
    }
  })

  it('serves easy intervals to a fresh ear, harder ones to a strong one', () => {
    const random = rng(9)
    const share = (rating: number, labels: string[]) => {
      let hits = 0
      for (let i = 0; i < 1500; i++) {
        const pick = pickBankItem(LEAP_BANK, {}, rating, {
          random,
          guessRate: 1 / 12,
        })
        if (labels.includes(pick.label)) hits++
      }
      return hits / 1500
    }
    const beginnerEasy = share(950, ['P8', 'P5', 'P4'])
    const strongHard = share(1650, ['TT', 'm6', 'M7'])
    const beginnerHard = share(950, ['TT', 'm6', 'M7'])
    expect(beginnerEasy).toBeGreaterThan(beginnerHard * 1.5)
    expect(strongHard).toBeGreaterThan(beginnerHard)
  })

  it('works on a single-item bank without excluding it', () => {
    const solo = [LEAP_BANK[0]]
    const pick = pickBankItem(solo, {}, 1200, {
      avoidItemId: solo[0].itemId,
      random: rng(1),
    })
    expect(pick.itemId).toBe(solo[0].itemId)
  })
})
