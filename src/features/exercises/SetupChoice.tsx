// ============================================================
// SetupChoice — one of a drill's setup pickers: a label over a row of chips
// ============================================================
//
// The pickers a drill's setup screen offers (Chord Stacker's Chords and
// Inversions, Drone Intonation's Tuning) in Read the Note's manner: a small
// caps label over a row of chips, the chosen one filled, each a thumb tall.
// The group says it handles Space itself (`data-exercise-native-space`),
// so Space on a chip presses the chip, where anywhere else on the page the
// shell's Space starts the run.

import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import styles from './SetupChoice.module.css'

export interface SetupChoiceOption<T extends string> {
  readonly value: T
  readonly label: string
}

export interface SetupChoiceProps<T extends string> {
  label: string
  options: readonly SetupChoiceOption<T>[]
  value: T
  onChange: (value: T) => void
}

export function SetupChoice<T extends string>(
  props: SetupChoiceProps<T>,
): JSX.Element {
  return (
    <div
      class={styles.choice}
      role="group"
      aria-label={props.label}
      data-exercise-native-space="true"
    >
      <span class={styles.label}>{props.label}</span>
      <div class={styles.chips}>
        <For each={props.options}>
          {(option) => (
            <button
              type="button"
              class={styles.chip}
              classList={{ [styles.chipOn]: props.value === option.value }}
              aria-pressed={props.value === option.value}
              onClick={() => props.onChange(option.value)}
            >
              {option.label}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

/** Several pickers, stacked and centred under the drill's other settings. */
export function SetupChoices(props: { children: JSX.Element }): JSX.Element {
  return <div class={styles.choices}>{props.children}</div>
}
