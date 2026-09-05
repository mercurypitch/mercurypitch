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

// ------------------------------------------------------------
// Purchases
// ------------------------------------------------------------
//
// Store vocabulary stops here. Products name their own entitlements and
// receive plain plans, snapshots and outcomes, so no application module has
// to import a billing SDK or reason about one store's error codes.

/** Billing shapes a product can price differently. */
export type PurchasePlanKind = 'monthly' | 'yearly' | 'lifetime' | 'other'

declare const PURCHASE_PLAN_HANDLE: unique symbol

/**
 * Adapter-owned reference to the store package a plan was built from. Pass a
 * plan back to `purchase` unchanged; never construct one.
 */
export type PurchasePlanHandle = {
  readonly [PURCHASE_PLAN_HANDLE]: true
}

export interface PurchasePlan {
  /** Package identifier as configured in the store dashboard. */
  readonly id: string
  readonly kind: PurchasePlanKind
  readonly offeringId: string
  readonly productId: string
  readonly title: string
  readonly description: string
  /** Price already formatted for the customer's storefront locale. */
  readonly priceText: string
  readonly currencyCode: string
  readonly handle: PurchasePlanHandle
}

export interface PurchaseOffering {
  readonly id: string
  readonly description: string
  readonly plans: readonly PurchasePlan[]
}

export interface PurchaseOfferings {
  readonly current?: PurchaseOffering
  readonly all: readonly PurchaseOffering[]
}

export type EntitlementPeriodKind =
  | 'normal'
  | 'intro'
  | 'trial'
  | 'prepaid'
  | 'unknown'

export interface EntitlementStatus {
  readonly id: string
  readonly active: boolean
  readonly willRenew: boolean
  readonly periodKind: EntitlementPeriodKind
  readonly productId: string
  readonly store: string
  readonly isSandbox: boolean
  /** Null for a lifetime entitlement, which never expires. */
  readonly expiresAt: Date | null
  /** Set once the customer turns off renewal; access usually continues. */
  readonly unsubscribeDetectedAt: Date | null
  /** Set while the store cannot charge; access usually continues for a grace period. */
  readonly billingIssueDetectedAt: Date | null
}

export interface CustomerSnapshot {
  readonly appUserId: string
  /** True while the customer has never been identified by the product. */
  readonly anonymous: boolean
  readonly entitlements: Readonly<Record<string, EntitlementStatus>>
  readonly activeEntitlementIds: readonly string[]
  /** Store-hosted subscription management page, when the store publishes one. */
  readonly managementUrl: string | null
}

/**
 * A purchase that ends without an entitlement is not a failure. Cancellation
 * is the customer's decision, and a pending payment resolves outside the app.
 */
export type PurchaseOutcome =
  | {
      readonly kind: 'purchased'
      readonly customer: CustomerSnapshot
      readonly productId: string
    }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'pending' }

export type PurchaseFailureReason =
  /** The running platform has no store. */
  | 'unavailable'
  | 'network'
  | 'store-problem'
  | 'not-allowed'
  | 'product-unavailable'
  | 'already-owned'
  /** The app's own store or dashboard setup is wrong. */
  | 'configuration'
  | 'unknown'

export class PurchasesFailure extends Error {
  readonly reason: PurchaseFailureReason

  constructor(
    reason: PurchaseFailureReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'PurchasesFailure'
    this.reason = reason
  }
}

export type CustomerListener = (
  customer: CustomerSnapshot,
) => void | Promise<void>

export interface PurchasesListenerHandle {
  remove(): Promise<void>
}

export interface PurchasesPort {
  /** False on platforms without a store; every other call then fails fast. */
  readonly available: boolean
  /** Idempotent. Safe to call on every app start and before any read. */
  initialize(): Promise<void>
  /** Cached unless `refresh` asks the store for current state. */
  getCustomer(options?: {
    readonly refresh?: boolean
  }): Promise<CustomerSnapshot>
  getOfferings(): Promise<PurchaseOfferings>
  purchase(plan: PurchasePlan): Promise<PurchaseOutcome>
  restore(): Promise<CustomerSnapshot>
  /** Store-owned code UI (iOS). Resolving does not prove a redemption succeeded. */
  presentCodeRedemptionSheet?(): Promise<void>
  /** Reconcile purchases made outside the app; never grants local access. */
  syncPurchases?(): Promise<void>
  /** Fires whenever the store or backend revises entitlements. */
  addCustomerListener(
    listener: CustomerListener,
  ): Promise<PurchasesListenerHandle>
  logIn(appUserId: string): Promise<CustomerSnapshot>
  logOut(): Promise<CustomerSnapshot>
}

export type PaywallOutcome =
  | 'purchased'
  | 'restored'
  | 'cancelled'
  /** The required entitlement was already active, so nothing was shown. */
  | 'not-presented'
  | 'error'

export interface PaywallRequest {
  /** Defaults to the offering the dashboard marks as current. */
  readonly offeringId?: string
  /** Show the paywall only while this entitlement is inactive. */
  readonly requiredEntitlementId?: string
  /** Full screen on both platforms instead of an iOS sheet. */
  readonly fullScreen?: boolean
}

export interface PaywallPort {
  readonly available: boolean
  present(request?: PaywallRequest): Promise<PaywallOutcome>
  /** Store-native subscription management, cancellation and refund flows. */
  presentCustomerCenter(): Promise<void>
}
