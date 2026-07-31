// ============================================================
// Billing core — pure-helper tests (pricing, balance, webhook signature)
// ============================================================
// Imports the dependency-free worker module directly (no D1/auth), so the
// security-critical logic is covered by the main suite.

import { describe, expect, it } from 'vitest'
import type { PricingRow } from '../../workers/db-worker/src/billing-core'
import { creditBalance, isUvrTier, isValidJobRef, mapPricingPlans, timingSafeEqualStr, UVR_BASE_MINUTES, UVR_MODEL_CREDIT_MULTIPLIERS, UVR_TIER_PLAN_IDS, uvrDebitKey, uvrJobCost, uvrLengthFactor, uvrModelCredits, uvrRefundKey, verifyStripeSignature, } from '../../workers/db-worker/src/billing-core'

/** Expected uvrModelCredits output for a given tier base, derived from the
 *  multiplier map so adding a registry model doesn't break these tests —
 *  the point under test is the arithmetic, not the model list. */
const creditsFor = (base: number): Record<string, number> =>
  Object.fromEntries(
    Object.entries(UVR_MODEL_CREDIT_MULTIPLIERS).map(([m, mult]) => [
      m,
      base * mult,
    ]),
  )

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
    expect(uvrModelCredits(0)).toEqual(creditsFor(0))
    expect(Object.values(uvrModelCredits(0)).every((c) => c === 0)).toBe(true)
  })

  it('exposes absolute per-model costs for the pricing endpoint', () => {
    expect(uvrModelCredits(1)).toEqual(creditsFor(1))
    // Spot-check the two ends of the scale so the derivation can't quietly
    // collapse to a constant.
    expect(uvrModelCredits(1).roformer).toBe(1)
    expect(uvrModelCredits(1).ensemble).toBe(2)
  })
})

describe('uvrLengthFactor — long-song surcharge blocks', () => {
  const min = (m: number) => m * 60

  it('charges the base within the included window', () => {
    expect(uvrLengthFactor(undefined)).toBe(1)
    expect(uvrLengthFactor(0)).toBe(1)
    expect(uvrLengthFactor(min(3.5))).toBe(1)
    expect(uvrLengthFactor(min(UVR_BASE_MINUTES))).toBe(1)
  })

  it('adds one multiple per STARTED block past the base', () => {
    expect(uvrLengthFactor(min(UVR_BASE_MINUTES) + 1)).toBe(2)
    expect(uvrLengthFactor(min(18))).toBe(2)
    expect(uvrLengthFactor(min(18) + 1)).toBe(3)
    expect(uvrLengthFactor(min(24))).toBe(3)
    expect(uvrLengthFactor(min(30))).toBe(4)
  })

  it('treats garbage durations as the base factor', () => {
    expect(uvrLengthFactor(Number.NaN)).toBe(1)
    expect(uvrLengthFactor(-30)).toBe(1)
    expect(uvrLengthFactor(Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('multiplies into the job cost together with the model', () => {
    // An 18-minute Full-band-quality job: base 1 × demucs-6s 2 × length 2.
    expect(uvrJobCost(1, 'demucs-6s', min(18))).toBe(4)
    expect(uvrJobCost(1, 'roformer', min(18))).toBe(2)
    expect(uvrJobCost(1, 'roformer', min(5))).toBe(1)
    expect(uvrJobCost(1, undefined, min(18))).toBe(2)
  })

  it('prices the multi-stem Demucs tiers above the RoFormer base', () => {
    // demucs-ft bags four checkpoints, so it must cost more than the
    // single-model multi-stem tiers.
    const credits = uvrModelCredits(1)
    expect(credits.demucs).toBeGreaterThan(credits.roformer)
    expect(credits['demucs-ft']).toBeGreaterThan(credits.demucs)
    expect(uvrJobCost(1, 'demucs-6s')).toBe(credits['demucs-6s'])
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
