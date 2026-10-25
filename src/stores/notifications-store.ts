// ============================================================
// Notifications Store — toast queue
// ============================================================
//
// Toasts are pushed from anywhere and rendered by Notifications.tsx. Use a
// `channel` for any toast a user could trigger repeatedly (save
// confirmations): showing a channelled toast clears the previous one on that
// channel, so a category can never stack up the screen.
//
// UNLOCKS ARE A KIND OF THEIR OWN. The grant engine passes `unlock` with
// each badge or achievement it announces, and that one option is what lets
// the native app route them (owner, 17 Oct 2026: two of them stacked at the
// bottom of a room and covered its controls):
//
//   - a room that holds a claim (`claimUnlocks`) takes them for the chip
//     under its result, and no toast is raised at all;
//   - under the native shell's pill (`setNotificationPresenter('pill')`),
//     unlocks from the same moment merge into one notice, and only one
//     notice is on screen at a time;
//   - on the web nothing changes: one toast each, worded by the caller.

import { createEffect, createRoot, createSignal, on } from 'solid-js'
import type { UnlockItem } from '@/lib/unlock-copy'
import { unlockSummary } from '@/lib/unlock-copy'
import { isNarrow } from '@/lib/use-viewport'
import type { ClaimedUnlock } from './unlock-claims'
import { currentClaim, resetUnlockClaims } from './unlock-claims'

export type { UnlockItem } from '@/lib/unlock-copy'
export type { ClaimedUnlock } from './unlock-claims'
export { claimUnlocks, onUnlockShown, unlockShown } from './unlock-claims'

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
  /**
   * The badges and achievements this notice announces, in the order they
   * were earned. Present only on an unlock (`NotificationOptions.unlock`);
   * under the pill, unlocks from the same moment gather here.
   */
  unlocks?: readonly UnlockItem[]
  /** When the first unlock of the set arrived; see `UNLOCK_MOMENT_MS`. */
  unlockAt?: number
}

/**
 * The tour offer's channel. The offer is a chip by the page title now
 * (TourChipHost), not a toast, so clearing this channel also counts in
 * `tourOfferRetired`, which the chip host listens to: a drill or a stage that
 * replaces what the offered tour walks still retires the offer.
 */
export const TOUR_OFFER_CHANNEL = 'page-tour-offer'

const [offerRetired, setOfferRetired] = createSignal(0)

/** How many times the tour offer was retired; see TOUR_OFFER_CHANNEL. */
export const tourOfferRetired = offerRetired

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
  /**
   * This notice announces a badge or an achievement. The message is still
   * the caller's, and it is what the web shows; the native shell's pill and
   * a room's chip word it themselves (unlock-copy.ts). See the header.
   */
  unlock?: UnlockItem
}

const DEFAULT_DURATION_MS: Record<Notification['type'], number> = {
  info: 6000,
  success: 6000,
  warning: 9000,
  error: 10000,
}

/** A phone shows this many toasts at once; the rest wait their turn. */
const MAX_VISIBLE_NARROW = 2

/**
 * Who draws the notices. `toast` is the web's stack (Notifications.tsx);
 * `pill` is the native shell's one-at-a-time pill under the status bar,
 * which the shell selects while it is mounted.
 */
export type NotificationPresenter = 'toast' | 'pill'

const [presenter, setPresenter] = createSignal<NotificationPresenter>('toast')

export const notificationPresenter = presenter

/**
 * Unlocks that arrive this close to the first of a set are the same moment,
 * and merge into its pill. One completion grants everything it earned in a
 * single pass, and a challenge's reward badge follows its pass by one
 * request, so a few seconds holds a whole set and nothing from a later take.
 */
export const UNLOCK_MOMENT_MS = 3000

/** How many notices may be on screen at once, where they are drawn now. */
function visibleCap(): number {
  if (presenter() === 'pill') return 1
  return isNarrow() ? MAX_VISIBLE_NARROW : Number.POSITIVE_INFINITY
}

/**
 * Choose who draws the notices. Narrowing to the pill hands every notice
 * past the first back to the queue, in order, the same way a rotation does.
 */
export function setNotificationPresenter(next: NotificationPresenter): void {
  setPresenter(next)
  evictOverflow()
  admitWaiting()
}

