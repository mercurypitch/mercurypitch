// ============================================================
// UserSurveyModal — The GH #97 feedback survey: one optional question
// ============================================================
//
// It asks what the singer was trying to do the last time the app got in their
// way, and saves `{ kind: 'gh97-v2', gotInTheWay }`. The role and use questions
// it used to ask are asked up front now, and a feature request is an idea
// taken at face value where this asks for a problem. The rows the three
// questions wrote are still in the table, and still read.

import type { Component } from 'solid-js'
import { createSignal, createUniqueId, onCleanup, onMount, Show, } from 'solid-js'
import { submitSurvey } from '@/db/services/survey-service'
import { isolateKeys } from '@/lib/keyboard-isolation'
import { skipArmSecondsLeft, SURVEY_SKIP_ARM_MS, surveyHasContent, } from '@/lib/survey-timing'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { showNotification } from '@/stores/notifications-store'
import styles from './UserSurveyModal.module.css'

interface Props {
  onClose: () => void
  /**
   * 'onboarding' is the automatic first-run prompt; 'feedback' is the user
   * opening it themselves from Settings, where the app's own title ("One
   * question") and a dismissal delay would both be wrong.
   */
  mode?: 'onboarding' | 'feedback'
}

const UserSurveyModal: Component<Props> = (props) => {
  const [gotInTheWay, setGotInTheWay] = createSignal('')
  const [submitting, setSubmitting] = createSignal(false)
  const [visible, setVisible] = createSignal(false)
  const [armMsLeft, setArmMsLeft] = createSignal(0)
  const answerId = createUniqueId()

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

  // It opens by itself, over a tab that may be playing, and the app's
  // shortcuts listen on the window: a Space that left it played the tab behind
  // and M opened the microphone. So it takes the focus and keeps its keys. It
  // opens on its heading, not the field, so a phone keeps its keyboard down,
  // and Escape is Skip, so it waits as Skip does.
  let dialog: HTMLDivElement | undefined
  let heading: HTMLHeadingElement | undefined
  useFocusTrap(() => dialog, {
    isOpen: () => true,
    isolateKeyboard: isolateKeys,
    onClose: () => {
      if (dismissable()) props.onClose()
    },
    initialFocus: () => heading,
  })

  const hasContent = () => surveyHasContent({ gotInTheWay: gotInTheWay() })

  /** Overlay clicks only count once armed — see dismissable(). */
  const handleOverlayClick = () => {
    if (dismissable()) props.onClose()
  }

  const handleSubmit = async () => {
    // Guard as well as disable: an empty response is indistinguishable from
    // a mis-click, and storing it would quietly poison the results.
    if (!hasContent() || submitting()) return
    setSubmitting(true)
    // `finally` puts the button back whatever happens below: a send that goes
    // wrong must leave the singer able to send again, not stuck on "Sending...".
    try {
      const saved = await submitSurvey({
        kind: 'gh97-v2',
        gotInTheWay: gotInTheWay().trim(),
      })
      // Only thank the user if the response was actually persisted. On a
      // failure, keep the modal open with their text intact and say so -
      // closing "quietly" would discard typed feedback, and in survey mode
      // onClose marks the prompt seen forever.
      if (!saved) {
        showNotification(
          'Could not send right now. Your answer is still here, so try again.',
          'error',
        )
        return
      }
      showNotification('Thank you for sharing!', 'success')
      props.onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      ref={dialog}
      class={styles.overlay}
      classList={{ [styles.visible]: visible() }}
      role="dialog"
      aria-modal="true"
      // Takes the focus from a press on its words, never from Tab, so the keys
      // after the press stay in it (keyboard-isolation.ts).
      tabIndex={-1}
      aria-label={selfOpened() ? 'Share feedback' : 'Quick survey'}
      data-testid="user-survey-modal"
      onClick={handleOverlayClick}
    >
      <div class={styles.card} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h2 ref={heading} class={styles.title} tabIndex={-1}>
            {selfOpened() ? 'Share your feedback' : 'One question'}
          </h2>
          <p class={styles.subtitle}>
            {selfOpened()
              ? 'Tell us what would make Mercury Pitch better. No account needed.'
              : 'Optional. Skip it if nothing got in your way.'}
          </p>
        </div>

        <div class={styles.questions}>
          <div class={styles.question}>
            <label class={styles.questionLabel} for={answerId}>
              What were you trying to do the last time the app got in your way?
            </label>
            <textarea
              id={answerId}
              class={styles.textarea}
              value={gotInTheWay()}
              onInput={(e) => setGotInTheWay(e.currentTarget.value)}
              placeholder="For example, load my own song"
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
                : 'Just a moment, so this is not dismissed by accident'
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
            title={hasContent() ? undefined : 'Write something first'}
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
