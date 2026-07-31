// ============================================================
// Billing core — pure-helper tests (pricing, balance, webhook signature)
// ============================================================
// Imports the dependency-free worker module directly (no D1/auth), so the
// security-critical logic is covered by the main suite.

import { describe, expect, it } from 'vitest'
import type { PricingRow } from '../../workers/db-worker/src/billing-core'
import { bestSupporterLevel, creditBalance, donationDays, extendSupporterExpiry, isUvrTier, isValidJobRef, mapPricingPlans, sourcePlanId, supporterLevel, timingSafeEqualStr, UVR_TIER_PLAN_IDS, uvrDebitKey, uvrJobCost, uvrModelCredits, uvrRefundKey, verifyStripeSignature, } from '../../workers/db-worker/src/billing-core'

const row = (over: Partial<PricingRow>): PricingRow => ({
  id: 'x',
  kind: 'pack',
  label: 'L',
  description: null,
  unit: null,
  amount: null,
  currency: 'eur',
  credits: null,
  stripePriceId: null,
  badge: null,
  sortOrder: 0,
  ...over,
})

describe('mapPricingPlans', () => {
  it('splits tiers/packs, sorts by sortOrder, computes purchasable', () => {
    const res = mapPricingPlans([
      row({ id: 't1', kind: 'tier', sortOrder: 2, amount: 0 }),
      row({
        id: 'p1',
        kind: 'pack',
        sortOrder: 1,
        amount: 800,
        stripePriceId: 'price_1',
        credits: 50,
      }),
      row({ id: 'p2', kind: 'pack', sortOrder: 0, amount: null }),
    ])
    expect(res.tiers.map((t) => t.id)).toEqual(['t1'])
    expect(res.packs.map((p) => p.id)).toEqual(['p2', 'p1'])
    const p1 = res.packs.find((p) => p.id === 'p1')
    expect(p1?.purchasable).toBe(true)
    expect(p1?.credits).toBe(50)
    const p2 = res.packs.find((p) => p.id === 'p2')
    expect(p2?.amount).toBeNull()
    expect(p2?.purchasable).toBe(false)
  })

  it('an amount with no stripePriceId is not purchasable', () => {
    const res = mapPricingPlans([
      row({ kind: 'pack', amount: 500, stripePriceId: null }),
    ])
    expect(res.packs[0].purchasable).toBe(false)
  })

  it('never leaks stripePriceId in the DTO', () => {
    const res = mapPricingPlans([
      row({ kind: 'pack', amount: 500, stripePriceId: 'price_secret' }),
    ])
    expect(JSON.stringify(res)).not.toContain('price_secret')
  })

  it('defaults currency to eur when empty', () => {
    expect(mapPricingPlans([]).currency).toBe('eur')
  })

  it('buckets donations separately from tiers and packs', () => {
    const res = mapPricingPlans([
      row({ id: 'd1', kind: 'donation', sortOrder: 1 }),
      row({ id: 'p1', kind: 'pack', sortOrder: 0 }),
      row({ id: 't1', kind: 'tier', sortOrder: 2 }),
    ])
    expect(res.donations.map((d) => d.id)).toEqual(['d1'])
    expect(res.packs.map((p) => p.id)).toEqual(['p1'])
    expect(res.tiers.map((t) => t.id)).toEqual(['t1'])
  })

  // The whole point of the "Other amount" row: Stripe holds the amount, so
  // requiring one here would leave it permanently showing "Soon".
  it('a custom-amount row is purchasable with a NULL amount', () => {
    const res = mapPricingPlans([
      row({
        kind: 'donation',
        amount: null,
        customAmount: 1,
        stripePriceId: 'price_custom',
      }),
    ])
    expect(res.donations[0].amount).toBeNull()
    expect(res.donations[0].customAmount).toBe(true)
    expect(res.donations[0].purchasable).toBe(true)
  })

  it('a custom-amount row still needs a Stripe price', () => {
    const res = mapPricingPlans([
      row({ kind: 'donation', customAmount: 1, stripePriceId: null }),
    ])
    expect(res.donations[0].purchasable).toBe(false)
  })

  it('parses perks, and degrades malformed JSON to no bullets', () => {
    const res = mapPricingPlans([
      row({ id: 'ok', kind: 'donation', perks: '["Badge","Costumes"]' }),
      row({ id: 'bad', kind: 'donation', perks: '{not json' }),
      row({ id: 'mixed', kind: 'donation', perks: '["Badge",42,null]' }),
      row({ id: 'none', kind: 'donation', perks: null }),
    ])
    const byId = (id: string) => res.donations.find((d) => d.id === id)
    expect(byId('ok')?.perks).toEqual(['Badge', 'Costumes'])
    expect(byId('bad')?.perks).toEqual([])
    expect(byId('mixed')?.perks).toEqual(['Badge'])
    expect(byId('none')?.perks).toEqual([])
  })
})

