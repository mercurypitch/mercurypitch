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
// the boot receiver that puts pending reminders back after a restart.
//
// iOS keeps at most 64 pending per app, and keeps a shown one in
// Notification Center until it is taken away, which `cancelReminders` does
// as well.
//
// Like every wrapper in platform.ts, which re-exports these: the plugin
// arrives through a dynamic import inside `attempt`, so the web evaluates
// none of it, and a phone without its native half answers as one that
// cannot, never by throwing.

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
  /** Android's status-bar icon: a drawable resource, white on clear. */
  readonly smallIcon?: string
  /** Android's tint for it, as #rrggbb. */
  readonly iconColor?: string
  /** Handed back when the reminder is tapped. */
  readonly extra?: Readonly<Record<string, unknown>>
}

/** A reminder somebody tapped. */
export interface ReminderTap {
  readonly id: number
  readonly extra: Readonly<Record<string, unknown>>
}

function permissionOf(display: string): ReminderPermission {
  if (display === 'granted' || display === 'denied') return display
  // 'prompt' and Android's 'prompt-with-rationale' both mean: not asked
  // yet, or asked and the question may come again.
  return 'prompt'
}

/** Whether reminders may be shown, without asking. */
export async function reminderPermission(): Promise<ReminderPermission> {
  let state: ReminderPermission = 'unavailable'
  await attempt(async () => {
    const { LocalNotifications } =
      await import('@capacitor/local-notifications')
    state = permissionOf((await LocalNotifications.checkPermissions()).display)
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
    const { LocalNotifications } =
      await import('@capacitor/local-notifications')
    state = permissionOf(
      (await LocalNotifications.requestPermissions()).display,
    )
  })
  return state
}

/** Schedule each reminder for its date. False where none could be. */
export async function scheduleReminders(
  reminders: readonly Reminder[],
): Promise<boolean> {
  return attempt(async () => {
    if (reminders.length === 0) return
    const { LocalNotifications } =
      await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({
      notifications: reminders.map((reminder) => ({
        id: reminder.id,
        title: reminder.title,
        body: reminder.body,
        schedule: {
          at: new Date(reminder.at.getTime()),
          allowWhileIdle: true,
        },
        autoCancel: true,
        ...(reminder.smallIcon === undefined
          ? {}
          : { smallIcon: reminder.smallIcon }),
        ...(reminder.iconColor === undefined
          ? {}
          : { iconColor: reminder.iconColor }),
        ...(reminder.extra === undefined
          ? {}
          : { extra: { ...reminder.extra } }),
      })),
    })
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
    const { LocalNotifications } =
      await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({
      notifications: ids.map((id) => ({ id })),
    })
    try {
      await LocalNotifications.removeDeliveredNotifications({
        notifications: ids.map((id) => ({ id, title: '', body: '' })),
      })
    } catch {
      // None shown to take away: what was still to come is cancelled,
      // which is what was asked.
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
        const { LocalNotifications } =
          await import('@capacitor/local-notifications')
        dispose(
          await LocalNotifications.addListener(
            'localNotificationActionPerformed',
            (action) => {
              if (action.actionId !== 'tap') return
              const extra: unknown = action.notification.extra
              handler({
                id: action.notification.id,
                extra:
                  extra !== null &&
                  typeof extra === 'object' &&
                  !Array.isArray(extra)
                    ? (extra as Readonly<Record<string, unknown>>)
                    : {},
              })
            },
          ),
        )
      } catch {
        // No reminders in this build: none can be tapped.
      }
    })()
  })
}
