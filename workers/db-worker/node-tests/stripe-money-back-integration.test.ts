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
import type { SqliteD1Database } from './sqlite-d1'
import { justBefore } from './sqlite-d1'
import type { StripeEvent } from './stripe-fake'
import type { Harness, Singer } from './stripe-harness'
import { alerts, balance, deliver, openHarness, recorded, register, spend, sweep, takeBacks, } from './stripe-harness'

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

function db(): SqliteD1Database {
  return h.env.DB as unknown as SqliteD1Database
}

/** The guarded write of a ledger row (ledger.ts, writeOnLedgerOnce). */
const LEDGER_WRITE =
  /INSERT OR IGNORE INTO creditLedger[\s\S]*SELECT COUNT\(\*\)/

/** What stripeCharges keeps of the payment's charge. */
function savedCharge(paymentIntent: string): unknown {
  return h.sqlite
    .prepare(
      'SELECT amount, amountRefunded, disputes FROM stripeCharges WHERE paymentIntentId = ?',
    )
    .get(paymentIntent)
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

  it('writes a row that moves nothing, and sends no alert, for a refund update that moves no money', async () => {
    const singer = await register(h, 'traced-refund@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.refund(pi, 500))
    const traced = h.stripe.touchLastRefund(pi)

    const res = await deliver(h, traced)

    // The row moves nothing; writing it is what makes a write that read
    // Stripe before this event read again (ledger.ts, the version check).
    expect(res).toEqual({ status: 200, body: { received: true } })
    expect(recorded(h, traced.id)).toBe(true)
    expect(takeBacks(h, singer.userId)).toMatchObject([
      { delta: -30 },
      { delta: 0, idempotencyKey: `clawback:${traced.id}` },
    ])
    expect(balance(h, singer.userId)).toBe(0)
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

  it('takes nothing for an inquiry, where no money has moved, and its closing gives nothing back', async () => {
    const singer = await register(h, 'inquiry@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.dispute(pi, { status: 'warning_needs_response' }))
    const held = balance(h, singer.userId)

    await deliver(h, h.stripe.closeDispute(pi, 'warning_closed'))

    expect(held).toBe(30)
    expect(balance(h, singer.userId)).toBe(30)
  })

  it('takes the credits once an inquiry becomes a chargeback and the money goes', async () => {
    const singer = await register(h, 'escalated@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.dispute(pi, { status: 'warning_needs_response' }))
    const duringInquiry = balance(h, singer.userId)

    await deliver(h, h.stripe.escalateDispute(pi))
    const charged = balance(h, singer.userId)
    await deliver(h, h.stripe.closeDispute(pi, 'won'))

    expect([duringInquiry, charged]).toEqual([30, 0])
    expect(balance(h, singer.userId)).toBe(30)
  })
})

describe('a purchase with no consent on record', () => {
  // Refunds and disputes never take back the credits its buyer used, by
  // whatever route the money goes back: every take is capped at what they
  // hold already plus the pack's credits still unused (CRD Art. 14(4)(b)).

  /** A 30-credit EUR 5.00 pack bought with no consent on record, 25 of its
   *  credits spent: 5 left. */
  async function mostlyUsed(singer: Singer): Promise<string> {
    const purchase = h.stripe.checkout(singer.userId, { consent: false })
    expect((await deliver(h, purchase)).status).toBe(200)
    setSongCost(25)
    expect((await spend(h, singer, 'job-used-25')).status).toBe(200)
    setSongCost(1)
    expect(balance(h, singer.userId)).toBe(5)
    return String(purchase.data.object.payment_intent)
  }

  it('takes only the unused credits when the whole price goes back in two refunds', async () => {
    const singer = await register(h, 'split-no-consent@example.com')
    const pi = await mostlyUsed(singer)

    await deliver(h, h.stripe.refund(pi, 333))
    const afterFirst = balance(h, singer.userId)
    await deliver(h, h.stripe.refund(pi, 167))

    expect(afterFirst).toBe(0)
    expect(balance(h, singer.userId)).toBe(0)
    expect(takeBacks(h, singer.userId).map((row) => row.delta)).toEqual([-5, 0])
  })

  it('takes only the unused credits through an inquiry, a whole refund and the inquiry closing', async () => {
    const singer = await register(h, 'inquiry-no-consent@example.com')
    const pi = await mostlyUsed(singer)

    await deliver(h, h.stripe.dispute(pi, { status: 'warning_needs_response' }))
    const afterInquiry = balance(h, singer.userId)
    await deliver(h, h.stripe.refund(pi, 500))
    const afterRefund = balance(h, singer.userId)
    await deliver(h, h.stripe.closeDispute(pi, 'warning_closed'))

    expect([afterInquiry, afterRefund]).toEqual([5, 0])
    expect(balance(h, singer.userId)).toBe(0)
    expect(takeBacks(h, singer.userId).map((row) => row.delta)).toEqual([
      0, -5, 0,
    ])
  })

  it('leaves the buyer owing nothing when a dispute is lost', async () => {
    const singer = await register(h, 'lost-no-consent@example.com')
    const pi = await mostlyUsed(singer)

    await deliver(h, h.stripe.dispute(pi))
    const held = balance(h, singer.userId)
    await deliver(h, h.stripe.closeDispute(pi, 'lost'))

    expect(held).toBe(0)
    expect(balance(h, singer.userId)).toBe(0)
  })

  it('gives back exactly what a capped dispute held when it is won', async () => {
    const singer = await register(h, 'won-no-consent@example.com')
    const pi = await mostlyUsed(singer)

    await deliver(h, h.stripe.dispute(pi))
    await deliver(h, h.stripe.closeDispute(pi, 'won'))

    expect(takeBacks(h, singer.userId).map((row) => row.delta)).toEqual([-5, 5])
    expect(balance(h, singer.userId)).toBe(5)
  })

  it('says how many used credits stay with the buyer', async () => {
    const singer = await register(h, 'alert-no-consent@example.com')
    const pi = await mostlyUsed(singer)

    await deliver(h, h.stripe.refund(pi, 250))

    const alert = alerts(h).find((mail) => mail.subject.includes('Refund'))
    expect(alert?.subject).toBe(
      '[MercuryPitch billing] Refund: took back 5 credit(s)',
    )
    expect(alert?.text).toContain(
      'This purchase has no consent on record, so refunds and disputes take back only credits still unused: 10 credit(s) the buyer used stay theirs.',
    )
  })

  it('still leaves a buyer who gave the consent owing for the credits they used', async () => {
    const singer = await register(h, 'consented@example.com')
    const pi = await bought(singer)
    setSongCost(25)
    expect((await spend(h, singer, 'job-consented-25')).status).toBe(200)

    await deliver(h, h.stripe.refund(pi, 500))

    expect(balance(h, singer.userId)).toBe(-25)
  })
})

describe('an event whose Stripe read is older than the ledger', () => {
  // Another delivery for the same payment lands between this one's read of
  // Stripe and its write. Every write reads Stripe again after the ledger,
  // and every event writes its row, so the last row written always comes
  // from the newest read.

  it('keeps the credits taken back when the whole price is refunded again before a failed refund gives them back', async () => {
    const singer = await register(h, 'stale-giveback@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.refund(pi, 500))
    const { failed } = h.stripe.failLastRefund(pi)

    // refund.failed has read Stripe (nothing refunded any more) when the
    // owner refunds the whole price again, and that refund's charge.refunded
    // is applied before refund.failed writes.
    justBefore(db(), LEDGER_WRITE, async () => {
      expect((await deliver(h, h.stripe.refund(pi, 500))).status).toBe(200)
    })
    expect((await deliver(h, failed)).status).toBe(200)
    await sweep(h)

    // Stripe: the second refund sent the whole EUR 5.00 back.
    expect(balance(h, singer.userId)).toBe(0)
    expect(savedCharge(pi)).toMatchObject({ amountRefunded: 500 })
  })

  it('takes nothing for a refund that failed before its take was written', async () => {
    const singer = await register(h, 'stale-take@example.com')
    const pi = await bought(singer)
    const refunded = h.stripe.refund(pi, 500)

    // charge.refunded has read Stripe (the refund on its way) when the
    // refund fails, and refund.failed is applied before charge.refunded
    // writes.
    let echo: StripeEvent | null = null
    justBefore(db(), LEDGER_WRITE, async () => {
      const ended = h.stripe.failLastRefund(pi)
      echo = ended.updated
      expect((await deliver(h, ended.failed)).status).toBe(200)
    })
    expect((await deliver(h, refunded)).status).toBe(200)
    // Stripe's second event for the same failure, delivered late.
    if (echo !== null) await deliver(h, echo)
    await sweep(h)

    // Stripe: the refund failed, and the money stayed with the shop.
    expect(balance(h, singer.userId)).toBe(30)
    expect(savedCharge(pi)).toMatchObject({ amountRefunded: 0 })
  })

  it('settles a purchase that lands after its refund from what Stripe says then, not from an older read', async () => {
    const singer = await register(h, 'stale-early@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    const pi = String(purchase.data.object.payment_intent)
    const refunded = h.stripe.refund(pi, 500)

    // Neither event finds the purchase. charge.refunded has read Stripe
    // (refunded whole) when the refund fails, and refund.failed keeps what
    // Stripe says before charge.refunded keeps its older read.
    justBefore(db(), /INTO stripeCharges/, async () => {
      const ended = h.stripe.failLastRefund(pi)
      expect((await deliver(h, ended.failed)).status).toBe(200)
    })
    expect((await deliver(h, refunded)).status).toBe(200)
    expect((await deliver(h, purchase)).status).toBe(200)

    // Stripe: the refund failed. The purchase keeps its 30 credits.
    expect(balance(h, singer.userId)).toBe(30)
  })

  it('never keeps an older read of Stripe over a newer one', async () => {
    const singer = await register(h, 'stale-keep@example.com')
    const pi = await bought(singer)
    await deliver(h, h.stripe.refund(pi, 500))
    const { updated, failed } = h.stripe.failLastRefund(pi)
    await deliver(h, failed)

    // The late refund.updated for the same failure has read Stripe (nothing
    // refunded) when the owner refunds the whole price again, and that
    // refund is applied, and kept, before the late event leaves its read.
    justBefore(db(), /INTO stripeCharges/, async () => {
      expect((await deliver(h, h.stripe.refund(pi, 500))).status).toBe(200)
    })
    expect((await deliver(h, updated)).status).toBe(200)

    expect(balance(h, singer.userId)).toBe(0)
    expect(savedCharge(pi)).toMatchObject({ amountRefunded: 500 })
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
