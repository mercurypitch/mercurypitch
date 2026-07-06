// ============================================================
// Billing service (client) tests
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pricing, PricingPlan } from '@/db/services/billing-service'
import { fetchPricing, formatPrice, formatTierPrice, isTierSoon, startCheckout, withModelCredits, } from '@/db/services/billing-service'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('withModelCredits', () => {
  const gpuTier = (credits: number | null): PricingPlan => ({
    id: 'tier-runpod-gpu',
    kind: 'tier',
    label: 'Server (GPU)',
    description: null,
    unit: 'song',
    amount: null,
    currency: 'eur',
    credits,
    badge: null,
    purchasable: false,
  })
  const basePricing = (over: Partial<Pricing>): Pricing => ({
    currency: 'eur',
    tiers: [],
    packs: [],
    stripeConfigured: false,
    ...over,
  })

  it('keeps server-provided uvrModelCredits untouched', () => {
    const served = basePricing({
      uvrModelCredits: { mdx: 5, roformer: 9, karaoke: 9, ensemble: 12 },
    })
    expect(withModelCredits(served).uvrModelCredits).toEqual({
      mdx: 5,
      roformer: 9,
      karaoke: 9,
      ensemble: 12,
    })
  })

  it('derives costs from the GPU tier base when the backend predates the field', () => {
    const legacy = basePricing({ tiers: [gpuTier(1)] })
    expect(withModelCredits(legacy).uvrModelCredits).toEqual({
      mdx: 1,
      roformer: 2,
      karaoke: 2,
      ensemble: 3,
    })
  })

  it('yields zero costs when the GPU tier is unmetered or absent', () => {
    expect(withModelCredits(basePricing({})).uvrModelCredits).toEqual({
      mdx: 0,
      roformer: 0,
      karaoke: 0,
      ensemble: 0,
    })
    expect(
      withModelCredits(basePricing({ tiers: [gpuTier(null)] })).uvrModelCredits,
    ).toEqual({ mdx: 0, roformer: 0, karaoke: 0, ensemble: 0 })
  })
})

describe('formatPrice', () => {
  it('renders Soon / Free / a currency amount', () => {
    expect(formatPrice(null, 'eur')).toBe('Soon')
    expect(formatPrice(0, 'eur')).toBe('Free')
    expect(formatPrice(800, 'eur')).toContain('8')
  })
})

describe('formatTierPrice / isTierSoon', () => {
  it('shows a live credit-priced tier as its per-song cost, not "Soon"', () => {
    // GPU tier: no money price, priced in credits.
    const gpu = { amount: null, credits: 1, currency: 'eur' }
    expect(formatTierPrice(gpu)).toBe('1 credit')
    expect(isTierSoon(gpu)).toBe(false)
  })

  it('pluralizes multi-credit tiers', () => {
    expect(formatTierPrice({ amount: null, credits: 3, currency: 'eur' })).toBe(
      '3 credits',
    )
  })

  it('renders the free tier as "Free"', () => {
    const free = { amount: 0, credits: null, currency: 'eur' }
    expect(formatTierPrice(free)).toBe('Free')
    expect(isTierSoon(free)).toBe(false)
  })

  it('renders an unlaunched tier (no price, no credits) as "Soon"', () => {
    const soon = { amount: null, credits: null, currency: 'eur' }
    expect(formatTierPrice(soon)).toBe('Soon')
    expect(isTierSoon(soon)).toBe(true)
  })

  it('falls back to the money price for a money-priced tier', () => {
    expect(
      formatTierPrice({ amount: 500, credits: null, currency: 'eur' }),
    ).toContain('5')
  })
})

describe('fetchPricing', () => {
  it('returns null when no API base is configured', async () => {
    expect(await fetchPricing('')).toBeNull()
  })

  it('fetches pricing from the given base (deriving model costs when absent)', async () => {
    const body = {
      currency: 'eur',
      tiers: [],
      packs: [],
      stripeConfigured: false,
    }
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    } as Response)
    expect(await fetchPricing('https://api.test')).toEqual({
      ...body,
      uvrModelCredits: { mdx: 0, roformer: 0, karaoke: 0, ensemble: 0 },
    })
  })

  it('throws on a non-ok response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as Response)
    await expect(fetchPricing('https://api.test')).rejects.toThrow(
      'Failed to load pricing',
    )
  })
})

describe('startCheckout', () => {
  it('posts the planId and returns the checkout url', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ url: 'https://stripe.test/session' }),
    } as Response)

    const url = await startCheckout('pack-plus', 'https://api.test')
    expect(url).toBe('https://stripe.test/session')

    const [calledUrl, init] = spy.mock.calls[0]
    expect(calledUrl).toBe('https://api.test/api/billing/checkout')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ planId: 'pack-plus' })
  })

  it('surfaces the server error message', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
      json: () => Promise.resolve({ error: 'This plan is not available yet' }),
    } as Response)
    await expect(startCheckout('p', 'https://api.test')).rejects.toThrow(
      'This plan is not available yet',
    )
  })

  it('throws when no API is configured', async () => {
    await expect(startCheckout('p', '')).rejects.toThrow('not available')
  })
})
