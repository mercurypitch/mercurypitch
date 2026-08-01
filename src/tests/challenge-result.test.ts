// The after-run card's copy per tier — and the store handoff contract
// weekly-attempt publishes into.

import { describe, expect, it } from 'vitest'
import { clearChallengeResult, lastChallengeResult, presentChallengeResult, } from '@/features/challenges/challenge-result-store'
import { challengeResultCopy } from '@/features/challenges/ChallengeResultCard'

const base = {
  challengeId: 'w1',
  title: 'The Impossible Note: Vincero',
  score: 74,
  targetScore: 70,
  badgeGranted: false,
}

describe('challengeResultCopy', () => {
  it('celebrates a completed Legend with score and target', () => {
    const copy = challengeResultCopy({ ...base, tier: 'completed' })
    expect(copy.headline).toBe('Legend complete')
    expect(copy.line).toContain('74%')
    expect(copy.line).toContain('70%')
  })

  it('crowns beating the founder', () => {
    const copy = challengeResultCopy({ ...base, tier: 'beat-founder' })
    expect(copy.headline).toBe('You beat the Founder')
  })

  it('encourages a miss without punishing it', () => {
    const copy = challengeResultCopy({
      ...base,
      score: 12,
      tier: 'attempted',
    })
    expect(copy.headline).toBe('Not this time')
    expect(copy.line).toContain('12%')
    expect(copy.line).toContain('70%')
  })
})

describe('challenge-result store', () => {
  it('publishes and clears', () => {
    presentChallengeResult({ ...base, tier: 'completed' })
    expect(lastChallengeResult()?.title).toBe(base.title)
    clearChallengeResult()
    expect(lastChallengeResult()).toBe(null)
  })
})
