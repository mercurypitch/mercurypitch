// Completion progression regressions — the results CTA advances from the best earned difficulty.

import { describe, expect, it } from 'vitest'
import type { ResolvedReplay } from '../core/replay-profile'
import { nextReplayDifficulty } from './completion-progression'

function profile(tier: 1 | 2 | 3, id = `tier-${tier}`): ResolvedReplay {
  return {
    level: {} as ResolvedReplay['level'],
    profile: {
      id,
      revision: 1,
      tier,
      title: `${tier}-star challenge`,
      description: '',
      encounters: {},
    },
    identity: {
      levelId: 'gallery',
      contentRevision: 1,
      profileId: id,
      profileRevision: 1,
      challengeSignature: id,
    },
  }
}

describe('nextReplayDifficulty', () => {
  const profiles = [profile(3), profile(1), profile(2)]

  it('offers the next authored tier after the selected and earned stars', () => {
    expect(nextReplayDifficulty(profiles, 1, 0)?.profile.tier).toBe(2)
    expect(nextReplayDifficulty(profiles, 1, 2)?.profile.tier).toBe(3)
    expect(nextReplayDifficulty(profiles, 2, 1)?.profile.tier).toBe(3)
  })

  it('hides the action once the highest authored tier is earned', () => {
    expect(nextReplayDifficulty(profiles, 1, 3)).toBeUndefined()
    expect(nextReplayDifficulty(profiles, 3, 0)).toBeUndefined()
  })

  it('uses the next real profile when authored tiers are sparse', () => {
    expect(
      nextReplayDifficulty([profile(1), profile(3)], 1, 1)?.profile.tier,
    ).toBe(3)
  })
})
