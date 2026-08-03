// ============================================================
// "Saving your run" — the gap after a challenge
// ============================================================
//
// Between the last note and the result card there are three sequential
// round trips: the session record, the reward badge, then the grant
// engine re-reading 200 records. That is a second or two, and the stage
// showed nothing — so singers thought it had hung, left the exercise,
// and the card appeared over whatever they opened next.

import { describe, expect, it } from 'vitest'
import { clearChallengeResult, finalizingResult, presentChallengeResult, whileFinalizing, } from '@/features/challenges/challenge-result-store'

describe('whileFinalizing', () => {
  it('is flagged for the duration of the work', async () => {
    expect(finalizingResult()).toBe(false)
    let seenInside = false
    await whileFinalizing(async () => {
      seenInside = finalizingResult()
    })
    expect(seenInside).toBe(true)
    expect(finalizingResult()).toBe(false)
  })

  it('clears even when the work throws', async () => {
    // Persistence failing must not leave a spinner over the app forever.
    await expect(
      whileFinalizing(async () => {
        throw new Error('network')
      }),
    ).rejects.toThrow('network')
    expect(finalizingResult()).toBe(false)
  })

  it('passes the result through', async () => {
    expect(await whileFinalizing(async () => 42)).toBe(42)
  })
})

describe('handing over to the result card', () => {
  it('stops finalizing the moment the result is presented', () => {
    // Otherwise the spinner and the card would show at once.
    void whileFinalizing(async () => {
      presentChallengeResult({
        challengeId: 'c1',
        title: 'Steady Voice',
        score: 80,
        targetScore: 55,
        tier: 'passed' as never,
        badgeGranted: false,
      })
    })
    expect(finalizingResult()).toBe(false)
    clearChallengeResult()
  })

  it('clearing the result also clears the flag', () => {
    clearChallengeResult()
    expect(finalizingResult()).toBe(false)
  })
})
