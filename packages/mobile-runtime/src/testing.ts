// ============================================================
// Mobile runtime test probe — framework-free device capability recording
// ============================================================

import type { HapticImpactStyle, HapticNotificationType, LocalNotificationAction, LocalNotificationActionListener, LocalNotificationChannel, LocalNotificationRequest, NotificationId, NotificationPermissionState, } from './contracts'
import type { MobileRuntime } from './runtime'
import { createMobileRuntime } from './runtime'

type AsyncHook<T> = (value: T) => void | Promise<void>

export interface MobileRuntimeProbeOptions {
  readonly permission?: NotificationPermissionState
  readonly requestedPermission?: NotificationPermissionState
  readonly onCreateChannel?: AsyncHook<LocalNotificationChannel>
  readonly onSchedule?: AsyncHook<readonly LocalNotificationRequest[]>
  readonly onCancel?: AsyncHook<readonly NotificationId[]>
  readonly onRemoveDelivered?: AsyncHook<readonly NotificationId[]>
}

export interface MobileRuntimeProbeCalls {
  readonly impacts: readonly HapticImpactStyle[]
  readonly hapticNotifications: readonly HapticNotificationType[]
  readonly channels: readonly LocalNotificationChannel[]
  readonly scheduled: readonly (readonly LocalNotificationRequest[])[]
  readonly cancelled: readonly (readonly NotificationId[])[]
  readonly removedDelivered: readonly (readonly NotificationId[])[]
  readonly permissionChecks: number
  readonly permissionRequests: number
}

export interface MobileRuntimeProbe {
  readonly runtime: MobileRuntime
  readonly calls: MobileRuntimeProbeCalls
  emitNotificationAction(action: LocalNotificationAction): Promise<void>
}

function copyChannel(
  channel: LocalNotificationChannel,
): LocalNotificationChannel {
  return { ...channel }
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

function copyAction(action: LocalNotificationAction): LocalNotificationAction {
  return {
    ...action,
    ...(action.extra === undefined ? {} : { extra: { ...action.extra } }),
  }
}

/**
 * Creates deterministic device ports without depending on Vitest or another
 * runner. Apps can inspect calls, delay native work through hooks, and emit
 * notification actions through the same listener seam used in production.
 */
export function createMobileRuntimeProbe(
  options: MobileRuntimeProbeOptions = {},
): MobileRuntimeProbe {
  const calls = {
    impacts: [] as HapticImpactStyle[],
    hapticNotifications: [] as HapticNotificationType[],
    channels: [] as LocalNotificationChannel[],
    scheduled: [] as LocalNotificationRequest[][],
    cancelled: [] as NotificationId[][],
    removedDelivered: [] as NotificationId[][],
    permissionChecks: 0,
    permissionRequests: 0,
  }
  const actionListeners = new Set<LocalNotificationActionListener>()
  const permission = options.permission ?? 'unsupported'
  const requestedPermission = options.requestedPermission ?? permission

  const runtime = createMobileRuntime({
    haptics: {
      async impact(style) {
        calls.impacts.push(style)
      },
      async notification(type) {
        calls.hapticNotifications.push(type)
      },
    },
    localNotifications: {
      async checkPermission() {
        calls.permissionChecks += 1
        return permission
      },
      async requestPermission() {
        calls.permissionRequests += 1
        return requestedPermission
      },
      async createChannel(channel) {
        const snapshot = copyChannel(channel)
        calls.channels.push(snapshot)
        await options.onCreateChannel?.(snapshot)
      },
      async schedule(notifications) {
        const snapshot = notifications.map(copyNotification)
        calls.scheduled.push(snapshot)
        await options.onSchedule?.(snapshot)
      },
      async cancel(ids) {
        const snapshot = [...ids]
        calls.cancelled.push(snapshot)
        await options.onCancel?.(snapshot)
      },
      async removeDelivered(ids) {
        const snapshot = [...ids]
        calls.removedDelivered.push(snapshot)
        await options.onRemoveDelivered?.(snapshot)
      },
      async addActionListener(listener) {
        actionListeners.add(listener)
        return {
          async remove() {
            actionListeners.delete(listener)
          },
        }
      },
    },
  })

  return {
    runtime,
    calls,
    async emitNotificationAction(action) {
      const snapshot = copyAction(action)
      await Promise.all(
        [...actionListeners].map((listener) => listener(snapshot)),
      )
    },
  }
}
