// ============================================================
// Weekly Legend Attempt — the drill → weekly-challenge return path
// ============================================================
//
// Mirrors challenge-attempt.ts: the hero arms an attempt context, the
// exercise-history store reports every finished run, and a matching run writes
// a sessionRecord tagged with the weeklyChallengeId (so the server-derived
// weekly board can rank it) and grades the tier — Attempted / Completed /
// Beat the Founder. Never throws into the exercise completion flow.

import { createSignal } from 'solid-js'
import { checkAndGrantBadges, grantBadgeByRef, } from '@/db/services/badge-grant-engine'
import { saveSessionRecord } from '@/db/services/session-service'
import type { ExerciseType } from '@/features/exercises/types'
import { trackEvent } from '@/lib/analytics'
import { showNotification } from '@/stores/notifications-store'

export interface WeeklyAttemptTarget {
  challengeId: string
  title: string
  /** Exercise type the attempt launches — results of other types disarm. */
  exercise: ExerciseType
  targetScore: number
  rewardBadgeId?: string | null
  founderScore?: number | null
}

const [active, setActive] = createSignal<WeeklyAttemptTarget | null>(null)
const [version, setVersion] = createSignal(0)

export const activeWeeklyAttempt = active
/** Bumped after every recorded attempt so the hero reloads the board. */
export const weeklyAttemptVersion = version

export function beginWeeklyAttempt(target: WeeklyAttemptTarget): void {
  setActive(target)
  trackEvent('weekly_join')
}

export function clearWeeklyAttempt(): void {
  setActive(null)
}

export type WeeklyTier = 'attempted' | 'completed' | 'beat-founder'

/** Grade one take against the challenge's target and the founder's seed. Pure. */
export function weeklyTier(
  score: number,
  targetScore: number,
  founderScore: number | null | undefined,
): WeeklyTier {
  if (
    founderScore !== null &&
    founderScore !== undefined &&
    score > founderScore
  ) {
    return 'beat-founder'
  }
  if (score >= targetScore) return 'completed'
  return 'attempted'
}

export async function recordWeeklyAttempt(entry: {
  type: ExerciseType
  score: number
}): Promise<void> {
  const a = active()
  if (a === null) return
  if (entry.type !== a.exercise) {
    setActive(null)
    return
  }

  const score = Math.min(100, Math.max(0, Math.round(entry.score)))
  try {
    // Counts as a real practice session tagged to the weekly challenge — the
    // board derives best-per-user from these rows.
    await saveSessionRecord({
      melodyName: `Legend: ${a.title}`,
      score,
      accuracy: score,
      notesHit: 0,
      notesTotal: 0,
      weeklyChallengeId: a.challengeId,
    })
    trackEvent('weekly_attempt')

    const tier = weeklyTier(score, a.targetScore, a.founderScore)
    if (tier === 'beat-founder') {
      showNotification(`You beat the Founder — ${score}%!`, 'success')
    } else if (tier === 'completed') {
      showNotification(`Legend complete: ${a.title} (${score}%)`, 'success')
    } else {
      showNotification(
        `${a.title}: ${score}% (target ${a.targetScore}%)`,
        'info',
      )
    }

    if (
      tier !== 'attempted' &&
      a.rewardBadgeId !== undefined &&
      a.rewardBadgeId !== null &&
      a.rewardBadgeId !== ''
    ) {
      await grantBadgeByRef(a.rewardBadgeId)
    }
    await checkAndGrantBadges()
  } catch {
    // The drill result stands even if persistence fails.
  }
  setVersion((v) => v + 1)
}
