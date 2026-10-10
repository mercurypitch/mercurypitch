// @vitest-environment node
//
// ── Only paid money grants ─────────────────────────────────────────────
//
// The Stripe webhook grants a pack when its Checkout Session is paid: at
// checkout.session.completed for a card, at
// checkout.session.async_payment_succeeded for a delayed method, never for a
// session still waiting for its money. Each grant keeps its PaymentIntent,
// which is what a refund or a dispute takes it back by: those, and the sweep
// that applies the refunds and disputes the webhook missed, have their own
// suites on a fake Stripe (stripe-money-back-integration.test.ts,
// stripe-sweep-integration.test.ts). The reconciliation sweep recovers both
// checkout events the webhook missed.
//
// Real SQLite with every migration applied, through the worker's own fetch.
// Stripe and Resend are stubbed at fetch: nothing leaves the process, and the
// stub records what would have been sent.

import { createHmac } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import { reconcileBilling } from '../src/billing'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const WEBHOOK_SECRET = 'whsec_stripe_payments_integration'
const PASSWORD = 'Singer123!pass'

let sqlite: DatabaseSync
let perksSqlite: DatabaseSync
let env: Env

interface Sent {
  url: string
  body: string
}
/** Every request the worker made to the outside world, which got a stub. */
let sent: Sent[]
/** The pages GET /v1/events answers with, in order. */
let eventPages: Array<Record<string, unknown>>

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      sent.push({ url, body: typeof init?.body === 'string' ? init.body : '' })
      if (url.startsWith('https://api.stripe.com/v1/events')) {
        const page = eventPages.shift() ?? { data: [], has_more: false }
        return Response.json(page)
      }
      if (url === 'https://api.resend.com/emails') {
        return Response.json({ id: 'stubbed' })
      }
      throw new Error(`unexpected fetch in a test: ${url}`)
    }),
  )
}

/** Billing alerts the worker would have mailed: subject and text. */
function alerts(): Array<{ subject: string; text: string }> {
  return sent
    .filter((request) => request.url === 'https://api.resend.com/emails')
    .map(
      (request) =>
        JSON.parse(request.body) as { subject: string; text: string },
    )
    .filter((mail) => mail.subject.startsWith('[MercuryPitch billing]'))
}

async function register(email: string): Promise<string> {
  const response = await worker.fetch(
    new Request('https://api.test/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
    env,
    {} as ExecutionContext,
  )
  expect(response.status).toBe(200)
  return ((await response.json()) as { userId: string }).userId
}

interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

/** Deliver an event to the webhook, signed as Stripe signs it. */
async function deliver(
  event: StripeEvent,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = JSON.stringify(event)
  const timestamp = Math.floor(Date.now() / 1000)
  const digest = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  const response = await worker.fetch(
    new Request('https://api.test/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': `t=${timestamp},v1=${digest}`,
      },
      body: payload,
    }),
    env,
    {} as ExecutionContext,
  )
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  }
}

function checkout(
  id: string,
  userId: string,
  options: {
    type?: string
    paid?: boolean
    paymentIntent?: string
    credits?: number
  } = {},
): StripeEvent {
  return {
    id,
    type: options.type ?? 'checkout.session.completed',
    data: {
      object: {
        id: `cs_${id}`,
        object: 'checkout.session',
        mode: 'payment',
        payment_status: options.paid === false ? 'unpaid' : 'paid',
        payment_intent: options.paymentIntent ?? 'pi_starter',
        amount_total: 500,
        currency: 'eur',
        // The withdrawal checkbox every pack's checkout asks for
        // (checkout-consent.ts).
        consent: { terms_of_service: 'accepted' },
        metadata: {
          userId,
          planId: 'pack-starter',
          credits: String(options.credits ?? 30),
        },
      },
    },
  }
}

function balance(userId: string): number {
  const row = sqlite
    .prepare(
      'SELECT COALESCE(SUM(delta), 0) AS total FROM creditLedger WHERE userId = ?',
    )
    .get(userId) as { total: number }
  return row.total
}

interface Row {
  delta: number
  reason: string
  jobRef: string | null
  paymentIntentId: string | null
}

function rows(userId: string): Row[] {
  return sqlite
    .prepare(
      'SELECT delta, reason, jobRef, paymentIntentId FROM creditLedger WHERE userId = ? ORDER BY rowid',
    )
    .all(userId) as unknown as Row[]
}