describe('donationDays', () => {
  it('treats a non-numeric entitlementDays as granting nothing', () => {
    // Metadata from a session created outside handleCheckout can carry a
    // non-numeric value; NaN passes every <= 0 guard and used to throw in
    // toISOString - inside the reconciliation sweep that poisoned one
    // event's grant on every run.
    expect(
      donationDays(
        { entitlementDays: Number('not-a-number'), customAmount: 0 },
        1000,
      ),
    ).toBe(0)
    expect(
      donationDays({ entitlementDays: Number.NaN, customAmount: 1 }, null),
    ).toBe(0)
  })

  it('gives a fixed tier exactly its configured days', () => {
    expect(donationDays({ entitlementDays: 90, customAmount: 0 }, 1000)).toBe(
      90,
    )
    // …regardless of what was actually paid.
    expect(donationDays({ entitlementDays: 90, customAmount: 0 }, 99999)).toBe(
      90,
    )
  })

  it('scales a custom amount by EUR 5 per 30 days', () => {
    const plan = { entitlementDays: 30, customAmount: 1 }
    expect(donationDays(plan, 500)).toBe(30)
    expect(donationDays(plan, 1500)).toBe(90)
    expect(donationDays(plan, 1700)).toBe(90) // partial block rounds down
  })

  it('floors a small custom donation at the row default', () => {
    expect(donationDays({ entitlementDays: 30, customAmount: 1 }, 200)).toBe(30)
  })

  it('caps a very large custom donation at a year', () => {
    expect(
      donationDays({ entitlementDays: 30, customAmount: 1 }, 500_000),
    ).toBe(365)
  })

  it('survives a missing amount_total', () => {
    expect(donationDays({ entitlementDays: 30, customAmount: 1 }, null)).toBe(
      30,
    )
    expect(donationDays({ entitlementDays: null, customAmount: 0 }, 500)).toBe(
      0,
    )
  })
})

describe('supporterLevel / bestSupporterLevel', () => {
  const TIERS = [
    { id: 'sup-fund', amount: 500 },
    { id: 'sup-extras', amount: 1000 },
    { id: 'sup-voice', amount: 2500 },
  ]

  it('resolves a fixed tier to itself', () => {
    expect(supporterLevel(TIERS, 500)).toBe('sup-fund')
    expect(supporterLevel(TIERS, 1000)).toBe('sup-extras')
    expect(supporterLevel(TIERS, 2500)).toBe('sup-voice')
  })

  // The whole point: a generous custom amount should earn a real badge name.
  it('lifts a custom amount to the highest tier it covers', () => {
    expect(supporterLevel(TIERS, 5900)).toBe('sup-voice')
    expect(supporterLevel(TIERS, 1500)).toBe('sup-extras')
    expect(supporterLevel(TIERS, 999)).toBe('sup-fund')
  })

  it('floors below the cheapest tier rather than resolving to nothing', () => {
    expect(supporterLevel(TIERS, 200)).toBe('sup-fund')
    expect(supporterLevel(TIERS, 0)).toBe('sup-fund')
    expect(supporterLevel(TIERS, null)).toBe('sup-fund')
  })

  it('ignores unpriced tiers, and gives up only when none are priced', () => {
    expect(supporterLevel([{ id: 'x', amount: null }, ...TIERS], 5900)).toBe(
      'sup-voice',
    )
    expect(supporterLevel([{ id: 'x', amount: null }], 5900)).toBeNull()
    expect(supporterLevel([], 5900)).toBeNull()
  })

  // Donating EUR 5 after EUR 59 must not demote a Voice supporter.
  it('keeps the high-water mark when donations stack', () => {
    expect(bestSupporterLevel(TIERS, 'sup-voice', 'sup-fund')).toBe('sup-voice')
    expect(bestSupporterLevel(TIERS, 'sup-fund', 'sup-voice')).toBe('sup-voice')
    expect(bestSupporterLevel(TIERS, null, 'sup-extras')).toBe('sup-extras')
    expect(bestSupporterLevel(TIERS, 'sup-extras', null)).toBe('sup-extras')
    expect(bestSupporterLevel(TIERS, null, null)).toBeNull()
  })

  it('treats an unknown stored level as the lowest rank', () => {
    expect(bestSupporterLevel(TIERS, 'sup-custom', 'sup-fund')).toBe('sup-fund')
  })
})

