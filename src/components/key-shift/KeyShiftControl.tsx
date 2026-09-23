// ============================================================
// KeyShiftControl — the karaoke key, in semitones
// ============================================================
//
// − and + step one semitone within ±6, and the readout goes back to the
// original key. Past ±4 the control is marked as a stretch: the engine still
// works there, but the backing starts to sound processed. The whole ±6 is
// offered and nothing is capped; the mark is the warning.
//
// "Find my key" belongs to the caller, which may apply a fit or ask for a
// voice type first. A known suggestion is shown on the button ("Try −3").
//
// Read-only (a Jam guest) shows the readout alone. A disabled reason (no
// engine on this device) disables every button and becomes its tooltip.

import type { Accessor, Component } from 'solid-js'
import { Show } from 'solid-js'
import { Crosshair, Minus, Plus } from '@/components/icons'
import { clampKeyShift, formatKeyShift, isCleanKeyShift, KEY_SHIFT_MAX, KEY_SHIFT_MIN, } from '@/lib/key-shift/key-shift'
import type { KeySuggestion } from '@/lib/key-shift/key-suggest'
import styles from './KeyShiftControl.module.css'

export const KEY_SHIFT_STRETCH_NOTE =
  'Beyond ±4 semitones the backing can sound processed'

/** What a host hands its key controls: the transport, the phone stage. */
export interface KeyShiftBinding {
  value: Accessor<number>
  onChange: (value: number) => void
  keyLabel: Accessor<string | undefined>
  suggestion: Accessor<KeySuggestion | null>
  onFindKey: () => void
  disabledReason: Accessor<string | undefined>
}

interface KeyShiftControlProps {
  value: number
  onChange: (value: number) => void
  /** The key the song lands on, e.g. "A major". */
  keyLabel?: string
  suggestion?: KeySuggestion | null
  onFindKey?: () => void
  readOnly?: boolean
  disabledReason?: string
  /** 'touch' is sized for a finger (the phone stage's sheet). */
  size?: 'compact' | 'touch'
}

function suggestionTitle(suggestion: KeySuggestion | null | undefined) {
  if (suggestion == null) return 'Fit the song to your voice'
  const shift = `${formatKeyShift(suggestion.keyShift)} semitones fits your voice`
  if (suggestion.octave < 0)
    return `${shift}, sung an octave lower than written`
  if (suggestion.octave > 0)
    return `${shift}, sung an octave higher than written`
  return shift
}

export const KeyShiftControl: Component<KeyShiftControlProps> = (props) => {
  const disabled = () => props.disabledReason !== undefined
  const stretch = () => !isCleanKeyShift(props.value)
  const change = (next: number) => {
    if (!disabled() && next !== props.value) props.onChange(next)
  }
  // Only worth offering while the song is somewhere else.
  const offer = () => {
    const suggestion = props.suggestion
    return suggestion != null && suggestion.keyShift !== props.value
      ? suggestion
      : null
  }
  const readoutLabel = () =>
    props.value === 0
      ? 'Key 0, the original key'
      : `Key ${formatKeyShift(props.value)}, back to the original key`

  return (
    <div
      class={styles.keyShift}
      role="group"
      aria-label="Key"
      data-testid="key-shift-control"
      data-quality={stretch() ? 'stretch' : 'clean'}
      data-size={props.size ?? 'compact'}
      title={
        props.disabledReason ?? (stretch() ? KEY_SHIFT_STRETCH_NOTE : undefined)
      }
    >
      <Show when={props.keyLabel}>
        {(label) => (
          <span class={styles.label} data-testid="key-shift-label">
            {label()}
          </span>
        )}
      </Show>
      <div class={styles.stepper}>
        <Show
          when={props.readOnly !== true}
          fallback={
            <span class={styles.value} data-testid="key-shift-value">
              {formatKeyShift(props.value)}
            </span>
          }
        >
          <button
            type="button"
            class={styles.step}
            aria-label="Lower the key"
            title={props.disabledReason}
            disabled={disabled() || props.value <= KEY_SHIFT_MIN}
            onClick={() => change(clampKeyShift(props.value - 1))}
          >
            <Minus size={props.size === 'touch' ? 18 : 12} />
          </button>
          <button
            type="button"
            class={styles.value}
            data-testid="key-shift-value"
            aria-label={readoutLabel()}
            title={props.disabledReason ?? 'Back to the original key'}
            disabled={disabled()}
            onClick={() => change(0)}
          >
            {formatKeyShift(props.value)}
          </button>
          <button
            type="button"
            class={styles.step}
            aria-label="Raise the key"
            title={props.disabledReason}
            disabled={disabled() || props.value >= KEY_SHIFT_MAX}
            onClick={() => change(clampKeyShift(props.value + 1))}
          >
            <Plus size={props.size === 'touch' ? 18 : 12} />
          </button>
        </Show>
      </div>
      <Show when={props.readOnly !== true && props.onFindKey}>
        {(onFindKey) => (
          <button
            type="button"
            class={styles.find}
            aria-label={
              offer() === null
                ? 'Find my key'
                : `Find my key: try ${formatKeyShift(offer()?.keyShift ?? 0)}`
            }
            title={props.disabledReason ?? suggestionTitle(props.suggestion)}
            disabled={disabled()}
            onClick={() => {
              if (!disabled()) onFindKey()()
            }}
          >
            <Crosshair />
            <span>
              {offer() === null
                ? 'Find my key'
                : `Try ${formatKeyShift(offer()?.keyShift ?? 0)}`}
            </span>
          </button>
        )}
      </Show>
    </div>
  )
}
