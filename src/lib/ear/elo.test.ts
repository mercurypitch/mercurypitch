// ============================================================
// Ear Lab Elo — the guess floor, the frozen item scale, and that a
// rating converges on a player's real ability.
// ============================================================

import { describe, expect, it } from 'vitest'
import { CALIBRATION_ATTEMPTS, DEFAULT_RATING, expectedScore, isCalibrated, isProvisional, ITEM_K, kFactor, newRating, PLAYER_K, targetDifficulty, updateItemDifficulty, updateRating, } from './elo'

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

describe('expectedScore', () => {
  it('is a coin flip when the ear matches the item', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 10)
  })

  it('gives 400 points ten-to-one odds', () => {
    expect(expectedScore(1600, 1200)).toBeCloseTo(10 / 11, 6)
    expect(expectedScore(1200, 1600)).toBeCloseTo(1 / 11, 6)
  })

  it('never drops below the guess rate', () => {
    // A hopeless item on a 7-button drill still comes up right 1/7
    // of the time; ignoring that would inflate wide-choice drills.
    const hopeless = expectedScore(800, 2400, 1 / 7)
    expect(hopeless).toBeGreaterThan(1 / 7)
    expect(hopeless).toBeCloseTo(1 / 7, 2)
  })

  it('scores a 7-choice item above a 2-choice one at equal skill', () => {
    expect(expectedScore(1200, 1200, 1 / 2)).toBeGreaterThan(
      expectedScore(1200, 1200, 1 / 7),
    )
  })
})

describe('kFactor', () => {
  it('starts fast and settles', () => {
    expect(kFactor(0, PLAYER_K)).toBeCloseTo(PLAYER_K.max, 6)
    expect(kFactor(PLAYER_K.decay, PLAYER_K)).toBeCloseTo(
      (PLAYER_K.max + PLAYER_K.min) / 2,
      6,
    )
    expect(kFactor(10_000, PLAYER_K)).toBeGreaterThanOrEqual(PLAYER_K.min)
    expect(kFactor(10_000, PLAYER_K)).toBeLessThan(PLAYER_K.min + 0.1)
  })

  it('moves items more slowly than the ears rating them', () => {
    expect(kFactor(0, ITEM_K)).toBeLessThan(kFactor(0, PLAYER_K))
  })
})

describe('updateRating', () => {
  it('rises on a correct answer and falls on a miss', () => {
    const start = newRating()
    expect(updateRating(start, 1200, true).rating).toBeGreaterThan(
      DEFAULT_RATING,
    )
    expect(updateRating(start, 1200, false).rating).toBeLessThan(DEFAULT_RATING)
  })

  it('pays more for beating a hard item than an easy one', () => {
    const start = newRating()
    const hard = updateRating(start, 1600, true).rating
    const easy = updateRating(start, 800, true).rating
    expect(hard).toBeGreaterThan(easy)
  })

  it('counts every attempt, right or wrong', () => {
    expect(updateRating(newRating(), 1200, false).attempts).toBe(1)
  })

  it('moves an experienced ear less than a new one', () => {
    const fresh = newRating()
    const veteran = { rating: DEFAULT_RATING, attempts: 500 }
    const freshDelta = updateRating(fresh, 1200, true).rating - DEFAULT_RATING
    const vetDelta = updateRating(veteran, 1200, true).rating - DEFAULT_RATING
    expect(freshDelta).toBeGreaterThan(vetDelta * 3)
  })

  it('flags a rating as provisional until it has settled', () => {
    expect(isProvisional(newRating())).toBe(true)
    expect(isProvisional({ rating: 1400, attempts: 50 })).toBe(false)
  })
})

