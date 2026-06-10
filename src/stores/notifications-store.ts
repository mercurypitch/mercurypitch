import { createSignal } from 'solid-js'

export interface Notification {
  id: number
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  /** Optional action button (e.g. "Undo") rendered in the toast. */
  action?: { label: string; onClick: () => void }
}

export const [notifications, setNotifications] = createSignal<Notification[]>(
  [],
)

let _notifId = 0

export function showNotification(
  message: string,
  type: Notification['type'] = 'info',
): void {
  const id = ++_notifId
  setNotifications((n) => [...n, { id, message, type }])
  setTimeout(() => removeNotification(id), 3000)
}

/** Show a notification with an action button (e.g. "Undo"). */
export function showActionNotification(
  message: string,
  type: Notification['type'],
  action: NonNullable<Notification['action']>,
): number {
  const id = ++_notifId
  setNotifications((n) => [...n, { id, message, type, action }])
  setTimeout(() => removeNotification(id), 6000)
  return id
}

/** Remove a notification by id immediately. Called by action onClick to dismiss. */
export function removeNotification(id: number): void {
  setNotifications((n) => n.filter((x) => x.id !== id))
}

export function getNotifications() {
  return notifications
}
