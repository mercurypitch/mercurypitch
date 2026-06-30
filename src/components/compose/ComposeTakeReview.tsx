// ============================================================
// ComposeTakeReview — appears after a recording stops. Lets the user dial a
// single "cleanup amount" (gentle: as-sung -> strong: key-snapped + quantized)
// that live-re-segments the retained pitch contour, then keep or discard the
// take before it is committed to the melody.
// ============================================================

import type { Component } from 'solid-js'
import styles from './ComposeTakeReview.module.css'

interface ComposeTakeReviewProps {
  /** Cleanup amount, 0..1. */
  amount: () => number
  onAmount: (value: number) => void
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
