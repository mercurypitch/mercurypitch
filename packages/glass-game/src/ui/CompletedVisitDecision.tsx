// Completed visit decision — choose replay, review or leave before any 3D gallery resources load.

import { focusDialog, trapDialogKeys } from './dialog-focus'
import styles from './GlassAdventure.module.css'

interface CompletedVisitDecisionProps {
  levelId: string
  levelTitle: string
  continueLabel?: string
  onContinue?(): void
  onExit(): void
  onRestart(): void
  onReview(): void
}

export function CompletedVisitDecision(props: CompletedVisitDecisionProps) {
  const titleId = () => `glass-completed-visit-${props.levelId}`
  return (
    <div
      class={styles.adventure}
      data-testid="glass-completed-visit"
      data-level-id={props.levelId}
    >
      <div class={styles.scrim}>
        <section
          class={styles.pausePanel}
          ref={focusDialog}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              props.onExit()
              return
            }
            trapDialogKeys(event)
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId()}
        >
          <div class={styles.completionMark} aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />
            </svg>
          </div>
          <h2 id={titleId()}>{props.levelTitle} is already complete.</h2>
          <p>
            Your finished visit is saved. Start again from the entrance, or
            review its rewards and encore.
          </p>
          <button
            class={styles.primary}
            type="button"
            onClick={() => props.onRestart()}
          >
            Play this gallery again
          </button>
          <button
            class={styles.textButton}
            type="button"
            onClick={() => props.onReview()}
          >
            Review completion
          </button>
          {props.onContinue !== undefined && (
            <button
              class={styles.textButton}
              type="button"
              onClick={() => props.onContinue?.()}
            >
              {props.continueLabel ?? 'Visit the next gallery'}
            </button>
          )}
          <button
            class={styles.textButton}
            type="button"
            onClick={() => props.onExit()}
          >
            Leave museum
          </button>
        </section>
      </div>
    </div>
  )
}
