// The one spinner. Everything that has to say "working on it" uses this.
// ============================================================
//
// Before this there was an `.icon-spin` class, a Loader2 import and a
// hand-rolled arc in about a dozen places, and the surfaces that needed it
// most — the buttons that leave for a whole other page — had none of them.
// On a slow connection those taps looked ignored.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import styles from './Spinner.module.css'

export interface SpinnerProps {
  /** Diameter in pixels. Defaults to the current text size. */
  size?: number | string
  class?: string
  /**
   * What is being waited for, announced politely. Omit inside a control that
   * already says so — a second voice repeating the button's own label is
   * noise to a screen reader, not help.
   */
  label?: string
}

export function Spinner(props: SpinnerProps): JSX.Element {
  const size = (): string =>
    typeof props.size === 'number' ? `${props.size}px` : (props.size ?? '1em')

  return (
    <span
      class={[styles.spinner, props.class].filter(Boolean).join(' ')}
      style={{ '--spinner-size': size() }}
      role={props.label === undefined ? undefined : 'status'}
      aria-hidden={props.label === undefined ? 'true' : undefined}
      data-testid="spinner"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle
          class={styles.track}
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          stroke-width="3"
        />
        <path
          class={styles.arc}
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
        />
      </svg>
      <Show when={props.label}>
        {(label) => <span class={styles.label}>{label()}</span>}
      </Show>
    </span>
  )
}
