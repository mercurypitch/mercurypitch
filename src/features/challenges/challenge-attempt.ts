// ============================================================
// Challenge Attempt — the drill → challenge return path
// ============================================================
//
// Closes the loop that used to be open: a challenge's "Practice" launched a
// drill on the Exercises tab, but the drill's score was thrown away and
// completion was decided by an unrelated average of recent practice
// sessions. Now the challenge card arms an attempt context here, the
// exercise-history store reports every finished drill back, and a score that
// meets the challenge's targetScore completes it for real.
//
// The context survives retries (each finished run of the same exercise type
// counts as another attempt) and disarms itself when the user moves on to a
// different exercise, launches another challenge, or leaves the exercise.

import { createSignal } from 'solid-js'
import type { ChallengeProgress } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { checkAndGrantBadges, grantBadgeByRef, } from '@/db/services/badge-grant-engine'
import { loadChallengeProgress, saveChallengeProgress, } from '@/db/services/challenges-service'
import { saveSessionRecord } from '@/db/services/session-service'
import type { ExerciseType } from '@/features/exercises/types'
import { showNotification } from '@/stores/notifications-store'

export interface ChallengeAttemptTarget {
  challengeId: string
  title: string
  category: string
  /** Exercise type the drill launches — results of other types disarm. */
  exercise: ExerciseType
  targetScore: number
  /** Badge (id or name) granted when this challenge completes. */
  rewardBadgeId?: string
}

const [activeAttempt, setActiveAttempt] =
  createSignal<ChallengeAttemptTarget | null>(null)

/** Bumped after every recorded attempt so challenge UIs reload progress. */
const [attemptVersion, setAttemptVersion] = createSignal(0)

export const activeChallengeAttempt = activeAttempt
export const challengeAttemptVersion = attemptVersion

/**
 * Arm the attempt context for a challenge whose drill is about to launch.
 * The caller launches the drill itself (launchDrill) — this module only
 * owns the return path, keeping it free of UI-store dependencies.
 */
export function beginChallengeAttempt(target: ChallengeAttemptTarget): void {
  setActiveAttempt(target)
}

export function clearChallengeAttempt(): void {
  setActiveAttempt(null)
}

export interface AttemptOutcome {
  attempts: number
  bestScore: number
  /** 0-100 bar fill — the best real score so far. */
  progress: number
  status: 'active' | 'completed'
  completed: boolean
  /** True only when THIS attempt crossed the target. */
  newlyCompleted: boolean
}

/**
 * Fold one drill score into a challenge's progress. Pure — exported for
 * tests. Completion requires a single attempt meeting targetScore; a stale
 * bestScore alone never completes (legacy seeded rows carried invented
 * bests, and "best of several partial runs" is not the challenge semantic).
 */
export function computeAttemptOutcome(
  prev: Pick<ChallengeProgress, 'attempts' | 'bestScore' | 'completed'> | null,
  score: number,
  targetScore: number,
): AttemptOutcome {
  const clamped = Math.min(100, Math.max(0, Math.round(score)))
  const attempts = (prev?.attempts ?? 0) + 1
  const bestScore = Math.max(prev?.bestScore ?? 0, clamped)
  const wasCompleted = prev?.completed === true
  const newlyCompleted = !wasCompleted && clamped >= targetScore
  const completed = wasCompleted || newlyCompleted
  return {
    attempts,
    bestScore,
    progress: Math.min(100, bestScore),
    status: completed ? 'completed' : 'active',
    completed,
    newlyCompleted,
  }
}

/**
 * Report a finished exercise run. Called by the exercise-history store for
 * every recorded result; no-ops unless an attempt is armed. A result of a
 * different exercise type means the user moved on — disarm silently.
 * Never throws into the exercise completion flow.
 */
export async function recordChallengeAttempt(entry: {
  type: ExerciseType
  score: number
}): Promise<void> {
  const attempt = activeAttempt()
  if (attempt === null) return
  if (entry.type !== attempt.exercise) {
    setActiveAttempt(null)
    return
  }

  const score = Math.min(100, Math.max(0, Math.round(entry.score)))
  try {
    const allProgress = await loadChallengeProgress()
    const prev =
      allProgress.find((p) => p.challengeId === attempt.challengeId) ?? null
    const outcome = computeAttemptOutcome(prev, score, attempt.targetScore)

    await saveChallengeProgress({
      userId: getUserId(),
      challengeId: attempt.challengeId,
      progress: outcome.progress,
      currentScore: score,
      bestScore: outcome.bestScore,
      status: outcome.status,
      completed: outcome.completed,
      attempts: outcome.attempts,
      ...(outcome.newlyCompleted
        ? { completedAt: new Date().toISOString() }
        : {}),
    })

    // The attempt counts as a real practice session: it feeds the
    // server-derived leaderboard and the badge engine's session stats.
    await saveSessionRecord({
      melodyName: `Challenge: ${attempt.title}`,
      score,
      accuracy: score,
      notesHit: 0,
      notesTotal: 0,
    })

    if (outcome.newlyCompleted) {
      showNotification(
        `Challenge complete: ${attempt.title} (${score}%)`,
        'success',
      )
      if (attempt.rewardBadgeId !== undefined && attempt.rewardBadgeId !== '') {
        await grantBadgeByRef(attempt.rewardBadgeId)
      }
    } else if (!outcome.completed) {
      showNotification(
        `${attempt.title}: ${score}% (target ${attempt.targetScore}%)`,
        'info',
      )
    }

    await checkAndGrantBadges()
  } catch {
    // The drill result stands even if persistence fails — never disrupt
    // the exercise flow.
  }
  setAttemptVersion((v) => v + 1)
}
