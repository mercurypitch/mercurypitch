// ============================================================
// Web mobile runtime — safe haptics and foreground-only notification timers
// ============================================================
//
// The web adapter never claims browser notification permission and never
// creates background work. Its callback runs only while this page remains
// alive, making that limitation explicit to products using the shared port.

import type { HapticImpactStyle, HapticNotificationType, HapticsPort, LocalNotificationActionListener, LocalNotificationChannel, LocalNotificationListenerHandle, LocalNotificationRequest, LocalNotificationsPort, NotificationId, NotificationPermissionState, } from './contracts'
import type { MobileRuntime } from './runtime'
import { createMobileRuntime } from './runtime'
import { validateNotificationBatch, validateNotificationIds, } from './validation'

const MAX_TIMER_DELAY_MS = 2_147_483_647

const IMPACT_PATTERNS: Record<HapticImpactStyle, number> = {
  light: 10,
  medium: 20,
  heavy: 35,
}

const NOTIFICATION_PATTERNS: Record<HapticNotificationType, readonly number[]> =
  {
    success: [15, 30, 40],
    warning: [30, 40, 30],
    error: [40, 30, 40, 30, 40],
  }

export interface WebVibrationTarget {
  vibrate(pattern: number | number[]): boolean
}

export interface WebForegroundNotification {
  notification: LocalNotificationRequest
  performAction(actionId: string, inputValue?: string): Promise<void>
}

export interface WebLocalNotificationsOptions {
  onForegroundNotification(
    delivery: WebForegroundNotification,
  ): void | Promise<void>
  now?: () => number
  onError?: (error: unknown) => void
}

export interface WebMobileRuntimeOptions extends WebLocalNotificationsOptions {
  /** Pass null to explicitly disable vibration. */
  vibrationTarget?: WebVibrationTarget | null
}

function browserVibrationTarget(): WebVibrationTarget | null {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.vibrate !== 'function'
  ) {
    return null
  }

  return navigator
}

function safelyVibrate(
  target: WebVibrationTarget | null,
  pattern: number | readonly number[],
): void {
  if (target === null) return

  try {
    target.vibrate(typeof pattern === 'number' ? pattern : [...pattern])
  } catch {
    // Vibration may be blocked without a user gesture. Haptics stay optional.
  }
}

export function createWebHapticsPort(
  vibrationTarget: WebVibrationTarget | null = browserVibrationTarget(),
): HapticsPort {
  return {
    async impact(style) {
      safelyVibrate(vibrationTarget, IMPACT_PATTERNS[style])
    },
    async notification(type) {
      safelyVibrate(vibrationTarget, NOTIFICATION_PATTERNS[type])
    },
  }
}

interface PendingWebNotification {
  readonly notification: LocalNotificationRequest
  nextDeliveryAtMs: number
  timer: ReturnType<typeof setTimeout> | null
}

function copyNotification(
  notification: LocalNotificationRequest,
): LocalNotificationRequest {
  return {
    ...notification,
    schedule:
      notification.schedule.kind === 'at'
        ? {
            kind: 'at',
            at: new Date(notification.schedule.at.getTime()),
          }
        : { ...notification.schedule },
    ...(notification.extra === undefined
      ? {}
      : { extra: { ...notification.extra } }),
  }
}

function nextDailyDeliveryAtMs(
  hour: number,
  minute: number,
  nowMs: number,
): number {
  const next = new Date(nowMs)
  next.setHours(hour, minute, 0, 0)

  if (next.getTime() <= nowMs) {
    next.setDate(next.getDate() + 1)
    next.setHours(hour, minute, 0, 0)
  }

  return next.getTime()
}

function firstDeliveryAtMs(
  notification: LocalNotificationRequest,
  nowMs: number,
): number {
  return notification.schedule.kind === 'at'
    ? notification.schedule.at.getTime()
    : nextDailyDeliveryAtMs(
        notification.schedule.hour,
        notification.schedule.minute,
        nowMs,
      )
}

