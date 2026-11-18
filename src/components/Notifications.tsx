// ============================================================
// Notifications — Toast notification system
// ============================================================
//
// While a drill's stage presents the notices (the store's `stage`
// presenter), it draws nothing at all: Merc's bubble says them, one at a
// time (src/features/exercises/stage/StageNotice.tsx). While a room on the
// web holds them (the store's `pill` presenter), it draws the pill instead
// of the toasts, one at a time under the room's bar
// (src/components/notice-pill/NoticePill.tsx).

import type { Component } from 'solid-js'
import { For, lazy, Match, onMount, Show, Suspense, Switch } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { WEB_ROOMS } from '@/lib/native-build'
import { unlockNames } from '@/lib/unlock-copy'
// Import straight from the leaf store, not the @/stores barrel — the barrel
// pulls app-store, which would drag the whole app shell into the standalone
// karaoke/mirror entries that also mount this toast host.
import type { Notification } from '@/stores/notifications-store'
import { notificationPresenter, notifications, removeNotification, showActionNotification, showNotification, } from '@/stores/notifications-store'
import styles from '@/styles/Notifications.module.css'
import { AlertTriangle, CheckCircle, XCircle } from './icons'

// There is no title unless a caller asks for one.
//
// Severity used to supply a fallback heading — "Note", "Done", "Problem", and
// before that "Update" on every single `info` message, which made a saved
// display name announce itself like a pending app upgrade. But a word derived
// from the type says nothing the icon and the colour do not already say, and it
// cost a whole row to shout it. A title now only appears when the caller has a
// subject worth naming ("Update", "Microphone"), and it renders as a coloured
// prefix on the message rather than a heading above it.

/** A notice's type, as a mark: also the stage's (StageNotice.tsx). */
export const NotificationIcon: Component<{ type: Notification['type'] }> = (
  props,
) => (
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

/**
 * The pill the rooms hold on the web. In the web build alone, and lazy: its
 * code and its art load when a room first holds it, not with the page. The
 * native shell mounts its own, and never this host.
 */
const NoticePill = WEB_ROOMS
  ? lazy(() =>
      import('@/components/notice-pill/NoticePill').then((module) => ({
        default: module.NoticePill,
      })),
    )
  : null

export const Notifications: Component = () => {
  // Notices, raised the way the app raises them, for the specs that check
  // where they are drawn (room-notices.spec.ts); the native shell exposes
  // the same pair for its own walk. Under the specs' flag alone, read here
  // rather than through lib/test-utils: that would bring lib/defaults, and
  // with it the pitch-core chunk, into the standalone rooms' first paint.
  onMount(() => {
    const win = window as unknown as Record<string, unknown>
    if (win['E2E_TEST_MODE'] !== true) return
    win['mpNotices'] = {
      show: showNotification,
      showAction: showActionNotification,
    }
  })
  return (
    <>
      <div
        class={styles.notificationContainer}
        role="region"
        aria-label="Notifications"
      >
        <For each={notificationPresenter() === 'toast' ? notifications() : []}>
          {(notif) => (
            <div
              class={`${styles.notification} ${styles[notif.type]} ${
                notif.secondaryAction === undefined
                  ? ''
                  : styles.notificationChoice
              }`}
              role={notif.type === 'error' ? 'alert' : 'status'}
              aria-atomic="true"
            >
              <span class={styles.notificationIcon} aria-hidden="true">
                <NotificationIcon type={notif.type} />
              </span>
              <span class={styles.notificationBody}>
                <Show when={notif.title !== undefined && notif.title !== null}>
                  <strong>{notif.title}</strong>
                </Show>
                <span class={styles.notificationText}>{notif.message}</span>
                {/* A set of unlocks merged on a drill's stage keeps its names
                  when the drill is left with it still on screen. */}
                <Show when={(notif.unlocks?.length ?? 0) > 1}>
                  <span class={styles.notificationNames}>
                    {unlockNames(notif.unlocks ?? [])}
                  </span>
                </Show>
              </span>
              <Show when={notif.action !== undefined}>
                <span class={styles.notificationActions}>
                  <button
                    class={styles.actionBtn}
                    type="button"
                    onClick={() => {
                      notif.action?.onClick()
                      removeNotification(notif.id)
                    }}
                  >
                    {notif.action?.label}
                  </button>
                  <Show when={notif.secondaryAction !== undefined}>
                    <button
                      class={styles.secondaryActionBtn}
                      type="button"
                      onClick={() => {
                        notif.secondaryAction?.onClick()
                        removeNotification(notif.id)
                      }}
                    >
                      {notif.secondaryAction?.label}
                    </button>
                  </Show>
                </span>
              </Show>
              <button
                class={styles.closeBtn}
                type="button"
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
      <Show when={notificationPresenter() === 'pill' && NoticePill}>
        {(Pill) => (
          <div class={styles.pill}>
            <Suspense>
              <Dynamic component={Pill()} />
            </Suspense>
          </div>
        )}
      </Show>
    </>
  )
}
