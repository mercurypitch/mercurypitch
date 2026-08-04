// ============================================================
// Beat 1 — Sky
// ============================================================
//
// The dark field, Merc drifting in, and one thing to do. No
// settings, no permissions, no account: the only cost so far is
// five seconds of attention.
//
// This is now the FIRST thing a visitor sees. There used to be a
// welcome card in front of it saying the same three things one screen
// earlier, whose call to action was "Show me around" — a promise of an
// interface tour, when what actually happens is that we listen to you
// sing and hand back a picture of your voice. Deleting it moved two
// jobs here: naming that outcome up front, and carrying the terms
// line, which has to appear before anything is measured.

import type { Component } from 'solid-js'
import { Mascot } from '@/components/Mascot'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import styles from '../onboarding.module.css'

export interface BeatSkyProps {
  onContinue: () => void
  /** Straight into the app. Same weight as the door's skip had. */
  onSkip: () => void
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
      us roughly where your voice sits. Ninety seconds more and you have a
      voiceprint: your range, how steadily you hold a note, and the legendary
      singer your voice overlaps with. Nothing is uploaded or stored; it all
      happens on your device.
    </p>

    <div class={styles.actions}>
      <button
        type="button"
        class={styles.primary}
        onClick={() => props.onContinue()}
      >
        Sing one note
      </button>
      <button
        type="button"
        class={styles.secondary}
        onClick={() => props.onSkip()}
      >
        Skip — take me in
      </button>
    </div>

    <p class={styles.consent}>
      By continuing, you agree to our{' '}
      <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
        Terms of Use
      </a>{' '}
      and{' '}
      <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
        Privacy Notice
      </a>
      .
    </p>
  </div>
)

export default BeatSky
