// ============================================================
// Beat 7 — Keep
// ============================================================
//
// The one ask, at the moment of most earned value: the twin is still
// on screen and it belongs to them. So the offer is that specific
// thing rather than a generic "save your progress" —
//
//   "Freddie Mercury is your twin. Keep him."
//
// What makes it honest rather than a wall: the voiceprint is ALREADY
// saved locally by the time this renders. Declining costs nothing that
// second. What an account adds is that it survives the browser, the
// device and the cache clear, and that it accumulates into a timeline.
//
// "Not now" is the same size as the primary and does not flinch.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { LOCAL_CAP } from '@/db/services/voiceprint-service'
import { LegendCaricature } from '@/features/mirror/LegendCaricature'
import styles from '../onboarding.module.css'

export interface BeatKeepProps {
  /** The legend matched at beat 5, or null when none was. */
  twin: string | null
  onCreateAccount: () => void
  onDismiss: () => void
}

export const BeatKeep: Component<BeatKeepProps> = (props) => (
  <div class={styles.beat} data-beat="keep">
    <Show when={props.twin !== null}>
      <span class={styles.twinArtSmall} aria-hidden="true">
        <LegendCaricature legend={props.twin ?? ''} />
      </span>
    </Show>

    <p class={styles.eyebrow}>Keep it</p>
    <Show
      when={props.twin !== null}
      fallback={<h1 class={styles.headline}>Keep your voiceprint</h1>}
    >
      <h1 class={styles.headline}>
        <span class={styles.lit}>{props.twin}</span> is your twin
      </h1>
    </Show>

    <p class={styles.sub}>
      Keep them — and every voiceprint you make from here, so you can watch your
      range grow.
    </p>

    <ul class={styles.keepList}>
      <li>Your twin and your numbers, on every device you sing on</li>
      <li>
        Every voiceprint you make, not just the last {LOCAL_CAP} on this browser
      </li>
      <li>
        A timeline of how your voice changes — <em>+3 semitones since March</em>
      </li>
    </ul>

    <div class={styles.actions}>
      <button
        type="button"
        class={styles.primary}
        onClick={() => props.onCreateAccount()}
      >
        Create a free account
      </button>
      <button
        type="button"
        class={styles.secondary}
        onClick={() => props.onDismiss()}
      >
        Not now
      </button>
    </div>

    <p class={styles.keepFootnote}>
      Your voiceprint is already saved on this device either way. An account is
      what stops it disappearing with your browser history.
    </p>
  </div>
)

export default BeatKeep
