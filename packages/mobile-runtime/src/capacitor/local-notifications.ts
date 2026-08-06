import { ExceptionCode } from '@capacitor/core'
import type { PermissionStatus } from '@capacitor/local-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'

import type { LocalNotificationAction, LocalNotificationActionListener, LocalNotificationChannel, LocalNotificationListenerHandle, LocalNotificationsPort, NotificationPermissionState, } from '../contracts'
import { notificationId } from '../contracts'
import { validateNotificationBatch, validateNotificationIds, } from '../validation'

export interface CapacitorLocalNotificationsOptions {
  onListenerError?: (error: unknown) => void
}

function permissionState(
  permission: PermissionStatus,
): NotificationPermissionState {
  return permission.display
}

function extraRecord(
  value: unknown,
): Readonly<Record<string, unknown>> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as Readonly<Record<string, unknown>>
}

function isUnavailableError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === ExceptionCode.Unavailable
  )
}

export function createCapacitorLocalNotificationsPort(
  options: CapacitorLocalNotificationsOptions = {},
): LocalNotificationsPort {
  return {
    async checkPermission() {
      return permissionState(await LocalNotifications.checkPermissions())
    },
    async requestPermission() {
      return permissionState(await LocalNotifications.requestPermissions())
    },
    async createChannel(channel: LocalNotificationChannel) {
      try {
        await LocalNotifications.createChannel({
          id: channel.id,
          name: channel.name,
          ...(channel.description === undefined
            ? {}
            : { description: channel.description }),
          ...(channel.sound === undefined ? {} : { sound: channel.sound }),
          ...(channel.importance === undefined
            ? {}
            : { importance: channel.importance }),
          ...(channel.visibility === undefined
            ? {}
            : { visibility: channel.visibility }),
          ...(channel.vibration === undefined
            ? {}
            : { vibration: channel.vibration }),
          ...(channel.lights === undefined ? {} : { lights: channel.lights }),
          ...(channel.lightColor === undefined
            ? {}
            : { lightColor: channel.lightColor }),
        })
      } catch (error) {
        // Android 7.0 and 7.1 do not have notification channels. Capacitor
        // reports that platform limitation as UNAVAILABLE, while unrelated
        // native failures must remain visible to the caller.
        if (!isUnavailableError(error)) throw error
      }
    },
    async schedule(notifications) {
      validateNotificationBatch(notifications)
      if (notifications.length === 0) return

      await LocalNotifications.schedule({
        notifications: notifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          body: notification.body,
          schedule:
            notification.schedule.kind === 'at'
              ? {
                  at: new Date(notification.schedule.at.getTime()),
                  ...(notification.allowWhileIdle === undefined
                    ? {}
                    : { allowWhileIdle: notification.allowWhileIdle }),
                }
              : {
                  on: {
                    hour: notification.schedule.hour,
                    minute: notification.schedule.minute,
                  },
                  ...(notification.allowWhileIdle === undefined
                    ? {}
                    : { allowWhileIdle: notification.allowWhileIdle }),
                },
          ...(notification.channelId === undefined
            ? {}
            : { channelId: notification.channelId }),
          ...(notification.sound === undefined
            ? {}
            : { sound: notification.sound }),
          ...(notification.actionTypeId === undefined
            ? {}
            : { actionTypeId: notification.actionTypeId }),
          ...(notification.extra === undefined
            ? {}
            : { extra: { ...notification.extra } }),
          ...(notification.autoCancel === undefined
            ? {}
            : { autoCancel: notification.autoCancel }),
        })),
      })
    },
    async cancel(ids) {
      validateNotificationIds(ids)
      if (ids.length === 0) return

      await LocalNotifications.cancel({
        notifications: ids.map((id) => ({ id })),
      })
    },
    async removeDelivered(ids) {
      validateNotificationIds(ids)
      if (ids.length === 0) return

      const selectedIds = new Set<number>(ids)
      const delivered = await LocalNotifications.getDeliveredNotifications()
      const selected = delivered.notifications.filter((notification) =>
        selectedIds.has(notification.id),
      )
      if (selected.length === 0) return

      await LocalNotifications.removeDeliveredNotifications({
        notifications: selected,
      })
    },
    async addActionListener(
      listener: LocalNotificationActionListener,
    ): Promise<LocalNotificationListenerHandle> {
      const handle = await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (performed) => {
          const extra = extraRecord(performed.notification.extra)
          const action: LocalNotificationAction = {
            notificationId: notificationId(performed.notification.id),
            actionId: performed.actionId,
            ...(performed.inputValue === undefined
              ? {}
              : { inputValue: performed.inputValue }),
            ...(extra === undefined ? {} : { extra }),
          }

          try {
            void Promise.resolve(listener(action)).catch((error: unknown) =>
              options.onListenerError?.(error),
            )
          } catch (error) {
            options.onListenerError?.(error)
          }
        },
      )

      return {
        remove: () => handle.remove(),
      }
    },
  }
}
