// ============================================================
// WelcomeScreen — first-run welcome overlay (GH #131)
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { TierSelector } from '@/components/TierSelector'
import { VocalRangeSelector } from '@/components/VocalRangeSelector'
import { VoiceTypeDetectorModal } from '@/components/VoiceTypeDetectorModal'
import { dismissWelcome } from '@/stores'
import styles from './WelcomeScreen.module.css'

interface WelcomeScreenProps {
  onTakeTour?: () => void
  onEnableMic?: () => Promise<void>
}

export const WelcomeScreen: Component<WelcomeScreenProps> = (props) => {
  const [micEnabled, setMicEnabled] = createSignal(false)
  const [micError, setMicError] = createSignal<string | null>(null)
  const [showVoiceDetector, setShowVoiceDetector] = createSignal(false)

  const handleEnableMic = async () => {
    try {
      if (props.onEnableMic) {
        await props.onEnableMic()
      }
      setMicEnabled(true)
      setMicError(null)
    } catch (_err) {
      setMicError(
        'Microphone access denied. Please enable it in your browser settings.',
      )
    }
  }

  const handleClose = () => {
    dismissWelcome()
  }

  const handleTakeTour = () => {
    dismissWelcome()
    if (props.onTakeTour) {
      props.onTakeTour()
    }
  }

  return (
    <div class={styles.welcomeOverlay} onClick={handleClose}>
      <div
        class={styles.welcomeCard}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <button
          class={styles.welcomeClose}
          onClick={handleClose}
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

        {/* Hero */}
        <div class={styles.welcomeHero} style="margin-bottom: 16px;">
          <h1 class={styles.welcomeTitle} style="font-size: 1.3rem;">
            Welcome to MercuryPitch
          </h1>
          <p class={styles.welcomeSubtitle}>
            Your voice, visualized and refined
          </p>
        </div>

        {/* Quick Setup: Voice & Accuracy */}
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
          <div class="welcome-tier-select" style="margin-top: 0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
              <p
                class="welcome-tier-label"
                style="font-weight: 600; margin: 0;"
              >
                1. Select your singing voice range:
              </p>
              <button
                onClick={() => setShowVoiceDetector(true)}
                style="background: transparent; border: none; color: var(--text-secondary); font-size: 0.75rem; cursor: pointer; text-decoration: underline;"
              >
                Find my voice
              </button>
            </div>
            <VocalRangeSelector />
          </div>

          <div class="welcome-tier-select" style="margin-top: 0;">
            <p
              class="welcome-tier-label"
              style="font-weight: 600; margin-bottom: 4px;"
            >
              2. Choose your accuracy level:
            </p>
            <TierSelector />
          </div>
        </div>

        {/* Actions */}
        <div class={styles.welcomeActions} style="margin-bottom: 20px;">
          <button class={styles.welcomeCta} onClick={handleClose}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
            Start Singing
          </button>
          <button class={styles.welcomeTourBtn} onClick={handleTakeTour}>
            Take a Tour
          </button>
        </div>

        {/* Mic Permission */}
        <div
          class={styles.welcomeMicSection}
          style="padding: 10px 14px; margin-bottom: 16px;"
        >
          <div class={styles.welcomeMicIcon} style="width: 28px; height: 28px;">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path
                fill="currentColor"
                d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
              />
              <path
                fill="currentColor"
                d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
              />
            </svg>
          </div>
          <div class={styles.welcomeMicText}>
            <strong>Microphone Access</strong>
            <p style="font-size: 0.7rem;">
              Required for real-time pitch detection.
            </p>
          </div>
          {micEnabled() === false && micError() === null && (
            <button
              class={styles.welcomeMicBtn}
              onClick={() => void handleEnableMic()}
              style="padding: 6px 12px; font-size: 0.75rem;"
            >
              Enable Mic
            </button>
          )}
          {micEnabled() && (
            <div class={styles.welcomeMicSuccess}>
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path
                  fill="currentColor"
                  d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                />
              </svg>{' '}
              Enabled
            </div>
          )}
          {micError() !== null && (
            <div class={styles.welcomeMicError}>{micError()}</div>
          )}
        </div>

        {/* Features - Compact Horizontal */}
        <div
          class={styles.welcomeFeatures}
          style="flex-direction: row; gap: 8px;"
        >
          <div
            class={styles.welcomeFeature}
            style="flex: 1; flex-direction: column; text-align: center; padding: 8px; gap: 4px;"
          >
            <div
              class={styles.welcomeFeatureIconPractice}
              style="width: 24px; height: 24px; display: inline-flex; justify-content: center; align-items: center; background: var(--bg-secondary); border-radius: 6px; margin: 0 auto;"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                />
              </svg>
            </div>
            <strong style="font-size: 0.75rem;">Practice</strong>
          </div>
          <div
            class={styles.welcomeFeature}
            style="flex: 1; flex-direction: column; text-align: center; padding: 8px; gap: 4px;"
          >
            <div
              class={styles.welcomeFeatureIconEditor}
              style="width: 24px; height: 24px; display: inline-flex; justify-content: center; align-items: center; background: var(--bg-secondary); border-radius: 6px; margin: 0 auto;"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                />
              </svg>
            </div>
            <strong style="font-size: 0.75rem;">Create</strong>
          </div>
          <div
            class={styles.welcomeFeature}
            style="flex: 1; flex-direction: column; text-align: center; padding: 8px; gap: 4px;"
          >
            <div
              class={styles.welcomeFeatureIconImprove}
              style="width: 24px; height: 24px; display: inline-flex; justify-content: center; align-items: center; background: var(--bg-secondary); border-radius: 6px; margin: 0 auto;"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"
                />
              </svg>
            </div>
            <strong style="font-size: 0.75rem;">Improve</strong>
          </div>
        </div>
      </div>

      <Show when={showVoiceDetector()}>
        <VoiceTypeDetectorModal onClose={() => setShowVoiceDetector(false)} />
      </Show>
    </div>
  )
}
