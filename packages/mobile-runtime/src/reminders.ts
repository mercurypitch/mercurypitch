// ============================================================
// Reminders — a notification the phone shows by itself, later
// ============================================================
//
// A reminder is a local notification: the phone shows it at the time the app
// chose, with no server and nothing of the app running. Each one is for one
// date. A repeating trigger can neither start tomorrow when it is set before
// its hour nor keep quiet on one day, so a product that needs either
// schedules the days it means.
//
// Android: from Android 12, an app that has not been allowed exact alarms
// (SCHEDULE_EXACT_ALARM, which this app does not ask for) gets an inexact
// one, which the system may deliver somewhat after its time; a reminder a
// little late is still a reminder. `allowWhileIdle` lets it through Doze. The
// plugin's own manifest brings POST_NOTIFICATIONS (Android 13's prompt) and
// the boot receiver that puts pending reminders back after a restart. Its
// status-bar icon is the plugin's default, which an app names in its
// capacitor.config.ts.
//
// iOS keeps at most 64 pending per app, and keeps a shown one in
// Notification Center until it is taken away, which `cancelReminders` does
// as well.
//
// These go through the package's one adapter for the plugin
// (capacitor/local-notifications.ts), which checks ids and batches and takes
// away only the shown ones the phone reports. Like every wrapper in
// platform.ts, which re-exports these, it arrives through a dynamic import
// inside `attempt`: the web evaluates none of it, nothing of it is in an
// app's startup graph, and a phone without the plugin's native half answers
// as one that cannot, never by throwing.

import type { LocalNotificationRequest, LocalNotificationsPort, NotificationPermissionState, } from './contracts'
import { notificationId } from './contracts'
import type { Unsubscribe } from './native-calls'
import { attempt, isNative, lazyListener } from './native-calls'

/** Whether the phone will show a reminder: 'prompt' until it has been
 *  asked, 'unavailable' on the web and where the plugin is missing. */
export type ReminderPermission = 'granted' | 'denied' | 'prompt' | 'unavailable'

export interface Reminder {
  /** The caller's own: a signed 32-bit integer, unique among those pending.
   *  Scheduling an id again replaces it. */
  readonly id: number
  readonly title: string
  readonly body: string
  /** Strictly in the future: iOS shows one whose time has passed at once. */
  readonly at: Date
  /** Handed back when the reminder is tapped. */
  readonly extra?: Readonly<Record<string, unknown>>
}

/** A reminder somebody tapped. */
export interface ReminderTap {
  readonly id: number
  readonly extra: Readonly<Record<string, unknown>>
}

/** The plugin's adapter, loaded on a phone, when a reminder is wanted. */
async function notifications(): Promise<LocalNotificationsPort> {
  const { createCapacitorLocalNotificationsPort } =
    await import('./capacitor/local-notifications')
  return createCapacitorLocalNotificationsPort()
}

function permissionOf(state: NotificationPermissionState): ReminderPermission {
  if (state === 'granted' || state === 'denied') return state
  if (state === 'unsupported') return 'unavailable'
  // 'prompt' and Android's 'prompt-with-rationale' both mean: not asked
  // yet, or asked and the question may come again.
  return 'prompt'
}

/** Whether reminders may be shown, without asking. */
export async function reminderPermission(): Promise<ReminderPermission> {
  let state: ReminderPermission = 'unavailable'
  await attempt(async () => {
    state = permissionOf(await (await notifications()).checkPermission())
  })
  return state
}

/**
 * Ask for them: the system's own question, which neither platform puts a
 * second time once it was refused. The answer, or the standing one where the
 * question was already settled.
 */
export async function askForReminders(): Promise<ReminderPermission> {
  let state: ReminderPermission = 'unavailable'
  await attempt(async () => {
    state = permissionOf(await (await notifications()).requestPermission())
  })
  return state
}

/** Schedule each reminder for its date. False where none could be. */
export async function scheduleReminders(
  reminders: readonly Reminder[],
): Promise<boolean> {
  return attempt(async () => {
    if (reminders.length === 0) return
    const port = await notifications()
    await port.schedule(
      reminders.map(
        (reminder): LocalNotificationRequest => ({
          id: notificationId(reminder.id),
          title: reminder.title,
          body: reminder.body,
          schedule: { kind: 'at', at: new Date(reminder.at.getTime()) },
          allowWhileIdle: true,
          autoCancel: true,
          ...(reminder.extra === undefined ? {} : { extra: reminder.extra }),
        }),
      ),
    )
  })
}

/**
 * Take these reminders away: those still to come, and those already shown.
 * False where they could not be reached.
 */
export async function cancelReminders(
  ids: readonly number[],
): Promise<boolean> {
  return attempt(async () => {
    if (ids.length === 0) return
    const port = await notifications()
    const named = ids.map(notificationId)
    await port.cancel(named)
    try {
      await port.removeDelivered(named)
    } catch {
      // None shown to take away, or a phone that keeps no list of them:
      // what was still to come is cancelled, which is what was asked.
    }
  })
}

/**
 * A reminder tapped, and the app opened by it: a cold start included, since
 * the plugin keeps the tap until somebody listens. A swipe that dismissed one
 * is not a tap and is not heard.
 */
export function onReminderTap(
  handler: (tap: ReminderTap) => void,
): Unsubscribe {
  if (!isNative()) return () => undefined

  return lazyListener((dispose) => {
    void (async () => {
      try {
        const port = await notifications()
        dispose(
          await port.addActionListener((action) => {
            if (action.actionId !== 'tap') return
            handler({ id: action.notificationId, extra: action.extra ?? {} })
          }),
        )
      } catch {
        // No reminders in this build: none can be tapped.
      }
    })()
  })
}