function recorded(eventId: string): boolean {
  return (
    sqlite.prepare('SELECT id FROM billingEvents WHERE id = ?').get(eventId) !==
    undefined
  )
}

beforeEach(() => {
  sent = []
  eventPages = []
  stubFetch()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  perksSqlite = new DatabaseSync(':memory:')
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    PERKS_DB: new SqliteD1Database(perksSqlite) as unknown as D1Database,
    JWT_SECRET: 'stripe-payments-integration-jwt',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY: 'stripe-payments-integration-admin',
    STRIPE_SECRET_KEY: 'sk_test_stripe_payments_integration',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    // A key, so the alerts are written; the fetch stub is all they reach.
    RESEND_API_KEY: 're_test_stripe_payments_integration',
    BILLING_ALERT_EMAIL: 'billing-alerts@example.test',
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  sqlite.close()
  perksSqlite.close()
})

describe('a checkout grants once it is paid', () => {
  it('grants a paid session and keeps its PaymentIntent on the row', async () => {
    const userId = await register('card@example.com')

    const res = await deliver(checkout('evt_paid', userId))

    expect(res).toEqual({ status: 200, body: { received: true } })
    expect(balance(userId)).toBe(30)
    expect(rows(userId)).toEqual([
      {
        delta: 30,
        reason: 'purchase',
        jobRef: 'pack-starter',
        paymentIntentId: 'pi_starter',
      },
    ])
    expect(recorded('evt_paid')).toBe(true)
  })

  it('waits for the money of a delayed payment, then grants it once', async () => {
    const userId = await register('debit@example.com')

    await deliver(checkout('evt_waiting', userId, { paid: false }))
    expect(balance(userId)).toBe(0)
    expect(recorded('evt_waiting')).toBe(true)

    const arrived = checkout('evt_arrived', userId, {
      type: 'checkout.session.async_payment_succeeded',
    })
    await deliver(arrived)
    await deliver(arrived)
    await deliver(checkout('evt_waiting', userId, { paid: false }))

    expect(balance(userId)).toBe(30)
    expect(rows(userId)).toHaveLength(1)
  })

  it('grants nothing for a delayed payment that fails', async () => {
    const userId = await register('bounced@example.com')

    await deliver(checkout('evt_pending', userId, { paid: false }))
    await deliver(
      checkout('evt_failed', userId, {
        type: 'checkout.session.async_payment_failed',
        paid: false,
      }),
    )

    expect(balance(userId)).toBe(0)
    // Nothing handles the failure: it is acknowledged and never recorded.
    expect(recorded('evt_failed')).toBe(false)
  })
})

describe('the reconciliation sweep', () => {
  it('asks Stripe for both checkout events, and recovers a paid one only', async () => {
    const userId = await register('swept@example.com')
    eventPages = [
      {
        data: [
          checkout('evt_swept_waiting', userId, { paid: false }),
          checkout('evt_swept_paid', userId, {
            type: 'checkout.session.async_payment_succeeded',
          }),
        ],
        has_more: false,
      },
    ]

    await reconcileBilling(env)

    const list = new URL(
      sent.find((request) => request.url.includes('/v1/events'))?.url ?? '',
    )
    expect(list.searchParams.getAll('types[]')).toEqual(
      expect.arrayContaining([
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
      ]),
    )
    expect(list.searchParams.has('type')).toBe(false)
    expect(balance(userId)).toBe(30)
    expect(recorded('evt_swept_waiting')).toBe(true)
    expect(recorded('evt_swept_paid')).toBe(true)
    const [alert] = alerts()
    expect(alert?.subject).toBe(
      '[MercuryPitch billing] Sweep recovered 1 missed event(s)',
    )
    expect(alert?.text).toContain(
      `evt_swept_paid (checkout.session.async_payment_succeeded): +30 credits, user=${userId}`,
    )
    expect(alert?.text).not.toContain('evt_swept_waiting')
  })

  it('alerts nobody when all it found was a session waiting for its money', async () => {
    const userId = await register('patient@example.com')
    eventPages = [
      {
        data: [checkout('evt_only_waiting', userId, { paid: false })],
        has_more: false,
      },
    ]

    await reconcileBilling(env)

    expect(balance(userId)).toBe(0)
    expect(alerts()).toEqual([])
  })
})
