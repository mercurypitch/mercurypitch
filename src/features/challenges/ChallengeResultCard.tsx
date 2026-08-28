// ============================================================
// ChallengeResultCard — the after-run moment above the frozen zen canvas
// ============================================================
// Presented whenever a weekly Legend attempt was just recorded
// (challenge-result-store): a full card instead of a toast — art graded to
// how the run actually went (see challenge-result-art) and the badge on a
// pass — with explicit paths to a scored retake, the finished pitch line,
// unscored Zen practice after a miss, or exit. Mounted once at app level so
// Home and Challenges share the flow.

import type { Component } from 'solid-js'
import { createEffect, createSignal, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { EXERCISE_SIGHT_SINGING } from '@/features/exercises/types'
import { trackEvent } from '@/lib/analytics'
import { useLocalSaveNavigationLock } from '@/lib/local-save-navigation-lock'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { showNotification } from '@/stores/notifications-store'
import { closeChallengeStage, openChallengeStage, openSingingZen, } from '@/stores/ui-store'
import { challengeResultArt } from './challenge-result-art'
import type { ChallengeResult } from './challenge-result-store'
import { clearChallengeResult, discardChallengeVoiceCapture, finalizingResult, lastChallengeResult, } from './challenge-result-store'
import { challengeToZenExercise } from './challenge-stage-model'
import styles from './ChallengeResultCard.module.css'
import { beginWeeklyAttempt } from './weekly-attempt'
import { getActiveWeekly } from './weekly-service'
import { keepWeeklyLegendVoiceTake } from './weekly-voice-take'

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
  const [voiceKeepState, setVoiceKeepState] = createSignal<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  let voiceResultKey: string | null = null
  let voiceResultGeneration = 0
  let voiceKeepAttemptGeneration = 0
  let dialogRef: HTMLDivElement | undefined
  let primaryActionRef: HTMLButtonElement | undefined
  const voiceSaveInFlight = (): boolean => voiceKeepState() === 'saving'
  useLocalSaveNavigationLock(
    voiceSaveInFlight,
    'weekly challenge voice-take keep',
  )

  createEffect(() => {
    const result = lastChallengeResult()
    const capture = result?.voiceCapture
    const nextKey =
      result === null
        ? null
        : capture?.state === 'ready'
          ? `${result.challengeId}:${capture.take.capturedAt}`
          : `${result.challengeId}:${result.score}`
    if (nextKey !== voiceResultKey) {
      voiceResultKey = nextKey
      voiceResultGeneration++
      setVoiceKeepState('idle')
    }
  })

  const passed = (): boolean => {
    const r = lastChallengeResult()
    return r !== null && r.tier !== 'attempted'
  }

  const voiceHeading = (result: ChallengeResult): string => {
    if (voiceKeepState() === 'saving') return 'Keeping voice take'
    if (voiceKeepState() === 'saved') return 'Voice take kept'
    if (voiceKeepState() === 'error') return 'Could not keep voice take'
    if (result.voiceCapture?.state === 'ready') {
      return 'Keep this Legend take?'
    }
    if (result.voiceCapture?.state === 'discarded') return 'Replay discarded'
    return 'Replay unavailable'
  }

  const voiceCopy = (result: ChallengeResult): string => {
    if (voiceKeepState() === 'saving') return 'Saving locally on this device…'
    if (voiceKeepState() === 'saved') {
      return 'Available in Hear Yourself on this device.'
    }
    if (voiceKeepState() === 'error') {
      return 'The temporary replay is still available. Retry or discard it.'
    }
    if (result.voiceCapture?.state === 'ready') {
      return 'It stays temporary unless you explicitly keep it on this device.'
    }
    if (result.voiceCapture?.state === 'unsupported') {
      return 'This browser saved the score but cannot record a replay.'
    }
    if (result.voiceCapture?.state === 'error') {
      return 'The replay could not be prepared. Your score is unchanged.'
    }
    return 'Your score remains on the Legend board.'
  }

  const keepVoiceTake = (): void => {
    if (voiceSaveInFlight()) return
    const result = lastChallengeResult()
    const capture = result?.voiceCapture
    if (result === null || capture?.state !== 'ready') return
    const take = capture.take
    const context = {
      challengeId: result.challengeId,
      title: result.title,
      score: result.score,
      targetScore: result.targetScore,
      tier: result.tier,
    }
    const resultGeneration = voiceResultGeneration
    voiceKeepAttemptGeneration++
    setVoiceKeepState('saving')
    trackEvent('voice_keep_attempt')

    void (async () => {
      try {
        const saveResult = await keepWeeklyLegendVoiceTake({ context, take })
        if (saveResult.ok) {
          trackEvent('voice_keep_success')
          if (resultGeneration !== voiceResultGeneration) return
          setVoiceKeepState('saved')
          showNotification(
            'Legend take kept in Hear Yourself on this device.',
            'success',
            { channel: 'voice-take-save' },
          )
          return
        }

        trackEvent('voice_keep_failure')
        if (resultGeneration !== voiceResultGeneration) return
        setVoiceKeepState('error')
        if (saveResult.quotaExceeded || !saveResult.roomAvailable) {
          trackEvent('voice_storage_warning')
          showNotification(
            'This device is too low on browser storage to keep the take. Export or clear space, then retry.',
            'warning',
            { channel: 'voice-take-save' },
          )
        } else {
          showNotification(
            'The Legend take could not be kept. Retry or discard its temporary copy.',
            'error',
            { channel: 'voice-take-save' },
          )
        }
      } catch {
        trackEvent('voice_keep_failure')
        if (resultGeneration !== voiceResultGeneration) return
        setVoiceKeepState('error')
        showNotification(
          'The Legend take could not be kept. Retry or discard its temporary copy.',
          'error',
          { channel: 'voice-take-save' },
        )
      }
    })()
  }

  const goAgain = async (): Promise<void> => {
    if (voiceSaveInFlight()) return
    const result = lastChallengeResult()
    if (result === null) return
    const resultGeneration = voiceResultGeneration
    const keepAttemptGeneration = voiceKeepAttemptGeneration
    const challenge = await getActiveWeekly()
    // The weekly lookup is asynchronous. A Keep, dismissal, or replacement
    // result can happen while it is pending; none of those may be overwritten
    // by the stale relaunch once the request resolves.
    if (
      voiceSaveInFlight() ||
      resultGeneration !== voiceResultGeneration ||
      keepAttemptGeneration !== voiceKeepAttemptGeneration ||
      lastChallengeResult() !== result
    ) {
      return
    }
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
    if (voiceSaveInFlight()) return
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
    if (voiceSaveInFlight()) return
    clearChallengeResult()
    closeChallengeStage()
  }

  const reviewPitchLine = (): void => {
    if (voiceSaveInFlight()) return
    clearChallengeResult()
  }

  const discardVoiceTake = (): void => {
    if (voiceSaveInFlight()) return
    discardChallengeVoiceCapture()
  }

  useFocusTrap(() => dialogRef, {
    isOpen: () => lastChallengeResult() !== null,
    onClose: reviewPitchLine,
    initialFocus: () => primaryActionRef,
  })

  return (
    <>
      {/* The gap between the last note and the card is three sequential
          round trips — the session record, the reward badge, then the
          grant engine re-reading 200 records. The stage sat frozen
          through it, so singers thought it had hung and left, and the
          card then appeared over whatever they opened next. This holds
          the moment and says what is happening. */}
      <Show when={finalizingResult()}>
        <Portal>
          <div
            class={styles.overlay}
            role="status"
            aria-live="polite"
            aria-label="Saving your run"
          >
            <div class={`${styles.card} ${styles.finalizing}`}>
              <span class={styles.spinner} aria-hidden="true" />
              <p class={styles.finalizingText}>Saving your run…</p>
            </div>
          </div>
        </Portal>
      </Show>

      <Show when={lastChallengeResult()}>
        {(result) => (
          <Portal>
            <div
              ref={dialogRef}
              class={styles.overlay}
              role="dialog"
              aria-modal="true"
              aria-label="Challenge result"
              aria-busy={voiceSaveInFlight()}
              tabindex="-1"
              onClick={reviewPitchLine}
            >
              <div class={styles.card} onClick={(e) => e.stopPropagation()}>
                <img
                  class={styles.art}
                  src={challengeResultArt(result())}
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
                  <p class={styles.line}>
                    {challengeResultCopy(result()).line}
                  </p>
                  <Show when={result().badgeGranted}>
                    <p class={styles.badgeLine}>
                      A new badge is yours — find it with your achievements.
                    </p>
                  </Show>
                  <Show when={result().voiceCapture !== undefined}>
                    <section
                      class={styles.voicePanel}
                      aria-busy={voiceKeepState() === 'saving'}
                    >
                      <div class={styles.voiceCopy}>
                        <strong>{voiceHeading(result())}</strong>
                        <span role="status" aria-live="polite">
                          {voiceCopy(result())}
                        </span>
                      </div>
                      <Show
                        when={
                          result().voiceCapture?.state === 'ready' &&
                          voiceKeepState() !== 'saved'
                        }
                      >
                        <div class={styles.voiceActions}>
                          <button
                            type="button"
                            class={styles.keepVoice}
                            disabled={voiceKeepState() === 'saving'}
                            onClick={keepVoiceTake}
                          >
                            {voiceKeepState() === 'saving'
                              ? 'Saving'
                              : voiceKeepState() === 'error'
                                ? 'Retry Keep'
                                : 'Keep Take'}
                          </button>
                          <button
                            type="button"
                            class={styles.discardVoice}
                            disabled={voiceKeepState() === 'saving'}
                            onClick={discardVoiceTake}
                          >
                            Discard
                          </button>
                        </div>
                      </Show>
                    </section>
                  </Show>
                  <div class={styles.actions}>
                    <button
                      type="button"
                      class={styles.primary}
                      disabled={voiceSaveInFlight()}
                      ref={primaryActionRef}
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
                          disabled={voiceSaveInFlight()}
                          onClick={practiseInZen}
                        >
                          Practise in Zen
                        </button>
                      </Show>
                      <button
                        type="button"
                        class={styles.secondary}
                        disabled={voiceSaveInFlight()}
                        onClick={reviewPitchLine}
                      >
                        Review pitch line
                      </button>
                      <button
                        type="button"
                        class={styles.secondary}
                        disabled={voiceSaveInFlight()}
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
    </>
  )
}

export default ChallengeResultCard
