// ============================================================
// Mobile runtime contracts — product-neutral device capabilities
// ============================================================
//
// Notification identifiers belong to the calling domain. Adapters preserve
// them exactly; they never hash, remap, or silently generate replacements.

export const MIN_NOTIFICATION_ID = -2_147_483_648
export const MAX_NOTIFICATION_ID = 2_147_483_647

declare const NOTIFICATION_ID_BRAND: unique symbol

/** A caller-owned, collision-free signed 32-bit notification identifier. */
export type NotificationId = number & {
  readonly [NOTIFICATION_ID_BRAND]: true
}

export function notificationId(value: number): NotificationId {
  if (
    !Number.isInteger(value) ||
    value < MIN_NOTIFICATION_ID ||
    value > MAX_NOTIFICATION_ID
  ) {
    throw new RangeError(
      `Notification id must be a signed 32-bit integer; received ${String(value)}`,
    )
  }

  return value as NotificationId
}

export type HapticImpactStyle = 'light' | 'medium' | 'heavy'
export type HapticNotificationType = 'success' | 'warning' | 'error'

export interface HapticsPort {
  impact(style: HapticImpactStyle): Promise<void>
  notification(type: HapticNotificationType): Promise<void>
}

export type NotificationPermissionState =
  | 'prompt'
  | 'prompt-with-rationale'
  | 'granted'
  | 'denied'
  | 'unsupported'

export type NotificationChannelImportance = 0 | 1 | 2 | 3 | 4 | 5
export type NotificationChannelVisibility = -1 | 0 | 1

export interface LocalNotificationChannel {
  /** Stable machine identifier used by scheduled notifications. */
  id: string
  /** Human-readable name displayed in Android notification settings. */
  name: string
  description?: string
  sound?: string
  importance?: NotificationChannelImportance
  visibility?: NotificationChannelVisibility
  vibration?: boolean
  lights?: boolean
  lightColor?: string
}

export interface LocalNotificationAtSchedule {
  kind: 'at'
  at: Date
}

export interface LocalNotificationDailySchedule {
  kind: 'daily'
  /** Local wall-clock hour, from 0 through 23. */
  hour: number
  /** Local wall-clock minute, from 0 through 59. */
  minute: number
}

export type LocalNotificationSchedule =
  | LocalNotificationAtSchedule
  | LocalNotificationDailySchedule

export interface LocalNotificationRequest {
  /** Caller-owned ID. It must remain unique among pending notifications. */
  id: NotificationId
  title: string
  body: string
  schedule: LocalNotificationSchedule
  channelId?: string
  sound?: string
  actionTypeId?: string
  extra?: Readonly<Record<string, unknown>>
  allowWhileIdle?: boolean
  autoCancel?: boolean
}

export interface LocalNotificationAction {
  notificationId: NotificationId
  actionId: string
  inputValue?: string
  extra?: Readonly<Record<string, unknown>>
}

export type LocalNotificationActionListener = (
  action: LocalNotificationAction,
) => void | Promise<void>

export interface LocalNotificationListenerHandle {
  remove(): Promise<void>
}

export interface LocalNotificationsPort {
  /** Read permission without prompting the user. */
  checkPermission(): Promise<NotificationPermissionState>
  /** Prompt only after the product has supplied its own contextual rationale. */
  requestPermission(): Promise<NotificationPermissionState>
  createChannel(channel: LocalNotificationChannel): Promise<void>
  schedule(notifications: readonly LocalNotificationRequest[]): Promise<void>
  cancel(ids: readonly NotificationId[]): Promise<void>
  removeDelivered(ids: readonly NotificationId[]): Promise<void>
  addActionListener(
    listener: LocalNotificationActionListener,
  ): Promise<LocalNotificationListenerHandle>
}
