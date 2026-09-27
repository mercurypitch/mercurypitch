// ============================================================
// CodeBoxes — six boxes over one real field
// ============================================================
//
// One <input>, not six. The keyboard's one-time-code suggestion fills a
// single field in one go, a paste lands whole, and a screen reader meets one
// labelled control instead of six unlabelled ones. The boxes are only its
// drawing: the field lies over them with its own text transparent, so a tap
// anywhere on the row lands in it.
//
// The second-factor pane also takes a recovery code (five characters, a dash,
// five more). That does not fit six boxes, so the moment a value stops being
// digits or runs past six the boxes step aside and the field shows itself.

import { For, Show } from 'solid-js'
import { CODE_LENGTH } from './sign-in-flow'

export interface CodeBoxesProps {
  value: string
  onInput: (value: string) => void
  /** The field's accessible name. */
  label: string
  /** Also take a recovery code, as plain text. */
  acceptsRecoveryCode?: boolean
  disabled?: boolean
  testId?: string
}

/** A recovery code: five, a dash, five. */
const RECOVERY_LENGTH = 11

const SLOTS = Array.from({ length: CODE_LENGTH }, (_, i) => i)

export function CodeBoxes(props: CodeBoxesProps) {
  const clean = (raw: string): string =>
    props.acceptsRecoveryCode === true
      ? raw.replace(/\s+/g, '').slice(0, RECOVERY_LENGTH)
      : raw.replace(/\D+/g, '').slice(0, CODE_LENGTH)

  // Past six, or anything but digits: not a code the boxes can draw.
  const free = (): boolean =>
    props.acceptsRecoveryCode === true &&
    (props.value.length > CODE_LENGTH || /\D/.test(props.value))

  return (
    <div class="mp-code" classList={{ 'mp-code--free': free() }}>
      <input
        class="mp-code__input"
        type="text"
        value={props.value}
        onInput={(e) => {
          const next = clean(e.currentTarget.value)
          // Keep the field in step when the cleaning dropped something.
          if (next !== e.currentTarget.value) e.currentTarget.value = next
          props.onInput(next)
        }}
        autocomplete="one-time-code"
        inputmode={props.acceptsRecoveryCode === true ? 'text' : 'numeric'}
        autocapitalize="characters"
        spellcheck={false}
        maxLength={
          props.acceptsRecoveryCode === true ? RECOVERY_LENGTH : CODE_LENGTH
        }
        aria-label={props.label}
        disabled={props.disabled}
        data-testid={props.testId}
      />
      <Show when={!free()}>
        <div class="mp-code__boxes" aria-hidden="true">
          <For each={SLOTS}>
            {(slot) => (
              <span
                class="mp-code__box"
                classList={{
                  'is-filled': slot < props.value.length,
                  'is-next': slot === props.value.length,
                }}
              >
                {props.value.charAt(slot)}
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
