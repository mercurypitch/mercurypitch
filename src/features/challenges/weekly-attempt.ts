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

/**
 * The last consumed attempt, so the follow-up run can be told it was a
 * practice round instead of silently not counting (owner decision D3:
 * one tap = one attempt, but say so at the moment of confusion). One
 * hint per consumed attempt — repeat runs stay quiet.
 */
let lastConsumed: { title: string; exercise: ExerciseType } | null = null
let practiceHintShown = false

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

/**
 * Returns true when the run was consumed as a weekly "Sing the Legend"
 * attempt (and a `source: 'weekly'` sessionRecord written), so the caller
 * knows not to also write a plain `source: 'exercise'` record for it.
 */
export async function recordWeeklyAttempt(entry: {
  type: ExerciseType
  score: number
}): Promise<boolean> {
  const a = active()
  if (a === null) {
    // Nothing armed. If this run's type matches the attempt just
    // consumed, the singer probably hit "try again" expecting it to
    // count — tell them once. (Rarely this run was consumed by a
    // personal challenge instead; the hint's claim still holds.)
    if (
      lastConsumed !== null &&
      !practiceHintShown &&
      entry.type === lastConsumed.exercise
    ) {
      practiceHintShown = true
      showNotification(
        `Practice round — your Legend attempt for "${lastConsumed.title}" is already in. Tap the Legend card for another attempt.`,
        'info',
      )
    }
    return false
  }
  if (entry.type !== a.exercise) {
    setActive(null)
    return false
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
      source: 'weekly',
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
  // One armed attempt consumes exactly one run. Staying armed meant every
  // later run of the same exercise type — any melody, days later — kept
  // posting to the Legend board. Another go is one tap on the hero.
  // (challenge-attempt.ts deliberately differs: its board ranks best-of,
  // so repeat runs counting is the design there.)
  lastConsumed = { title: a.title, exercise: a.exercise }
  practiceHintShown = false
  setActive(null)
  setVersion((v) => v + 1)
  return true
}
