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

import type { SQLInputValue } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import worker from '../src/index'
import { SWEEP_MONEY_BACK_PER_RUN } from '../src/stripe-sweep'
import type { SqliteD1Statement } from './sqlite-d1'
import { applyMigration, interleaved, SqliteD1Database } from './sqlite-d1'
import type { Harness } from './stripe-harness'
import { alerts, balance, deliver, failingD1, openHarness, recorded, recordedType, register, stripeReads, sweep, takeBacks, } from './stripe-harness'

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
  'charge.dispute.funds_withdrawn',
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

describe('the 6-hourly cron', () => {
  it('runs the sweep beside the others, and applies a refund the webhook missed', async () => {
    const singer = await register(h, 'cron-refund@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )

    await worker.scheduled(
      {} as ScheduledController,
      h.env,
      {} as ExecutionContext,
    )

    expect(balance(h, singer.userId)).toBe(0)
    expect(recorded(h, refund.id)).toBe(true)
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

/** D1 that counts its queries: each statement run on its own, and each
 *  statement of a batch, as D1 counts them against an invocation. */
function countingD1(h: Harness): { db: D1Database; queries: () => number } {
  const db = new SqliteD1Database(h.sqlite)
  let queries = 0
  const statement = (inner: SqliteD1Statement): SqliteD1Statement =>
    new Proxy(inner, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: SQLInputValue[]) =>
            statement(target.bind(...values))
        }
        const value: unknown = Reflect.get(target, property, receiver)
        if (property === 'first' || property === 'all' || property === 'run') {
          const query = value as (...args: unknown[]) => Promise<unknown>
          return async (...args: unknown[]) => {
            queries += 1
            return query.apply(target, args)
          }
        }
        return value
      },
    })
  return {
    db: {
      prepare: (sql: string) => statement(db.prepare(sql)),
      batch: async (statements: SqliteD1Statement[]) => {
        queries += statements.length
        return db.batch(statements)
      },
    } as unknown as D1Database,
    queries: () => queries,
  }
}

/** What an older worker (v0.9.16) did with a refund or dispute event:
 *  recorded it, applied nothing. */
function recordedByOldWorker(
  h: Harness,
  event: { id: string; type: string },
): void {
  h.sqlite
    .prepare('INSERT INTO billingEvents (id, createdAt, type) VALUES (?, ?, ?)')
    .run(event.id, new Date().toISOString(), event.type)
}

describe('what one run asks of D1', () => {
  it('asks once about a page of recorded purchases and refunds, and applies none of them', async () => {
    const singer = await register(h, 'all-recorded@example.com')
    for (let n = 0; n < 30; n += 1) {
      const purchase = h.stripe.checkout(singer.userId)
      await deliver(h, purchase)
      await deliver(
        h,
        h.stripe.refund(String(purchase.data.object.payment_intent), 250),
      )
    }
    const counted = countingD1(h)
    h.env.DB = counted.db

    await sweep(h)

    expect(counted.queries()).toBe(1)
  })

  it('applies SWEEP_MONEY_BACK_PER_RUN refunds in a run, within D1 1,000 queries, and the rest in the next', async () => {
    const singer = await register(h, 'many-refunds@example.com')
    const refunds = []
    for (let n = 0; n < SWEEP_MONEY_BACK_PER_RUN + 2; n += 1) {
      const purchase = h.stripe.checkout(singer.userId)
      await deliver(h, purchase)
      refunds.push(
        h.stripe.refund(String(purchase.data.object.payment_intent), 500),
      )
    }
    const counted = countingD1(h)
    h.env.DB = counted.db

    await sweep(h)
    const firstRun = {
      queries: counted.queries(),
      recorded: refunds.filter((refund) => recorded(h, refund.id)).length,
      balance: balance(h, singer.userId),
    }
    await sweep(h)

    expect(firstRun.recorded).toBe(SWEEP_MONEY_BACK_PER_RUN)
    expect(firstRun.balance).toBe(2 * 30)
    expect(firstRun.queries).toBeLessThan(1000)
    expect(refunds.every((refund) => recorded(h, refund.id))).toBe(true)
    expect(balance(h, singer.userId)).toBe(0)
  })
})

describe('events an older worker recorded without applying them', () => {
  it('applies them on the first sweep after the migration reopens them', async () => {
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
    expect(recordedType(h, refund.id)).toBe('charge.refunded')
  })

  it('sums them up in one alert that blames no webhook, with the alert each would have sent', async () => {
    const singer = await register(h, 'reopened-summary@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )
    recordedByOldWorker(h, refund)
    // A purchase from before PaymentIntent ids were stored (migration 0058).
    const old = h.stripe.checkout(singer.userId)
    await deliver(h, old)
    h.sqlite
      .prepare(
        'UPDATE creditLedger SET paymentIntentId = NULL WHERE paymentIntentId = ?',
      )
      .run(String(old.data.object.payment_intent))
    const oldRefund = h.stripe.refund(
      String(old.data.object.payment_intent),
      500,
    )
    recordedByOldWorker(h, oldRefund)
    applyMigration(h.sqlite, '0065_reapply_money_back_events.sql')
    const alertsBefore = alerts(h).length

    await sweep(h)

    const sent = alerts(h).slice(alertsBefore)
    expect(sent.map((alert) => alert.subject)).toEqual([
      '[MercuryPitch billing] Reapplied 2 event(s) after migration 0065',
    ])
    expect(sent[0].text).toContain(
      `${refund.id} (charge.refunded): Refund: took back 30 credit(s)`,
    )
    expect(sent[0].text).toContain(
      `${oldRefund.id} (charge.refunded): Refund with no credits on record`,
    )
    expect(sent[0].text).toContain(`  Account: ${singer.userId}`)
    expect(sent[0].text).not.toContain('webhook delivery is failing')
    expect(balance(h, singer.userId)).toBe(30)
    expect(recorded(h, refund.id)).toBe(true)
    expect(recorded(h, oldRefund.id)).toBe(true)
  })

  it('reports an event the webhook missed beside them as missed, with its own alert', async () => {
    const singer = await register(h, 'reopened-and-missed@example.com')
    const first = h.stripe.checkout(singer.userId)
    await deliver(h, first)
    const reopened = h.stripe.refund(
      String(first.data.object.payment_intent),
      500,
    )
    recordedByOldWorker(h, reopened)
    const second = h.stripe.checkout(singer.userId)
    await deliver(h, second)
    const missed = h.stripe.refund(
      String(second.data.object.payment_intent),
      500,
    )
    applyMigration(h.sqlite, '0065_reapply_money_back_events.sql')
    const alertsBefore = alerts(h).length

    await sweep(h)

    const subjects = alerts(h)
      .slice(alertsBefore)
      .map((alert) => alert.subject)
    expect(subjects).toEqual([
      '[MercuryPitch billing] Refund: took back 30 credit(s)',
      '[MercuryPitch billing] Sweep recovered 1 missed event(s)',
      '[MercuryPitch billing] Reapplied 1 event(s) after migration 0065',
    ])
    const recovered = alerts(h).find((alert) =>
      alert.subject.includes('Sweep recovered'),
    )
    expect(recovered?.text).toContain(`${missed.id} (charge.refunded)`)
    expect(recovered?.text).not.toContain(reopened.id)
    expect(balance(h, singer.userId)).toBe(0)
  })

  it('still alerts a reopened event that fails, and applies it on the next run', async () => {
    const singer = await register(h, 'reopened-fails@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)
    const refund = h.stripe.refund(
      String(purchase.data.object.payment_intent),
      500,
    )
    recordedByOldWorker(h, refund)
    applyMigration(h.sqlite, '0065_reapply_money_back_events.sql')
    const alertsBefore = alerts(h).length
    const healthy = h.env.DB
    h.env.DB = failingD1(h, /INSERT OR IGNORE INTO creditLedger/)

    await sweep(h)
    const afterFailure = {
      subjects: alerts(h)
        .slice(alertsBefore)
        .map((alert) => alert.subject),
      balance: balance(h, singer.userId),
      recorded: recorded(h, refund.id),
    }
    h.env.DB = healthy
    await sweep(h)

    expect(afterFailure).toEqual({
      subjects: ['[MercuryPitch billing] Sweep could not apply 1 event(s)'],
      balance: 30,
      recorded: false,
    })
    expect(alerts(h).at(-1)?.subject).toBe(
      '[MercuryPitch billing] Reapplied 1 event(s) after migration 0065',
    )
    expect(balance(h, singer.userId)).toBe(0)
    expect(recorded(h, refund.id)).toBe(true)
  })

  it('leaves checkout events recorded', async () => {
    const singer = await register(h, 'checkout-kept@example.com')
    const purchase = h.stripe.checkout(singer.userId)
    await deliver(h, purchase)

    applyMigration(h.sqlite, '0065_reapply_money_back_events.sql')

    expect(recordedType(h, purchase.id)).toBe('checkout.session.completed')
  })
})
