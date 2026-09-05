import type { CustomerSnapshot } from '@irchiinnuss/mobile-runtime'
import { beforeEach, describe, expect, it } from 'vitest'
import type { MockPurchaseRequest, MockPurchases, MockPurchaseStorage, } from './mock-purchases'
import { createMockPurchases } from './mock-purchases'

const ENTITLEMENT = 'BeSideCue Pro'
const NOW = new Date('2026-03-01T09:00:00.000Z')

// jsdom here exposes a `localStorage` with no Storage methods, and persistence
// across a reload is part of what this covers, so the store is supplied.
function createStorage(): MockPurchaseStorage {
  const entries = new Map<string, string>()
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  }
}

let storage: MockPurchaseStorage

interface Harness {
  readonly mock: MockPurchases
  readonly pending: () => MockPurchaseRequest | undefined
  readonly updates: readonly CustomerSnapshot[]
}

function createHarness(now: () => Date = () => NOW): Harness {
  let pending: MockPurchaseRequest | undefined
  const updates: CustomerSnapshot[] = []

  const mock = createMockPurchases({
    entitlementId: ENTITLEMENT,
    now,
    storage,
    onRequest: (request) => {
      pending = request
    },
  })

  void mock.purchases.addCustomerListener((customer) => {
    updates.push(customer)
  })

  return { mock, pending: () => pending, updates }
}

async function buy(harness: Harness, planId: string): Promise<void> {
  const offerings = await harness.mock.purchases.getOfferings()
  const plan = offerings.current?.plans.find(
    (candidate) => candidate.id === planId,
  )
  if (plan === undefined) throw new Error(`No mock plan ${planId}`)
  await harness.mock.purchases.purchase(plan)
}

