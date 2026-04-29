import { createSignal } from 'solid-js'

export interface Notification {
  id: number
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
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
  setTimeout(() => {
    setNotifications((n) => n.filter((x) => x.id !== id))
  }, 3000)
}

export function getNotifications() {
  return notifications
}
