// ============================================================
// Notifications — Toast notification system
// ============================================================

import type { Component } from 'solid-js'
import { For, Match, Show, Switch } from 'solid-js'
// Import straight from the leaf store, not the @/stores barrel — the barrel
// pulls app-store, which would drag the whole app shell into the standalone
// karaoke/mirror entries that also mount this toast host.
import type { Notification } from '@/stores/notifications-store'
import { notifications, removeNotification } from '@/stores/notifications-store'
import styles from '@/styles/Notifications.module.css'
import { AlertTriangle, CheckCircle, XCircle } from './icons'

// Fallback titles, used only when a caller gives no `title` of its own.
//
// These can describe severity and nothing else, so they are deliberately
// plain. `info` used to read "Update", which made every ordinary message in
// the app — a saved name, a loaded song — announce itself like a pending app
// update; "Update" now belongs to the one toast that means it (the service
// worker's, in src/index.tsx). Anything that can name its own subject should
// pass `title` instead of leaning on these.
const NOTIFICATION_LABELS: Record<Notification['type'], string> = {
  info: 'Note',
  success: 'Done',
  warning: 'Heads up',
  error: 'Problem',
}

/**
 * The caps line for a toast: the caller's title, else a word for its type.
 * `null` is a caller saying "no title" — the message stands on its own.
 */
function notificationTitle(notif: Notification): string | null {
  if (notif.title !== undefined) return notif.title
  return NOTIFICATION_LABELS[notif.type]
}

const NotificationIcon: Component<{ type: Notification['type'] }> = (props) => (
  <Switch>
    <Match when={props.type === 'success'}>
      <CheckCircle />
    </Match>
    <Match when={props.type === 'warning'}>
      <AlertTriangle />
    </Match>
    <Match when={props.type === 'error'}>
      <XCircle />
    </Match>
    <Match when={props.type === 'info'}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="11" x2="12" y2="16" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </Match>
  </Switch>
)

export const Notifications: Component = () => {
  return (
    <div
      class={styles.notificationContainer}
      role="region"
      aria-label="Notifications"
    >
      <For each={notifications()}>
        {(notif) => (
          <div
            class={`${styles.notification} ${styles[notif.type]}`}
            role={notif.type === 'error' ? 'alert' : 'status'}
            aria-atomic="true"
          >
            <span class={styles.notificationIcon} aria-hidden="true">
              <NotificationIcon type={notif.type} />
            </span>
            <span class={styles.notificationBody}>
              <Show when={notificationTitle(notif)}>
                {(title) => <strong>{title()}</strong>}
              </Show>
              <span class={styles.notificationText}>{notif.message}</span>
            </span>
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
            <button
              class={styles.closeBtn}
              onClick={() => removeNotification(notif.id)}
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
