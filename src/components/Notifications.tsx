// ============================================================
// Notifications — Toast notification system
// ============================================================

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { notifications } from '@/stores'
import styles from '@/styles/Notifications.module.css'

export const Notifications: Component = () => {
  return (
    <div class={styles.notificationContainer} role="region" aria-live="polite">
      <For each={notifications()}>
        {(notif) => (
          <div
            class={`${styles.notification} ${styles[notif.type]}`}
            role="alert"
          >
            {notif.message}
          </div>
        )}
      </For>
    </div>
  )
}