describe('sourcePlanId', () => {
  it('extracts the planId from a donation source', () => {
    expect(sourcePlanId('donation:sup-voice')).toBe('sup-voice')
  })

  it('returns null for anything else', () => {
    expect(sourcePlanId(null)).toBeNull()
    expect(sourcePlanId('')).toBeNull()
    expect(sourcePlanId('donation:')).toBeNull()
    expect(sourcePlanId('subscription:pro')).toBeNull()
  })
})

describe('extendSupporterExpiry', () => {
  const now = '2026-07-28T00:00:00.000Z'

  it('starts from now when there is no existing grant', () => {
    expect(extendSupporterExpiry(null, now, 30)).toBe(
      '2026-08-27T00:00:00.000Z',
    )
  })

  // Donating again mid-term must ADD time, not reset the clock to 30 days out.
  it('stacks on top of a live grant', () => {
    const live = '2026-09-01T00:00:00.000Z'
    expect(extendSupporterExpiry(live, now, 30)).toBe(
      '2026-10-01T00:00:00.000Z',
    )
  })

  it('restarts from now when the previous grant already lapsed', () => {
    const lapsed = '2026-01-01T00:00:00.000Z'
    expect(extendSupporterExpiry(lapsed, now, 30)).toBe(
      '2026-08-27T00:00:00.000Z',
    )
  })

  it('treats an unparseable stored expiry as absent', () => {
    expect(extendSupporterExpiry('not-a-date', now, 30)).toBe(
      '2026-08-27T00:00:00.000Z',
    )
  })
})

describe('creditBalance', () => {
  it('sums ledger deltas', () => {
    expect(creditBalance([{ delta: 50 }, { delta: -3 }, { delta: 10 }])).toBe(
      57,
    )
    expect(creditBalance([])).toBe(0)
  })
})

describe('uvrJobCost / uvrModelCredits', () => {
  it('scales the tier base by the model multiplier', () => {
    // Collapsed pricing (2026-07-06): the single server quality (roformer)
    // costs the plain base; only the unexposed 2x-compute ensemble carries
    // a multiplier.
    expect(uvrJobCost(1, 'mdx')).toBe(1)
    expect(uvrJobCost(1, 'roformer')).toBe(1)
    expect(uvrJobCost(1, 'karaoke')).toBe(1)
    expect(uvrJobCost(1, 'ensemble')).toBe(2)
  })

  it('maps the legacy MDX filename to the base cost', () => {
    expect(uvrJobCost(1, 'UVR-MDX-NET-Inst_HQ_3')).toBe(1)
    expect(uvrJobCost(1, 'UVR-MDX-NET-Inst_HQ_3.onnx')).toBe(1)
  })

  it('charges the base for absent or unknown models (version skew must not refuse jobs)', () => {
    expect(uvrJobCost(1)).toBe(1)
    expect(uvrJobCost(1, '')).toBe(1)
    expect(uvrJobCost(1, 'mystery-model')).toBe(1)
  })

  it('is zero across the board while the tier is unmetered', () => {
    expect(uvrJobCost(0, 'roformer')).toBe(0)
    expect(uvrModelCredits(0)).toEqual({
      mdx: 0,
      roformer: 0,
      karaoke: 0,
      ensemble: 0,
    })
  })

  it('exposes absolute per-model costs for the pricing endpoint', () => {
    expect(uvrModelCredits(1)).toEqual({
      mdx: 1,
      roformer: 1,
      karaoke: 1,
      ensemble: 2,
    })
  })
})

