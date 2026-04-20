// ============================================================
// Notifications — Toast notification system
// ============================================================

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { appStore } from '@/stores/app-store'
import styles from '@/styles/Notifications.module.css'

export const Notifications: Component = () => {
  return (
    <div class={styles.notificationContainer} role="region" aria-live="polite">
      <For each={appStore.notifications}>
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
