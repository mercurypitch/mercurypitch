// ============================================================
// Notifications Store — toast queue
// ============================================================
//
// Toasts are pushed from anywhere and rendered by Notifications.tsx. Use a
// `channel` for any toast a user could trigger repeatedly (tour offers, save
// confirmations): showing a channelled toast clears the previous one on that
// channel, so a category can never stack up the screen.

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
  /**
   * Grouping key. A notification pushed with the same key while this one is
   * still on screen folds INTO it rather than stacking beside it or
   * replacing it -- see `NotificationOptions.group`.
   */
  groupKey?: string
  /** Every message folded in so far, in arrival order. */
  groupParts?: string[]
  /**
   * The summariser from the FIRST of the group, kept so the wording stays
   * put. Re-running the caller's summariser on each merge would re-roll a
   * randomised phrase and the toast would rewrite itself mid-read.
   */
  groupSummarise?: (parts: string[]) => string
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
  /**
   * Fold into a live notification with the same key.
   *
   * The third behaviour, beside stacking and `channel`'s replacing. Some
   * things arrive in bursts where every one is a fact worth keeping:
   * three people joining a room is not "Cy joined", and it is not three
   * toasts either. `summarise` is handed every message gathered so far and
   * writes the single line they become.
   */
  group?: { key: string; summarise: (parts: string[]) => string }
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

/**
 * When each live toast is due to go away.
 *
 * Kept so a merge can extend a toast that was about to expire without
 * granting it a whole fresh lifetime -- a steady trickle of arrivals would
 * otherwise pin one on screen indefinitely.
 */
const deadlines = new Map<number, number>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()

/** The shortest a merged toast gets to be read before it goes. */
const MIN_AFTER_MERGE_MS = 2500

function scheduleRemoval(id: number, inMs: number): void {
  const existing = timers.get(id)
  if (existing !== undefined) clearTimeout(existing)
  deadlines.set(id, Date.now() + inMs)
  timers.set(
    id,
    setTimeout(() => removeNotification(id), inMs),
  )
}

export function showNotification(
  message: string,
  type: Notification['type'] = 'info',
  opts?: NotificationOptions,
): void {
  const duration = opts?.durationMs ?? DEFAULT_DURATION_MS[type]
  const group = opts?.group

  if (group !== undefined) {
    const live = notifications().find((n) => n.groupKey === group.key)
    if (live !== undefined) {
      const parts = [...(live.groupParts ?? [live.message]), message]
      // The FIRST summariser, not this call's: a randomised phrase must
      // not be re-rolled halfway through somebody reading it.
      const write = live.groupSummarise ?? group.summarise
      setNotifications((list) =>
        list.map((n) =>
          n.id === live.id
            ? { ...n, message: write(parts), groupParts: parts }
            : n,
        ),
      )
      const left = (deadlines.get(live.id) ?? 0) - Date.now()
      scheduleRemoval(live.id, Math.max(left, MIN_AFTER_MERGE_MS))
      return
    }
  }

  const id = ++_notifId
  pushNotification({
    id,
    message: group === undefined ? message : group.summarise([message]),
    type,
    channel: opts?.channel,
    ...(group === undefined
      ? {}
      : {
          groupKey: group.key,
          groupParts: [message],
          groupSummarise: group.summarise,
        }),
  })
  scheduleRemoval(id, duration)
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
  const timer = timers.get(id)
  if (timer !== undefined) clearTimeout(timer)
  timers.delete(id)
  deadlines.delete(id)
  setNotifications((n) => n.filter((x) => x.id !== id))
}

/** Remove every notification currently on a given channel. */
export function removeNotificationsByChannel(channel: string): void {
  setNotifications((n) => n.filter((x) => x.channel !== channel))
}

export function getNotifications() {
  return notifications
}
