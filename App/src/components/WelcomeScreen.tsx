// ============================================================
// WelcomeScreen — first-run welcome overlay (GH #131)
// ============================================================

import { Component } from 'solid-js';
import { appStore } from '@/stores/app-store';

export const WelcomeScreen: Component = () => {
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
