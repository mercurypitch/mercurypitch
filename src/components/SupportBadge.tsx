// ============================================================
// Support Badge — a header double-pill: app version + support heart
// ============================================================
// Left segment shows the running app version; right segment is a heart that
// opens the in-app support surface. Right-anchored in the header.

import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { ChangelogModal } from '@/components/ChangelogModal'
import { APP_VERSION, COMMIT_SHA } from '@/lib/defaults'
import styles from './SupportBadge.module.css'

/** Where the heart goes. Settings → Credits is where every support option now
 *  lives — supporter tiers, Ko-fi, Sponsors — rather than one off-site link.
 *  Donations never gate features; see docs/plans/premium.md. */
const SUPPORT_HASH = '#/settings/credits'

export const SupportBadge: Component = () => {
  const [showChangelog, setShowChangelog] = createSignal(false)
  return (
    <div class={styles.badge}>
      <button
        type="button"
        class={styles.version}
        title={`MercuryPitch v${APP_VERSION} (${COMMIT_SHA}) — what's new`}
        aria-label="Show the changelog"
        onClick={() => setShowChangelog(true)}
      >
        v{APP_VERSION}
      </button>
      <Show when={showChangelog()}>
        <ChangelogModal
          open={showChangelog()}
          onClose={() => setShowChangelog(false)}
        />
      </Show>
      <a
        class={styles.support}
        href={SUPPORT_HASH}
        title="Support MercuryPitch"
        aria-label="Support MercuryPitch"
        data-testid="support-heart"
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
