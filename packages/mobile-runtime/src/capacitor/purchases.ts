// ============================================================
// Capacitor purchases adapter — RevenueCat behind the store-neutral port
// ============================================================
//
// Configuration happens once per process and is guarded by the SDK's own
// `isConfigured` check, so a product may call `initialize` on every start.
// Store error codes are translated here: a customer who backs out of the
// payment sheet gets a cancelled outcome, never a thrown error.

import { Capacitor } from '@capacitor/core'
import type { CustomerInfo, PurchasesEntitlementInfo, PurchasesOffering, PurchasesPackage, } from '@revenuecat/purchases-capacitor'
import { LOG_LEVEL, PACKAGE_TYPE, Purchases, PURCHASES_ERROR_CODE, } from '@revenuecat/purchases-capacitor'
import type { CustomerListener, CustomerSnapshot, EntitlementPeriodKind, EntitlementStatus, PurchaseFailureReason, PurchaseOffering, PurchaseOutcome, PurchasePlan, PurchasePlanHandle, PurchasePlanKind, PurchasesListenerHandle, PurchasesPort, } from '../contracts'
import { PurchasesFailure } from '../contracts'

export type PurchasesLogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error'

export interface CapacitorPurchasesOptions {
  /**
   * Store-specific public SDK key. A RevenueCat `test_` key is rejected by the
   * SDK in release builds, so products must select this per build mode.
   */
  apiKey: string
  /** Omit to let the SDK generate and persist an anonymous identifier. */
  appUserId?: string
  logLevel?: PurchasesLogLevel
  /** Surfaces errors thrown by a customer listener the product supplied. */
  onListenerError?: (error: unknown) => void
}

const LOG_LEVELS: Record<PurchasesLogLevel, LOG_LEVEL> = {
  verbose: LOG_LEVEL.VERBOSE,
  debug: LOG_LEVEL.DEBUG,
  info: LOG_LEVEL.INFO,
  warn: LOG_LEVEL.WARN,
  error: LOG_LEVEL.ERROR,
}

const PLAN_KINDS: Partial<Record<PACKAGE_TYPE, PurchasePlanKind>> = {
  [PACKAGE_TYPE.MONTHLY]: 'monthly',
  [PACKAGE_TYPE.ANNUAL]: 'yearly',
  [PACKAGE_TYPE.LIFETIME]: 'lifetime',
}

/**
 * Dashboards may use the standard `$rc_` packages or plain identifiers. Both
 * name the same three shapes, so custom packages still resolve to a kind.
 */
const PLAN_KINDS_BY_IDENTIFIER: Record<string, PurchasePlanKind> = {
  $rc_monthly: 'monthly',
  $rc_annual: 'yearly',
  $rc_lifetime: 'lifetime',
  monthly: 'monthly',
  yearly: 'yearly',
  annual: 'yearly',
  lifetime: 'lifetime',
}

const FAILURE_REASONS: Partial<
  Record<PURCHASES_ERROR_CODE, PurchaseFailureReason>
> = {
  [PURCHASES_ERROR_CODE.NETWORK_ERROR]: 'network',
  [PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR]: 'network',
  [PURCHASES_ERROR_CODE.API_ENDPOINT_BLOCKED]: 'network',
  [PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR]: 'network',
  [PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR]: 'store-problem',
  [PURCHASES_ERROR_CODE.UNEXPECTED_BACKEND_RESPONSE_ERROR]: 'store-problem',
  [PURCHASES_ERROR_CODE.UNKNOWN_BACKEND_ERROR]: 'store-problem',
  [PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR]: 'not-allowed',
  [PURCHASES_ERROR_CODE.INSUFFICIENT_PERMISSIONS_ERROR]: 'not-allowed',
  [PURCHASES_ERROR_CODE.INELIGIBLE_ERROR]: 'not-allowed',
  [PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR]:
    'product-unavailable',
  [PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR]: 'product-unavailable',
  [PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR]: 'already-owned',
  [PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR]: 'already-owned',
  [PURCHASES_ERROR_CODE.CONFIGURATION_ERROR]: 'configuration',
  [PURCHASES_ERROR_CODE.INVALID_CREDENTIALS_ERROR]: 'configuration',
  [PURCHASES_ERROR_CODE.INVALID_APPLE_SUBSCRIPTION_KEY_ERROR]: 'configuration',
  [PURCHASES_ERROR_CODE.UNSUPPORTED_ERROR]: 'configuration',
}

