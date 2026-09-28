// ============================================================
// The Karaoke subscription, through the app's purchase ports (plan S8 §6.7)
// ============================================================
//
// The paywall and Settings ask the shell to subscribe, restore and manage;
// this is the one place that speaks to the store for them. Until the store
// products and the RevenueCat keys exist the app's own composition has no
// store, and every answer is "not available yet": fail closed, never a
// purchase that did not happen. With a store, the month's plan is bought as
// the server's own user, which is how the webhook finds whom to give the
// songs to (db-worker revenuecat.ts).

import type { CustomerSnapshot, PaywallPort, PurchaseOfferings, PurchasePlan, PurchasePlanHandle, PurchasesPort, } from '@irchiinnuss/mobile-runtime'
import { PurchasesFailure } from '@irchiinnuss/mobile-runtime'
import type { MobileRuntimeProbeOptions } from '@irchiinnuss/mobile-runtime/testing'
import { createCustomerSnapshot, createMobileRuntimeProbe, } from '@irchiinnuss/mobile-runtime/testing'
import { describe, expect, it, vi } from 'vitest'
import { createNativeRuntime } from '../infrastructure/mobile-runtime'
import { createKaraokeSubscription, KARAOKE_ENTITLEMENT, } from './karaoke-subscription'

const plan = (kind: PurchasePlan['kind'], id: string): PurchasePlan => ({
  id,
  kind,
  offeringId: 'karaoke',
  productId: `mp.karaoke.${id}`,
  title: `Karaoke ${id}`,
  description: 'Songs of your own',
  priceText: '€4.99',
  currencyCode: 'EUR',
  handle: {} as PurchasePlanHandle,
})

const OFFERINGS: PurchaseOfferings = {
  current: {
    id: 'karaoke',
    description: 'Karaoke',
    plans: [plan('yearly', 'yearly'), plan('monthly', 'monthly')],
  },
  all: [],
}

const subscribed: CustomerSnapshot = createCustomerSnapshot([
  KARAOKE_ENTITLEMENT,
])

/** A store that works, with every call it gets written down in order:
 *  `order` the ones that name or buy, `steps` every one. */
function store(options: MobileRuntimeProbeOptions = {}) {
  const probe = createMobileRuntimeProbe({ offerings: OFFERINGS, ...options })
  const order: string[] = []
  const steps: string[] = []
  const inner = probe.runtime.purchases
  const innerPaywall = probe.runtime.paywall
  const purchases: PurchasesPort = {
    ...inner,
    initialize: vi.fn(async () => {
      steps.push('initialize')
      return inner.initialize()
    }),
    getCustomer: vi.fn(async (asked?: { refresh?: boolean }) => {
      steps.push('getCustomer')
      return inner.getCustomer(asked)
    }),
    logIn: vi.fn(async (id: string) => {
      order.push(`logIn ${id}`)
      steps.push(`logIn ${id}`)
      return inner.logIn(id)
    }),
    purchase: vi.fn(async (chosen: PurchasePlan) => {
      order.push(`purchase ${chosen.kind}`)
      return inner.purchase(chosen)
    }),
    restore: vi.fn(async () => {
      order.push('restore')
      return inner.restore()
    }),
  }
  const paywall: PaywallPort = {
    ...innerPaywall,
    presentCustomerCenter: vi.fn(async () => {
      steps.push('customer center')
      return innerPaywall.presentCustomerCenter()
    }),
  }
  return { probe, order, steps, purchases, paywall }
}

const asUser = vi.fn(async () => Promise.resolve('user-7f3a' as string | null))

describe("this app's own composition", () => {
  it('fails closed: no store, so nothing is bought and nobody is asked who they are', async () => {
    const identify = vi.fn(async () => Promise.resolve('user-7f3a'))
    const subscription = createKaraokeSubscription(
      createNativeRuntime(),
      identify,
    )

    await expect(subscription.subscribe()).resolves.toBe('unavailable')
    await expect(subscription.restore()).resolves.toBe('unavailable')
    await expect(subscription.offer?.()).resolves.toBeNull()
    await expect(subscription.storeSubscribed?.()).resolves.toBe(false)
    expect(subscription.manage).toBeUndefined()
    expect(identify).not.toHaveBeenCalled()
  })
})

