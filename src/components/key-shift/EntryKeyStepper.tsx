// ============================================================
// EntryKeyStepper — a playlist entry's key, beside its vocal level
// ============================================================
//
// Unset ("default") means every song of the entry plays in its own
// remembered key. Once set — 0 included — it overrides that for this singer.
// Stepping from "default" starts at the original key.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { Minus, Plus, X } from '@/components/icons'
import { clampKeyShift, formatKeyShift, KEY_SHIFT_MAX, KEY_SHIFT_MIN, } from '@/lib/key-shift/key-shift'
import styles from './EntryKeyStepper.module.css'

interface EntryKeyStepperProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
}

export const EntryKeyStepper: Component<EntryKeyStepperProps> = (props) => {
  const current = () => props.value ?? 0
  const step = (delta: number) => {
    const next = clampKeyShift(current() + delta)
    if (props.value === undefined || next !== props.value) props.onChange(next)
  }

  return (
    <div
      class={styles.entryKey}
      title="This singer's key for every song of this entry, in semitones"
    >
      <span class={styles.label}>Key</span>
      <button
        type="button"
        class={styles.step}
        aria-label="Lower this entry's key"
        disabled={props.value !== undefined && current() <= KEY_SHIFT_MIN}
        onClick={() => step(-1)}
      >
        <Minus size={12} />
      </button>
      <span class={styles.value} data-testid="entry-key-value">
        {props.value === undefined ? 'default' : formatKeyShift(props.value)}
      </span>
      <button
        type="button"
        class={styles.step}
        aria-label="Raise this entry's key"
        disabled={props.value !== undefined && current() >= KEY_SHIFT_MAX}
        onClick={() => step(1)}
      >
        <Plus size={12} />
      </button>
      <Show when={props.value !== undefined}>
        <button
          type="button"
          class={styles.clear}
          aria-label="Use each song's own key"
          title="Use each song's own key"
          onClick={() => props.onChange(undefined)}
        >
          <X />
        </button>
      </Show>
    </div>
  )
}