// The cap has to hold across a rotation, in BOTH directions. Widening past
// the phone breakpoint has room for everything that was waiting; narrowing
// back has to take back the slots it no longer has, or a landscape phone's
// four toasts all stay on screen in portrait — which is what it did, since
// the cap was only ever applied as a toast arrived.
//
// Both calls are guarded, so the order below is the whole logic: give the
// slots back first, then fill whatever is free.
// App-lifetime root: the store outlives every component.
createRoot(() => {
  createEffect(
    on(
      isNarrow,
      () => {
        evictOverflow()
        admitWaiting()
      },
      { defer: true },
    ),
  )
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

/**
 * Bring the visible stack back inside the phone cap after a rotation.
 *
 * The oldest stay: they have been readable longest and are nearest their
 * own end anyway. The overflow goes back to the FRONT of the queue in
 * arrival order — nothing is dropped, and the order a phone shows them in
 * is still the order they arrived in.
 *
 * A re-queued toast carries the time it had LEFT rather than a fresh full
 * lifetime — it has already been on screen — floored so one with 80ms on
 * the clock does not come back only to flash.
 */
function evictOverflow(): void {
  const overflow = notifications().slice(visibleCap())
  if (overflow.length === 0) return
  const requeued = overflow.map((notif) => {
    const left = (deadlines.get(notif.id) ?? 0) - Date.now()
    dropVisible(notif.id)
    return { notif, durationMs: Math.max(left, MIN_ON_SCREEN_MS) }
  })
  waiting.unshift(...requeued)
}

function admitWaiting(): void {
  while (waiting.length > 0 && notifications().length < visibleCap()) {
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
  if (notifications().length >= visibleCap()) {
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

/**
 * The shortest a toast gets to be read once it is (back) on screen.
 *
 * Two callers: a merge extending a toast that was about to expire, and a
 * toast a rotation pushed back into the queue coming round again.
 */
const MIN_ON_SCREEN_MS = 2500

function scheduleRemoval(id: number, inMs: number): void {
  const existing = timers.get(id)
  if (existing !== undefined) clearTimeout(existing)
  deadlines.set(id, Date.now() + inMs)
  timers.set(
    id,
    setTimeout(() => removeNotification(id), inMs),
  )
}

/**
 * An unlock that never becomes a notice of its own, and whether it was one:
 * a room's claim takes it, or the pill folds it into the set of its moment.
 */
function routedUnlock(
  message: string,
  type: Notification['type'],
  unlock: UnlockItem,
): boolean {
  const claim = currentClaim()
  if (claim !== undefined) {
    claim({ message, type, unlock })
    return true
  }
  return presenter() === 'pill' && mergeUnlock(unlock)
}

/** Fold a grouped arrival into a live or waiting toast; true when it did. */
function foldedIntoGroup(
  message: string,
  group: NonNullable<NotificationOptions['group']>,
): boolean {
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
    return true
  }
  const live = notifications().find((n) => n.groupKey === group.key)
  if (live === undefined) return false
  const parts = [...(live.groupParts ?? [live.message]), message]
  // The FIRST summariser, not this call's: a randomised phrase must
  // not be re-rolled halfway through somebody reading it.
  const write = live.groupSummarise ?? group.summarise
  setNotifications((list) =>
    list.map((n) =>
      n.id === live.id ? { ...n, message: write(parts), groupParts: parts } : n,
    ),
  )
  const left = (deadlines.get(live.id) ?? 0) - Date.now()
  scheduleRemoval(live.id, Math.max(left, MIN_ON_SCREEN_MS))
  return true
}

export function showNotification(
  message: string,
  type: Notification['type'] = 'info',
  opts?: NotificationOptions,
): void {
  const duration = opts?.durationMs ?? DEFAULT_DURATION_MS[type]
  const group = opts?.group
  const unlock = opts?.unlock

  if (unlock !== undefined && routedUnlock(message, type, unlock)) return
  if (group !== undefined && foldedIntoGroup(message, group)) return

  const id = ++_notifId
  // The pill words an unlock itself, the same way it words a merged set.
  const text =
    unlock !== undefined && presenter() === 'pill'
      ? unlockSummary([unlock])
      : message
  pushNotification(
    {
      id,
      message: group === undefined ? text : group.summarise([text]),
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
      ...(unlock === undefined
        ? {}
        : { unlocks: [unlock], unlockAt: Date.now() }),
    },
    duration,
  )
}

/**
 * Fold an unlock into the pill notice of the same moment, waiting or on
 * screen, and say whether there was one. A notice on screen is rewritten in
 * place and kept at least long enough to read again.
 */
function mergeUnlock(unlock: UnlockItem): boolean {
  const now = Date.now()
  const sameMoment = (notif: Notification): boolean =>
    notif.unlocks !== undefined &&
    now - (notif.unlockAt ?? 0) < UNLOCK_MOMENT_MS
  const merged = (notif: Notification): Notification => {
    const unlocks = [...(notif.unlocks ?? []), unlock]
    return { ...notif, unlocks, message: unlockSummary(unlocks) }
  }

  const queued = waiting.find((w) => sameMoment(w.notif))
  if (queued !== undefined) {
    queued.notif = merged(queued.notif)
    return true
  }
  const live = notifications().find(sameMoment)
  if (live === undefined) return false
  setNotifications((list) =>
    list.map((n) => (n.id === live.id ? merged(n) : n)),
  )
  const left = (deadlines.get(live.id) ?? 0) - now
  scheduleRemoval(live.id, Math.max(left, MIN_ON_SCREEN_MS))
  return true
}

/** Announce an unlock a room's claim held and never showed, as a notice. */
export function announceUnclaimed(claimed: ClaimedUnlock): void {
  showNotification(claimed.message, claimed.type, { unlock: claimed.unlock })
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
  if (channel === TOUR_OFFER_CHANNEL) setOfferRetired((n) => n + 1)
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
  resetUnlockClaims()
  setPresenter('toast')
  setNotifications([])
}

export function getNotifications() {
  return notifications
}
