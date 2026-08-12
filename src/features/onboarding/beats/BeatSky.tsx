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
//
// The three promises used to be one 60-word paragraph. Nobody reads a
// paragraph on a screen they have not decided to trust yet — they scan
// it for the catch and press the button. Three lines with a mark each
// survive a scan, and each one is a thing that actually happens in the
// next ninety seconds, in the order it happens: we name your note, we
// map your voice, and none of it leaves the device.

import type { Component, JSX } from 'solid-js'
import { For } from 'solid-js'
import { Mascot } from '@/components/Mascot'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import styles from '../onboarding.module.css'

/**
 * One mark per promise. Deliberately three different glyphs rather than
 * three identical bullets: the marks carry the shape of the flow (sing,
 * measure, stays put) before any of the words are read.
 */
const PROMISES: readonly { icon: () => JSX.Element; text: string }[] = [
  {
    // Microphone — the one thing we ask you to do.
    icon: () => (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
        />
        <path
          d="M18.5 11v.5a6.5 6.5 0 0 1-13 0V11M12 18v3"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
        />
      </svg>
    ),
    text: 'Sing one note and we will tell you which note it was.',
  },
  {
    // Rising bars — the range and steadiness that get measured.
    icon: () => (
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
      >
        <path d="M4 15v4M9 11v8M14 7v12M19 12v7" />
      </svg>
    ),
    text: 'Ninety seconds more maps your range, and the famous voice yours sits closest to.',
  },
  {
    // Padlock — the answer to the question everyone has at this screen.
    icon: () => (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M8 10V7.5a4 4 0 0 1 8 0V10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
        />
        <rect
          x="5"
          y="10"
          width="14"
          height="10"
          rx="2.5"
          fill="currentColor"
        />
      </svg>
    ),
    text: 'It all happens on your device. Nothing is uploaded, nothing is kept.',
  },
]

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
    <ul class={styles.promises}>
      <For each={PROMISES}>
        {(promise) => (
          <li class={styles.promise}>
            <span class={styles.promiseMark} aria-hidden="true">
              {promise.icon()}
            </span>
            {promise.text}
          </li>
        )}
      </For>
    </ul>

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
