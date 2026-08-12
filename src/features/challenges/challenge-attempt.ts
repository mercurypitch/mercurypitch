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
import { checkAndGrantBadges, grantBadgeByRef, } from '@/db/services/badge-grant-engine'
import { loadChallengeProgress, saveChallengeProgress, } from '@/db/services/challenges-service'
import { saveSessionRecord } from '@/db/services/session-service'
import { getUserId } from '@/db/services/user-service'
import { fingerprintOf } from '@/features/community/share-identity'
import { lastRunTrace } from '@/features/exercises/last-run-trace'
import type { ExerciseType } from '@/features/exercises/types'
import { showNotification } from '@/stores/notifications-store'
import { armScoredAttempt, disarmScoredAttempt } from './attempt-coordinator'
import { whileFinalizing } from './challenge-result-store'
import { saveChallengeTrace } from './challenge-trace'

export interface ChallengeAttemptTarget {
  challengeId: string
  title: string
  category: string
  /** Exercise type the drill launches — results of other types disarm. */
  exercise: ExerciseType
  /** Exact authored note task used by this scored run. */
  targetNotes?: readonly string[]
  /** Numeric difficulty pinned into the exercise launch override. */
  difficulty?: number
  targetScore: number
  /** Badge (id or name) granted when this challenge completes. */
  rewardBadgeId?: string
}

export const CHALLENGE_ATTEMPT_SOURCE_VERSION = 1

/** Omit the key unless the exact scored task is known. */
export function challengeAttemptComparabilityKey(
  target: ChallengeAttemptTarget,
): string | undefined {
  if (target.targetNotes === undefined || target.targetNotes.length === 0) {
    return undefined
  }
  const signature = fingerprintOf(
    JSON.stringify({
      exercise: target.exercise,
      notes: target.targetNotes,
      difficulty: target.difficulty ?? null,
    }),
  )
  return `voice:challenge:${target.challengeId}:v${CHALLENGE_ATTEMPT_SOURCE_VERSION}:${signature}`
}

interface ActiveChallengeAttempt extends ChallengeAttemptTarget {
  ownerId: string
}

const [activeAttempt, setActiveAttempt] =
  createSignal<ActiveChallengeAttempt | null>(null)

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
  setActiveAttempt({ ...target, ownerId: getUserId() })
  armScoredAttempt('challenge', () => setActiveAttempt(null))
}

export function clearChallengeAttempt(): void {
  setActiveAttempt(null)
  disarmScoredAttempt('challenge')
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
 *
 * Returns true when the run was consumed as a challenge attempt (and a
 * `source: 'challenge'` sessionRecord written), so the caller knows not to
 * ALSO write a plain `source: 'exercise'` record for the same run.
 */
export async function recordChallengeAttempt(entry: {
  type: ExerciseType
  score: number
  durationMs?: number
}): Promise<boolean> {
  const attempt = activeAttempt()
  if (attempt === null) return false
  if (entry.type !== attempt.exercise) {
    clearChallengeAttempt()
    return false
  }
  if (getUserId() !== attempt.ownerId) {
    clearChallengeAttempt()
    return true
  }

  const score = Math.min(100, Math.max(0, Math.round(entry.score)))
  const comparabilityKey = challengeAttemptComparabilityKey(attempt)
  let progressSaved = false
  let sessionSaved = false
  let persistedCompletion = false

  // Keep the best take's pitch contour for this challenge (pitch-race share
  // video / duet-with-past-self). The base exercise published the trace just
  // before the result fired; a fresh matching-type trace is this run's.
  const trace = lastRunTrace()
  if (
    trace !== null &&
    trace.type === attempt.exercise &&
    Date.now() - trace.completedAt < 10_000
  ) {
    saveChallengeTrace(
      attempt.challengeId,
      score,
      trace,
      localStorage,
      attempt.ownerId,
    )
  }

  try {
    // Same three-round-trip shape as the weekly path: progress read,
    // session write, badge grant, grant engine. Hold the moment rather
    // than freezing the stage through it.
    await whileFinalizing(async () => {
      const allProgress = await loadChallengeProgress(attempt.ownerId)
      if (getUserId() !== attempt.ownerId) return
      const prev =
        allProgress.find((p) => p.challengeId === attempt.challengeId) ?? null
      const outcome = computeAttemptOutcome(prev, score, attempt.targetScore)

      const savedProgress = await saveChallengeProgress(
        {
          userId: attempt.ownerId,
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
        },
        attempt.ownerId,
      )
      if (savedProgress === null) return
      progressSaved = true
      persistedCompletion = savedProgress.completed
      if (getUserId() !== attempt.ownerId) return

      // The attempt counts as a real practice session: it feeds the
      // server-derived leaderboard and the badge engine's session stats.
      // A challenge is a fixed task, so it is one of the sources that rank.
      const savedSession = await saveSessionRecord(
        {
          melodyName: `Challenge: ${attempt.title}`,
          score,
          accuracy: score,
          notesHit: 0,
          notesTotal: 0,
          durationMs: entry.durationMs,
          source: 'challenge',
          sourceRef: attempt.challengeId,
          ...(comparabilityKey === undefined
            ? {}
            : {
                sourceVersion: CHALLENGE_ATTEMPT_SOURCE_VERSION,
                comparabilityKey,
              }),
        },
        attempt.ownerId,
      )
      if (savedSession === null) return
      sessionSaved = true
      if (getUserId() !== attempt.ownerId) return

      if (outcome.newlyCompleted) {
        showNotification(
          `Challenge complete: ${attempt.title} (${score}%)`,
          'success',
        )
      } else if (!outcome.completed) {
        showNotification(
          `${attempt.title}: ${score}% (target ${attempt.targetScore}%)`,
          'info',
        )
      }

      // Granting is idempotent. Keeping it tied to completed state, rather
      // than only the first crossing, lets a retry repair the rare case where
      // progress persisted but the session write failed before the reward.
      if (
        outcome.completed &&
        attempt.rewardBadgeId !== undefined &&
        attempt.rewardBadgeId !== ''
      ) {
        await grantBadgeByRef(attempt.rewardBadgeId, attempt.ownerId)
        if (getUserId() !== attempt.ownerId) return
      }

      if (getUserId() === attempt.ownerId) {
        await checkAndGrantBadges(attempt.ownerId)
      }
    })
  } catch {
    // The drill result stands even if persistence fails — never disrupt
    // the exercise flow.
  }
  if (getUserId() !== attempt.ownerId) {
    clearChallengeAttempt()
    return true
  }
  if (!progressSaved || !sessionSaved) {
    const message = persistedCompletion
      ? `Your ${attempt.title} challenge completion was saved, but this attempt is missing from session history. Try the exercise again to repair the record.`
      : `We couldn't save ${attempt.title}. Your score was not marked complete; try the exercise again when you're ready.`
    showNotification(message, 'error')
    if (progressSaved) setAttemptVersion((v) => v + 1)
    return true
  }
  setAttemptVersion((v) => v + 1)
  // Consumed: even if persistence threw, this run was a challenge attempt and
  // must not also be recorded as a plain exercise (the record was attempted).
  return true
}
