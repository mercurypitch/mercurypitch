// ============================================================
// Challenge result — the after-run moment above the frozen challenge stage
// ============================================================
//
// A consumed weekly Legend attempt publishes here without changing tabs.
// App.tsx owns the card so it can appear over the challenge stage whether
// the singer launched from Home or Challenges. Dismissing it reveals the
// frozen trace; another scored attempt must be armed explicitly.

import { createSignal } from 'solid-js'
import type { MelodyItem } from '@/types'
import type { WeeklyTier } from './weekly-attempt'

export interface ChallengeResult {
  challengeId: string
  title: string
  score: number
  targetScore: number
  tier: WeeklyTier
  /** True when this run granted the challenge's reward badge. */
  badgeGranted: boolean
  /** Present for stage-launched attempts so the line can move into Zen. */
  targetItems?: MelodyItem[]
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
