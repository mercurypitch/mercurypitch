// ============================================================
// Credit facts — the balance and the cheapest pack a credits line states
// ============================================================
//
// The plan's Karaoke Night card and Karaoke Night's own tour say the same
// credits line, so they read the same facts. Both rules here are about what a
// line may claim: a pack is only named when it can be bought at a price, and
// what cannot be read is null (the line then says nothing), never a guess.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as BillingServiceModule from '@/db/services/billing-service'
import type { Pricing, PricingPlan } from '@/db/services/billing-service'

const mocks = vi.hoisted(() => ({
  fetchBillingMe: vi.fn(),
  fetchPricing: vi.fn(),
}))

vi.mock('@/db/services/billing-service', async (importOriginal) => ({
  ...(await importOriginal<typeof BillingServiceModule>()),
  fetchBillingMe: mocks.fetchBillingMe,
  fetchPricing: mocks.fetchPricing,
}))

import { cheapestPack, loadAccountFacts } from './credit-facts'

const pack = (over: Partial<PricingPlan>): PricingPlan => ({
  id: 'pack',
  kind: 'pack',
  label: 'Pack',
  description: null,
  unit: null,
  amount: 500,
  currency: 'EUR',
  credits: 10,
  badge: null,
  purchasable: true,
  ...over,
})

const pricing = (packs: PricingPlan[]): Pricing => ({
  currency: 'EUR',
  tiers: [],
  packs,
  stripeConfigured: true,
})

const me = (creditBalance: number) => ({ creditBalance, entitlements: [] })

beforeEach(() => {
  mocks.fetchBillingMe.mockReset()
  mocks.fetchPricing.mockReset()
})

describe('cheapestPack', () => {
  it('names the cheapest pack that can be bought at a price', async () => {
    mocks.fetchPricing.mockResolvedValue(
      pricing([
        pack({ id: 'big', amount: 2000 }),
        pack({ id: 'soon', amount: null }),
        pack({ id: 'free', amount: 0 }),
        pack({ id: 'off-sale', amount: 100, purchasable: false }),
        pack({ id: 'small', amount: 450, currency: 'USD' }),
      ]),
    )

    await expect(cheapestPack()).resolves.toEqual({
      amount: 450,
      currency: 'USD',
    })
  })

  it('names none when nothing is on sale or the answer is empty', async () => {
    mocks.fetchPricing.mockResolvedValueOnce(
      pricing([pack({ amount: null }), pack({ purchasable: false })]),
    )
    await expect(cheapestPack()).resolves.toBeNull()

    mocks.fetchPricing.mockResolvedValueOnce(null)
    await expect(cheapestPack()).resolves.toBeNull()
  })

  it('names none when the price list cannot be read', async () => {
    // fetchPricing throws on a bad answer.
    mocks.fetchPricing.mockRejectedValue(new Error('500'))

    await expect(cheapestPack()).resolves.toBeNull()
  })
})

describe('loadAccountFacts', () => {
  it('reads a balance, and asks no price for one it can state', async () => {
    mocks.fetchBillingMe.mockResolvedValue(me(3))

    await expect(loadAccountFacts()).resolves.toEqual({
      balance: 3,
      cheapestPack: null,
    })
    expect(mocks.fetchPricing).not.toHaveBeenCalled()
  })

  it('asks where credits start for a balance of none', async () => {
    mocks.fetchBillingMe.mockResolvedValue(me(0))
    mocks.fetchPricing.mockResolvedValue(pricing([pack({ amount: 500 })]))

    await expect(loadAccountFacts()).resolves.toEqual({
      balance: 0,
      cheapestPack: { amount: 500, currency: 'EUR' },
    })
  })

  it('knows nothing when billing has no answer, and never rejects', async () => {
    mocks.fetchBillingMe.mockResolvedValueOnce(null)
    await expect(loadAccountFacts()).resolves.toEqual({
      balance: null,
      cheapestPack: null,
    })

    mocks.fetchBillingMe.mockRejectedValueOnce(new Error('offline'))
    await expect(loadAccountFacts()).resolves.toEqual({
      balance: null,
      cheapestPack: null,
    })
    expect(mocks.fetchPricing).not.toHaveBeenCalled()
  })
})
