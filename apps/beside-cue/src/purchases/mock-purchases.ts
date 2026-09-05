// ============================================================
// Mock purchases — an explicit development / internal-TestFlight fake store
// ============================================================
//
// RevenueCat's Capacitor plugin has no web implementation, so a browser build
// composes the store-free ports and the whole Pro surface collapses to one
// sentence. This puts a fake store behind the same PurchasesPort and
// PaywallPort, so the loop the customer actually walks — paywall, purchase,
// renewal note, Customer Center, restore, and a revocation pushed by the store
// — can be checked without a device.
//
// The caller lazily imports it only for development or internal beta mocks.
// Store-release bundles exclude it. It tests UI, never RevenueCat itself.

import type { CustomerListener, CustomerSnapshot, PaywallPort, PurchaseOffering, PurchaseOfferings, PurchaseOutcome, PurchasePlan, PurchasePlanKind, PurchasesPort, } from '@irchiinnuss/mobile-runtime'

const STORAGE_KEY = 'beside-cue.mock-purchases'
const OFFERING_ID = 'default'
const DAY_MS = 24 * 60 * 60 * 1000

interface MockPlanSpec {
  readonly id: string
  readonly kind: PurchasePlanKind
  readonly productId: string
  readonly title: string
  readonly description: string
  readonly priceText: string
  readonly days: number | null
}

// Illustrative test plans, not a source of truth for store prices or products.
// Real builds load their localized plans directly from the store offering.
const PLAN_SPECS: readonly MockPlanSpec[] = [
  {
    id: 'monthly',
    kind: 'monthly',
    productId: 'besidecue.pro.monthly',
    title: 'Monthly',
    description: 'Support the work month to month.',
    priceText: '2.99 EUR',
    days: 30,
  },
  {
    id: 'yearly',
    kind: 'yearly',
    productId: 'besidecue.pro.yearly',
    title: 'Yearly',
    description: 'Two months free against the monthly price.',
    priceText: '24.99 EUR',
    days: 365,
  },
  {
    id: 'lifetime',
    kind: 'lifetime',
    productId: 'besidecue.pro.lifetime',
    title: 'Lifetime',
    description: 'One payment, yours for good.',
    priceText: '59.99 EUR',
    days: null,
  },
]

/** What the mock persists between reloads, or undefined when nothing is owned. */
interface MockEntitlementState {
  readonly productId: string
  readonly kind: PurchasePlanKind
  readonly expiresAt: string | null
  readonly willRenew: boolean
  readonly billingIssue: boolean
}

export type MockPurchaseChoice =
  | { readonly kind: 'buy'; readonly plan: PurchasePlan }
  | { readonly kind: 'cancel' }
  | { readonly kind: 'stop-renewal' }
  | { readonly kind: 'billing-issue' }
  | { readonly kind: 'expire' }
  | { readonly kind: 'redeem-offer' }

export interface MockPurchaseRequest {
  readonly kind: 'paywall' | 'customer-center' | 'redeem-code'
  readonly plans: readonly PurchasePlan[]
  readonly isPro: boolean
  readonly choose: (choice: MockPurchaseChoice) => void
}

export interface MockPurchases {
  readonly purchases: PurchasesPort
  readonly paywall: PaywallPort
}

/** The slice of Storage this needs, so a test can supply a plain map. */
export interface MockPurchaseStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface MockPurchasesOptions {
  readonly entitlementId: string
  /**
   * Called with the dialog the mock is waiting on, and with undefined once it
   * closes. The caller owns the signal, keeping this module framework-free like
   * the ports it stands in for.
   */
  readonly onRequest: (request: MockPurchaseRequest | undefined) => void
  /** Injected so a test can place expiry dates without waiting for them. */
  readonly now?: () => Date
  /** Where a fake purchase survives a reload. Defaults to local storage. */
  readonly storage?: MockPurchaseStorage
}

function toPlan(spec: MockPlanSpec): PurchasePlan {
  return {
    id: spec.id,
    kind: spec.kind,
    offeringId: OFFERING_ID,
    productId: spec.productId,
    title: spec.title,
    description: spec.description,
    priceText: spec.priceText,
    currencyCode: 'EUR',
    // The handle is an adapter-owned opaque reference. The mock is the adapter
    // here, and it identifies plans by productId, so nothing reads it.
    handle: {} as PurchasePlan['handle'],
  }
}

const PLANS: readonly PurchasePlan[] = PLAN_SPECS.map(toPlan)

const OFFERING: PurchaseOffering = {
  id: OFFERING_ID,
  description: 'Beside Cue Pro',
  plans: PLANS,
}

function readState(
  storage: MockPurchaseStorage,
): MockEntitlementState | undefined {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return undefined
    return JSON.parse(raw) as MockEntitlementState
  } catch {
    // A private-mode or corrupted store just means "nothing owned".
    return undefined
  }
}