describe('timingSafeEqualStr', () => {
  it('is true only for equal strings', () => {
    expect(timingSafeEqualStr('abc', 'abc')).toBe(true)
    expect(timingSafeEqualStr('abc', 'abd')).toBe(false)
    expect(timingSafeEqualStr('abc', 'abcd')).toBe(false)
  })
})

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test'

  async function sign(payload: string, t: number): Promise<string> {
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig = await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${t}.${payload}`),
    )
    const hex = [...new Uint8Array(sig)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    return `t=${t},v1=${hex}`
  }

  it('accepts a valid signature within tolerance', async () => {
    const payload = '{"id":"evt_1"}'
    const t = 1_700_000_000
    const header = await sign(payload, t)
    expect(await verifyStripeSignature(payload, header, secret, t + 5)).toBe(
      true,
    )
  })

  it('rejects a tampered payload', async () => {
    const t = 1_700_000_000
    const header = await sign('{"id":"evt_1"}', t)
    expect(
      await verifyStripeSignature('{"id":"evt_2"}', header, secret, t),
    ).toBe(false)
  })

  it('rejects the wrong secret', async () => {
    const t = 1_700_000_000
    const header = await sign('{"a":1}', t)
    expect(
      await verifyStripeSignature('{"a":1}', header, 'whsec_other', t),
    ).toBe(false)
  })

  it('rejects timestamps outside the tolerance window', async () => {
    const t = 1_700_000_000
    const header = await sign('{"a":1}', t)
    expect(
      await verifyStripeSignature('{"a":1}', header, secret, t + 10_000),
    ).toBe(false)
  })

  it('rejects malformed headers', async () => {
    expect(await verifyStripeSignature('x', 'garbage', secret)).toBe(false)
    expect(await verifyStripeSignature('x', 't=1', secret)).toBe(false)
  })
})

describe('uvr metering helpers', () => {
  it('maps tiers to their pricingPlans rows', () => {
    expect(UVR_TIER_PLAN_IDS.gpu).toBe('tier-runpod-gpu')
    expect(UVR_TIER_PLAN_IDS.cpu).toBe('tier-runpod-cpu')
  })

  it('isUvrTier accepts only gpu/cpu', () => {
    expect(isUvrTier('gpu')).toBe(true)
    expect(isUvrTier('cpu')).toBe(true)
    expect(isUvrTier('tpu')).toBe(false)
    expect(isUvrTier(undefined)).toBe(false)
    expect(isUvrTier(1)).toBe(false)
  })

  it('isValidJobRef enforces the session-id charset and length', () => {
    expect(isValidJobRef('rp_gpu_sync-80266ad4-e2')).toBe(true)
    expect(isValidJobRef('')).toBe(false)
    expect(isValidJobRef(undefined)).toBe(false)
    expect(isValidJobRef('has space')).toBe(false)
    expect(isValidJobRef('semi;colon')).toBe(false)
    expect(isValidJobRef('x'.repeat(201))).toBe(false)
  })

  it('debit/refund idempotency keys are distinct per job', () => {
    expect(uvrDebitKey('rp_gpu_j1')).toBe('uvr:rp_gpu_j1')
    expect(uvrRefundKey('rp_gpu_j1')).toBe('uvr-refund:rp_gpu_j1')
    expect(uvrDebitKey('rp_gpu_j1')).not.toBe(uvrRefundKey('rp_gpu_j1'))
  })
})
