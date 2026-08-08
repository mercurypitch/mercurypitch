// ============================================================
// ComposeTakeReview — appears after a recording stops. Lets the user dial a
// single "cleanup amount" (gentle: as-sung -> strong: key-snapped + quantized)
// that live-re-segments the retained pitch contour, then keep or discard the
// take before it is committed to the melody.
// ============================================================

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import styles from './ComposeTakeReview.module.css'

interface ComposeTakeReviewProps {
  /** Cleanup amount, 0..1. */
  amount: () => number
  onAmount: (value: number) => void
  /** Timing nudge in ms; negative pulls the take earlier. */
  nudgeMs: () => number
  onNudgeMs: (value: number) => void
  /**
   * The measured mic round trip already removed at capture, in ms. Shown so
   * the singer knows the take is compensated before they reach for Timing.
   */
  compensatedMs: () => number
  /** Number of notes in the current (re-segmented) preview. */
  noteCount: () => number
  onCommit: () => void
  onDiscard: () => void
}

export const ComposeTakeReview: Component<ComposeTakeReviewProps> = (props) => {
  return (
    <div class={styles.panel} data-testid="take-review">
      <div class={styles.header}>
        <span class={styles.title}>Review take</span>
        <span class={styles.count}>{props.noteCount()} notes</span>
      </div>
      <div class={styles.sliderRow}>
        <span class={styles.end}>As sung</span>
        <input
          class={styles.slider}
          type="range"
          min="0"
          max="100"
          value={Math.round(props.amount() * 100)}
          aria-label="Cleanup amount"
          onInput={(e) => props.onAmount(Number(e.currentTarget.value) / 100)}
        />
        <span class={styles.end}>Clean</span>
      </div>
      <div class={styles.sliderRow}>
        <span class={styles.end}>Earlier</span>
        <input
          class={styles.slider}
          type="range"
          min="-200"
          max="200"
          step="5"
          value={props.nudgeMs()}
          aria-label="Timing nudge in milliseconds"
          data-testid="take-nudge"
          onInput={(e) => props.onNudgeMs(Number(e.currentTarget.value))}
          onDblClick={() => props.onNudgeMs(0)}
        />
        <span class={styles.end}>Later</span>
      </div>
      <div class={styles.hintRow}>
        <span class={styles.hint}>
          Timing: {props.nudgeMs() === 0 ? 'as sung' : `${props.nudgeMs()} ms`}
        </span>
        {/* The compensation note earns its place only when it applies — an
            unmeasured device would read "0 ms removed" as something broken. */}
        <Show when={props.compensatedMs() > 0}>
          <span class={styles.hint}>
            Mic delay of {props.compensatedMs()} ms already removed
          </span>
        </Show>
      </div>
      <div class={styles.actions}>
        <button
          type="button"
          class={styles.discard}
          data-testid="take-discard"
          onClick={() => props.onDiscard()}
        >
          Discard
        </button>
        <button
          type="button"
          class={styles.keep}
          data-testid="take-keep"
          onClick={() => props.onCommit()}
        >
          Keep
        </button>
      </div>
    </div>
  )
}
