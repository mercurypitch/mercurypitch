// ============================================================
// Challenge result — the after-run moment, owned by the Challenges tab
// ============================================================
//
// A consumed weekly Legend attempt no longer ends on the plain exercise
// screen (whose "Try again" is ordinary practice under the one-attempt
// rule and confused everyone): weekly-attempt records the run, publishes
// the result here and navigates to the Challenges tab, which presents a
// full pass/fail card — congratulations art and the badge on a pass,
// encouragement on a miss — with "go again" as the one obvious next
// step. Owner-designed flow, 2026-08-01.

import { createSignal } from 'solid-js'
import type { WeeklyTier } from './weekly-attempt'

export interface ChallengeResult {
  challengeId: string
  title: string
  score: number
  targetScore: number
  tier: WeeklyTier
  /** True when this run granted the challenge's reward badge. */
  badgeGranted: boolean
}

const [lastChallengeResult, setLastChallengeResult] =
  createSignal<ChallengeResult | null>(null)

export { lastChallengeResult }

export function presentChallengeResult(result: ChallengeResult): void {
  setLastChallengeResult(result)
}

export function clearChallengeResult(): void {
  setLastChallengeResult(null)
}
