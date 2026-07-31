// ============================================================
// Beat 1 — Sky
// ============================================================
//
// The dark field, Merc drifting in, and one thing to do. No
// settings, no permissions, no account: the only cost so far is
// five seconds of attention.

import type { Component } from 'solid-js'
import { Mascot } from '@/components/Mascot'
import styles from '../onboarding.module.css'

export interface BeatSkyProps {
  onContinue: () => void
}

export const BeatSky: Component<BeatSkyProps> = (props) => (
  <div class={styles.beat} data-beat="sky">
    <span class={styles.mascot} aria-hidden="true">
      <Mascot state="idle" size={92} title="" followPointer />
    </span>

    <p class={styles.eyebrow}>Welcome to MercuryPitch</p>
    <h1 class={styles.headline}>
      Your voice, <span class={styles.lit}>made visible</span>
    </h1>
    <p class={styles.sub}>
      Sing one note and watch it light the sky — that single note already tells
      us roughly where your voice sits. Sing a little more afterwards and we can
      map your whole range. Nothing is uploaded or stored; it all happens on
      your device.
    </p>

    <div class={styles.actions}>
      <button
        type="button"
        class={styles.primary}
        onClick={() => props.onContinue()}
      >
        Sing one note
      </button>
    </div>
  </div>
)

export default BeatSky
