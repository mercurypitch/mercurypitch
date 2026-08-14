// Guitar Night live score renders one quiet, evidence-labelled stage readout.
// ============================================================

import type { Accessor } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import styles from './GuitarNightLiveScore.module.css'

export type GuitarNightLiveScoreVisualState =
  | 'needs-input'
  | 'ready'
  | 'count-in'
  | 'warming'
  | 'active'
  | 'paused'
  | 'complete'
  | 'unavailable'

export type GuitarNightLiveScoreBasis = 'notes' | 'notes-and-time'

interface GuitarNightLiveScoreProps {
  state: Accessor<GuitarNightLiveScoreVisualState>
  basis: Accessor<GuitarNightLiveScoreBasis>
  label: Accessor<string>
  detail: Accessor<string>
  score: Accessor<number | null>
  grade: Accessor<'S' | 'A' | 'B' | 'C' | 'D' | null>
  /** Semantic transitions only; rolling numbers deliberately stay silent. */
  announcement: Accessor<string>
}

export function GuitarNightLiveScore(props: GuitarNightLiveScoreProps) {
  const hasResult = createMemo(
    () => props.score() !== null && props.grade() !== null,
  )

  return (
    <aside
      class={styles.score}
      data-testid="guitar-night-live-score"
      data-state={props.state()}
      data-score-basis={props.basis()}
      aria-label="Live performance score"
    >
      <div class={styles.identity}>
        <span>{props.label()}</span>
        <strong>{props.detail()}</strong>
      </div>

      <Show when={hasResult()}>
        <div class={styles.result}>
          <output
            class={styles.grade}
            aria-label={`Live grade, ${props.grade()}`}
            aria-live="off"
          >
            {props.grade()}
          </output>
          <output
            class={styles.number}
            aria-label={`Live score, ${props.score()} out of 100`}
            aria-live="off"
          >
            <span>{props.score()}</span>
            <small aria-hidden="true">/100</small>
            <span class={styles.visuallyHidden}> out of 100</span>
          </output>
        </div>
      </Show>

      <span
        class={styles.visuallyHidden}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {props.announcement()}
      </span>
    </aside>
  )
}
