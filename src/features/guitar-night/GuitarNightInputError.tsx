// Shared Guitar Night input error keeps cross-tab recovery one clear action away.
// ============================================================

import type { Accessor } from 'solid-js'
import { Show } from 'solid-js'
import styles from './GuitarNightApp.module.css'

interface GuitarNightInputErrorProps {
  message: Accessor<string | null>
  canTakeOver: Accessor<boolean>
  takeoverPending: Accessor<boolean>
  onTakeOver(): void
}

export function GuitarNightInputError(props: GuitarNightInputErrorProps) {
  return (
    <Show when={props.message()}>
      {(message) => (
        <div class={styles.listeningError} role="alert">
          <span>{message()}</span>
          <Show when={props.canTakeOver()}>
            <button
              type="button"
              disabled={props.takeoverPending()}
              aria-busy={props.takeoverPending()}
              onClick={() => props.onTakeOver()}
            >
              {props.takeoverPending() ? 'Moving input' : 'Use it here'}
            </button>
          </Show>
        </div>
      )}
    </Show>
  )
}
