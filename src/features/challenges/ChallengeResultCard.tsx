// ============================================================
// ChallengeResultCard — the after-run moment above the frozen zen canvas
// ============================================================
// Presented whenever a weekly Legend attempt was just recorded
// (challenge-result-store): a full card instead of a toast — cosmic
// celebration art and the badge on a pass, warm encouragement on a
// miss — with explicit paths to a scored retake, the finished pitch line,
// unscored Zen practice after a miss, or exit. Mounted once at app level so
// Home and Challenges share the flow.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { EXERCISE_SIGHT_SINGING } from '@/features/exercises/types'
import { showNotification } from '@/stores/notifications-store'
import { closeChallengeStage, openChallengeStage, openSingingZen, } from '@/stores/ui-store'
import type { ChallengeResult } from './challenge-result-store'
import { clearChallengeResult, lastChallengeResult, } from './challenge-result-store'
import { challengeToZenExercise } from './challenge-stage-model'
import styles from './ChallengeResultCard.module.css'
import { beginWeeklyAttempt } from './weekly-attempt'
import { getActiveWeekly } from './weekly-service'

/** Headline + line per tier, pure for tests. */
export function challengeResultCopy(result: ChallengeResult): {
  headline: string
  line: string
} {
  if (result.tier === 'beat-founder') {
    return {
      headline: 'You beat the Founder',
      line: `${result.score}% on "${result.title}" — the top of the mountain just changed hands.`,
    }
  }
  if (result.tier === 'completed') {
    return {
      headline: 'Legend complete',
      line: `${result.score}% on "${result.title}" — target was ${result.targetScore}%. That run is on the board.`,
    }
  }
  return {
    headline: 'Not this time',
    line: `You reached ${result.score}% — the Legend asks for ${result.targetScore}%. Every run trains the climb.`,
  }
}

export const ChallengeResultCard: Component = () => {
  const passed = (): boolean => {
    const r = lastChallengeResult()
    return r !== null && r.tier !== 'attempted'
  }

  const goAgain = async (): Promise<void> => {
    const result = lastChallengeResult()
    if (result === null) return
    const challenge = await getActiveWeekly()
    if (challenge === null || challenge.id !== result.challengeId) {
      showNotification(
        'That Legend has rotated out — a new one is waiting on the board.',
        'info',
      )
      clearChallengeResult()
      return
    }
    clearChallengeResult()
    beginWeeklyAttempt({
      challengeId: challenge.id,
      title: challenge.title,
      exercise: EXERCISE_SIGHT_SINGING,
      targetScore: challenge.targetScore,
      rewardBadgeId: challenge.rewardBadgeId,
      founderScore: challenge.founderScore,
      targetItems: challenge.targetItems,
    })
    openChallengeStage({
      challengeId: challenge.id,
      title: challenge.title,
      targetScore: challenge.targetScore,
      targetItems: challenge.targetItems,
      mode: 'ranked',
    })
  }

  const practiseInZen = (): void => {
    const result = lastChallengeResult()
    if (result?.targetItems === undefined) return
    const exercise = challengeToZenExercise({
      id: result.challengeId,
      title: result.title,
      targetItems: result.targetItems,
    })
    if (exercise === null) {
      showNotification(
        'This Legend has no playable notes yet. Try another challenge.',
        'info',
      )
      return
    }
    clearChallengeResult()
    openSingingZen({
      mode: 'exercise',
      exerciseDefinition: exercise,
      source: 'exercises',
    })
  }

  const closeResultAndStage = (): void => {
    clearChallengeResult()
    closeChallengeStage()
  }

  return (
    <Show when={lastChallengeResult()}>
      {(result) => (
        <Portal>
          <div
            class={styles.overlay}
            role="dialog"
            aria-modal="true"
            aria-label="Challenge result"
            onClick={clearChallengeResult}
          >
            <div class={styles.card} onClick={(e) => e.stopPropagation()}>
              <img
                class={styles.art}
                src={
                  passed()
                    ? '/challenges/challenge-triumph.webp'
                    : '/challenges/challenge-again.webp'
                }
                alt=""
              />
              <div class={styles.body}>
                <p
                  class={styles.eyebrow}
                  classList={{ [styles.eyebrowWin]: passed() }}
                >
                  {passed() ? 'Challenge passed' : 'Challenge attempt'}
                </p>
                <h3 class={styles.headline}>
                  {challengeResultCopy(result()).headline}
                </h3>
                <p class={styles.line}>{challengeResultCopy(result()).line}</p>
                <Show when={result().badgeGranted}>
                  <p class={styles.badgeLine}>
                    A new badge is yours — find it with your achievements.
                  </p>
                </Show>
                <div class={styles.actions}>
                  <button
                    type="button"
                    class={styles.primary}
                    ref={(element) => queueMicrotask(() => element.focus())}
                    onClick={() => void goAgain()}
                  >
                    {passed() ? 'Sing it again' : 'Try the Legend again'}
                  </button>
                  <div class={styles.secondaryActions}>
                    <Show
                      when={!passed() && result().targetItems !== undefined}
                    >
                      <button
                        type="button"
                        class={styles.secondary}
                        onClick={practiseInZen}
                      >
                        Practise in Zen
                      </button>
                    </Show>
                    <button
                      type="button"
                      class={styles.secondary}
                      onClick={clearChallengeResult}
                    >
                      Review pitch line
                    </button>
                    <button
                      type="button"
                      class={styles.secondary}
                      onClick={closeResultAndStage}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </Show>
  )
}

export default ChallengeResultCard