describe('the offer, with a store', () => {
  // App Store guideline 3.1.2: the paywall states the subscription's price,
  // and only the store knows it in the singer's own currency.
  it("is the month's plan at the store's own price, before anyone is named", async () => {
    const shop = store()

    await expect(
      createKaraokeSubscription(shop, asUser).offer?.(),
    ).resolves.toEqual({ priceText: '€4.99', title: 'Karaoke monthly' })
    expect(shop.order).toEqual([])
  })

  it('is nothing while the store has no plan to sell, or no products yet', async () => {
    const empty = store({ offerings: { all: [] } })
    const unset = store()
    unset.purchases.getOfferings = async () =>
      Promise.reject(new PurchasesFailure('configuration', 'no products'))

    await expect(
      createKaraokeSubscription(empty, asUser).offer?.(),
    ).resolves.toBeNull()
    await expect(
      createKaraokeSubscription(unset, asUser).offer?.(),
    ).resolves.toBeNull()
  })

  // Review of PR 880, finding 6: the paywall offers Subscribe only with the
  // price in view, and asks again when the store could not say.
  it('fails when the store cannot say, so the paywall can ask again', async () => {
    const failing = store()
    failing.purchases.getOfferings = async () =>
      Promise.reject(new PurchasesFailure('network', 'offline'))

    await expect(
      createKaraokeSubscription(failing, asUser).offer?.(),
    ).rejects.toThrow('offline')
  })
})

describe('Subscribe, with a store', () => {
  it("buys the month's plan as the server's own user", async () => {
    const shop = store({
      onPurchase: () => ({
        kind: 'purchased',
        customer: subscribed,
        productId: 'mp.karaoke.monthly',
      }),
    })

    const outcome = await createKaraokeSubscription(shop, asUser).subscribe()

    expect(outcome).toBe('purchased')
    expect(shop.order).toEqual(['logIn user-7f3a', 'purchase monthly'])
    expect(shop.probe.calls.purchaseInitializations).toBeGreaterThan(0)
  })

  it('says cancelled and pending as the store did', async () => {
    const cancelled = store({ onPurchase: () => ({ kind: 'cancelled' }) })
    const pending = store({ onPurchase: () => ({ kind: 'pending' }) })

    await expect(
      createKaraokeSubscription(cancelled, asUser).subscribe(),
    ).resolves.toBe('cancelled')
    await expect(
      createKaraokeSubscription(pending, asUser).subscribe(),
    ).resolves.toBe('pending')
  })

  it('is not available while the store has no plan to sell', async () => {
    const empty = store({ offerings: { all: [] } })

    await expect(
      createKaraokeSubscription(empty, asUser).subscribe(),
    ).resolves.toBe('unavailable')
    expect(empty.probe.calls.purchased).toEqual([])
  })

  it('buys nothing for a phone the server cannot name', async () => {
    const shop = store()

    const outcome = await createKaraokeSubscription(shop, async () =>
      Promise.resolve(null),
    ).subscribe()

    expect(outcome).toBe('failed')
    expect(shop.order).toEqual([])
  })

  it("reads the store's failures: its own setup is not available yet, the rest failed", async () => {
    const failing = (error: unknown) =>
      store({
        onPurchase: () => {
          throw error
        },
      })

    for (const reason of [
      'unavailable',
      'configuration',
      'product-unavailable',
    ] as const) {
      await expect(
        createKaraokeSubscription(
          failing(new PurchasesFailure(reason, reason)),
          asUser,
        ).subscribe(),
      ).resolves.toBe('unavailable')
    }
    await expect(
      createKaraokeSubscription(
        failing(new PurchasesFailure('network', 'offline')),
        asUser,
      ).subscribe(),
    ).resolves.toBe('failed')
    await expect(
      createKaraokeSubscription(failing(new Error('boom')), asUser).subscribe(),
    ).resolves.toBe('failed')
  })
})

