// ============================================================
// Billing core — pure-helper tests (pricing, balance, webhook signature)
// ============================================================
// Imports the dependency-free worker module directly (no D1/auth), so the
// security-critical logic is covered by the main suite.

import { describe, expect, it } from 'vitest'
import type { PricingRow } from '../../workers/db-worker/src/billing-core'
import { creditBalance, isUvrTier, isValidJobRef, mapPricingPlans, timingSafeEqualStr, UVR_TIER_PLAN_IDS, uvrDebitKey, uvrRefundKey, verifyStripeSignature, } from '../../workers/db-worker/src/billing-core'

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