describe('updateItemDifficulty', () => {
  it('marks an item easier when players keep getting it right', () => {
    const item = { rating: 1200, attempts: 0 }
    expect(updateItemDifficulty(item, 1200, true).rating).toBeLessThan(1200)
  })

  it('marks an item harder when players miss it', () => {
    const item = { rating: 1200, attempts: 0 }
    expect(updateItemDifficulty(item, 1200, false).rating).toBeGreaterThan(1200)
  })

  it('freezes the scale once the item is calibrated', () => {
    // The yardstick has to stop moving, or "your rating rose" means
    // nothing — this is what keeps Ruler B comparable over months.
    const calibrated = { rating: 1350, attempts: CALIBRATION_ATTEMPTS }
    expect(isCalibrated(calibrated)).toBe(true)
    expect(updateItemDifficulty(calibrated, 900, true)).toBe(calibrated)
    expect(updateItemDifficulty(calibrated, 2000, false)).toBe(calibrated)
  })

  it('converges on an item’s true difficulty from repeated play', () => {
    const random = rng(7)
    const trueDifficulty = 1450
    let item = { rating: DEFAULT_RATING, attempts: 0 }
    for (let i = 0; i < CALIBRATION_ATTEMPTS; i++) {
      // A stream of players of assorted ability meet the item.
      const player = 1000 + random() * 800
      const correct = random() < expectedScore(player, trueDifficulty)
      item = updateItemDifficulty(item, player, correct)
    }
    expect(item.rating).toBeGreaterThan(trueDifficulty - 120)
    expect(item.rating).toBeLessThan(trueDifficulty + 120)
    expect(isCalibrated(item)).toBe(true)
  })
})

describe('targetDifficulty', () => {
  it('round-trips through expectedScore', () => {
    const d = targetDifficulty(1400, 0.75)
    expect(expectedScore(1400, d)).toBeCloseTo(0.75, 6)
  })

  it('accounts for the guess floor', () => {
    const d = targetDifficulty(1400, 0.8, 1 / 7)
    expect(expectedScore(1400, d, 1 / 7)).toBeCloseTo(0.8, 6)
    // With a 1-in-7 freebie, hitting 80% needs a harder item than it
    // would with no menu to guess from.
    expect(d).toBeGreaterThan(targetDifficulty(1400, 0.8))
  })

  it('serves easier items for a lower success target', () => {
    expect(targetDifficulty(1400, 0.6)).toBeGreaterThan(
      targetDifficulty(1400, 0.9),
    )
  })

  it('pins unreachable targets to the ends of the bank', () => {
    expect(targetDifficulty(1400, 0.1, 1 / 7)).toBe(Number.NEGATIVE_INFINITY)
    expect(targetDifficulty(1400, 1)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('convergence', () => {
  /** Play a whole bank against a simulated ear of known ability. */
  function play(trueAbility: number, items: number, seed: number): number {
    const random = rng(seed)
    let player = newRating()
    for (let i = 0; i < items; i++) {
      // The scheduler aims at the desirable-difficulty band.
      const difficulty = targetDifficulty(player.rating, 0.75)
      const correct = random() < expectedScore(trueAbility, difficulty)
      player = updateRating(player, difficulty, correct)
    }
    return player.rating
  }

  it('finds a strong ear from a default start', () => {
    const final = play(1600, 300, 3)
    expect(final).toBeGreaterThan(1500)
    expect(final).toBeLessThan(1700)
  })

  it('finds a weaker ear from the same start', () => {
    const final = play(950, 300, 3)
    expect(final).toBeGreaterThan(850)
    expect(final).toBeLessThan(1050)
  })

  it('keeps rising as the ear itself improves', () => {
    // The claim Ruler B has to support: harder items over time, and
    // the number still goes up rather than sticking at 75% correct.
    const random = rng(11)
    let player = newRating()
    const marks: number[] = []
    for (let block = 0; block < 5; block++) {
      const ability = 1100 + block * 150
      for (let i = 0; i < 80; i++) {
        const difficulty = targetDifficulty(player.rating, 0.75)
        const correct = random() < expectedScore(ability, difficulty)
        player = updateRating(player, difficulty, correct)
      }
      marks.push(player.rating)
    }
    for (let i = 1; i < marks.length; i++) {
      expect(marks[i]).toBeGreaterThan(marks[i - 1])
    }
    expect(marks[marks.length - 1] - marks[0]).toBeGreaterThan(400)
  })
})
