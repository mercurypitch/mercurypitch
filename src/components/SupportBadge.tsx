// ============================================================
// Support Badge — a header double-pill: app version + Ko-fi heart
// ============================================================
// Left segment shows the running app version; right segment is a heart
// that links to the support (Ko-fi) page. Right-anchored in the header.

import type { Component } from 'solid-js'
import { APP_VERSION, COMMIT_SHA } from '@/lib/defaults'
import styles from './SupportBadge.module.css'

/** Where the heart links. Donation-only support for now (no feature gating);
 *  see docs/plans/premium.md. */
const SUPPORT_URL = 'https://ko-fi.com/chaosmatters'

export const SupportBadge: Component = () => {
  return (
    <div class={styles.badge}>
      <span
        class={styles.version}
        title={`MercuryPitch v${APP_VERSION} (${COMMIT_SHA})`}
      >
        v{APP_VERSION}
      </span>
      <a
        class={styles.support}
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Support MercuryPitch on Ko-fi"
        aria-label="Support MercuryPitch on Ko-fi"
      >
        <svg
          class={styles.heart}
          viewBox="0 0 24 24"
          width="15"
          height="15"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
      </a>
    </div>
  )
}
