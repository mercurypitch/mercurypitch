// @vitest-environment node
//
// ── Money that goes back takes its credits back, exactly once ──────────
//
// A refund takes back the refunded share of what its payment granted, a
// dispute holds all of it until the bank decides, and a won dispute or a
// failed or canceled refund gives back what it held (stripe-payments.ts).
// Every event applies once, whichever order it arrives in, and credits
// already spent leave the balance below zero, which blocks spending until it
// is positive.
//
// The worker reads each charge, its refunds and its disputes from a fake
// Stripe (stripe-fake.ts), the way it reads the real one: the event says
// what changed, Stripe's API says what is true now.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Harness, Singer } from './stripe-harness'
import { alerts, balance, deliver, openHarness, recorded, register, spend, takeBacks, } from './stripe-harness'

let h: Harness

beforeEach(() => {
  h = openHarness()
})

afterEach(() => {
  h.close()
})

/** A pack of 30 credits for EUR 5.00, bought and granted. */
async function bought(singer: Singer, credits = 30): Promise<string> {
  const event = h.stripe.checkout(singer.userId, { credits })
  expect((await deliver(h, event)).status).toBe(200)
  return String(event.data.object.payment_intent)
}

function setSongCost(credits: number): void {
  h.sqlite
    .prepare("UPDATE pricingPlans SET credits = ? WHERE id = 'tier-runpod-gpu'")
    .run(credits)
}

