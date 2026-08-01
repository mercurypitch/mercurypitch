// ============================================================
// WelcomeScreen — the door (GH #131)
// ============================================================
//
// One line, two ways forward: take the guided First Light onboarding,
// or go straight into the app. Nothing else.
//
// This screen used to ask for microphone access, a vocal range and an
// accuracy tier before the visitor had heard a note — configuration
// before any value, and three questions a first-timer cannot answer.
// All of that now lives inside the flow, where it is earned:
//
//   mic          → beat 2, asked at the moment of intent
//   vocal range  → measured by the voiceprint, not guessed from a list
//   accuracy tier→ a sensible default, changeable in Settings
//   the tours    → the Map (beat 6)
//
// See docs/plans/onboarding-first-light.md.

import type { Component } from 'solid-js'
import { Mascot } from '@/components/Mascot'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
import { dismissWelcome } from '@/stores'
import styles from './WelcomeScreen.module.css'

interface WelcomeScreenProps {
  /** Start the guided onboarding. */
  onStart: () => void
}

export const WelcomeScreen: Component<WelcomeScreenProps> = (props) => {
  const handleSkip = () => {
    dismissWelcome()
  }

  const handleStart = () => {
    // The flow owns the seen-flag from here — dismissing now would let a
    // reload mid-onboarding drop the visitor into the app with no map.
    props.onStart()
  }

  return (
    <div class={styles.welcomeOverlay} onClick={handleSkip}>
      <div
        class={styles.welcomeCard}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <button
          class={styles.welcomeClose}
          onClick={handleSkip}
          title="Dismiss"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>

        <div class={styles.welcomeHero}>
          <span class={styles.welcomeDoorMascot} aria-hidden="true">
            <Mascot state="idle" size={64} title="" followPointer />
          </span>
          <h1 class={styles.welcomeTitle}>
            Welcome to <span class="app-title">MercuryPitch</span>
          </h1>
          <p class={styles.welcomeSubtitle}>
            Your voice, visualized and refined
          </p>
        </div>

        <div class={styles.welcomeActions}>
          <button class={styles.welcomeCta} onClick={handleStart}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
            Show me around
          </button>
          <button class={styles.welcomeTourBtn} onClick={handleSkip}>
            Skip — take me in
          </button>
        </div>

        <p class={styles.welcomeConsent}>
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
    </div>
  )
}
