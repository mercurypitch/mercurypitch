// @vitest-environment node
//
// ── A supporter badge names the grant that is running ──
//
// Donations stack. A second one while the first still runs adds its days, and
// the badge keeps the higher of the two levels, so EUR 5 after EUR 59 does not
// demote an Anthem supporter to Chime. A grant that has run out counts for
// nothing: its days are not added on (extendSupporterExpiry), and its level
// must not carry over either. Someone whose Anthem grant lapsed months ago and
// who now gives EUR 5 is a Chime supporter (grantSupporterEntitlement).
//
// Real SQLite with every migration applied, through the worker's own webhook
// (stripe-harness.ts).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Harness, Singer } from './stripe-harness'
import { deliver, openHarness, register } from './stripe-harness'

let h: Harness

beforeEach(() => {
  h = openHarness()
  // The migrations leave the tier prices unset. These are the ones
  // billing-core's comments give: Chime at EUR 5, Anthem at EUR 59.
  h.sqlite
    .prepare("UPDATE pricingPlans SET amount = 500 WHERE id = 'sup-fund'")
    .run()
  h.sqlite
    .prepare("UPDATE pricingPlans SET amount = 5900 WHERE id = 'sup-voice'")
    .run()
})

afterEach(() => {
  h.close()
})

/** A supporter grant on record that ends `days` from now (negative: ended). */
function granted(singer: Singer, planId: string, days: number): void {
  const now = new Date().toISOString()
  h.sqlite
    .prepare(
      `INSERT INTO entitlements (id, createdAt, updatedAt, userId, feature, source, expiresAt)
       VALUES (?, ?, ?, ?, 'supporter', ?, ?)`,
    )
    .run(
      'earlier-grant',
      now,
      now,
      singer.userId,
      `donation:${planId}`,
      new Date(Date.now() + days * 86_400_000).toISOString(),
    )
}

/** A EUR 5 Chime donation, paid and delivered. */
async function donateChime(singer: Singer): Promise<void> {
  const donation = h.stripe.checkout(singer.userId, {
    planId: 'sup-fund',
    amount: 500,
  })
  Object.assign(donation.data.object.metadata as object, {
    kind: 'donation',
    entitlementDays: '30',
  })
  expect((await deliver(h, donation)).status).toBe(200)
}

function badge(singer: Singer): string | undefined {
  const row = h.sqlite
    .prepare(
      "SELECT source FROM entitlements WHERE userId = ? AND feature = 'supporter'",
    )
    .get(singer.userId) as { source: string } | undefined
  return row?.source
}

describe('a donation names the supporter level', () => {
  it('keeps the higher level while that grant still runs', async () => {
    const singer = await register(h, 'anthem@example.com')
    granted(singer, 'sup-voice', 10)

    await donateChime(singer)

    expect(badge(singer)).toBe('donation:sup-voice')
  })

  it('does not carry over the level of a grant that has run out', async () => {
    const singer = await register(h, 'lapsed@example.com')
    granted(singer, 'sup-voice', -1)

    await donateChime(singer)

    expect(badge(singer)).toBe('donation:sup-fund')
  })
})
