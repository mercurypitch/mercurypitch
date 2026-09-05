// ============================================================
// Pro access — reactive entitlement state over the store-neutral runtime
// ============================================================
//
// The store is the authority on entitlements, never this device. State starts
// locked, is corrected by the first customer read, and is corrected again by
// every customer update the store pushes, so a subscription that lapses or a
// refund that lands revokes access without the app polling for it.

import type { CustomerSnapshot, EntitlementStatus, MobileRuntime, PaywallOutcome, PurchasePlan, } from '@irchiinnuss/mobile-runtime'
import { PurchasesFailure } from '@irchiinnuss/mobile-runtime'
import { createSignal, untrack } from 'solid-js'
import { message } from '@/i18n/messages'
import type { PurchasesSetup } from './revenuecat-config'

export type ProAccessStatus = 'loading' | 'ready' | 'unavailable'

export interface ProAccessOptions {
  readonly runtime: Promise<MobileRuntime>
  readonly setup: PurchasesSetup
}

export interface ProAccess {
  /** True when this build can reach a store at all. */
  readonly available: () => boolean
  readonly status: () => ProAccessStatus
  readonly isPro: () => boolean
  readonly entitlement: () => EntitlementStatus | undefined
  readonly customer: () => CustomerSnapshot | undefined
  readonly plans: () => readonly PurchasePlan[]
  /** True while a store call the customer is waiting on is in flight. */
  readonly busy: () => boolean
  readonly notice: () => string | undefined
  readonly error: () => string | undefined
  readonly entitlementId: string
  start(): Promise<void>
  refresh(): Promise<void>
  loadPlans(): Promise<void>
  openPaywall(): Promise<PaywallOutcome | undefined>
  purchase(plan: PurchasePlan): Promise<void>
  restore(): Promise<void>
  redeemCode(): Promise<void>
  checkPromoAccess(): Promise<void>
  expectExternalRedemption(): void
  openCustomerCenter(): Promise<void>
  dispose(): Promise<void>
}

const FAILURE_MESSAGES: Record<string, string> = {
  network: 'The store could not be reached. Try again when you are online.',
  'store-problem': 'The store had a problem. Please try again in a moment.',
  'not-allowed': 'This device does not allow purchases.',
  'product-unavailable': 'That plan is not available right now.',
  'already-owned': 'You already own this. Use Restore purchases to unlock it.',
  configuration: 'Purchases are not set up for this build yet.',
}

export function purchaseErrorMessage(error: unknown): string {
  if (error instanceof PurchasesFailure) {
    if (error.reason === 'unavailable') return error.message
    return (
      FAILURE_MESSAGES[error.reason] ?? 'That did not work. Please try again.'
    )
  }
  return 'That did not work. Please try again.'
}

