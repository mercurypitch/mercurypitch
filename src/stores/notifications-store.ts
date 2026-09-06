// ============================================================
// Notifications Store — toast queue
// ============================================================
//
// Toasts are pushed from anywhere and rendered by Notifications.tsx. Use a
// `channel` for any toast a user could trigger repeatedly (tour offers, save
// confirmations): showing a channelled toast clears the previous one on that
// channel, so a category can never stack up the screen.

import { createEffect, createRoot, createSignal, on } from 'solid-js'
import { isNarrow } from '@/lib/use-viewport'

export interface NotificationAction {
  label: string
  onClick: () => void
}

export interface Notification {
  id: number
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  /**
   * An optional subject for the toast, rendered as a coloured prefix ON the
   * message — same size, same line — not as a heading above it.
   *
   * There is no fallback: omit it (or pass `null`) and the toast shows the
   * message alone, which is the right answer for nearly everything. Set it only
   * when the toast belongs to something the reader would recognise on sight —
   * "Update", "Offline", "Microphone". A word derived from the `type` says
   * nothing the icon and the colour do not, and an earlier version that put one
   * above every message made a saved display name look like an app update.
   */
  title?: string | null
  /** Optional action button (e.g. "Undo") rendered in the toast. */
  action?: NotificationAction
  /** Optional quiet alternative for a two-choice notification. */
  secondaryAction?: NotificationAction
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
  /** Subject prefix on the message — see `Notification.title`. */
  title?: string | null
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

/** A phone shows this many toasts at once; the rest wait their turn. */
const MAX_VISIBLE_NARROW = 2

/** The app's own phone breakpoint, reactive; false where there is no DOM. */
function narrowViewport(): boolean {
  return isNarrow()
}

// A window that widens past the phone breakpoint has room for everything
// that was waiting; without this they waited for a visible toast to go.
// App-lifetime root: the store outlives every component.
createRoot(() => {
  createEffect(on(isNarrow, () => admitWaiting(), { defer: true }))
})

/**
 * Toasts that arrived while a phone already showed its two. First in, first
 * out: a full-width toast covers content, and four of them stacked on a
 * phone covered the whole lower half. A waiting toast's clock starts when it
 * is shown, not when it was asked for.
 */
const waiting: Array<{ notif: Notification; durationMs: number }> = []

function dropWaiting(match: (notif: Notification) => boolean): void {
  for (let i = waiting.length - 1; i >= 0; i -= 1) {
    if (match(waiting[i]!.notif)) waiting.splice(i, 1)
  }
}

function dropVisible(id: number): void {
  const timer = timers.get(id)
  if (timer !== undefined) clearTimeout(timer)
  timers.delete(id)
  deadlines.delete(id)
  setNotifications((n) => n.filter((x) => x.id !== id))
}

function admitWaiting(): void {
  while (
    waiting.length > 0 &&
    (!narrowViewport() || notifications().length < MAX_VISIBLE_NARROW)
  ) {
    const next = waiting.shift()!
    setNotifications((list) => [...list, next.notif])
    scheduleRemoval(next.notif.id, next.durationMs)
  }
}

/** Append a notification, first evicting any prior toast sharing its channel. */
function pushNotification(notif: Notification, durationMs: number): void {
  const channel = notif.channel
  if (channel != null) {
    dropWaiting((n) => n.channel === channel)
    for (const stale of notifications().filter((n) => n.channel === channel))
      dropVisible(stale.id)
  }
  if (narrowViewport() && notifications().length >= MAX_VISIBLE_NARROW) {
    waiting.push({ notif, durationMs })
    return
  }
  setNotifications((list) => [...list, notif])
  scheduleRemoval(notif.id, durationMs)
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
    const queued = waiting.find((w) => w.notif.groupKey === group.key)
    if (queued !== undefined) {
      const parts = [
        ...(queued.notif.groupParts ?? [queued.notif.message]),
        message,
      ]
      const write = queued.notif.groupSummarise ?? group.summarise
      queued.notif = {
        ...queued.notif,
        message: write(parts),
        groupParts: parts,
      }
      return
    }
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
  pushNotification(
    {
      id,
      message: group === undefined ? message : group.summarise([message]),
      type,
      channel: opts?.channel,
      // Spread-guarded so an absent option stays absent rather than becoming
      // an explicit `undefined`, which `title in notif` checks would then see.
      ...(opts !== undefined && 'title' in opts ? { title: opts.title } : {}),
      ...(group === undefined
        ? {}
        : {
            groupKey: group.key,
            groupParts: [message],
            groupSummarise: group.summarise,
          }),
    },
    duration,
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
  pushNotification(
    {
      id,
      message,
      type,
      action,
      channel: opts?.channel,
      ...(opts !== undefined && 'title' in opts ? { title: opts.title } : {}),
    },
    opts?.durationMs ?? 10000,
  )
  return id
}

/** Show a notification with one primary and one quieter explicit choice. */
export function showDecisionNotification(
  message: string,
  type: Notification['type'],
  action: NotificationAction,
  secondaryAction: NotificationAction,
  opts?: NotificationOptions,
): number {
  const id = ++_notifId
  pushNotification(
    {
      id,
      message,
      type,
      action,
      secondaryAction,
      channel: opts?.channel,
      ...(opts !== undefined && 'title' in opts ? { title: opts.title } : {}),
    },
    opts?.durationMs ?? 10000,
  )
  return id
}

/** Remove a notification by id immediately. Called by action onClick to dismiss. */
export function removeNotification(id: number): void {
  if (waiting.some((w) => w.notif.id === id)) {
    dropWaiting((n) => n.id === id)
    return
  }
  dropVisible(id)
  admitWaiting()
}

/** Remove every notification currently on a given channel. */
export function removeNotificationsByChannel(channel: string): void {
  dropWaiting((n) => n.channel === channel)
  for (const stale of notifications().filter((n) => n.channel === channel))
    dropVisible(stale.id)
  admitWaiting()
}

/** Forget every toast, shown or waiting, and its clock. For tests. */
export function resetNotifications(): void {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
  deadlines.clear()
  waiting.length = 0
  setNotifications([])
}

export function getNotifications() {
  return notifications
}
