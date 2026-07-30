// ============================================================
// Ear Lab item bank — degree data, cadence voicings, and that the
// picker actually serves the desirable-difficulty band.
// ============================================================

import { describe, expect, it } from 'vitest'
import { cadenceChordMidis, HOME_DEGREES, homeDegree, homeItemId, homeItemState, pickHomeItem, probeMidi, roveRootMidi, } from './item-bank'

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

describe('HOME_DEGREES', () => {
  it('covers all seven diatonic degrees in the major scale', () => {
    expect(HOME_DEGREES.map((d) => d.degree)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(HOME_DEGREES.map((d) => d.semitone)).toEqual([0, 2, 4, 5, 7, 9, 11])
  })

  it('seeds the anchors easier than the tendency tones', () => {
    const seed = (n: number) => homeDegree(n)?.seed ?? 0
    // 1, 5, 3 are the tonal anchors; 4 and 7 pull hardest.
    expect(seed(1)).toBeLessThan(seed(2))
    expect(seed(5)).toBeLessThan(seed(6))
    expect(seed(3)).toBeLessThan(seed(4))
    expect(Math.max(seed(1), seed(3), seed(5))).toBeLessThan(
      Math.min(seed(4), seed(7)),
    )
  })

  it('derives stable ids per degree', () => {
    const ids = HOME_DEGREES.map((d) => homeItemId(d.degree))
    expect(new Set(ids).size).toBe(7)
    expect(ids[0]).toBe('home:deg-1')
  })
})

describe('homeItemState', () => {
  it('falls back to the authored seed with zero attempts', () => {
    const state = homeItemState({}, 7)
    expect(state.rating).toBe(homeDegree(7)?.seed)
    expect(state.attempts).toBe(0)
  })

  it('prefers the stored override once one exists', () => {
    const stored = { rating: 1420, attempts: 30 }
    expect(homeItemState({ [homeItemId(7)]: stored }, 7)).toBe(stored)
  })
})

describe('cadenceChordMidis', () => {
  it('opens and closes on the tonic triad', () => {
    const [first, , , last] = cadenceChordMidis(60)
    expect(first).toEqual([60, 64, 67])
    expect(last).toEqual([60, 64, 67])
  })

  it('voices the leading tone a semitone under the tonic in V', () => {
    const chords = cadenceChordMidis(60)
    expect(chords[2]).toContain(59)
  })

  it('keeps every voice within an octave of the tonic', () => {
    for (const chord of cadenceChordMidis(60)) {
      for (const midi of chord) {
        expect(midi).toBeGreaterThanOrEqual(59)
        expect(midi).toBeLessThanOrEqual(72)
      }
    }
  })
})

describe('probeMidi and roving', () => {
  it('places each degree at its semitone above the roved root', () => {
    expect(probeMidi(50, 1)).toBe(50)
    expect(probeMidi(50, 5)).toBe(57)
    expect(probeMidi(50, 7)).toBe(61)
  })

  it('roves the root across C3..B3 and hits every key', () => {
    const random = rng(3)
    const seen = new Set<number>()
    for (let i = 0; i < 300; i++) seen.add(roveRootMidi(random))
    expect(Math.min(...seen)).toBe(48)
    expect(Math.max(...seen)).toBe(59)
    expect(seen.size).toBe(12)
  })
})

describe('pickHomeItem', () => {
  it('never repeats the previous item back-to-back', () => {
    const random = rng(11)
    let last: string | undefined
    for (let i = 0; i < 200; i++) {
      const pick = pickHomeItem({}, 1200, { random, avoidItemId: last })
      expect(pick.itemId).not.toBe(last)
      last = pick.itemId
    }
  })

  it('serves the anchors to a fresh ear more than the tendency tones', () => {
    const random = rng(5)
    const counts = new Map<number, number>()
    for (let i = 0; i < 2000; i++) {
      const pick = pickHomeItem({}, 1000, { random })
      counts.set(pick.degree.degree, (counts.get(pick.degree.degree) ?? 0) + 1)
    }
    const anchors =
      (counts.get(1) ?? 0) + (counts.get(3) ?? 0) + (counts.get(5) ?? 0)
    const pulls = (counts.get(4) ?? 0) + (counts.get(7) ?? 0)
    expect(anchors).toBeGreaterThan(pulls * 1.5)
    // ...but the hard degrees still appear — no dead items.
    expect(counts.get(7) ?? 0).toBeGreaterThan(0)
  })

  it('shifts toward the tendency tones as the ear rating climbs', () => {
    const random = rng(7)
    const pullShare = (rating: number) => {
      let pulls = 0
      for (let i = 0; i < 1500; i++) {
        const d = pickHomeItem({}, rating, { random }).degree.degree
        if (d === 4 || d === 7) pulls++
      }
      return pulls / 1500
    }
    expect(pullShare(1600)).toBeGreaterThan(pullShare(950) * 1.5)
  })

  it('respects stored item difficulties over the seeds', () => {
    // Degree 1 recalibrated as very hard: a beginner should now see
    // it rarely, seed or no seed.
    const random = rng(13)
    const states = { [homeItemId(1)]: { rating: 1900, attempts: 50 } }
    let tonic = 0
    for (let i = 0; i < 1500; i++) {
      if (pickHomeItem(states, 950, { random }).degree.degree === 1) tonic++
    }
    expect(tonic / 1500).toBeLessThan(0.08)
  })
})