describe('mock purchases', () => {
  beforeEach(() => {
    storage = createStorage()
  })

  it('grants a confirmed test offer for 60 days without renewal', async () => {
    const harness = createHarness()
    const redeem = harness.mock.purchases.presentCodeRedemptionSheet!()
    expect(harness.pending()?.kind).toBe('redeem-code')
    expect(
      (await harness.mock.purchases.getCustomer()).activeEntitlementIds,
    ).toEqual([])

    harness.pending()?.choose({ kind: 'redeem-offer' })
    await redeem

    const entitlement = (await harness.mock.purchases.getCustomer())
      .entitlements[ENTITLEMENT]
    expect(entitlement).toMatchObject({
      active: true,
      willRenew: false,
      isSandbox: true,
      store: 'MOCK_STORE',
    })
    expect(entitlement?.expiresAt).toEqual(
      new Date(NOW.getTime() + 60 * 86400000),
    )
  })

  it('leaves premium locked when test redemption is cancelled', async () => {
    const harness = createHarness()
    const redeem = harness.mock.purchases.presentCodeRedemptionSheet!()

    harness.pending()?.choose({ kind: 'cancel' })
    await redeem

    expect(
      (await harness.mock.purchases.getCustomer()).activeEntitlementIds,
    ).toEqual([])
    expect(harness.updates).toHaveLength(0)
  })

  it('revokes a time-limited test offer at its actual expiry after a reload', async () => {
    const harness = createHarness()
    const redeem = harness.mock.purchases.presentCodeRedemptionSheet!()
    harness.pending()?.choose({ kind: 'redeem-offer' })
    await redeem

    const reloaded = createHarness(
      () => new Date(NOW.getTime() + 60 * 86400000),
    )

    expect(
      (await reloaded.mock.purchases.getCustomer()).activeEntitlementIds,
    ).toEqual([])
    expect(
      (await reloaded.mock.purchases.getCustomer()).entitlements[ENTITLEMENT]
        ?.active,
    ).toBe(false)
  })

  it('does not replace existing lifetime access with a test offer', async () => {
    const harness = createHarness()
    await buy(harness, 'lifetime')
    const redeem = harness.mock.purchases.presentCodeRedemptionSheet!()

    harness.pending()?.choose({ kind: 'redeem-offer' })
    await redeem

    expect(
      (await harness.mock.purchases.getCustomer()).entitlements[ENTITLEMENT]
        ?.expiresAt,
    ).toBeNull()
  })

  it('starts owning nothing', async () => {
    const harness = createHarness()
    const customer = await harness.mock.purchases.getCustomer()

    expect(customer.entitlements[ENTITLEMENT]).toBeUndefined()
    expect(customer.activeEntitlementIds).toEqual([])
    expect(customer.anonymous).toBe(true)
  })

  it('publishes the three plans the dashboard is set up with', async () => {
    const offerings = await createHarness().mock.purchases.getOfferings()

    expect(offerings.current?.plans.map((plan) => plan.kind)).toEqual([
      'monthly',
      'yearly',
      'lifetime',
    ])
  })

  it('gives a subscription an expiry that renews', async () => {
    const harness = createHarness()
    await buy(harness, 'yearly')

    const entitlement = (await harness.mock.purchases.getCustomer())
      .entitlements[ENTITLEMENT]

    expect(entitlement?.active).toBe(true)
    expect(entitlement?.willRenew).toBe(true)
    expect(entitlement?.expiresAt?.toISOString()).toBe(
      '2027-03-01T09:00:00.000Z',
    )
  })

  it('gives lifetime no expiry and no renewal', async () => {
    const harness = createHarness()
    await buy(harness, 'lifetime')

    const entitlement = (await harness.mock.purchases.getCustomer())
      .entitlements[ENTITLEMENT]

    expect(entitlement?.expiresAt).toBeNull()
    expect(entitlement?.willRenew).toBe(false)
  })

  it('pushes every change to the customer listener', async () => {
    const harness = createHarness()
    await buy(harness, 'monthly')

    expect(harness.updates).toHaveLength(1)
    expect(harness.updates[0]?.activeEntitlementIds).toEqual([ENTITLEMENT])
  })

  it('unlocks through the paywall when a plan is chosen', async () => {
    const harness = createHarness()
    const outcome = harness.mock.paywall.present()

    const request = harness.pending()
    expect(request?.kind).toBe('paywall')
    expect(request?.isPro).toBe(false)
    request?.choose({ kind: 'buy', plan: request.plans[0]! })

    expect(await outcome).toBe('purchased')
    expect(harness.pending()).toBeUndefined()
  })

  it('leaves everything alone when the paywall is dismissed', async () => {
    const harness = createHarness()
    const outcome = harness.mock.paywall.present()
    harness.pending()?.choose({ kind: 'cancel' })

    expect(await outcome).toBe('cancelled')
    const customer = await harness.mock.purchases.getCustomer()
    expect(customer.entitlements[ENTITLEMENT]).toBeUndefined()
  })

  it('turns off renewal from the customer center', async () => {
    const harness = createHarness()
    await buy(harness, 'monthly')

    const opened = harness.mock.paywall.presentCustomerCenter()
    expect(harness.pending()?.isPro).toBe(true)
    harness.pending()?.choose({ kind: 'stop-renewal' })
    await opened

    const entitlement = (await harness.mock.purchases.getCustomer())
      .entitlements[ENTITLEMENT]
    expect(entitlement?.willRenew).toBe(false)
    expect(entitlement?.unsubscribeDetectedAt).toEqual(NOW)
    // Access continues until the paid period ends.
    expect(entitlement?.active).toBe(true)
  })

  it('raises a billing problem from the customer center', async () => {
    const harness = createHarness()
    await buy(harness, 'monthly')

    const opened = harness.mock.paywall.presentCustomerCenter()
    harness.pending()?.choose({ kind: 'billing-issue' })
    await opened

    const entitlement = (await harness.mock.purchases.getCustomer())
      .entitlements[ENTITLEMENT]
    expect(entitlement?.billingIssueDetectedAt).toEqual(NOW)
  })

  it('revokes access when the entitlement expires', async () => {
    const harness = createHarness()
    await buy(harness, 'yearly')

    const opened = harness.mock.paywall.presentCustomerCenter()
    harness.pending()?.choose({ kind: 'expire' })
    await opened

    const customer = await harness.mock.purchases.getCustomer()
    expect(customer.entitlements[ENTITLEMENT]).toBeUndefined()
    // The revocation is pushed, not polled for — the same as a real store.
    expect(harness.updates.at(-1)?.activeEntitlementIds).toEqual([])
  })

  it('restores a purchase made before the page reloaded', async () => {
    await buy(createHarness(), 'lifetime')

    // A second instance reads the same persisted state, as a reload would.
    const reloaded = createHarness()
    const restored = await reloaded.mock.purchases.restore()

    expect(restored.entitlements[ENTITLEMENT]?.active).toBe(true)
    expect(restored.entitlements[ENTITLEMENT]?.expiresAt).toBeNull()
  })

  it('restores nothing for a customer who bought nothing', async () => {
    const restored = await createHarness().mock.purchases.restore()

    expect(restored.activeEntitlementIds).toEqual([])
  })
})
