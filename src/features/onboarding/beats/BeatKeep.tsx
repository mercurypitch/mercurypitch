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
      Your voiceprint lives in this browser right now. Clearing your history
      loses it.
    </p>

    {/* The things an account actually buys, ordered by what someone
        holding a fresh voiceprint would care about — see the account
        value map in the owner's notes. Deliberately not led with "sync"
        or "cloud": those name the mechanism, not the loss. */}
    <ul class={styles.keepList}>
      <li>Your voice and practice history on any device</li>
      <li>Badges and challenge progress that stick</li>
      <li>A place on the leaderboard and the weekly Legend</li>
      <li>Cloud karaoke separation, credits and supporter perks</li>
    </ul>

    <div class={styles.actions}>
      <button
        type="button"
        class={styles.primary}
        onClick={() => props.onCreateAccount()}
      >
        Keep my voiceprint
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
      Free, takes a moment, and nothing you have already earned is locked behind
      it — badges and progress keep working either way.
    </p>
  </div>
)

export default BeatKeep
