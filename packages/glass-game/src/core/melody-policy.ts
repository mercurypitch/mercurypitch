// Shared melody difficulty policy — map one-to-three-star profiles to correction timing.

import type { MelodyJudgePolicy } from '../melody-contracts.ts'

export type MelodyDifficultyTier = 1 | 2 | 3

export const MELODY_MISMATCH_GRACE_SECONDS = Object.freeze({
  1: 1.2,
  2: 0.75,
  3: 0.45,
} satisfies Record<MelodyDifficultyTier, number>)

export const MELODY_DROPOUT_GRACE_SECONDS = Object.freeze({
  1: 0.8,
  2: 0.4,
  3: 0.4,
} satisfies Record<MelodyDifficultyTier, number>)

export function melodyJudgePolicyForTier(
  tier: MelodyDifficultyTier,
): Pick<MelodyJudgePolicy, 'dropoutGraceSeconds' | 'mismatchGraceSeconds'> {
  const mismatchGraceSeconds = MELODY_MISMATCH_GRACE_SECONDS[tier]
  const dropoutGraceSeconds = MELODY_DROPOUT_GRACE_SECONDS[tier]
  if (mismatchGraceSeconds === undefined || dropoutGraceSeconds === undefined)
    throw new Error('Melody difficulty must be between one and three stars.')
  return { dropoutGraceSeconds, mismatchGraceSeconds }
}
