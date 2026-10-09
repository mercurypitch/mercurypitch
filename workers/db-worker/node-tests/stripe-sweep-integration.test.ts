// @vitest-environment node
//
// ── The sweep applies what the webhook missed, through the same handler ──
//
// Every six hours the worker lists the last 30 days of the Stripe events it
// handles and applies each one billingEvents has not recorded, oldest first,
// through the handler the webhook uses (billing.ts, applyStripeEvent). A
// refund or dispute whose webhook failed for all of Stripe's three days of
// retries is applied here, and the owner hears that the webhook missed it.
// A sweep that cannot finish says so too.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyMigration, interleaved, SqliteD1Database } from './sqlite-d1'
import type { Harness } from './stripe-harness'
import { alerts, balance, deliver, failingD1, openHarness, recorded, register, stripeReads, sweep, takeBacks, } from './stripe-harness'

let h: Harness

beforeEach(() => {
  h = openHarness()
})

afterEach(() => {
  h.close()
})

const HANDLED = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'charge.refunded',
  'refund.updated',
  'refund.failed',
  'charge.dispute.created',
  'charge.dispute.closed',
]

describe('what the sweep asks Stripe for', () => {
  it('lists every event type the webhook handles, from 30 days ago to ten minutes ago', async () => {
    const before = Math.floor(Date.now() / 1000)

    await sweep(h)

    const [list] = stripeReads(h, '/v1/events')
    expect(list.searchParams.getAll('types[]').sort()).toEqual(
      [...HANDLED].sort(),
    )
    const from = Number(list.searchParams.get('created[gte]'))
    const to = Number(list.searchParams.get('created[lte]'))
    expect(Math.abs(from - (before - 30 * 24 * 60 * 60))).toBeLessThan(60)
    expect(Math.abs(to - (before - 10 * 60))).toBeLessThan(60)
  })
})

describe('events the webhook missed', () => {
  it('applies a refund the webhook missed once, and says the webhook missed it', async () => {
    const singer = await register(h, 'missed-refund@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )

    await sweep(h)
    const late = await deliver(h, refund)

    expect(balance(h, singer.userId)).toBe(0)
    expect(takeBacks(h, singer.userId)).toHaveLength(1)
    expect(recorded(h, refund.id)).toBe(true)
    expect(late.body).toEqual({ received: true, duplicate: true })
    const summary = alerts(h).find((alert) =>
      alert.subject.includes('Sweep recovered'),
    )
    expect(summary?.subject).toBe(
      '[MercuryPitch billing] Sweep recovered 1 missed event(s)',
    )
    expect(summary?.text).toContain(`${refund.id} (charge.refunded)`)
  })

  it('applies a missed purchase before its missed refund', async () => {
    const singer = await register(h, 'missed-both@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    h.stripe.refund(String(purchase.data.object.payment_intent), 500)

    await sweep(h)

    expect(balance(h, singer.userId)).toBe(0)
    expect(
      alerts(h).filter((alert) =>
        alert.subject.includes('no credits on record'),
      ),
    ).toEqual([])
  })

  it('applies a dispute closing that no webhook subscription delivers', async () => {
    const singer = await register(h, 'missed-closing@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    const pi = String(purchase.data.object.payment_intent)
    await deliver(h, purchase)
    await deliver(h, h.stripe.dispute(pi))
    const won = h.stripe.closeDispute(pi, 'won')

    await sweep(h)

    expect(balance(h, singer.userId)).toBe(30)
    expect(recorded(h, won.id)).toBe(true)
  })

  it('applies an event once when the webhook delivers it while the sweep runs', async () => {
    const singer = await register(h, 'race@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )
    h.env.DB = interleaved(new SqliteD1Database(h.sqlite))

    await Promise.all([sweep(h), deliver(h, refund)])

    expect(balance(h, singer.userId)).toBe(0)
    expect(takeBacks(h, singer.userId)).toHaveLength(1)
    expect(
      alerts(h).filter((alert) => alert.subject.includes('Refund: took back')),
    ).toHaveLength(1)
  })

  it('stays quiet when the webhook delivered everything', async () => {
    const singer = await register(h, 'all-delivered@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const alertsBefore = alerts(h).length

    await sweep(h)

    expect(alerts(h)).toHaveLength(alertsBefore)
  })
})

describe('a sweep that cannot finish', () => {
  it('alerts when Stripe will not list the events', async () => {
    h.stripe.failNext('/v1/events', 500)
    h.stripe.failNext('/v1/events', 500)

    await sweep(h)

    const [alert] = alerts(h)
    expect(alert?.subject).toBe(
      '[MercuryPitch billing] Sweep failed: Stripe answered 500 to the events list',
    )
  })

  it('leaves an event that fails for the next run, and alerts', async () => {
    const singer = await register(h, 'poisoned@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )
    const healthy = h.env.DB
    h.env.DB = failingD1(h, /INSERT OR IGNORE INTO creditLedger/)

    await sweep(h)
    const afterFailure = balance(h, singer.userId)
    h.env.DB = healthy
    await sweep(h)

    expect(afterFailure).toBe(30)
    expect(balance(h, singer.userId)).toBe(0)
    const failure = alerts(h).find((alert) =>
      alert.subject.includes('could not apply'),
    )
    expect(failure?.subject).toBe(
      '[MercuryPitch billing] Sweep could not apply 1 event(s)',
    )
    expect(failure?.text).toContain(`${refund.id} (charge.refunded)`)
  })
})

describe('events an older worker recorded without applying them', () => {
  it('applies them on the first sweep after the migration forgets them', async () => {
    const singer = await register(h, 'old-worker@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )
    // What v0.9.16 did with a refund: recorded it, applied nothing.
    h.sqlite
      .prepare(
        'INSERT INTO billingEvents (id, createdAt, type) VALUES (?, ?, ?)',
      )
      .run(refund.id, new Date().toISOString(), refund.type)
    await sweep(h)
    const beforeMigration = balance(h, singer.userId)

    applyMigration(h.sqlite, '0065_reapply_money_back_events.sql')
    const purchaseKept = recorded(h, purchase.id)
    await sweep(h)

    expect(beforeMigration).toBe(30)
    expect(purchaseKept).toBe(true)
    expect(balance(h, singer.userId)).toBe(0)
    expect(recorded(h, refund.id)).toBe(true)
  })
})
