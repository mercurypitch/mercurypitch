// GET /api/pricingPlans must not hand out our Stripe configuration.
//
// `mapPricingPlans` withholds stripePriceId from /api/billing/pricing and
// exposes a `purchasable` flag instead. The generic CRUD reader is a second
// door onto the same table and had no such filter, so the live price ids were
// served to anyone who asked. tables.test.ts pins the projection; this pins
// the route, because the projection only helps if the route calls it.

import { describe, expect, it } from 'vitest'
import type { Env } from './auth'
import worker from './index'

const SECRET_PRICE = 'price_live_do_not_publish'

const PLAN = {
  id: 'sup-fund',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  kind: 'donation',
  label: 'Chime',
  description: 'The no-questions fund.',
  unit: null,
  amount: 500,
  currency: 'eur',
  credits: null,
  stripePriceId: SECRET_PRICE,
  badge: null,
  sortOrder: 20,
  active: 1,
  entitlementDays: 30,
  customAmount: 0,
  perks: '["Supporter badge on your profile"]',
}

/** Enough of D1 to answer the two CRUD read shapes. */
function envWithPlan(): Env {
  const statement = {
    bind: () => statement,
    all: async () => ({ results: [{ ...PLAN }] }),
    first: async () => ({ ...PLAN }),
    run: async () => ({}),
  }
  return {
    ADMIN_KEY: 'test-admin-key',
    DB: { prepare: () => statement },
  } as unknown as Env
}

const get = (path: string, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request(`https://api.test${path}`, { headers }),
    envWithPlan(),
    {} as ExecutionContext,
  )

describe('GET /api/pricingPlans', () => {
  it('omits stripePriceId for an anonymous caller', async () => {
    const response = await get('/api/pricingPlans')
    expect(response.status).toBe(200)
    const rows = (await response.json()) as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(rows[0]).not.toHaveProperty('stripePriceId')
    // Everything the pricing page renders still arrives.
    expect(rows[0]!.amount).toBe(500)
    expect(rows[0]!.label).toBe('Chime')
    expect(rows[0]!.entitlementDays).toBe(30)
  })

  it('omits it on a single-row read too', async () => {
    const response = await get('/api/pricingPlans/sup-fund')
    expect(response.status).toBe(200)
    const row = (await response.json()) as Record<string, unknown>
    expect(row).not.toHaveProperty('stripePriceId')
    expect(row.id).toBe('sup-fund')
  })

  it('never appears anywhere in the serialized body', async () => {
    // A substring check catches a leak through some other field — a nested
    // object, or a column that happens to carry the id — that a property
    // assertion on the top level would walk straight past.
    const body = await (await get('/api/pricingPlans')).text()
    expect(body).not.toContain(SECRET_PRICE)
    expect(body).not.toContain('stripePriceId')
  })

  it('still gives it to the admin studio', async () => {
    const response = await get('/api/pricingPlans', {
      'X-Admin-Key': 'test-admin-key',
    })
    expect(response.status).toBe(200)
    const rows = (await response.json()) as Record<string, unknown>[]
    expect(rows[0]!.stripePriceId).toBe(SECRET_PRICE)
  })
})

// Omitting the column from the body is not the same as withholding it. A list
// query reads columns the body never carries: a filter on stripePriceId
// answers "is this the id?" by returning the row or nothing, and a sort on it
// orders the page by a value the caller may not see.
describe('GET /api/pricingPlans — querying the withheld column', () => {
  it('refuses a filter on it', async () => {
    const response = await get(
      `/api/pricingPlans?where[stripePriceId]=${SECRET_PRICE}`,
    )
    expect(response.status).toBe(400)
    // No row comes back, so a hit is indistinguishable from a miss.
    expect(await response.text()).not.toContain('sup-fund')
  })

  it('refuses a sort on it', async () => {
    const response = await get('/api/pricingPlans?orderBy=stripePriceId')
    expect(response.status).toBe(400)
  })

  it('refuses the same filter on the count endpoint', async () => {
    // /count returns only a number, which is all an oracle needs.
    const response = await get(
      `/api/pricingPlans/count?where[stripePriceId]=${SECRET_PRICE}`,
    )
    expect(response.status).toBe(400)
  })

  it('is not fooled by a different case', async () => {
    // SQLite resolves quoted column names case-insensitively, so
    // ORDER BY "STRIPEPRICEID" sorts by stripePriceId all the same.
    const response = await get('/api/pricingPlans?orderBy=STRIPEPRICEID')
    expect(response.status).toBe(400)
  })

  it('leaves ordinary filters and sorts working', async () => {
    const filtered = await get('/api/pricingPlans?where[kind]=donation')
    expect(filtered.status).toBe(200)
    const sorted = await get('/api/pricingPlans?orderBy=sortOrder')
    expect(sorted.status).toBe(200)
  })

  it('still lets the admin studio filter and sort by it', async () => {
    const admin = { 'X-Admin-Key': 'test-admin-key' }
    expect(
      (
        await get(
          `/api/pricingPlans?where[stripePriceId]=${SECRET_PRICE}`,
          admin,
        )
      ).status,
    ).toBe(200)
    expect(
      (await get('/api/pricingPlans?orderBy=stripePriceId', admin)).status,
    ).toBe(200)
  })
})
