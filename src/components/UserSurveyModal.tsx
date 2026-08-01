// ============================================================
// UserSurveyModal — Optional onboarding survey
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { submitSurvey } from '@/db/services/survey-service'
import { skipArmSecondsLeft, SURVEY_SKIP_ARM_MS, surveyHasContent, } from '@/lib/survey-timing'
import { showNotification } from '@/stores/notifications-store'
import styles from './UserSurveyModal.module.css'

interface Props {
  onClose: () => void
  /**
   * 'onboarding' is the automatic first-run prompt; 'feedback' is the user
   * opening it themselves from Settings, where "Welcome to MercuryPitch" and
   * a dismissal delay would both be wrong.
   */
  mode?: 'onboarding' | 'feedback'
}

const BACKGROUNDS = [
  { id: 'singer', label: 'Singer / Vocalist' },
  { id: 'guitarist', label: 'Guitarist' },
  { id: 'musician', label: 'Musician (multi-instrument)' },
  { id: 'producer', label: 'Producer / Songwriter' },
  { id: 'exploring', label: 'Just exploring' },
]

const USAGES = [
  { id: 'singing', label: 'Singing practice' },
  { id: 'guitar', label: 'Guitar practice' },
  { id: 'jam', label: 'Jam sessions' },
  { id: 'karaoke', label: 'Karaoke singing' },
  { id: 'ear', label: 'Ear training' },
]

const UserSurveyModal: Component<Props> = (props) => {
  const [background, setBackground] = createSignal<string[]>([])
  const [usage, setUsage] = createSignal<string[]>([])
  const [featureRequest, setFeatureRequest] = createSignal('')
  const [submitting, setSubmitting] = createSignal(false)
  const [visible, setVisible] = createSignal(false)
  const [armMsLeft, setArmMsLeft] = createSignal(0)

  // The user opened this themselves — no arming delay, they are looking at it.
  const selfOpened = (): boolean => props.mode === 'feedback'
  /** Skip / click-outside are inert until this passes. */
  const dismissable = (): boolean => selfOpened() || armMsLeft() <= 0

  onMount(() => {
    requestAnimationFrame(() => setVisible(true))
    if (selfOpened()) return
    // Count down rather than a single timeout, so the button can SAY why it
    // is disabled. A greyed-out control with no explanation reads as broken.
    const startedAt = Date.now()
    setArmMsLeft(SURVEY_SKIP_ARM_MS)
    const id = window.setInterval(() => {
      const left = SURVEY_SKIP_ARM_MS - (Date.now() - startedAt)
      setArmMsLeft(left > 0 ? left : 0)
      if (left <= 0) window.clearInterval(id)
    }, 200)
    onCleanup(() => window.clearInterval(id))
  })

  const hasContent = () =>
    surveyHasContent({
      background: background(),
      usage: usage(),
      featureRequest: featureRequest(),
    })

  /** Overlay clicks only count once armed — see dismissable(). */
  const handleOverlayClick = () => {
    if (dismissable()) props.onClose()
  }

  const toggleItem = (
    list: string[],
    setter: (v: string[]) => void,
    id: string,
  ) => {
    if (list.includes(id)) {
      setter(list.filter((x) => x !== id))
    } else {
      setter([...list, id])
    }
  }

  const handleSubmit = async () => {
    // Guard as well as disable: an empty response is indistinguishable from
    // a mis-click, and storing it would quietly poison the results.
    if (!hasContent() || submitting()) return
    setSubmitting(true)
    const saved = await submitSurvey({
      background: background(),
      usage: usage(),
      featureRequest: featureRequest().trim() || undefined,
    })
    setSubmitting(false)
    // Only thank the user if the response was actually persisted. On a
    // failure, keep the modal open with their text intact and say so -
    // closing "quietly" would discard typed feedback, and in survey mode
    // onClose marks the prompt seen forever.
    if (!saved) {
      showNotification(
        'Could not send right now - your answers are still here, try again.',
        'error',
      )
      return
    }
    showNotification('Thank you for sharing!', 'success')
    props.onClose()
  }

  return (
    <div
      class={styles.overlay}
      classList={{ [styles.visible]: visible() }}
      role="dialog"
      aria-modal="true"
      aria-label={selfOpened() ? 'Share feedback' : 'Quick survey'}
      data-testid="user-survey-modal"
      onClick={handleOverlayClick}
    >
      <div class={styles.card} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h2 class={styles.title}>
            {selfOpened() ? 'Share your feedback' : 'Welcome to MercuryPitch'}
          </h2>
          <p class={styles.subtitle}>
            {selfOpened()
              ? 'Tell us what would make MercuryPitch better — anonymous, no account needed'
              : 'Help us improve — 3 quick questions (optional)'}
          </p>
        </div>

        <div class={styles.questions}>
          {/* Q1: Background */}
          <div class={styles.question}>
            <h3 class={styles.questionLabel}>I am a...</h3>
            <div class={styles.options}>
              <For each={BACKGROUNDS}>
                {(opt) => (
                  <button
                    class={styles.option}
                    classList={{
                      [styles.selected]: background().includes(opt.id),
                    }}
                    onClick={() =>
                      toggleItem(background(), setBackground, opt.id)
                    }
                    type="button"
                  >
                    <span class={styles.check}>
                      <Show when={background().includes(opt.id)}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </Show>
                    </span>
                    {opt.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Q2: Usage */}
          <div class={styles.question}>
            <h3 class={styles.questionLabel}>
              I plan to use MercuryPitch for...
            </h3>
            <div class={styles.options}>
              <For each={USAGES}>
                {(opt) => (
                  <button
                    class={styles.option}
                    classList={{
                      [styles.selected]: usage().includes(opt.id),
                    }}
                    onClick={() => toggleItem(usage(), setUsage, opt.id)}
                    type="button"
                  >
                    <span class={styles.check}>
                      <Show when={usage().includes(opt.id)}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </Show>
                    </span>
                    {opt.label}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* Q3: Feature request */}
          <div class={styles.question}>
            <h3 class={styles.questionLabel}>
              What feature would you most like to see?
            </h3>
            <textarea
              class={styles.textarea}
              value={featureRequest()}
              onInput={(e) => setFeatureRequest(e.currentTarget.value)}
              placeholder="e.g. Offline mode, more exercises, tablature view..."
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        <div class={styles.actions}>
          <button
            class={styles.skipBtn}
            onClick={() => {
              if (dismissable()) props.onClose()
            }}
            disabled={!dismissable()}
            title={
              dismissable()
                ? undefined
                : 'Just a moment — so this is not dismissed by accident'
            }
            data-testid="survey-skip"
            type="button"
          >
            <Show
              when={dismissable()}
              fallback={`Skip (${skipArmSecondsLeft(armMsLeft())})`}
            >
              {selfOpened() ? 'Close' : 'Skip'}
            </Show>
          </button>
          <button
            class={styles.submitBtn}
            onClick={() => void handleSubmit()}
            disabled={submitting() || !hasContent()}
            title={
              hasContent()
                ? undefined
                : 'Pick an option or write something first'
            }
            data-testid="survey-submit"
            type="button"
          >
            {submitting() ? 'Sending...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserSurveyModal
