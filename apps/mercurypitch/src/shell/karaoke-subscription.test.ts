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

import type { CustomerSnapshot, PurchaseOfferings, PurchasePlan, PurchasePlanHandle, PurchasesPort, } from '@irchiinnuss/mobile-runtime'
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

/** A store that works, with every call it gets written down in order. */
function store(options: MobileRuntimeProbeOptions = {}) {
  const probe = createMobileRuntimeProbe({ offerings: OFFERINGS, ...options })
  const order: string[] = []
  const inner = probe.runtime.purchases
  const purchases: PurchasesPort = {
    ...inner,
    logIn: vi.fn(async (id: string) => {
      order.push(`logIn ${id}`)
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
  return {
    probe,
    order,
    purchases,
    paywall: probe.runtime.paywall,
  }
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
    expect(subscription.manage).toBeUndefined()
    expect(identify).not.toHaveBeenCalled()
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
    await subscription.manage?.()

    expect(shop.probe.calls.customerCenterOpens).toBe(1)
  })
})
