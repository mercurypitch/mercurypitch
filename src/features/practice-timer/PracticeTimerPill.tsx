// ============================================================
// PracticeTimerPill — the ambient voice-rest readout
// ============================================================
//
// Deliberately quiet: it only appears once the timer has something to say,
// and the phase change itself is a toast, not a dialog. Nothing here blocks
// singing — the button offers the break early, it never forces one.

import { Show } from 'solid-js'
import { breakIntervalMin, phaseRemainingMs, practicePhase, practiceTimerVisible, skipPracticeTimerPhase, } from '@/stores/practice-timer-store'
import styles from './PracticeTimerPill.module.css'

/** m:ss, rounding up so the readout never shows 0:00 while still counting. */
export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function PracticeTimerPill() {
  const onBreak = () => practicePhase() === 'break'

  const label = () =>
    onBreak()
      ? `Resting your voice, ${formatRemaining(phaseRemainingMs())} left`
      : `Singing, ${formatRemaining(phaseRemainingMs())} until a break is due`

  // Not a live region on purpose: it reads out every second if it is one.
  // The phase change is announced by its toast, which already has role=status.
  return (
    <Show when={practiceTimerVisible()}>
      <div
        class={styles.pill}
        classList={{ [styles.pillBreak]: onBreak() }}
        data-testid="practice-timer-pill"
      >
        <span class={styles.icon} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2" />
            <path d="M9 2h6" />
          </svg>
        </span>

        <span class={styles.time} title={label()}>
          {formatRemaining(phaseRemainingMs())}
        </span>

        <button
          type="button"
          class={styles.action}
          onClick={skipPracticeTimerPhase}
          aria-label={
            onBreak()
              ? `End the break and go back to singing. ${label()}.`
              : `Start the ${breakIntervalMin()}-minute break now. ${label()}.`
          }
          title={
            onBreak()
              ? 'End the break and go back to singing'
              : `Start the ${breakIntervalMin()}-minute break now`
          }
        >
          {onBreak() ? 'Resume' : 'Rest'}
        </button>
      </div>
    </Show>
  )
}
