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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StripeEvent } from './stripe-fake'
import type { Harness, Singer } from './stripe-harness'
import { deliver, openHarness, register } from './stripe-harness'

const NOW = '2026-10-13T12:00:00.000Z'
const THIRTY_DAYS_LATER = '2026-11-12T12:00:00.000Z'
let h: Harness

beforeEach(() => {
  // Mock Date alone so the exact expiry boundary cannot move during a request.
  vi.setSystemTime(new Date(NOW))
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
  vi.useRealTimers()
})

/** An existing Anthem grant, including legacy absent or malformed end dates. */
function granted(singer: Singer, expiresAt: string | null): void {
  h.sqlite
    .prepare(
      `INSERT INTO entitlements (id, createdAt, updatedAt, userId, feature, source, expiresAt)
       VALUES (?, ?, ?, ?, 'supporter', ?, ?)`,
    )
    .run(
      'earlier-grant',
      NOW,
      NOW,
      singer.userId,
      'donation:sup-voice',
      expiresAt,
    )
}

/** A EUR 5 Chime donation, paid and delivered. */
async function donateChime(singer: Singer): Promise<StripeEvent> {
  const donation = h.stripe.checkout(singer.userId, {
    planId: 'sup-fund',
    amount: 500,
  })
  Object.assign(donation.data.object.metadata as object, {
    kind: 'donation',
    entitlementDays: '30',
  })
  expect((await deliver(h, donation)).status).toBe(200)
  return donation
}

function entitlement(singer: Singer) {
  return h.sqlite
    .prepare(
      "SELECT * FROM entitlements WHERE userId = ? AND feature = 'supporter'",
    )
    .get(singer.userId)
}

interface GrantCase {
  name: string
  existingExpiry: string | null | undefined
  level: string
  expiresAt: string
}

const GRANTS: GrantCase[] = [
  {
    name: 'keeps the higher level while that grant still runs',
    existingExpiry: '2026-10-23T12:00:00.000Z',
    level: 'sup-voice',
    expiresAt: '2026-11-22T12:00:00.000Z',
  },
  {
    name: 'does not carry over the level of a grant that has run out',
    existingExpiry: '2026-10-12T12:00:00.000Z',
    level: 'sup-fund',
    expiresAt: THIRTY_DAYS_LATER,
  },
  {
    name: 'starts at the paid level when no grant is on record',
    existingExpiry: undefined,
    level: 'sup-fund',
    expiresAt: THIRTY_DAYS_LATER,
  },
  {
    name: 'keeps the higher level when the existing grant has no end date',
    existingExpiry: null,
    level: 'sup-voice',
    // Donations already replace a NULL expiry with their own finite term.
    expiresAt: THIRTY_DAYS_LATER,
  },
  {
    name: 'does not carry over the level at the exact expiry',
    existingExpiry: NOW,
    level: 'sup-fund',
    expiresAt: THIRTY_DAYS_LATER,
  },
  {
    name: 'keeps the higher level with one millisecond remaining',
    existingExpiry: '2026-10-13T12:00:00.001Z',
    level: 'sup-voice',
    expiresAt: '2026-11-12T12:00:00.001Z',
  },
  {
    name: 'does not carry over the level one millisecond after expiry',
    existingExpiry: '2026-10-13T11:59:59.999Z',
    level: 'sup-fund',
    expiresAt: THIRTY_DAYS_LATER,
  },
  {
    name: 'restarts at the paid level when the expiry is unparseable',
    existingExpiry: 'not-a-date',
    level: 'sup-fund',
    expiresAt: THIRTY_DAYS_LATER,
  },
  {
    name: 'restarts at the paid level when the expiry is empty',
    existingExpiry: '',
    level: 'sup-fund',
    expiresAt: THIRTY_DAYS_LATER,
  },
]

describe('a donation names the supporter level', () => {
  it.each(GRANTS)('$name', async ({ existingExpiry, level, expiresAt }) => {
    const singer = await register(h, 'supporter@example.test')
    if (existingExpiry !== undefined) granted(singer, existingExpiry)

    const donation = await donateChime(singer)
    const grant = entitlement(singer)
    expect(grant).toMatchObject({
      source: `donation:${level}`,
      expiresAt,
      updatedAt: NOW,
    })

    // A redelivery must preserve the whole grant and never add days twice.
    expect((await deliver(h, donation)).status).toBe(200)
    expect(entitlement(singer)).toEqual(grant)
    expect(
      h.sqlite
        .prepare(
          "SELECT COUNT(*) AS count, SUM(delta) AS delta FROM creditLedger WHERE userId = ? AND reason = 'donation'",
        )
        .get(singer.userId),
    ).toEqual({ count: 1, delta: 0 })
    expect(
      h.sqlite
        .prepare('SELECT COUNT(*) AS count FROM billingEvents WHERE id = ?')
        .get(donation.id),
    ).toEqual({ count: 1 })
  })
})
