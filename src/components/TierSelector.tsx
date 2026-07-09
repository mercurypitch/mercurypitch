// ============================================================
// TierSelector — Shared accuracy tier selection buttons
// Used in both WelcomeScreen and SettingsPanel
// ============================================================

import type { Component } from 'solid-js'
import { accuracyTier, applyAccuracyTier } from '@/stores/settings-store'
import styles from './TierSelector.module.css'

interface TierSelectorProps {
  /** Optional extra CSS class on the wrapper */
  class?: string
}

export const TierSelector: Component<TierSelectorProps> = (props) => {
  return (
    <div class={`${styles.tierSelector} ${props.class ?? ''}`}>
      <div class={styles.tierButtons}>
        <button
          class={`${styles.tierBtn} ${styles.tierLearning}${accuracyTier() === 'learning' ? ` ${styles.tierActive}` : ''}`}
          onClick={() => applyAccuracyTier('learning')}
          title="Perfect within 15 cents. Great for beginners starting out."
        >
          <span class={styles.tierIconWrap}>
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
          <span class={styles.tierName}>Learning</span>
          <span class={styles.tierDesc}>&plusmn;15 cents</span>
        </button>
        <button
          class={`${styles.tierBtn} ${styles.tierSinger}${accuracyTier() === 'singer' ? ` ${styles.tierActive}` : ''}`}
          onClick={() => applyAccuracyTier('singer')}
          title="Perfect within 8 cents. Good for intermediate singers."
        >
          <span class={styles.tierIconWrap}>
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
          <span class={styles.tierName}>Singer</span>
          <span class={styles.tierDesc}>&plusmn;8 cents</span>
        </button>
        <button
          class={`${styles.tierBtn} ${styles.tierProfessional}${accuracyTier() === 'professional' ? ` ${styles.tierActive}` : ''}`}
          onClick={() => applyAccuracyTier('professional')}
          title="Perfect within 0 cents. Advanced virtuoso level."
        >
          <span class={styles.tierIconWrap}>
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
          <span class={styles.tierName}>Professional</span>
          <span class={styles.tierDesc}>&plusmn;0 cents</span>
        </button>
      </div>
    </div>
  )
}