export function createProAccess(options: ProAccessOptions): ProAccess {
  const entitlementId = options.setup.entitlementId
  const storeConfigured = options.setup.config !== undefined

  const [status, setStatus] = createSignal<ProAccessStatus>(
    storeConfigured ? 'loading' : 'unavailable',
  )
  const [customer, setCustomer] = createSignal<CustomerSnapshot>()
  const [plans, setPlans] = createSignal<readonly PurchasePlan[]>([])
  const [busy, setBusy] = createSignal(false)
  const [notice, setNotice] = createSignal<string | undefined>()
  const [error, setError] = createSignal<string | undefined>(
    options.setup.problem,
  )

  let listenerHandle: { remove(): Promise<void> } | undefined
  let visibilityListener: (() => void) | undefined
  let disposed = false
  let storeOperations = 0
  let promoSyncPending = false
  let checkingPromo = false
  let customerRevision = 0

  function entitlement(): EntitlementStatus | undefined {
    return customer()?.entitlements[entitlementId]
  }

  function isPro(): boolean {
    return entitlement()?.active === true
  }

  function applyCustomer(next: CustomerSnapshot): void {
    if (disposed) return
    customerRevision += 1
    setCustomer(next)
    setStatus('ready')
    if (promoSyncPending && next.entitlements[entitlementId]?.active === true) {
      promoSyncPending = false
      setNotice(message('purchases.accessConfirmed'))
    } else if (
      next.entitlements[entitlementId]?.active !== true &&
      untrack(notice) === message('purchases.accessConfirmed')
    ) {
      setNotice(message('purchases.accessNotConfirmed'))
    }
  }

  async function readCustomer(
    runtime: MobileRuntime,
    refresh = false,
  ): Promise<void> {
    const revision = customerRevision
    const next = await runtime.purchases.getCustomer(
      refresh ? { refresh: true } : undefined,
    )
    // A listener may deliver a grant or revocation while this older read waits.
    if (customerRevision === revision) applyCustomer(next)
  }

  async function withStore<T>(
    operation: (runtime: MobileRuntime) => Promise<T>,
  ): Promise<T | undefined> {
    if (disposed) return undefined
    if (!storeConfigured) {
      setError(options.setup.problem ?? 'Purchases are not available here.')
      return undefined
    }

    storeOperations += 1
    setBusy(true)
    setError(undefined)
    setNotice(undefined)
    try {
      const runtime = await options.runtime
      return await operation(runtime)
    } catch (failure) {
      if (!disposed) setError(purchaseErrorMessage(failure))
      return undefined
    } finally {
      storeOperations -= 1
      if (!disposed) setBusy(storeOperations > 0)
    }
  }

  async function refresh(): Promise<void> {
    await withStore(async (runtime) => {
      await readCustomer(runtime, true)
    })
  }

  async function loadPlans(): Promise<void> {
    const offeringId = options.setup.offeringId

    await withStore(async (runtime) => {
      const offerings = await runtime.purchases.getOfferings()
      const offering =
        offeringId === undefined
          ? offerings.current
          : offerings.all.find((candidate) => candidate.id === offeringId)

      if (disposed) return
      setPlans(offering?.plans ?? [])
      if (offering === undefined) {
        setError('No plans are published for this app yet.')
      }
    })
  }

  async function checkPromoAccess(): Promise<void> {
    if (checkingPromo || disposed) return
    checkingPromo = true
    try {
      await withStore(async (runtime) => {
        await runtime.purchases.syncPurchases?.()
        if (disposed) return
        await readCustomer(runtime, true)
        if (disposed) return
        setNotice(
          message(
            untrack(isPro)
              ? 'purchases.accessConfirmed'
              : 'purchases.accessNotConfirmed',
          ),
        )
      })
    } finally {
      checkingPromo = false
    }
  }

  return {
    available: () => storeConfigured,
    status,
    isPro,
    entitlement,
    customer,
    plans,
    busy,
    notice,
    error,
    entitlementId,
    async start() {
      if (!storeConfigured) return

      // Subscribing before the first read means a store correction that
      // lands mid-flight is not lost.
      await withStore(async (runtime) => {
        await runtime.purchases.initialize()
        const handle = await runtime.purchases.addCustomerListener(
          (updated) => {
            applyCustomer(updated)
          },
        )
        if (disposed) {
          await handle.remove()
          return
        }
        listenerHandle = handle
        await readCustomer(runtime)
      })

      if (disposed || typeof document === 'undefined') return

      // Returning from the store's payment sheet or the Customer Center is a
      // visibility change, and the entitlement may have moved while away.
      visibilityListener = () => {
        if (document.visibilityState === 'visible') {
          void (promoSyncPending ? checkPromoAccess() : refresh())
        }
      }
      document.addEventListener('visibilitychange', visibilityListener)
    },
    refresh,
    checkPromoAccess,
    expectExternalRedemption() {
      promoSyncPending = true
    },
    async redeemCode() {
      if (busy()) return
      promoSyncPending = true
      await withStore(async (runtime) => {
        if (runtime.purchases.presentCodeRedemptionSheet === undefined) {
          throw new PurchasesFailure(
            'unavailable',
            message('purchases.redeemUnavailable'),
          )
        }
        await runtime.purchases.presentCodeRedemptionSheet()
        // Apple reports presentation, not success. Only CustomerInfo unlocks.
        if (!disposed)
          setNotice(
            message(
              untrack(isPro)
                ? 'purchases.accessConfirmed'
                : 'purchases.redemptionPending',
            ),
          )
      })
    },
    loadPlans,
    async openPaywall() {
      return withStore(async (runtime) => {
        if (!runtime.paywall.available) {
          throw new PurchasesFailure(
            'unavailable',
            'Purchases are only available in the mobile app.',
          )
        }

        const offeringId = options.setup.offeringId
        const outcome = await runtime.paywall.present({
          requiredEntitlementId: entitlementId,
          ...(offeringId === undefined ? {} : { offeringId }),
        })

        if (outcome === 'purchased' || outcome === 'restored') {
          await readCustomer(runtime, true)
          setNotice(
            outcome === 'purchased'
              ? 'Thank you. Pro is active.'
              : 'Your purchases are restored.',
          )
        } else if (outcome === 'error') {
          setError('The upgrade screen could not be completed.')
        }

        return outcome
      })
    },
    async purchase(plan: PurchasePlan) {
      await withStore(async (runtime) => {
        const outcome = await runtime.purchases.purchase(plan)
        if (disposed) return

        if (outcome.kind === 'purchased') {
          applyCustomer(outcome.customer)
          setNotice('Thank you. Pro is active.')
        } else if (outcome.kind === 'pending') {
          setNotice(
            'Your payment is still being confirmed. Pro unlocks as soon as it clears.',
          )
        }
        // A cancelled purchase is the customer's choice, so it says nothing.
      })
    },
    async restore() {
      await withStore(async (runtime) => {
        const restored = await runtime.purchases.restore()
        applyCustomer(restored)
        if (disposed) return
        setNotice(
          restored.entitlements[entitlementId]?.active === true
            ? 'Your purchases are restored.'
            : 'No previous purchase was found for this store account.',
        )
      })
    },
    async openCustomerCenter() {
      await withStore(async (runtime) => {
        await runtime.paywall.presentCustomerCenter()
      })
    },
    async dispose() {
      disposed = true
      if (visibilityListener !== undefined && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityListener)
        visibilityListener = undefined
      }
      const handle = listenerHandle
      listenerHandle = undefined
      await handle?.remove()
    },
  }
}
