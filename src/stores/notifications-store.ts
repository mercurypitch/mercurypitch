import { createSignal } from 'solid-js'

export interface Notification {
  id: number
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  /** Optional action button (e.g. "Undo") rendered in the toast. */
  action?: { label: string; onClick: () => void }
  /**
   * Optional channel. Showing a notification with a channel first clears any
   * other notification already on that channel, so a whole *category* of toast
   * (e.g. the per-page "take a tour" offer) never stacks — only the latest is
   * ever on screen. Notifications without a channel behave as before.
   */
  channel?: string
}

/** Shared channel for the one-at-a-time "take a tour" offer toasts. */
export const TOUR_OFFER_CHANNEL = 'page-tour-offer'

export const [notifications, setNotifications] = createSignal<Notification[]>(
  [],
)

let _notifId = 0

export interface NotificationOptions {
  /** Replace any existing notification on this channel (see `Notification.channel`). */
  channel?: string
  /** Override how long the toast stays visible. Defaults are intentionally
   *  longer for warnings and errors so important feedback is not missed. */
  durationMs?: number
}

const DEFAULT_DURATION_MS: Record<Notification['type'], number> = {
  info: 6000,
  success: 6000,
  warning: 9000,
  error: 10000,
}

/** Append a notification, first evicting any prior toast sharing its channel. */
function pushNotification(notif: Notification): void {
  setNotifications((list) => {
    const base =
      notif.channel != null
        ? list.filter((n) => n.channel !== notif.channel)
        : list
    return [...base, notif]
  })
}

export function showNotification(
  message: string,
  type: Notification['type'] = 'info',
  opts?: NotificationOptions,
): void {
  const id = ++_notifId
  pushNotification({ id, message, type, channel: opts?.channel })
  setTimeout(
    () => removeNotification(id),
    opts?.durationMs ?? DEFAULT_DURATION_MS[type],
  )
}

/** Show a notification with an action button (e.g. "Undo"). */
export function showActionNotification(
  message: string,
  type: Notification['type'],
  action: NonNullable<Notification['action']>,
  opts?: NotificationOptions,
): number {
  const id = ++_notifId
  pushNotification({ id, message, type, action, channel: opts?.channel })
  setTimeout(() => removeNotification(id), opts?.durationMs ?? 10000)
  return id
}

/** Remove a notification by id immediately. Called by action onClick to dismiss. */
export function removeNotification(id: number): void {
  setNotifications((n) => n.filter((x) => x.id !== id))
}

/** Remove every notification currently on a given channel. */
export function removeNotificationsByChannel(channel: string): void {
  setNotifications((n) => n.filter((x) => x.channel !== channel))
}

export function getNotifications() {
  return notifications
}
