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
            {/* Explicit dismiss — toasts auto-expire, but a user who doesn't
                want the action (e.g. the "take a tour" offer) needs a way to
                clear it now, especially on a phone where it floats above the
                tab bar. */}
            <button
              class={styles.closeBtn}
              onClick={() => removeNotification(notif.id)}
              title="Dismiss"
              aria-label="Dismiss notification"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  d="M6 6l12 12M18 6L6 18"
                />
              </svg>
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
