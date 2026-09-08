// Free-form source modes remain distinct from the Listening input selector and Record action.
// ============================================================
/* Inherit Velvet Rehearsal: compact amber controls by source identity, leaving
   the instrument and the two-row transport intact. Live is view-only consent. */
import { For, Show } from 'solid-js'
import styles from './GuitarFreeFormModePicker.module.css'
import type { GuitarFreeFormMode } from './useGuitarFreeFormModes'

const MODES: readonly {
  mode: GuitarFreeFormMode
  label: string
  detail: string
}[] = [
  {
    mode: 'live',
    label: 'Live',
    detail: 'See what you play without recording',
  },
  {
    mode: 'replay',
    label: 'Replay',
    detail: 'Hear your recording or its notes',
  },
  {
    mode: 'practice',
    label: 'Practice',
    detail: 'Score your playing against accepted melody notes',
  },
]

export function GuitarFreeFormModePicker(props: {
  mode: GuitarFreeFormMode
  pending: string | null
  disabled: boolean
  recording?: boolean
  sourceTitle: string | null
  onSelect(mode: GuitarFreeFormMode): void
  onCancel(): void
}) {
  return (
    <div class={styles.picker} data-testid="guitar-free-form-modes">
      <div class={styles.modes} role="group" aria-label="Free-form mode">
        <For each={MODES}>
          {(item) => (
            <button
              type="button"
              aria-pressed={props.mode === item.mode}
              disabled={props.disabled}
              title={item.detail}
              onClick={() => props.onSelect(item.mode)}
            >
              {item.label}
            </button>
          )}
        </For>
      </div>
      <Show
        when={props.pending !== null}
        fallback={
          <span class={styles.source} title={props.sourceTitle ?? undefined}>
            {props.recording === true
              ? 'Recording audio and notes'
              : props.mode === 'live'
                ? 'You played · not recording'
                : (props.sourceTitle ?? 'Choose a melody')}
          </span>
        }
      >
        <button
          class={styles.cancel}
          type="button"
          onClick={() => props.onCancel()}
        >
          Cancel mode change
        </button>
      </Show>
    </div>
  )
}
