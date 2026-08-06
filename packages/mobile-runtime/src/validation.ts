// ============================================================
// Notification validation — shared invariants before platform calls
// ============================================================

import type { LocalNotificationRequest, NotificationId } from './contracts'
import { notificationId } from './contracts'

export function validateNotificationIds(ids: readonly NotificationId[]): void {
  for (const id of ids) notificationId(id)
}

export function validateNotificationBatch(
  notifications: readonly LocalNotificationRequest[],
): void {
  const seen = new Set<number>()

  for (const notification of notifications) {
    notificationId(notification.id)

    if (seen.has(notification.id)) {
      throw new Error(
        `Notification id ${notification.id} occurs more than once in one schedule batch`,
      )
    }
    seen.add(notification.id)

    if (notification.schedule.kind === 'at') {
      if (
        !(notification.schedule.at instanceof Date) ||
        Number.isNaN(notification.schedule.at.getTime())
      ) {
        throw new RangeError(
          `Notification ${notification.id} has an invalid scheduled date`,
        )
      }
      continue
    }

    if (
      !Number.isInteger(notification.schedule.hour) ||
      notification.schedule.hour < 0 ||
      notification.schedule.hour > 23 ||
      !Number.isInteger(notification.schedule.minute) ||
      notification.schedule.minute < 0 ||
      notification.schedule.minute > 59
    ) {
      throw new RangeError(
        `Notification ${notification.id} has an invalid daily wall-clock time`,
      )
    }
  }
}
