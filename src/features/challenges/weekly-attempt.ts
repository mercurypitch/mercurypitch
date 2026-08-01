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
import { getUserId } from '@/db/services/user-service'
import { fingerprintOf } from '@/features/community/share-identity'
import type { ExerciseType } from '@/features/exercises/types'
import type { ExerciseVoiceCaptureOutcome } from '@/features/exercises/use-base-exercise'
import { trackEvent } from '@/lib/analytics'
import { showNotification } from '@/stores/notifications-store'
import type { MelodyItem } from '@/types'
import { armScoredAttempt, disarmScoredAttempt } from './attempt-coordinator'
import { presentChallengeResult, whileFinalizing, } from './challenge-result-store'

export interface WeeklyAttemptTarget {
  challengeId: string
  title: string
  /** Exercise type the attempt launches — results of other types disarm. */
  exercise: ExerciseType
  targetScore: number
  rewardBadgeId?: string | null
  founderScore?: number | null
  /** The authored line, retained so a miss can open as unscored Zen practice. */
  targetItems?: MelodyItem[]
}

export const WEEKLY_ATTEMPT_SOURCE_VERSION = 1

/** Fingerprint the fields that the weekly stage actually scores. */
export function weeklyAttemptComparabilityKey(
  target: WeeklyAttemptTarget,
): string | undefined {
  const notes = (target.targetItems ?? [])
    .filter(
      (item) =>
        Number.isFinite(item.note?.midi) &&
        Number.isFinite(item.startBeat) &&
        Number.isFinite(item.duration),
    )
    .map((item) => ({
      midi: item.note.midi,
      startBeat: item.startBeat,
      duration: item.duration,
    }))
    .sort(
      (a, b) =>
        a.startBeat - b.startBeat || a.midi - b.midi || a.duration - b.duration,
    )
  if (notes.length === 0) return undefined
  const signature = fingerprintOf(JSON.stringify(notes))
  return `voice:weekly:${target.challengeId}:v${WEEKLY_ATTEMPT_SOURCE_VERSION}:${signature}`
}

interface ActiveWeeklyAttempt extends WeeklyAttemptTarget {
  ownerId: string
}

const [active, setActive] = createSignal<ActiveWeeklyAttempt | null>(null)
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
  setActive({ ...target, ownerId: getUserId() })
  armScoredAttempt('weekly', () => setActive(null))
  trackEvent('weekly_join')
}

export function clearWeeklyAttempt(): void {
  setActive(null)
  disarmScoredAttempt('weekly')
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
  durationMs?: number
  voiceCapture?: ExerciseVoiceCaptureOutcome
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
    clearWeeklyAttempt()
    return false
  }
  if (getUserId() !== a.ownerId) {
    clearWeeklyAttempt()
    return true
  }

  const score = Math.min(100, Math.max(0, Math.round(entry.score)))
  const comparabilityKey = weeklyAttemptComparabilityKey(a)
  let sessionSaved = false
  try {
    // Wrapped so the stage can say "saving your run" instead of sitting
    // frozen through three round trips.
    await whileFinalizing(async () => {
      // Counts as a real practice session tagged to the weekly challenge — the
      // board derives best-per-user from these rows.
      const savedSession = await saveSessionRecord(
        {
          melodyName: `Legend: ${a.title}`,
          score,
          accuracy: score,
          notesHit: 0,
          notesTotal: 0,
          durationMs: entry.durationMs,
          weeklyChallengeId: a.challengeId,
          source: 'weekly',
          sourceRef: a.challengeId,
          ...(comparabilityKey === undefined
            ? {}
            : {
                sourceVersion: WEEKLY_ATTEMPT_SOURCE_VERSION,
                comparabilityKey,
              }),
        },
        a.ownerId,
      )
      if (savedSession === null) return
      sessionSaved = true
      if (getUserId() !== a.ownerId) return
      trackEvent('weekly_attempt')

      const tier = weeklyTier(score, a.targetScore, a.founderScore)
      let badgeGranted = false
      if (
        tier !== 'attempted' &&
        a.rewardBadgeId !== undefined &&
        a.rewardBadgeId !== null &&
        a.rewardBadgeId !== ''
      ) {
        await grantBadgeByRef(a.rewardBadgeId, a.ownerId)
        if (getUserId() !== a.ownerId) return
        badgeGranted = true
      }
      if (getUserId() !== a.ownerId) return
      await checkAndGrantBadges(a.ownerId)
      if (getUserId() !== a.ownerId) return

      // Publish the result without navigating away. The app-level result
      // overlay sits above the frozen challenge canvas, so the singer can
      // review the trace, practise the line without scoring, or explicitly
      // arm another board attempt.
      presentChallengeResult({
        challengeId: a.challengeId,
        title: a.title,
        score,
        targetScore: a.targetScore,
        tier,
        badgeGranted,
        targetItems: a.targetItems,
        voiceCapture: entry.voiceCapture,
      })
    })
  } catch {
    // The drill result stands even if persistence fails.
  }
  if (getUserId() !== a.ownerId) {
    clearWeeklyAttempt()
    return true
  }
  if (!sessionSaved) {
    showNotification(
      `We couldn't save that Legend attempt. Your score was not posted; try the line again when you're ready.`,
      'error',
    )
    return true
  }
  // One armed attempt consumes exactly one run. Staying armed meant every
  // later run of the same exercise type — any melody, days later — kept
  // posting to the Legend board. Another go is one tap on the hero.
  // (challenge-attempt.ts deliberately differs: its board ranks best-of,
  // so repeat runs counting is the design there.)
  lastConsumed = { title: a.title, exercise: a.exercise }
  practiceHintShown = false
  clearWeeklyAttempt()
  setVersion((v) => v + 1)
  return true
}
