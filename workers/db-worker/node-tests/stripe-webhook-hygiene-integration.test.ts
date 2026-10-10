// @vitest-environment node
//
// ── The webhook answers so that Stripe retries only what can succeed ──
//
// Stripe redelivers any event it does not get a 2xx for, for three days.
// So a failure that may pass on a retry (D1 or Stripe out of reach) answers
// 500, and one that never will (a payload Stripe signed but nobody can read,
// a charge Stripe no longer knows) answers 200 and leaves a trace instead.
// An event type the worker does not handle answers 200 before D1 is touched.
// A signature that does not verify, or is older than five minutes, answers
// 400. And nothing it logs holds an email address or card details.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BUYER_EMAIL, CARD_LAST4 } from './stripe-fake'
import type { Harness } from './stripe-harness'
import { ALERT_ADDRESS, alerts, balance, deliver, failingD1, openHarness, post, recorded, recordedCount, register, signature, sweep, takeBacks, } from './stripe-harness'

let h: Harness

beforeEach(() => {
  h = openHarness()
})

afterEach(() => {
  h.close()
})

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

describe('answers that end the retries', () => {
  it('answers an event type it does not handle with 200 and writes nothing', async () => {
    const event = {
      id: 'evt_unhandled',
      object: 'event',
      type: 'customer.created',
      data: { object: { id: 'cus_1', object: 'customer' } },
    }

    const res = await deliver(h, event as never)

    expect(res).toEqual({
      status: 200,
      body: { received: true, ignored: 'unhandled event type' },
    })
    expect(recordedCount(h)).toBe(0)
    expect(alerts(h)).toEqual([])
  })

  it('answers an event type it does not handle with 200 even while D1 is down', async () => {
    h.env.DB = failingD1(h, /./, 100)
    const event = {
      id: 'evt_unhandled_outage',
      object: 'event',
      type: 'invoice.paid',
      data: { object: {} },
    }

    const res = await deliver(h, event as never)

    expect(res.status).toBe(200)
  })

  it('answers a payload Stripe signed but nobody can parse with 200', async () => {
    const payload = '{"id": "evt_truncated", "type": "charge.refu'

    const res = await post(h, payload, signature(payload))

    expect(res).toEqual({
      status: 200,
      body: { received: true, ignored: 'malformed payload' },
    })
  })

  it('answers a signed event without an id with 200', async () => {
    const payload = JSON.stringify({ type: 'charge.refunded', data: {} })

    const res = await post(h, payload, signature(payload))

    expect(res.status).toBe(200)
    expect(res.body.ignored).toBe('missing event id')
  })

  it('records a refund of a charge Stripe does not know, answers 200 and alerts', async () => {
    const singer = await register(h, 'ghost@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )
    refund.data.object.id = 'ch_gone'

    const res = await deliver(h, refund)

    expect(res).toEqual({
      status: 200,
      body: { received: true, ignored: 'charge not found' },
    })
    expect(recorded(h, refund.id)).toBe(true)
    expect(balance(h, singer.userId)).toBe(30)
    expect(alerts(h).at(-1)?.subject).toBe(
      '[MercuryPitch billing] Refund that could not be applied',
    )
  })
})

describe('answers that ask Stripe to try again', () => {
  it('answers a D1 outage with 500, then applies the redelivery once', async () => {
    const singer = await register(h, 'outage@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )
    const healthy = h.env.DB
    h.env.DB = failingD1(h, /INSERT OR IGNORE INTO creditLedger/)

    const failed = await deliver(h, refund)
    h.env.DB = healthy
    const retried = await deliver(h, refund)

    expect(failed.status).toBe(500)
    expect(JSON.stringify(failed.body)).not.toContain('D1_ERROR')
    expect(retried).toEqual({ status: 200, body: { received: true } })
    expect(balance(h, singer.userId)).toBe(0)
    expect(takeBacks(h, singer.userId)).toHaveLength(1)
    expect(recorded(h, refund.id)).toBe(true)
  })

  it('answers 500 and records nothing while Stripe cannot say what the charge is', async () => {
    const singer = await register(h, 'stripe-down@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )
    h.stripe.failNext('/v1/charges/', 503)

    const failed = await deliver(h, refund)

    expect(failed.status).toBe(500)
    expect(recorded(h, refund.id)).toBe(false)
    expect(balance(h, singer.userId)).toBe(30)
  })

  it('answers 500 and records nothing while Stripe will not list the refunds or the disputes', async () => {
    const singer = await register(h, 'lists-down@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    const pi = String(purchase.data.object.payment_intent)
    await deliver(h, purchase)
    const refund = h.stripe.refund(pi, 250)
    const dispute = h.stripe.dispute(pi)
    h.stripe.failNext('/v1/refunds', 429)
    h.stripe.failNext('/v1/disputes', 500)

    const refundFailed = await deliver(h, refund)
    const disputeFailed = await deliver(h, dispute)

    expect(refundFailed.status).toBe(500)
    expect(disputeFailed.status).toBe(500)
    expect(recorded(h, refund.id)).toBe(false)
    expect(recorded(h, dispute.id)).toBe(false)
    expect(balance(h, singer.userId)).toBe(30)
  })

  it('records a purchase on the redelivery that finishes it, after a failure past its grant', async () => {
    const singer = await register(h, 'past-the-grant@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    const db = h.env.DB
    h.env.DB = failingD1(h, /FROM stripeCharges/)

    const failed = await deliver(h, purchase)
    const recordedAfterFailure = recorded(h, purchase.id)
    h.env.DB = db
    const again = await deliver(h, purchase)

    expect(failed.status).toBe(500)
    expect(recordedAfterFailure).toBe(false)
    expect(again).toEqual({
      status: 200,
      body: { received: true, duplicate: true },
    })
    expect(recorded(h, purchase.id)).toBe(true)
    expect(balance(h, singer.userId)).toBe(30)
  })

  it('records a purchase the sweep finishes, after a failure past its grant, and reports nothing missed', async () => {
    const singer = await register(h, 'swept-past-the-grant@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    const db = h.env.DB
    h.env.DB = failingD1(h, /FROM stripeCharges/)
    await deliver(h, purchase)
    h.env.DB = db

    await sweep(h)

    expect(recorded(h, purchase.id)).toBe(true)
    expect(balance(h, singer.userId)).toBe(30)
    expect(alerts(h)).toEqual([])
  })
})

describe('signatures', () => {
  it('rejects a signature made with another secret, and writes nothing', async () => {
    const payload = JSON.stringify({
      id: 'evt_forged',
      type: 'charge.refunded',
    })

    const res = await post(
      h,
      payload,
      signature(payload, { secret: 'whsec_somebody_else' }),
    )

    expect(res.status).toBe(400)
    expect(recordedCount(h)).toBe(0)
  })

  it('rejects a signature older than five minutes', async () => {
    const payload = JSON.stringify({
      id: 'evt_replayed',
      type: 'charge.refunded',
    })
    const sixMinutesAgo = Math.floor(Date.now() / 1000) - 6 * 60

    const res = await post(
      h,
      payload,
      signature(payload, { timestamp: sixMinutesAgo }),
    )

    expect(res.status).toBe(400)
  })
})

describe('logs', () => {
  it('hold no email address and no card details through a purchase, a refund and a dispute', async () => {
    const singer = await register(h, 'private.singer@example.com')
    h.logs.length = 0
    const purchase = h.stripe.checkout(singer.userId)
    const pi = String(purchase.data.object.payment_intent)

    await deliver(h, purchase)
    await deliver(h, h.stripe.refund(pi, 250))
    await deliver(h, h.stripe.dispute(pi))

    const leaks = (text: string): boolean =>
      EMAIL.test(text) ||
      text.includes(BUYER_EMAIL) ||
      text.includes(ALERT_ADDRESS) ||
      text.includes('last4') ||
      text.includes(`*${CARD_LAST4}`)
    expect(h.logs.length).toBeGreaterThan(0)
    expect(h.logs.filter(leaks)).toEqual([])
    expect(alerts(h).length).toBeGreaterThan(0)
    expect(alerts(h).filter((alert) => leaks(alert.text))).toEqual([])
  })
})
