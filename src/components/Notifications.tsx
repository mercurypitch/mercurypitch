// ============================================================
// Notifications — Toast notification system
// ============================================================

import type { Component } from 'solid-js'
import { For } from 'solid-js'
// Import straight from the leaf store, not the @/stores barrel — the barrel
// pulls app-store, which would drag the whole app shell into the standalone
// karaoke/mirror entries that also mount this toast host.
import { notifications, removeNotification } from '@/stores/notifications-store'
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
            <span class={styles.notificationText}>{notif.message}</span>
            {notif.action && (
              <button
                class={styles.actionBtn}
                onClick={() => {
                  notif.action!.onClick()
                  removeNotification(notif.id)
                }}
              >
                {notif.action.label}
              </button>
            )}
          </div>
        )}
      </For>
    </div>
  )
}
