// Guitar Night Learn Shelf keeps a small setlist one gesture away without resizing the room.
// ============================================================
//
// The shelf is deliberately modal: opening it protects focus while the current
// stage remains mounted beneath it. Choosing an activity never starts sound,
// capture, a count-in, or a timer.

import { For, onCleanup, onMount } from 'solid-js'
import type { GuitarFirstWinProgressV1 } from './first-win-progress'
import styles from './GuitarNightApp.module.css'
import type { GuitarNightLearnActivityId } from './GuitarNightLearnActivity'
import { GUITAR_NIGHT_LEARN_ACTIVITIES } from './GuitarNightLearnActivity'

interface GuitarNightLearnShelfProps {
  firstWinProgress: GuitarFirstWinProgressV1
  tuningLabel: string
  initialFocus?: GuitarNightLearnActivityId
  onFirstSteps(): void
  onActivity(activity: Exclude<GuitarNightLearnActivityId, 'first-steps'>): void
  onClose(): void
}

function firstStepsCopy(progress: GuitarFirstWinProgressV1): {
  action: string
  detail: string
  state: string
} {
  if (progress.status === 'completed') {
    return {
      action: 'Replay first steps',
      detail: 'Make a groove, then read your first one-string tab.',
      state: 'Completed',
    }
  }
  if (progress.status === 'in-progress') {
    return {
      action: 'Continue first steps',
      detail: 'Return to the exact lesson you left.',
      state: 'In progress',
    }
  }
  if (progress.status === 'skipped') {
    return {
      action: 'Try first steps',
      detail: 'A quiet two-part introduction, here whenever you want it.',
      state: 'Optional',
    }
  }
  return {
    action: 'Start with one string',
    detail: 'Make a groove, then read your first one-string tab.',
    state: 'Recommended',
  }
}

export function GuitarNightLearnShelf(props: GuitarNightLearnShelfProps) {
  let dialog!: HTMLDivElement
  let firstAction!: HTMLButtonElement
  const activityActions = new Map<
    GuitarNightLearnActivityId,
    HTMLButtonElement
  >()

  onMount(() => {
    const shell = dialog.closest<HTMLElement>(
      '[data-testid="guitar-night-shell"]',
    )
    const shellScrollTop = shell?.scrollTop ?? 0
    const shellOverflow = shell?.style.overflow ?? ''
    const bodyOverflow = document.body.style.overflow
    if (shell !== null && shell !== undefined) shell.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    const focusTarget =
      props.initialFocus === undefined || props.initialFocus === 'first-steps'
        ? firstAction
        : (activityActions.get(props.initialFocus) ?? firstAction)
    focusTarget.focus({ preventScroll: true })
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        props.onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    onCleanup(() => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = bodyOverflow
      if (shell !== null && shell !== undefined) {
        shell.style.overflow = shellOverflow
        shell.scrollTop = shellScrollTop
      }
    })
  })

  const intro = () => firstStepsCopy(props.firstWinProgress)

  return (
    <div
      class={styles.learnScrim}
      data-testid="guitar-night-learn-shelf"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) props.onClose()
      }}
    >
      <div
        ref={dialog}
        class={styles.learnShelf}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guitar-night-learn-heading"
        aria-describedby="guitar-night-learn-description"
      >
        <div class={styles.learnShelfHeading}>
          <div>
            <span>Learn setlist</span>
            <h2 id="guitar-night-learn-heading">One small win at a time.</h2>
          </div>
          <button type="button" onClick={() => props.onClose()}>
            Close
          </button>
        </div>
        <p id="guitar-night-learn-description">
          Choose one focused exercise. The room stays silent until you make a
          musical move.
        </p>

        <div class={styles.learnSetlist}>
          <button
            ref={firstAction}
            type="button"
            class={styles.learnContinue}
            onClick={() => props.onFirstSteps()}
          >
            <span>{intro().state}</span>
            <strong>{intro().action}</strong>
            <small>{intro().detail}</small>
            <b aria-hidden="true">
              {intro().state === 'Completed'
                ? 'Replay'
                : intro().state === 'In progress'
                  ? 'Resume'
                  : 'Start'}
            </b>
          </button>

          <For each={GUITAR_NIGHT_LEARN_ACTIVITIES}>
            {(activity, index) => (
              <button
                ref={(element) => activityActions.set(activity.id, element)}
                type="button"
                class={styles.learnSetlistRow}
                onClick={() => props.onActivity(activity.id)}
              >
                <span>{String(index() + 2).padStart(2, '0')}</span>
                <span>
                  <strong>{activity.label}</strong>
                  <small>{activity.detail}</small>
                </span>
                <b aria-hidden="true">Open</b>
              </button>
            )}
          </For>
        </div>

        <p class={styles.learnShelfFootnote}>
          This set keeps {props.tuningLabel} until you return to the room.
        </p>
      </div>
    </div>
  )
}
