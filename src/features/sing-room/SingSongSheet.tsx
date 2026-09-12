// ============================================================
// The song chip's sheet — what to do with the melody you loaded
// ============================================================
//
// Device round 2, R1. A melody stays loaded after a take, and the chip that
// names it used to go straight back to the song picker: there was no way to
// play the same one again and no way to put it down at all. Three answers,
// on a tap, because a long press is not discoverable.
//
// Remove is the only way back to the free tracker. It ends a melody run that
// is still going — taking the melody away from a run reading it would leave
// the trace measured against a target nobody can see — and ending it is the
// same ending as Stop: the end card if there is a take, otherwise rest.

import type { Component } from 'solid-js'
import { Sheet } from '@/components/mobile/Sheet'
import styles from './sing-room.module.css'

interface SingSongSheetProps {
  isOpen: boolean
  close: () => void
  /** The loaded melody's name, for the heading. */
  songName: () => string
  onPlayAgain: () => void
  onChangeSong: () => void
  onRemove: () => void
}

export const SingSongSheet: Component<SingSongSheetProps> = (props) => (
  <Sheet
    isOpen={props.isOpen}
    close={() => props.close()}
    ariaLabel="The loaded melody"
  >
    <div class={styles.takeSheet} data-testid="sing-song-sheet">
      <h2 class={styles.head}>{props.songName()}</h2>

      <button
        type="button"
        class={styles.capsule}
        onClick={() => props.onPlayAgain()}
        data-testid="sing-song-play-again"
      >
        Play again
      </button>
      <button
        type="button"
        classList={{ [styles.capsule]: true, [styles.capsuleSecondary]: true }}
        onClick={() => props.onChangeSong()}
        data-testid="sing-song-change"
      >
        Change song
      </button>
      <button
        type="button"
        classList={{ [styles.capsule]: true, [styles.capsuleSecondary]: true }}
        onClick={() => props.onRemove()}
        data-testid="sing-song-remove"
      >
        Remove
      </button>
    </div>
  </Sheet>
)
