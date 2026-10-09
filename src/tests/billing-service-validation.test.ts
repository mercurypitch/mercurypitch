// Billing service validation — malformed entitlement evidence fails closed.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BillingMe } from '@/db/services/billing-service'
import { fetchBillingMe, supporterEntitlement, } from '@/db/services/billing-service'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('billing entitlement validation', () => {
  it('does not turn a missing expiry field into a permanent supporter grant', () => {
    const malformed = {
      creditBalance: 0,
      entitlements: [{ feature: 'supporter', source: 'donation:test' }],
      stripeConfigured: true,
    } as unknown as BillingMe

    expect(supporterEntitlement(malformed)).toBeNull()
  })

  it('does not throw or grant when the entitlement collection is malformed', () => {
    const malformed = {
      creditBalance: 0,
      stripeConfigured: true,
    } as unknown as BillingMe

    expect(supporterEntitlement(malformed)).toBeNull()
  })

  it('rejects a malformed successful /api/billing/me response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              creditBalance: 0,
              entitlements: [{ feature: 'supporter', source: null }],
              stripeConfigured: true,
            }),
            { status: 200 },
          ),
      ),
    )

    await expect(fetchBillingMe('https://api.test')).resolves.toBeNull()
  })

  it('accepts a complete permanent supporter grant', async () => {
    const body: BillingMe = {
      creditBalance: 0,
      entitlements: [
        { feature: 'supporter', source: 'manual', expiresAt: null },
      ],
      stripeConfigured: true,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
    )

    const billing = await fetchBillingMe('https://api.test')

    expect(billing).toEqual(body)
    expect(supporterEntitlement(billing)).toEqual(body.entitlements[0])
  })
})

describe('the Karaoke songs on /me (plan S8 §8)', () => {
  const base = {
    creditBalance: 18,
    entitlements: [
      {
        feature: 'cloud',
        source: 'revenuecat:karaoke_monthly',
        expiresAt: '2026-10-27T10:00:00.000Z',
      },
    ],
    stripeConfigured: false,
  }

  function answer(body: unknown): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
    )
  }

  it('reads the songs a subscription leaves', async () => {
    const body: BillingMe = {
      ...base,
      songs: {
        subscribed: true,
        left: 18,
        renewsAt: '2026-10-27T10:00:00.000Z',
        perPeriod: 20,
        cap: 50,
      },
    }
    answer(body)

    await expect(fetchBillingMe('https://api.test')).resolves.toEqual(body)
  })

  it('reads an older worker, which says nothing of songs', async () => {
    answer(base)

    const billing = await fetchBillingMe('https://api.test')

    expect(billing?.creditBalance).toBe(18)
    expect(billing?.songs).toBeUndefined()
  })

  for (const [what, songs] of [
    ['a subscription that is not a yes or no', { subscribed: 'yes' }],
    ['songs left below none', { left: -1 }],
    ['songs left that are not a number', { left: '18' }],
    ['a period of no number', { perPeriod: Number.NaN }],
    ['a cap that is missing', { cap: undefined }],
    ['a renewal that is not a date', { renewsAt: 20261027 }],
  ] as const) {
    it(`sets aside a songs summary with ${what}, and keeps the rest`, async () => {
      const readable: Record<string, unknown> = {
        subscribed: true,
        left: 18,
        renewsAt: '2026-10-27T10:00:00.000Z',
        perPeriod: 20,
        cap: 50,
      }
      answer({ ...base, songs: { ...readable, ...songs } })

      const billing = await fetchBillingMe('https://api.test')

      expect(billing?.creditBalance).toBe(18)
      expect(billing?.entitlements).toHaveLength(1)
      expect(billing && 'songs' in billing).toBe(false)
    })
  }
})

describe('the launch offer on /me', () => {
  const base = {
    creditBalance: 3,
    entitlements: [],
    stripeConfigured: true,
  }
  const readable = {
    state: 'counting',
    used: 2,
    goal: 5,
    deadline: '2026-10-23T23:59:59.999Z',
    bonusCredits: 30,
  }

  function answer(body: unknown): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
    )
  }

  it('reads an offer in each of its states', async () => {
    for (const state of ['counting', 'unlocked', 'used', 'lapsed']) {
      const body = { ...base, offer: { ...readable, state } }
      answer(body)
      await expect(fetchBillingMe('https://api.test')).resolves.toEqual(body)
    }
  })

  it('reads no offer, and an older worker that says nothing of one', async () => {
    answer({ ...base, offer: null })
    expect((await fetchBillingMe('https://api.test'))?.offer).toBeNull()
    answer(base)
    const billing = await fetchBillingMe('https://api.test')
    expect(billing?.creditBalance).toBe(3)
    expect(billing?.offer).toBeUndefined()
  })

  for (const [what, offer] of [
    ['a state it does not know', { ...readable, state: 'expired' }],
    ['credits used below none', { ...readable, used: -1 }],
    ['a part of a credit used', { ...readable, used: 2.5 }],
    ['nothing to use', { ...readable, goal: 0 }],
    ['a goal that is not a number', { ...readable, goal: '5' }],
    [
      'extra credits that are not a number',
      { ...readable, bonusCredits: '30' },
    ],
    ['a deadline that is not a date', { ...readable, deadline: 'soon' }],
    ['no deadline', { ...readable, deadline: undefined }],
    ['an offer that is not an object', 'yes'],
  ] as const) {
    it(`sets aside an offer with ${what}, and keeps the rest`, async () => {
      answer({ ...base, offer })

      const billing = await fetchBillingMe('https://api.test')

      expect(billing?.creditBalance).toBe(3)
      expect(billing?.stripeConfigured).toBe(true)
      expect(billing?.offer).toBeNull()
    })
  }
})