describe('Restore purchases, with a store', () => {
  it('restores a Karaoke subscription the store holds for this user', async () => {
    const shop = store({ onRestore: () => subscribed })

    await expect(
      createKaraokeSubscription(shop, asUser).restore(),
    ).resolves.toBe('restored')
    expect(shop.order).toEqual(['logIn user-7f3a', 'restore'])
  })

  it('finds nothing where the store holds another entitlement, or none', async () => {
    const other = store({
      onRestore: () => createCustomerSnapshot(['supporter']),
    })

    await expect(
      createKaraokeSubscription(other, asUser).restore(),
    ).resolves.toBe('nothing')
  })

  it("reads the store's failures", async () => {
    const failing = (error: unknown) =>
      store({
        onRestore: () => {
          throw error
        },
      })

    await expect(
      createKaraokeSubscription(
        failing(new PurchasesFailure('configuration', 'keys')),
        asUser,
      ).restore(),
    ).resolves.toBe('unavailable')
    await expect(
      createKaraokeSubscription(
        failing(new PurchasesFailure('network', 'offline')),
        asUser,
      ).restore(),
    ).resolves.toBe('failed')
  })
})

describe('Manage subscription, with a store', () => {
  it("opens the store's own subscription page", async () => {
    const shop = store()

    const subscription = createKaraokeSubscription(shop, asUser)
    await expect(subscription.manage?.()).resolves.toBe('opened')

    expect(shop.probe.calls.customerCenterOpens).toBe(1)
  })

  // Review of PR 880, finding 2: a subscriber who taps Manage on a cold
  // start never opened the paywall, so nothing had configured the store,
  // and its page would run as the store's own anonymous id.
  it("signs in to the store as the server's user before it opens the page", async () => {
    const shop = store()

    await createKaraokeSubscription(shop, asUser).manage?.()

    expect(shop.steps).toEqual([
      'initialize',
      'logIn user-7f3a',
      'customer center',
    ])
  })

  it('opens nothing for a phone the server cannot name', async () => {
    const shop = store()

    const outcome = await createKaraokeSubscription(shop, async () =>
      Promise.resolve(null),
    ).manage?.()

    expect(outcome).toBe('failed')
    expect(shop.probe.calls.customerCenterOpens).toBe(0)
  })

  it('says it failed when the store cannot open its page', async () => {
    const shop = store()
    shop.paywall.presentCustomerCenter = async () =>
      Promise.reject(new PurchasesFailure('unknown', 'no page'))

    await expect(
      createKaraokeSubscription(shop, asUser).manage?.(),
    ).resolves.toBe('failed')
  })
})

describe("what the store says of this user's subscription", () => {
  // Review of PR 880, finding 5: the store is the first to know of a
  // purchase; the server hears through RevenueCat's webhook. The room asks
  // the store before it offers the subscription again (S7 §3.9: the more
  // generous of the two).
  it("is subscribed where the store holds the Karaoke subscription for the server's user", async () => {
    const shop = store({ customer: subscribed })

    await expect(
      createKaraokeSubscription(shop, asUser).storeSubscribed?.(),
    ).resolves.toBe(true)
    expect(shop.steps).toEqual(['initialize', 'logIn user-7f3a', 'getCustomer'])
  })

  it('is not, where the store holds another entitlement, or none', async () => {
    const other = store({ customer: createCustomerSnapshot(['supporter']) })
    const none = store()

    await expect(
      createKaraokeSubscription(other, asUser).storeSubscribed?.(),
    ).resolves.toBe(false)
    await expect(
      createKaraokeSubscription(none, asUser).storeSubscribed?.(),
    ).resolves.toBe(false)
  })

  it('is not, for a phone the server cannot name, and the store is not asked', async () => {
    const shop = store({ customer: subscribed })

    await expect(
      createKaraokeSubscription(shop, async () =>
        Promise.resolve(null),
      ).storeSubscribed?.(),
    ).resolves.toBe(false)
    expect(shop.steps).not.toContain('getCustomer')
  })

  it('is not, when the store cannot say', async () => {
    const shop = store({ customer: subscribed })
    shop.purchases.getCustomer = async () =>
      Promise.reject(new PurchasesFailure('network', 'offline'))

    await expect(
      createKaraokeSubscription(shop, asUser).storeSubscribed?.(),
    ).resolves.toBe(false)
  })
})
