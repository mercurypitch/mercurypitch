// ============================================================
// The way out of a separation that stopped
// ============================================================
//
// A cancelled or failed separation used to offer retrying and nothing else,
// and it sits above the branches that offer a room. So a reader who cancelled
// a separation and then attached a tab could reach neither: the file could not
// be put down, and the tab it was blocking could not be played.
//
// Two actions, both of them the reader's way forward: put the file down, or go
// and use the tab that is already attached and has nothing to do with it.

import { Show } from 'solid-js'
import styles from './GuitarNightApp.module.css'

export interface GuitarNightStoppedPreparationProps {
  onDiscard(): void
  /** Offered only when a tab is attached, because only then does it go anywhere. */
  onRehearseTab?: (() => void) | undefined
}

export function StoppedPreparationActions(
  props: GuitarNightStoppedPreparationProps,
) {
  return (
    <>
      <button
        class={styles.bandPreparationAction}
        type="button"
        onClick={() => props.onDiscard()}
      >
        Remove this file
      </button>
      <Show when={props.onRehearseTab}>
        {(rehearse) => (
          <button
            class={styles.bandPreparationAction}
            type="button"
            onClick={() => rehearse()()}
          >
            Rehearse the tab
          </button>
        )}
      </Show>
    </>
  )
}
