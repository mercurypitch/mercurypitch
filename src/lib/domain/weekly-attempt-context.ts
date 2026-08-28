// ============================================================
// Weekly Attempt Context — active Legend run shared with its exercise
// ============================================================
//
// The challenge owns scoring and persistence while the exercise owns capture.
// Their one launch-scoped context lives below both feature layers so neither
// feature must import the other to identify the same attempt.

import { createSignal } from 'solid-js'
import type { MelodyItem } from '@/types'
import type { ExerciseType } from './exercise-contracts'

export interface ActiveWeeklyAttemptContext {
  challengeId: string
  title: string
  exercise: ExerciseType
  targetScore: number
  rewardBadgeId?: string | null
  founderScore?: number | null
  targetItems?: MelodyItem[]
  ownerId: string
}

const [activeWeeklyAttempt, setActiveWeeklyAttemptSignal] =
  createSignal<ActiveWeeklyAttemptContext | null>(null)

export { activeWeeklyAttempt }

export function setActiveWeeklyAttempt(
  attempt: ActiveWeeklyAttemptContext,
): void {
  setActiveWeeklyAttemptSignal(attempt)
}

export function clearActiveWeeklyAttempt(): void {
  setActiveWeeklyAttemptSignal(null)
}