function writeState(
  storage: MockPurchaseStorage,
  state: MockEntitlementState | undefined,
): void {
  try {
    if (state === undefined) storage.removeItem(STORAGE_KEY)
    else storage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Persistence is a convenience; the session still works without it.
  }
}

export function createMockPurchases(
  options: MockPurchasesOptions,
): MockPurchases {
  const now = options.now ?? (() => new Date())
  const storage = options.storage ?? window.localStorage
  const listeners = new Set<CustomerListener>()

  let state = readState(storage)

  function customer(): CustomerSnapshot {
    if (state === undefined) {
      return {
        appUserId: '$RCAnonymousID:mock',
        anonymous: true,
        entitlements: {},
        activeEntitlementIds: [],
        managementUrl: null,
      }
    }

    const owned = state
    const active =
      owned.expiresAt === null ||
      new Date(owned.expiresAt).getTime() > now().getTime()
    return {
      appUserId: '$RCAnonymousID:mock',
      anonymous: true,
      entitlements: {
        [options.entitlementId]: {
          id: options.entitlementId,
          active,
          willRenew: owned.willRenew,
          periodKind:
            owned.productId === 'besidecue.mock.promo' ? 'trial' : 'normal',
          productId: owned.productId,
          store: 'MOCK_STORE',
          isSandbox: true,
          expiresAt:
            owned.expiresAt === null ? null : new Date(owned.expiresAt),
          unsubscribeDetectedAt: owned.willRenew ? null : now(),
          billingIssueDetectedAt: owned.billingIssue ? now() : null,
        },
      },
      activeEntitlementIds: active ? [options.entitlementId] : [],
      managementUrl: null,
    }
  }

  async function commit(next: MockEntitlementState | undefined): Promise<void> {
    state = next
    writeState(storage, next)
    const snapshot = customer()
    await Promise.all([...listeners].map((listener) => listener(snapshot)))
  }

  function ask(kind: MockPurchaseRequest['kind']): Promise<MockPurchaseChoice> {
    return new Promise((resolve) => {
      options.onRequest({
        kind,
        plans: PLANS,
        isPro: customer().activeEntitlementIds.includes(options.entitlementId),
        choose(choice) {
          options.onRequest(undefined)
          resolve(choice)
        },
      })
    })
  }

  async function buy(plan: PurchasePlan): Promise<void> {
    const spec = PLAN_SPECS.find((candidate) => candidate.id === plan.id)
    const days = spec?.days ?? null
    await commit({
      productId: plan.productId,
      kind: plan.kind,
      expiresAt:
        days === null
          ? null
          : new Date(now().getTime() + days * DAY_MS).toISOString(),
      willRenew: days !== null,
      billingIssue: false,
    })
  }

  async function apply(choice: MockPurchaseChoice): Promise<void> {
    if (choice.kind === 'buy') return buy(choice.plan)
    if (choice.kind === 'redeem-offer') {
      // A test offer must not shorten a paid period or replace lifetime access.
      if (customer().activeEntitlementIds.includes(options.entitlementId))
        return
      return commit({
        productId: 'besidecue.mock.promo',
        kind: 'other',
        expiresAt: new Date(now().getTime() + 60 * DAY_MS).toISOString(),
        willRenew: false,
        billingIssue: false,
      })
    }
    if (choice.kind === 'expire') return commit(undefined)
    if (state === undefined) return
    if (choice.kind === 'stop-renewal') {
      return commit({ ...state, willRenew: false })
    }
    if (choice.kind === 'billing-issue') {
      return commit({ ...state, billingIssue: true })
    }
  }

  const purchases: PurchasesPort = {
    available: true,
    async initialize() {
      // A real adapter configures the SDK here; the mock has nothing to set up.
    },
    async getCustomer() {
      return customer()
    },
    async getOfferings(): Promise<PurchaseOfferings> {
      return { current: OFFERING, all: [OFFERING] }
    },
    async purchase(plan): Promise<PurchaseOutcome> {
      await buy(plan)
      return {
        kind: 'purchased',
        customer: customer(),
        productId: plan.productId,
      }
    },
    async restore() {
      await commit(state)
      return customer()
    },
    async presentCodeRedemptionSheet() {
      const choice = await ask('redeem-code')
      if (choice.kind === 'redeem-offer') await apply(choice)
    },
    async syncPurchases() {
      await commit(state)
    },
    async addCustomerListener(listener) {
      listeners.add(listener)
      return {
        async remove() {
          listeners.delete(listener)
        },
      }
    },
    async logIn() {
      return customer()
    },
    async logOut() {
      return customer()
    },
  }

  const paywall: PaywallPort = {
    available: true,
    async present() {
      const choice = await ask('paywall')
      if (choice.kind !== 'buy') return 'cancelled'
      await apply(choice)
      return 'purchased'
    },
    async presentCustomerCenter() {
      await apply(await ask('customer-center'))
    },
  }

  return { purchases, paywall }
}
