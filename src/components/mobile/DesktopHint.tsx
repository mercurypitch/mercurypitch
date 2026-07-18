// ============================================================
// DesktopHint — the "full studio lives on desktop" upsell row.
// ============================================================
//
// The deliberate funnel from the ad-driven phone visit to the desktop
// experience (decision D4). One shared component so the copy, action and
// analytics stay identical wherever it appears (More sheet, options
// sheets). Copies the site link via the platform share service.

import type { Component } from 'solid-js'
import { platform } from '@/lib/platform'
import { showNotification } from '@/stores/notifications-store'
import styles from './DesktopHint.module.css'

interface DesktopHintProps {
  /** Hint copy; defaults to the generic studio line. */
  message?: string
}

export const DesktopHint: Component<DesktopHintProps> = (props) => {
  const copyDesktopLink = (): void => {
    void platform
      .share({ title: 'MercuryPitch', url: window.location.origin })
      .then((ok) => {
        if (ok) showNotification('Link copied — open it on your computer')
      })
  }

  return (
    <div class={styles.hint}>
      <p>
        {props.message ??
          'The full studio — piano-roll editor, vocal analysis, stem mixing — lives on desktop.'}
      </p>
      <button class={styles.btn} onClick={copyDesktopLink}>
        Copy link
      </button>
    </div>
  )
}
