// ============================================================
// WelcomeScreen — first-run welcome overlay (GH #131)
// ============================================================

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { TierSelector } from '@/components/TierSelector'
import { Tooltip } from '@/components/Tooltip'
import { VocalRangeSelector } from '@/components/VocalRangeSelector'
import { VoiceTypeDetectorModal } from '@/components/VoiceTypeDetectorModal'
import { ChangelogModal } from '@/components/ChangelogModal'
import { APP_VERSION } from '@/lib/defaults'
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal-links'
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
  const [showChangelog, setShowChangelog] = createSignal(false)

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
    // Open the guide dialog BEFORE dismissing the welcome overlay: Solid
    // effects run synchronously on writes, and the deferred onboarding survey
    // watches showWelcome — this order keeps a tour surface open the whole
    // hand-off so the survey can never slip in over the tour.
    if (props.onTakeTour) {
      props.onTakeTour()
    }
    dismissWelcome()
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
        <div class={styles.welcomeHero} style="margin-bottom: 12px;">
          <h1 class={styles.welcomeTitle} style="font-size: 1.3rem;">
            Welcome to <span class="app-title">MercuryPitch</span>
          </h1>
          <div class={styles.welcomeVersionPillRow}>
            <button
              type="button"
              class={styles.welcomeVersionPill}
              onClick={() => setShowChangelog(true)}
              title={`MercuryPitch v${APP_VERSION} — what's new`}
              aria-label="Show what's new (changelog)"
            >
              v{APP_VERSION} · What&rsquo;s new
            </button>
          </div>

          {/* Quick actions: mic permission + voice-range detection */}
          <div class={styles.welcomeQuickActions}>
            <Show
              when={!micEnabled()}
              fallback={
                <div class={styles.welcomeMicSuccess}>
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path
                      fill="currentColor"
                      d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                    />
                  </svg>{' '}
                  Mic enabled
                </div>
              }
            >
              <Tooltip
                text="Needed for real-time pitch detection — we listen locally, nothing is uploaded."
                placement="bottom"
              >
                <button
                  class={styles.welcomeQuickBtnPrimary}
                  onClick={() => void handleEnableMic()}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
                    />
                    <path
                      fill="currentColor"
                      d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
                    />
                  </svg>
                  Enable Mic
                </button>
              </Tooltip>
            </Show>
            <Tooltip
              text="Sing one steady note and we'll suggest your voice range."
              placement="bottom"
            >
              <button
                class={styles.welcomeQuickBtn}
                onClick={() => setShowVoiceDetector(true)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  aria-hidden="true"
                >
                  <path d="M3 12h2l2-6 3 12 3-9 2 5 2-2h4" />
                </svg>
                Find my voice
              </button>
            </Tooltip>
          </div>
          <Show when={micError() !== null}>
            <p class={styles.welcomeMicError}>{micError()}</p>
          </Show>
        </div>

        {/* Quick Setup: Voice & Accuracy */}
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;">
          <div class="welcome-tier-select" style="margin-top: 0;">
            <div class={styles.welcomeSectionHead}>
              <p class={styles.welcomeSectionTitle}>
                1. Select your singing voice range:
              </p>
              <Tooltip
                text="Sets the comfortable octave for exercises and melodies. Pick what matches your voice, or use Find my voice above to detect it."
                placement="left"
                clickToggle
              >
                <span class={styles.welcomeInfoDot} aria-label="What is this?">
                  <svg
                    viewBox="0 0 24 24"
                    width="11"
                    height="11"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="4" r="0.5" fill="currentColor" />
                    <path d="M12 10v10" />
                  </svg>
                </span>
              </Tooltip>
            </div>
            <VocalRangeSelector />
          </div>

          <div class="welcome-tier-select" style="margin-top: 0;">
            <div class={styles.welcomeSectionHead}>
              <p class={styles.welcomeSectionTitle}>
                2. Choose your accuracy level:
              </p>
              <Tooltip
                text="How strict the pitch scoring is — the smaller the cents window, the closer to perfect you must sing. You can change it any time in Settings."
                placement="left"
                clickToggle
              >
                <span class={styles.welcomeInfoDot} aria-label="What is this?">
                  <svg
                    viewBox="0 0 24 24"
                    width="11"
                    height="11"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="4" r="0.5" fill="currentColor" />
                    <path d="M12 10v10" />
                  </svg>
                </span>
              </Tooltip>
            </div>
            <TierSelector />
          </div>
        </div>

        {/* Actions */}
        <div class={styles.welcomeActions} style="margin-bottom: 14px;">
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

        {/* Consent — the canonical Terms/Privacy live on the marketing site;
            we link out rather than duplicate them in the app. */}
        <p style="text-align: center; font-size: 0.72rem; line-height: 1.45; color: var(--text-muted); margin: -2px 0 12px;">
          By continuing, you agree to our{' '}
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style="color: var(--accent); text-decoration: none;"
          >
            Terms of Use
          </a>{' '}
          and{' '}
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            style="color: var(--accent); text-decoration: none;"
          >
            Privacy Notice
          </a>
          .
        </p>

        {/* Voice Mirror — the zero-commitment hook: 60 seconds, no account */}
        <a
          href="/mirror"
          class={styles.welcomeMirrorCta}
          aria-label="Voice Mirror — your free 60-second voiceprint"
          onClick={() => {
            // Persist the dismissal before the full-page navigation, so
            // coming back from the mirror doesn't re-show this overlay.
            dismissWelcome()
          }}
        >
          <span class={styles.welcomeMirrorIcon} aria-hidden="true">
            ✦
          </span>
          <span class={styles.welcomeMirrorText}>
            <strong>Mirror your voice</strong>
            <small>
              Free 60-second voiceprint — your range, mapped in stars
            </small>
          </span>
          <span class={styles.welcomeMirrorArrow} aria-hidden="true">
            →
          </span>
        </a>
      </div>

      <Show when={showVoiceDetector()}>
        <VoiceTypeDetectorModal onClose={() => setShowVoiceDetector(false)} />
      </Show>

      <Show when={showChangelog()}>
        <ChangelogModal
          open={showChangelog()}
          onClose={() => setShowChangelog(false)}
        />
      </Show>
    </div>
  )
}
