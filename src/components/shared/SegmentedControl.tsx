// ============================================================
// SegmentedControl — compact pill-group toggle (one active
// segment). Used in the song status bars (guitar sound + view).
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './status-bar/SongStatusBar.module.css'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  title?: string
  /** Optional data-tour hook on this segment (tours navigate via these). */
  dataTour?: string
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: () => T
  onChange: (value: T) => void
  /** Small muted label rendered inside the pill track (e.g. "Sound"). */
  label?: string
  /** Accessible group name; falls back to the label. */
  ariaLabel?: string
  dataTour?: string
  /** Stretch to the host's width, segments sharing it evenly (sidebar rows). */
  grow?: boolean
}

export function SegmentedControl<T extends string>(
  props: SegmentedControlProps<T>,
): ReturnType<Component> {
  return (
    <div
      class={styles.segmented}
      classList={{ [styles.segGrow]: props.grow === true }}
      role="radiogroup"
      aria-label={props.ariaLabel ?? props.label}
      data-tour={props.dataTour}
    >
      <Show when={props.label}>
        <span class={styles.segLabel}>{props.label}</span>
      </Show>
      <For each={props.options}>
        {(opt) => (
          <button
            type="button"
            class={styles.segBtn}
            classList={{ [styles.segActive]: props.value() === opt.value }}
            role="radio"
            aria-checked={props.value() === opt.value}
            title={opt.title}
            data-tour={opt.dataTour}
            onClick={() => props.onChange(opt.value)}
          >
            {opt.label}
          </button>
        )}
      </For>
    </div>
  )
}
