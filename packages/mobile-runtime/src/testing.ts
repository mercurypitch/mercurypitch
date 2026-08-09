// ============================================================
// Mobile runtime test probe — framework-free device capability recording
// ============================================================

import type { CustomerListener, CustomerSnapshot, EntitlementStatus, HapticImpactStyle, HapticNotificationType, LocalNotificationAction, LocalNotificationActionListener, LocalNotificationChannel, LocalNotificationRequest, NotificationId, NotificationPermissionState, PaywallOutcome, PaywallRequest, PurchaseOfferings, PurchaseOutcome, PurchasePlan, } from './contracts'
import type { MobileRuntime } from './runtime'
import { createMobileRuntime } from './runtime'
import { createUnavailablePaywallPort, createUnavailablePurchasesPort, } from './unavailable-purchases'

type AsyncHook<T> = (value: T) => void | Promise<void>

export interface MobileRuntimeProbeOptions {
  readonly permission?: NotificationPermissionState
  readonly requestedPermission?: NotificationPermissionState
  readonly onCreateChannel?: AsyncHook<LocalNotificationChannel>
  readonly onSchedule?: AsyncHook<readonly LocalNotificationRequest[]>
  readonly onCancel?: AsyncHook<readonly NotificationId[]>
  readonly onRemoveDelivered?: AsyncHook<readonly NotificationId[]>
  /** Defaults to true. Set false to exercise a product's store-free path. */
  readonly purchasesAvailable?: boolean
  readonly customer?: CustomerSnapshot
  readonly offerings?: PurchaseOfferings
  readonly onPurchase?: (
    plan: PurchasePlan,
  ) => PurchaseOutcome | Promise<PurchaseOutcome>
  readonly onRestore?: () => CustomerSnapshot | Promise<CustomerSnapshot>
  readonly onPaywall?: (
    request: PaywallRequest,
  ) => PaywallOutcome | Promise<PaywallOutcome>
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
  readonly purchaseInitializations: number
  readonly customerReads: number
  readonly customerRefreshes: number
  readonly offeringReads: number
  readonly purchased: readonly PurchasePlan[]
  readonly restores: number
  readonly paywalls: readonly PaywallRequest[]
  readonly customerCenterOpens: number
}

export interface MobileRuntimeProbe {
  readonly runtime: MobileRuntime
  readonly calls: MobileRuntimeProbeCalls
  emitNotificationAction(action: LocalNotificationAction): Promise<void>
  /** Replaces the current customer and notifies every purchase listener. */
  emitCustomer(customer: CustomerSnapshot): Promise<void>
}

export interface EntitlementSnapshotOptions extends Partial<
  Omit<EntitlementStatus, 'id' | 'active'>
> {
  readonly id: string
  readonly active?: boolean
}

export function createEntitlementStatus(
  options: EntitlementSnapshotOptions,
): EntitlementStatus {
  return {
    id: options.id,
    active: options.active ?? true,
    willRenew: options.willRenew ?? true,
    periodKind: options.periodKind ?? 'normal',
    productId: options.productId ?? `${options.id}.product`,
    store: options.store ?? 'PLAY_STORE',
    isSandbox: options.isSandbox ?? true,
    expiresAt: options.expiresAt ?? null,
    unsubscribeDetectedAt: options.unsubscribeDetectedAt ?? null,
    billingIssueDetectedAt: options.billingIssueDetectedAt ?? null,
  }
}

/** Builds a customer holding exactly the entitlements named, all active. */
export function createCustomerSnapshot(
  entitlementIds: readonly string[] = [],
  overrides: Partial<CustomerSnapshot> = {},
): CustomerSnapshot {
  const entitlements: Record<string, EntitlementStatus> = {}
  for (const id of entitlementIds) {
    entitlements[id] = createEntitlementStatus({ id })
  }

  return {
    appUserId: '$RCAnonymousID:probe',
    anonymous: true,
    entitlements,
    activeEntitlementIds: entitlementIds,
    managementUrl: null,
    ...overrides,
  }
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
    purchaseInitializations: 0,
    customerReads: 0,
    customerRefreshes: 0,
    offeringReads: 0,
    purchased: [] as PurchasePlan[],
    restores: 0,
    paywalls: [] as PaywallRequest[],
    customerCenterOpens: 0,
  }
  const actionListeners = new Set<LocalNotificationActionListener>()
  const customerListeners = new Set<CustomerListener>()
  const permission = options.permission ?? 'unsupported'
  const requestedPermission = options.requestedPermission ?? permission
  const purchasesAvailable = options.purchasesAvailable ?? true
  let customer = options.customer ?? createCustomerSnapshot()

  async function notifyCustomerListeners(): Promise<void> {
    const snapshot = customer
    await Promise.all(
      [...customerListeners].map((listener) => listener(snapshot)),
    )
  }

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
    purchases: purchasesAvailable
      ? {
          available: true,
          async initialize() {
            calls.purchaseInitializations += 1
          },
          async getCustomer(customerOptions = {}) {
            calls.customerReads += 1
            if (customerOptions.refresh === true) calls.customerRefreshes += 1
            return customer
          },
          async getOfferings() {
            calls.offeringReads += 1
            return options.offerings ?? { all: [] }
          },
          async purchase(plan) {
            calls.purchased.push(plan)
            const outcome = (await options.onPurchase?.(plan)) ?? {
              kind: 'purchased' as const,
              customer,
              productId: plan.productId,
            }
            if (outcome.kind === 'purchased') {
              customer = outcome.customer
              await notifyCustomerListeners()
            }
            return outcome
          },
          async restore() {
            calls.restores += 1
            const restored = await options.onRestore?.()
            if (restored !== undefined) {
              customer = restored
              await notifyCustomerListeners()
            }
            return customer
          },
          async addCustomerListener(listener) {
            customerListeners.add(listener)
            return {
              async remove() {
                customerListeners.delete(listener)
              },
            }
          },
          async logIn() {
            return customer
          },
          async logOut() {
            return customer
          },
        }
      : createUnavailablePurchasesPort(),
    paywall: purchasesAvailable
      ? {
          available: true,
          async present(request = {}) {
            calls.paywalls.push({ ...request })
            return (await options.onPaywall?.(request)) ?? 'cancelled'
          },
          async presentCustomerCenter() {
            calls.customerCenterOpens += 1
          },
        }
      : createUnavailablePaywallPort(),
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
    async emitCustomer(next) {
      customer = next
      await notifyCustomerListeners()
    },
  }
}
