// ============================================================
// WelcomeScreen — first-run welcome overlay (GH #131)
// ============================================================

import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import { TierSelector } from '@/components/TierSelector'
import { appStore } from '@/stores'

interface WelcomeScreenProps {
  onTakeTour?: () => void
  onEnableMic?: () => Promise<void>
}

export const WelcomeScreen: Component<WelcomeScreenProps> = (props) => {
  const [micEnabled, setMicEnabled] = createSignal(false)
  const [micError, setMicError] = createSignal<string | null>(null)

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
    appStore.dismissWelcome()
  }

  const handleTakeTour = () => {
    appStore.dismissWelcome()
    if (props.onTakeTour) {
      props.onTakeTour()
    }
  }

  return (
    <div class="welcome-overlay" onClick={handleClose}>
      <div
        class="welcome-card"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <button class="welcome-close" onClick={handleClose} title="Dismiss">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>

        {/* Hero */}
        <div class="welcome-hero">
          <svg class="welcome-icon" viewBox="0 0 24 24" width="56" height="56">
            <path
              fill="currentColor"
              d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
            />
          </svg>
          <h1 class="welcome-title">Welcome to PitchPerfect</h1>
          <p class="welcome-subtitle">Your voice, visualized and refined</p>
        </div>

        {/* Mic Permission */}
        <div class="welcome-mic-section">
          <div class="welcome-mic-icon">
            <svg viewBox="0 0 24 24" width="20" height="20">
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
          <div class="welcome-mic-text">
            <strong>Microphone Access</strong>
            <p>
              PitchPerfect needs microphone access to detect your singing pitch
              in real-time.
            </p>
          </div>
          {micEnabled() === false && micError() === null && (
            <button
              class="welcome-mic-btn"
              onClick={() => void handleEnableMic()}
            >
              Enable Mic
            </button>
          )}
          {micEnabled() && (
            <div class="welcome-mic-success">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path
                  fill="currentColor"
                  d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                />
              </svg>
              Enabled
            </div>
          )}
          {micError() !== null && (
            <div class="welcome-mic-error">{micError()}</div>
          )}
        </div>

        {/* Features */}
        <div class="welcome-features">
          <div class="welcome-feature">
            <div class="welcome-feature-icon welcome-feature-icon-practice">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
                />
              </svg>
            </div>
            <div class="welcome-feature-text">
              <strong>Practice</strong>
              <p>
                Sing along to melodies with real-time pitch feedback and scoring
              </p>
            </div>
          </div>
          <div class="welcome-feature">
            <div class="welcome-feature-icon welcome-feature-icon-editor">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                />
              </svg>
            </div>
            <div class="welcome-feature-text">
              <strong>Create</strong>
              <p>
                Build melodies in the piano roll editor, import MIDI, or record
              </p>
            </div>
          </div>
          <div class="welcome-feature">
            <div class="welcome-feature-icon welcome-feature-icon-improve">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"
                />
              </svg>
            </div>
            <div class="welcome-feature-text">
              <strong>Improve</strong>
              <p>Track progress with sessions and detailed accuracy reports</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div class="welcome-actions">
          <button class="welcome-cta" onClick={handleClose}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M8 5v14l11-7z" />
            </svg>
            Start Singing
          </button>
          <button class="welcome-tour-btn" onClick={handleTakeTour}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
              />
            </svg>
            Take a Tour
          </button>
        </div>

        {/* Quick Accuracy Tier Select */}
        <div class="welcome-tier-select">
          <p class="welcome-tier-label">Choose your accuracy level:</p>
          <TierSelector />
        </div>
      </div>
    </div>
  )
}