describe('a refund', () => {
  it('takes back the refunded share of a partial refund, and the rest when it completes', async () => {
    const singer = await register(h, 'partial@example.com')
    const pi = await bought(singer)

    await deliver(h, h.stripe.refund(pi, 250))
    const afterHalf = balance(h, singer.userId)
    await deliver(h, h.stripe.refund(pi, 250))

    expect(afterHalf).toBe(15)
    expect(balance(h, singer.userId)).toBe(0)
    expect(takeBacks(h, singer.userId).map((row) => row.delta)).toEqual([
      -15, -15,
    ])
  })

  it('takes nothing twice when Stripe delivers the same refund twice', async () => {
    const singer = await register(h, 'twice@example.com')
    const pi = await bought(singer)
    const refund = h.stripe.refund(pi, 500)

    const first = await deliver(h, refund)
    const again = await deliver(h, refund)

    expect(first).toEqual({ status: 200, body: { received: true } })
    expect(again).toEqual({
      status: 200,
      body: { received: true, duplicate: true },
    })
    expect(balance(h, singer.userId)).toBe(0)
    expect(takeBacks(h, singer.userId)).toHaveLength(1)
    expect(alerts(h).map((alert) => alert.subject)).toEqual([
      '[MercuryPitch billing] Refund: took back 30 credit(s)',
    ])
  })

  it('takes nothing more for a second event that reports the same refund', async () => {
    const singer = await register(h, 'echo@example.com')
    const pi = await bought(singer)
    const refund = h.stripe.refund(pi, 500)
    await deliver(h, refund)

    const echo = await deliver(h, { ...refund, id: 'evt_refund_echo' })

    expect(echo).toEqual({ status: 200, body: { received: true } })
    expect(balance(h, singer.userId)).toBe(0)
    expect(
      takeBacks(h, singer.userId).filter((row) => row.delta !== 0),
    ).toHaveLength(1)
    expect(alerts(h)).toHaveLength(1)
  })

  it('takes the credits back when the refund arrives before its purchase', async () => {
    const singer = await register(h, 'early@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )

    const early = await deliver(h, refund)
    await deliver(h, purchase)

    expect(early.status).toBe(200)
    expect(recorded(h, refund.id)).toBe(true)
    expect(balance(h, singer.userId)).toBe(0)
    expect(alerts(h).map((alert) => alert.subject)).toEqual([
      '[MercuryPitch billing] Refund with no credits on record',
      '[MercuryPitch billing] Refund before its purchase: took back 30 credit(s)',
    ])
  })

  it('leaves spent credits owed, and blocks spending until the balance is positive', async () => {
    const singer = await register(h, 'spent@example.com')
    const pi = await bought(singer)
    setSongCost(25)
    expect((await spend(h, singer, 'job-spent-1')).status).toBe(200)

    await deliver(h, h.stripe.refund(pi, 500))
    setSongCost(1)
    const blocked = await spend(h, singer, 'job-spent-2')
    await bought(singer)
    const unblocked = await spend(h, singer, 'job-spent-3')

    expect(blocked.status).toBe(402)
    expect(blocked.body.balance).toBe(-25)
    expect(unblocked.status).toBe(200)
    expect(balance(h, singer.userId)).toBe(4)
    const refundAlert = alerts(h).find((alert) =>
      alert.subject.includes('Refund: took back 30'),
    )
    expect(refundAlert?.text).toContain('Balance after: -25 credit(s)')
    expect(refundAlert?.text).toContain('25 of them were already spent')
  })

  it('takes only unused credits for a whole refund of a purchase with no consent on record, and gives them back if it fails', async () => {
    const singer = await register(h, 'no-consent@example.com')
    const purchase = h.stripe.checkout(singer.userId, { consent: false })
    expect((await deliver(h, purchase)).status).toBe(200)
    const pi = String(purchase.data.object.payment_intent)
    setSongCost(25)
    expect((await spend(h, singer, 'job-no-consent')).status).toBe(200)

    await deliver(h, h.stripe.refund(pi, 500))
    const afterRefund = balance(h, singer.userId)
    const { updated, failed } = h.stripe.failLastRefund(pi)
    await deliver(h, failed)
    await deliver(h, updated)

    // The 25 used stay the buyer's; the 5 unused go, and come back.
    expect(afterRefund).toBe(0)
    expect(takeBacks(h, singer.userId).map((row) => row.delta)).toEqual([-5, 5])
    expect(balance(h, singer.userId)).toBe(5)
  })

  it('gives back what a failed refund took once, for both events Stripe sends', async () => {
    const singer = await register(h, 'bounced-refund@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.refund(pi, 500))
    const { updated, failed } = h.stripe.failLastRefund(pi)

    const first = await deliver(h, failed)
    const second = await deliver(h, updated)

    expect(first).toEqual({ status: 200, body: { received: true } })
    expect(second).toEqual({ status: 200, body: { received: true } })
    expect(balance(h, singer.userId)).toBe(30)
    expect(takeBacks(h, singer.userId).map((row) => row.delta)).toEqual([
      -30, 30,
    ])
    expect(alerts(h).map((alert) => alert.subject)).toEqual([
      '[MercuryPitch billing] Refund: took back 30 credit(s)',
      '[MercuryPitch billing] Refund failed: gave back 30 credit(s)',
    ])
  })

  it('gives back what a canceled refund took', async () => {
    const singer = await register(h, 'canceled-refund@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.refund(pi, 250))

    await deliver(h, h.stripe.cancelLastRefund(pi))

    expect(balance(h, singer.userId)).toBe(30)
    expect(alerts(h).at(-1)?.subject).toBe(
      '[MercuryPitch billing] Refund canceled: gave back 15 credit(s)',
    )
  })

  it('writes nothing for a refund update that moves no money', async () => {
    const singer = await register(h, 'traced-refund@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.refund(pi, 500))
    const traced = h.stripe.touchLastRefund(pi)

    const res = await deliver(h, traced)

    expect(res).toEqual({ status: 200, body: { received: true } })
    expect(recorded(h, traced.id)).toBe(true)
    expect(takeBacks(h, singer.userId)).toHaveLength(1)
    expect(alerts(h)).toHaveLength(1)
  })

  it('takes the refund back from a refund update when its charge.refunded never came', async () => {
    const singer = await register(h, 'update-first@example.com')
    const pi = await bought(singer)
    h.stripe.refund(pi, 500)

    await deliver(h, h.stripe.touchLastRefund(pi))

    expect(balance(h, singer.userId)).toBe(0)
    expect(alerts(h).map((alert) => alert.subject)).toEqual([
      '[MercuryPitch billing] Refund: took back 30 credit(s)',
    ])
  })

  it('takes nothing for a payment with no credits on record, and says so', async () => {
    const singer = await register(h, 'stranger@example.com')
    await bought(singer)
    const unknown = h.stripe.checkout(singer.userId)

    const res = await deliver(
      h,
      h.stripe.refund(String(unknown.data.object.payment_intent), 500),
    )

    expect(res.status).toBe(200)
    expect(balance(h, singer.userId)).toBe(30)
    const [alert] = alerts(h)
    expect(alert?.subject).toBe(
      '[MercuryPitch billing] Refund with no credits on record',
    )
    expect(alert?.text).toContain('any credits still due are taken back then')
  })

  it('names the donor of a refunded donation, and takes no credits', async () => {
    const singer = await register(h, 'donor@example.com')
    const donation = h.stripe.checkout(singer.userId, { planId: 'sup-fund' })
    Object.assign(donation.data.object.metadata as object, {
      kind: 'donation',
      entitlementDays: '30',
    })
    await deliver(h, donation)

    await deliver(
      h,
      h.stripe.refund(String(donation.data.object.payment_intent), 500),
    )

    expect(balance(h, singer.userId)).toBe(0)
    const [alert] = alerts(h)
    expect(alert?.subject).toBe(
      '[MercuryPitch billing] Refund with no credits on record',
    )
    expect(alert?.text).toContain(`donation from account ${singer.userId}`)
  })

  it('says once that a refund with no credits on record failed', async () => {
    const singer = await register(h, 'old-purchase@example.com')
    const unknown = h.stripe.checkout(singer.userId)
    const pi = String(unknown.data.object.payment_intent)
    await deliver(h, h.stripe.refund(pi, 500))
    const { updated, failed } = h.stripe.failLastRefund(pi)

    await deliver(h, updated)
    await deliver(h, failed)

    expect(alerts(h).map((alert) => alert.subject)).toEqual([
      '[MercuryPitch billing] Refund with no credits on record',
      '[MercuryPitch billing] Refund failed (no credits on record)',
    ])
  })
})

describe('a dispute', () => {
  it('holds the credits when it opens, and alerts with the amount, the reason and the deadline', async () => {
    const singer = await register(h, 'disputed@example.com')
    const pi = await bought(singer)

    const res = await deliver(h, h.stripe.dispute(pi, { reason: 'fraudulent' }))

    expect(res.status).toBe(200)
    expect(balance(h, singer.userId)).toBe(0)
    expect(takeBacks(h, singer.userId)).toMatchObject([
      { delta: -30, reason: 'purchase-dispute', jobRef: pi },
    ])
    const [alert] = alerts(h)
    expect(alert?.subject).toBe(
      '[MercuryPitch billing] Dispute opened: €5.00, evidence due 30 October 2026',
    )
    expect(alert?.text).toContain('Amount: €5.00 of a €5.00 payment')
    expect(alert?.text).toContain('Reason: fraudulent')
    expect(alert?.text).toContain('Evidence due: 30 October 2026, 23:59 UTC')
    expect(alert?.text).toContain(`Account: ${singer.userId}`)
    expect(alert?.text).toContain(
      'https://dashboard.stripe.com/test/disputes/dp_',
    )
  })

  it('gives the held credits back when the dispute is won', async () => {
    const singer = await register(h, 'won@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.dispute(pi))

    await deliver(h, h.stripe.closeDispute(pi, 'won'))

    expect(balance(h, singer.userId)).toBe(30)
    expect(takeBacks(h, singer.userId).map((row) => row.delta)).toEqual([
      -30, 30,
    ])
    expect(alerts(h).at(-1)?.subject).toBe(
      '[MercuryPitch billing] Dispute won: gave back 30 credit(s)',
    )
  })

  it('keeps the credits taken when the dispute is lost', async () => {
    const singer = await register(h, 'lost@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.dispute(pi))

    await deliver(h, h.stripe.closeDispute(pi, 'lost'))

    expect(balance(h, singer.userId)).toBe(0)
    expect(alerts(h).at(-1)?.subject).toBe(
      '[MercuryPitch billing] Dispute lost: €5.00 gone, 30 credit(s) stay taken back',
    )
  })

  it('takes nothing when the dispute closes as won before its opening is processed', async () => {
    const singer = await register(h, 'reversed@example.com')
    const pi = await bought(singer)
    const opened = h.stripe.dispute(pi)
    const won = h.stripe.closeDispute(pi, 'won')

    await deliver(h, won)
    await deliver(h, opened)

    expect(balance(h, singer.userId)).toBe(30)
    expect(recorded(h, opened.id)).toBe(true)
    expect(recorded(h, won.id)).toBe(true)
  })

  it('takes only what a refund left, and gives back only that when it is won', async () => {
    const singer = await register(h, 'refunded-then-disputed@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.refund(pi, 250))

    await deliver(h, h.stripe.dispute(pi))
    const held = balance(h, singer.userId)
    await deliver(h, h.stripe.closeDispute(pi, 'won'))

    expect(held).toBe(0)
    expect(balance(h, singer.userId)).toBe(15)
  })

  it('treats an inquiry that closes without a chargeback like a won dispute', async () => {
    const singer = await register(h, 'inquiry@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.dispute(pi, { status: 'warning_needs_response' }))
    const held = balance(h, singer.userId)

    await deliver(h, h.stripe.closeDispute(pi, 'warning_closed'))

    expect(held).toBe(0)
    expect(balance(h, singer.userId)).toBe(30)
  })
})

describe('the launch bonus', () => {
  it('goes back with the pack it came with', async () => {
    const singer = await register(h, 'bonus@example.com')
    const purchase = h.stripe.checkout(singer.userId, { bonus: 30 })
    await deliver(h, purchase)
    const granted = balance(h, singer.userId)

    await deliver(
      h,
      h.stripe.refund(String(purchase.data.object.payment_intent), 500),
    )

    expect(granted).toBe(60)
    expect(balance(h, singer.userId)).toBe(0)
    expect(takeBacks(h, singer.userId).map((row) => row.delta)).toEqual([-60])
  })
})