export function createWebLocalNotificationsPort(
  options: WebLocalNotificationsOptions,
): LocalNotificationsPort {
  const now = options.now ?? Date.now
  const pending = new Map<NotificationId, PendingWebNotification>()
  const delivered = new Set<NotificationId>()
  const actionListeners = new Set<LocalNotificationActionListener>()

  function reportError(error: unknown): void {
    options.onError?.(error)
  }

  async function performAction(
    notification: LocalNotificationRequest,
    actionId: string,
    inputValue?: string,
  ): Promise<void> {
    const action = {
      notificationId: notification.id,
      actionId,
      ...(inputValue === undefined ? {} : { inputValue }),
      ...(notification.extra === undefined
        ? {}
        : { extra: notification.extra }),
    }

    await Promise.all(
      [...actionListeners].map(async (listener) => {
        try {
          await listener(action)
        } catch (error) {
          reportError(error)
        }
      }),
    )
  }

  function deliver(entry: PendingWebNotification): void {
    const current = pending.get(entry.notification.id)
    if (current !== entry) return

    const remainingMs = entry.nextDeliveryAtMs - now()
    if (remainingMs > 0) {
      arm(entry)
      return
    }

    delivered.add(entry.notification.id)

    if (entry.notification.schedule.kind === 'at') {
      pending.delete(entry.notification.id)
    } else {
      entry.nextDeliveryAtMs = nextDailyDeliveryAtMs(
        entry.notification.schedule.hour,
        entry.notification.schedule.minute,
        now(),
      )
      arm(entry)
    }

    try {
      const result = options.onForegroundNotification({
        notification: copyNotification(entry.notification),
        performAction: (actionId, inputValue) =>
          performAction(entry.notification, actionId, inputValue),
      })
      void Promise.resolve(result).catch(reportError)
    } catch (error) {
      reportError(error)
    }
  }

  function arm(entry: PendingWebNotification): void {
    const remainingMs = entry.nextDeliveryAtMs - now()
    const delayMs = Math.min(Math.max(remainingMs, 0), MAX_TIMER_DELAY_MS)
    entry.timer = setTimeout(() => deliver(entry), delayMs)
  }

  return {
    async checkPermission(): Promise<NotificationPermissionState> {
      return 'unsupported'
    },
    async requestPermission(): Promise<NotificationPermissionState> {
      return 'unsupported'
    },
    async createChannel(_channel: LocalNotificationChannel): Promise<void> {
      // Browser foreground delivery has no persistent OS channel.
    },
    async schedule(notifications): Promise<void> {
      validateNotificationBatch(notifications)

      for (const notification of notifications) {
        const existing = pending.get(notification.id)
        if (existing?.timer !== null && existing?.timer !== undefined) {
          clearTimeout(existing.timer)
        }

        const entry: PendingWebNotification = {
          notification: copyNotification(notification),
          nextDeliveryAtMs: firstDeliveryAtMs(notification, now()),
          timer: null,
        }
        pending.set(notification.id, entry)
        arm(entry)
      }
    },
    async cancel(ids): Promise<void> {
      validateNotificationIds(ids)

      for (const id of ids) {
        const entry = pending.get(id)
        if (entry?.timer !== null && entry?.timer !== undefined) {
          clearTimeout(entry.timer)
        }
        pending.delete(id)
      }
    },
    async removeDelivered(ids): Promise<void> {
      validateNotificationIds(ids)
      for (const id of ids) delivered.delete(id)
    },
    async addActionListener(
      listener: LocalNotificationActionListener,
    ): Promise<LocalNotificationListenerHandle> {
      actionListeners.add(listener)
      return {
        async remove() {
          actionListeners.delete(listener)
        },
      }
    },
  }
}

export function createWebMobileRuntime(
  options: WebMobileRuntimeOptions,
): MobileRuntime {
  const vibrationTarget =
    options.vibrationTarget === undefined
      ? browserVibrationTarget()
      : options.vibrationTarget

  return createMobileRuntime({
    haptics: createWebHapticsPort(vibrationTarget),
    localNotifications: createWebLocalNotificationsPort(options),
  })
}
