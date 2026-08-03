// The result card's art is graded, so the bands are where the meaning is.
// A boundary that slips by one point turns a laurel into an ordinary pass
// for the singer who earned it, and nothing else in the app would notice.

import { describe, expect, it } from 'vitest'
import { CHALLENGE_RESULT_ART, challengeArtTier, challengeResultArt, CLOSE_BAND, PERFECT_SCORE, } from '@/features/challenges/challenge-result-art'
import type { ChallengeResult } from '@/features/challenges/challenge-result-store'

describe('challengeArtTier', () => {
  it('gives the laurel from 98 up, whatever the week asked for', () => {
    expect(challengeArtTier(PERFECT_SCORE, 55)).toBe('perfect')
    expect(challengeArtTier(100, 55)).toBe('perfect')
    // An easy target cannot confer it, and a hard one cannot withhold it.
    expect(challengeArtTier(99, 90)).toBe('perfect')
  })

  it('gives an ordinary pass right up to the laurel', () => {
    expect(challengeArtTier(PERFECT_SCORE - 1, 55)).toBe('pass')
    expect(challengeArtTier(55, 55)).toBe('pass')
  })

  it('counts the target itself as passed, not as just short', () => {
    expect(challengeArtTier(55, 55)).toBe('pass')
    expect(challengeArtTier(54, 55)).toBe('close')
  })

  it('holds "just short" to the band, then calls it a miss', () => {
    expect(challengeArtTier(55 - CLOSE_BAND, 55)).toBe('close')
    expect(challengeArtTier(55 - CLOSE_BAND - 1, 55)).toBe('miss')
    expect(challengeArtTier(0, 55)).toBe('miss')
  })

  it('does not let a tiny target put the floor underground', () => {
    // targetScore - CLOSE_BAND would be negative here; without the clamp
    // every run on such a week would be "close" by arithmetic accident.
    expect(challengeArtTier(0, 5)).toBe('close')
    expect(challengeArtTier(5, 5)).toBe('pass')
  })
})

describe('challengeResultArt', () => {
  const run = (score: number, targetScore: number): ChallengeResult => ({
    challengeId: 'c1',
    title: 'Steady Voice',
    score,
    targetScore,
    tier: score >= targetScore ? 'completed' : 'attempted',
    badgeGranted: false,
  })

  it('hands each band its own picture', () => {
    const seen = [
      challengeResultArt(run(99, 55)),
      challengeResultArt(run(78, 55)),
      challengeResultArt(run(50, 55)),
      challengeResultArt(run(20, 55)),
    ]
    expect(new Set(seen).size).toBe(4)
    expect(seen).toEqual([
      CHALLENGE_RESULT_ART.perfect,
      CHALLENGE_RESULT_ART.pass,
      CHALLENGE_RESULT_ART.close,
      CHALLENGE_RESULT_ART.miss,
    ])
  })

  it('returns the same picture every time for the same run', () => {
    // Not a tautology worth skipping: the brief asked for random selection,
    // and this records why there is none — reopening a result must not
    // reshuffle it.
    const result = run(78, 55)
    expect(challengeResultArt(result)).toBe(challengeResultArt(result))
  })

  it('points every band at a file under /challenges/', () => {
    for (const src of Object.values(CHALLENGE_RESULT_ART)) {
      expect(src).toMatch(/^\/challenges\/[a-z-]+\.webp$/)
    }
  })
})
