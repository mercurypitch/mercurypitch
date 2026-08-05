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
