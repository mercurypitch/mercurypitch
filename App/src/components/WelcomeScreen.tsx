// ============================================================
// WelcomeScreen — first-run welcome overlay (GH #131)
// ============================================================

import { Component, createSignal } from 'solid-js';
import { appStore } from '@/stores/app-store';

interface WelcomeScreenProps {
  onEnableMic?: () => Promise<void>;
}

export const WelcomeScreen: Component<WelcomeScreenProps> = (props) => {
  const [micEnabled, setMicEnabled] = createSignal(false);
  const [micError, setMicError] = createSignal<string | null>(null);

  const handleEnableMic = async () => {
    try {
      if (props.onEnableMic) {
        await props.onEnableMic();
      }
      setMicEnabled(true);
      setMicError(null);
    } catch (err) {
      setMicError('Microphone access denied. Please enable it in your browser settings.');
    }
  };

  return (
    <div class="welcome-overlay" onClick={() => appStore.dismissWelcome()}>
      <div class="welcome-card" onClick={(e) => e.stopPropagation()}>
        <button
          class="overlay-close"
          onClick={() => appStore.dismissWelcome()}
          title="Dismiss"
        >
          &times;
        </button>

        {/* Hero */}
        <div class="welcome-hero">
          <svg class="welcome-icon" viewBox="0 0 24 24" width="48" height="48">
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
          <h3>Microphone Access</h3>
          <p>PitchPerfect needs microphone access to detect your singing pitch in real-time.</p>
          {!micEnabled() && !micError() && (
            <button class="welcome-mic-btn" onClick={handleEnableMic}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              Enable Microphone
            </button>
          )}
          {micEnabled() && (
            <div class="welcome-mic-success">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              Microphone enabled
            </div>
          )}
          {micError() && (
            <div class="welcome-mic-error">{micError()}</div>
          )}
        </div>

        {/* Features */}
        <div class="welcome-features">
          <div class="welcome-feature">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"
              />
            </svg>
            <div>
              <strong>Practice</strong>
              <p>Sing along to melodies and get real-time pitch feedback with detailed scoring</p>
            </div>
          </div>
          <div class="welcome-feature">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
              />
            </svg>
            <div>
              <strong>Create</strong>
              <p>Build melodies in the piano roll editor, import MIDI files, or record your own</p>
            </div>
          </div>
          <div class="welcome-feature">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"
              />
            </svg>
            <div>
              <strong>Improve</strong>
              <p>Track your progress over time with sessions, sessions, and detailed accuracy reports</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <button class="welcome-cta" onClick={() => appStore.dismissWelcome()}>
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M8 5v14l11-7z" />
          </svg>
          Ready to Sing?
        </button>
      </div>
    </div>
  );
};
