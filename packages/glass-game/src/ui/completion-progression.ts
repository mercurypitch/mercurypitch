// Completion progression — choose the next unearned authored replay difficulty without skipping saved stars.

import type { LevelStarTier, ResolvedReplay } from '../core/replay-profile'

export function nextReplayDifficulty(
  profiles: readonly ResolvedReplay[],
  selectedTier: LevelStarTier,
  earnedTier: LevelStarTier | 0,
): ResolvedReplay | undefined {
  const completedTier = Math.max(selectedTier, earnedTier)
  return profiles.reduce<ResolvedReplay | undefined>((next, candidate) => {
    if (candidate.profile.tier <= completedTier) return next
    if (next === undefined || candidate.profile.tier < next.profile.tier)
      return candidate
    return next
  }, undefined)
}