function errorCode(error: unknown): PURCHASES_ERROR_CODE | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined
  }

  // Capacitor forwards the native code as a string on the rejected error.
  const code = String((error as { code: unknown }).code)
  return Object.values(PURCHASES_ERROR_CODE).includes(
    code as PURCHASES_ERROR_CODE,
  )
    ? (code as PURCHASES_ERROR_CODE)
    : undefined
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message !== '') return error.message
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message !== ''
  ) {
    return error.message
  }
  return fallback
}

function isCancellation(error: unknown): boolean {
  return errorCode(error) === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
}

function isPending(error: unknown): boolean {
  return errorCode(error) === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR
}

function purchasesFailure(error: unknown, fallback: string): PurchasesFailure {
  if (error instanceof PurchasesFailure) return error

  const code = errorCode(error)
  const reason =
    code === undefined ? 'unknown' : (FAILURE_REASONS[code] ?? 'unknown')
  return new PurchasesFailure(reason, errorMessage(error, fallback), {
    cause: error,
  })
}

async function attempt<T>(
  operation: () => Promise<T>,
  fallback: string,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    throw purchasesFailure(error, fallback)
  }
}

function optionalDate(value: string | null): Date | null {
  if (value === null) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function periodKind(value: string): EntitlementPeriodKind {
  switch (value.toUpperCase()) {
    case 'NORMAL':
      return 'normal'
    case 'INTRO':
      return 'intro'
    case 'TRIAL':
      return 'trial'
    case 'PREPAID':
      return 'prepaid'
    default:
      return 'unknown'
  }
}

function entitlementStatus(
  entitlement: PurchasesEntitlementInfo,
): EntitlementStatus {
  return {
    id: entitlement.identifier,
    active: entitlement.isActive,
    willRenew: entitlement.willRenew,
    periodKind: periodKind(entitlement.periodType),
    productId: entitlement.productIdentifier,
    store: entitlement.store,
    isSandbox: entitlement.isSandbox,
    expiresAt: optionalDate(entitlement.expirationDate),
    unsubscribeDetectedAt: optionalDate(entitlement.unsubscribeDetectedAt),
    billingIssueDetectedAt: optionalDate(entitlement.billingIssueDetectedAt),
  }
}

export function toCustomerSnapshot(
  customerInfo: CustomerInfo,
): CustomerSnapshot {
  const entitlements: Record<string, EntitlementStatus> = {}
  for (const [id, entitlement] of Object.entries(
    customerInfo.entitlements.all,
  )) {
    entitlements[id] = entitlementStatus(entitlement)
  }

  return {
    appUserId: customerInfo.originalAppUserId,
    // RevenueCat marks identifiers it generated itself with this prefix.
    anonymous: customerInfo.originalAppUserId.startsWith('$RCAnonymousID:'),
    entitlements: Object.freeze(entitlements),
    activeEntitlementIds: Object.freeze(
      Object.keys(customerInfo.entitlements.active),
    ),
    managementUrl: customerInfo.managementURL,
  }
}

function planKind(storePackage: PurchasesPackage): PurchasePlanKind {
  return (
    PLAN_KINDS[storePackage.packageType] ??
    PLAN_KINDS_BY_IDENTIFIER[storePackage.identifier.toLowerCase()] ??
    'other'
  )
}

export function toPurchasePlan(storePackage: PurchasesPackage): PurchasePlan {
  return {
    id: storePackage.identifier,
    kind: planKind(storePackage),
    offeringId: storePackage.offeringIdentifier,
    productId: storePackage.product.identifier,
    title: storePackage.product.title,
    description: storePackage.product.description,
    priceText: storePackage.product.priceString,
    currencyCode: storePackage.product.currencyCode,
    handle: storePackage as unknown as PurchasePlanHandle,
  }
}

function toPurchaseOffering(offering: PurchasesOffering): PurchaseOffering {
  return {
    id: offering.identifier,
    description: offering.serverDescription,
    plans: Object.freeze(offering.availablePackages.map(toPurchasePlan)),
  }
}

export function createCapacitorPurchasesPort(
  options: CapacitorPurchasesOptions,
): PurchasesPort {
  let configured: Promise<void> | undefined

  async function configure(): Promise<void> {
    if (options.logLevel !== undefined) {
      await Purchases.setLogLevel({ level: LOG_LEVELS[options.logLevel] })
    }

    const { isConfigured } = await Purchases.isConfigured()
    if (isConfigured) return

    await Purchases.configure({
      apiKey: options.apiKey,
      ...(options.appUserId === undefined
        ? {}
        : { appUserID: options.appUserId }),
    })
  }

  async function initialize(): Promise<void> {
    // One in-flight configure is shared; a failed attempt may be retried.
    configured ??= attempt(configure, 'Purchases could not be configured.')
    try {
      await configured
    } catch (error) {
      configured = undefined
      throw error
    }
  }

  async function ready<T>(
    operation: () => Promise<T>,
    fallback: string,
  ): Promise<T> {
    await initialize()
    return attempt(operation, fallback)
  }

  return {
    available: true,
    initialize,
    async getCustomer(customerOptions = {}) {
      return ready(async () => {
        if (customerOptions.refresh === true) {
          await Purchases.invalidateCustomerInfoCache()
        }
        const { customerInfo } = await Purchases.getCustomerInfo()
        return toCustomerSnapshot(customerInfo)
      }, 'Purchase status could not be read.')
    },
    async getOfferings() {
      return ready(async () => {
        const offerings = await Purchases.getOfferings()
        return {
          ...(offerings.current === null
            ? {}
            : { current: toPurchaseOffering(offerings.current) }),
          all: Object.freeze(
            Object.values(offerings.all).map(toPurchaseOffering),
          ),
        }
      }, 'Available plans could not be loaded.')
    },
    async purchase(plan): Promise<PurchaseOutcome> {
      await initialize()

      try {
        const result = await Purchases.purchasePackage({
          aPackage: plan.handle as unknown as PurchasesPackage,
        })
        return {
          kind: 'purchased',
          customer: toCustomerSnapshot(result.customerInfo),
          productId: result.productIdentifier,
        }
      } catch (error) {
        if (isCancellation(error)) return { kind: 'cancelled' }
        if (isPending(error)) return { kind: 'pending' }
        throw purchasesFailure(error, 'The purchase could not be completed.')
      }
    },
    async restore() {
      return ready(async () => {
        const { customerInfo } = await Purchases.restorePurchases()
        return toCustomerSnapshot(customerInfo)
      }, 'Previous purchases could not be restored.')
    },
    async presentCodeRedemptionSheet() {
      if (Capacitor.getPlatform() !== 'ios') {
        throw new PurchasesFailure(
          'unavailable',
          'Redeem this code in the store app.',
        )
      }
      return ready(
        () => Purchases.presentCodeRedemptionSheet(),
        'The code redemption sheet could not be opened.',
      )
    },
    async syncPurchases() {
      return ready(
        () => Purchases.syncPurchases(),
        'Store purchases could not be synchronized.',
      )
    },
    async addCustomerListener(
      listener: CustomerListener,
    ): Promise<PurchasesListenerHandle> {
      await initialize()

      const callbackId = await Purchases.addCustomerInfoUpdateListener(
        (customerInfo) => {
          try {
            void Promise.resolve(
              listener(toCustomerSnapshot(customerInfo)),
            ).catch((error: unknown) => options.onListenerError?.(error))
          } catch (error) {
            options.onListenerError?.(error)
          }
        },
      )

      return {
        remove: async () => {
          await Purchases.removeCustomerInfoUpdateListener({
            listenerToRemove: callbackId,
          })
        },
      }
    },
    async logIn(appUserId) {
      return ready(async () => {
        const { customerInfo } = await Purchases.logIn({ appUserID: appUserId })
        return toCustomerSnapshot(customerInfo)
      }, 'The purchase account could not be identified.')
    },
    async logOut() {
      return ready(async () => {
        const { customerInfo } = await Purchases.logOut()
        return toCustomerSnapshot(customerInfo)
      }, 'The purchase account could not be signed out.')
    },
  }
}
