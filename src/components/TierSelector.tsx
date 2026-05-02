// ============================================================
// TierSelector — Shared accuracy tier selection buttons
// Used in both WelcomeScreen and SettingsPanel
// ============================================================

import type { Component } from 'solid-js'
import { accuracyTier, applyAccuracyTier } from '@/stores/settings-store'

interface TierSelectorProps {
  /** Optional extra CSS class on the wrapper */
  class?: string
}

export const TierSelector: Component<TierSelectorProps> = (props) => {
  return (
    <div class={`tier-selector ${props.class ?? ''}`}>
      <div class="welcome-tier-buttons">
        <button
          class={`welcome-tier-btn welcome-tier-learning${accuracyTier() === 'learning' ? ' tier-active' : ''}`}
          onClick={() => applyAccuracyTier('learning')}
          title="Perfect within 15 cents. Great for beginners starting out."
        >
          <span class="tier-icon-wrap">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 22c4-4 8-7.5 8-12a8 8 0 1 0-16 0c0 4.5 4 8 8 12z" />
              <path d="M12 12V8" />
              <path d="M10 14c0-1.1.9-2 2-2s2 .9 2 2" />
            </svg>
          </span>
          <span class="tier-name">Learning</span>
          <span class="tier-desc">&plusmn;15 cents</span>
        </button>
        <button
          class={`welcome-tier-btn welcome-tier-singer${accuracyTier() === 'singer' ? ' tier-active' : ''}`}
          onClick={() => applyAccuracyTier('singer')}
          title="Perfect within 8 cents. Good for intermediate singers."
        >
          <span class="tier-icon-wrap">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
          </span>
          <span class="tier-name">Singer</span>
          <span class="tier-desc">&plusmn;8 cents</span>
        </button>
        <button
          class={`welcome-tier-btn welcome-tier-professional${accuracyTier() === 'professional' ? ' tier-active' : ''}`}
          onClick={() => applyAccuracyTier('professional')}
          title="Perfect within 0 cents. Advanced virtuoso level."
        >
          <span class="tier-icon-wrap">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </span>
          <span class="tier-name">Professional</span>
          <span class="tier-desc">&plusmn;0 cents</span>
        </button>
      </div>
    </div>
  )
}
