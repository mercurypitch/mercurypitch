// ── The worker on a fresh database, with a fake Stripe, for payment tests ──
//
// Real SQLite with every migration applied, driven through the worker's own
// fetch, as the other integration suites do. Every request the worker sends
// out is answered here: api.stripe.com by FakeStripe (stripe-fake.ts),
// Resend with a stub id, and anything else fails the test. Every console line
// is kept, so a test can read what an operator would see in the logs.

import { createHmac } from 'node:crypto'
import type { SQLInputValue } from 'node:sqlite'
import { DatabaseSync } from 'node:sqlite'
import { expect, vi } from 'vitest'
import type { Env } from '../src/auth'
import { reconcileBilling } from '../src/billing'
import worker from '../src/index'
import type { SqliteD1Statement } from './sqlite-d1'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'
import type { StripeEvent } from './stripe-fake'
import { FakeStripe } from './stripe-fake'

export const WEBHOOK_SECRET = 'whsec_stripe_payment_tests'
export const ALERT_ADDRESS = 'billing-alerts@example.test'
const PASSWORD = 'Singer123!pass'

export interface Harness {
  sqlite: DatabaseSync
  env: Env
  stripe: FakeStripe
  /** Every request the worker sent out of the process. */
  sent: Array<{ url: string; body: string }>
  /** Every line the worker logged, at any level. */
  logs: string[]
  close(): void
}

export interface Answer {
  status: number
  body: Record<string, unknown>
}

export interface Singer {
  userId: string
  token: string
}

function line(args: unknown[]): string {
  return args
    .map((arg) =>
      arg instanceof Error
        ? `${arg.name}: ${arg.message}`
        : typeof arg === 'string'
          ? arg
          : JSON.stringify(arg),
    )
    .join(' ')
}

/** A fresh database, a fake Stripe and the stubs, for one test. */
export function openHarness(): Harness {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  const perks = new DatabaseSync(':memory:')
  const stripe = new FakeStripe()
  const sent: Harness['sent'] = []
  const logs: string[] = []
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logs.push(line(args))
    })
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      sent.push({ url, body: typeof init?.body === 'string' ? init.body : '' })
      const fromStripe = stripe.answer(url)
      if (fromStripe !== null) return fromStripe
      if (url === 'https://api.resend.com/emails') {
        return Response.json({ id: 'stubbed' })
      }
      throw new Error(`unexpected fetch in a test: ${url}`)
    }),
  )
  const env: Env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    PERKS_DB: new SqliteD1Database(perks) as unknown as D1Database,
    JWT_SECRET: 'stripe-payment-tests-jwt',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY: 'stripe-payment-tests-admin',
    STRIPE_SECRET_KEY: 'sk_test_stripe_payment_tests',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    // A key, so the alerts are written; the fetch stub is all they reach.
    RESEND_API_KEY: 're_test_stripe_payment_tests',
    BILLING_ALERT_EMAIL: ALERT_ADDRESS,
  }
  const now = new Date().toISOString()
  // The GPU tier at one credit a song, as dev prices it, so a test can
  // spend through the real debit route.
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO pricingPlans
         (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active)
       VALUES ('tier-runpod-gpu', ?, ?, 'tier', 'Cloud GPU', '', 'song', NULL, 'eur', 1, NULL, NULL, 1, 1)`,
    )
    .run(now, now)
  return {
    sqlite,
    env,
    stripe,
    sent,
    logs,
    close() {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
      sqlite.close()
      perks.close()
    },
  }
}

async function readAnswer(response: Response): Promise<Answer> {
  const text = await response.text()
  return {
    status: response.status,
    body: text === '' ? {} : (JSON.parse(text) as Record<string, unknown>),
  }
}

/** A request to the worker, as the app or a service makes it. */
export async function call(
  h: Harness,
  path: string,
  init: { body?: unknown; token?: string; method?: string } = {},
): Promise<Answer> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (init.token !== undefined) headers.Authorization = `Bearer ${init.token}`
  const response = await worker.fetch(
    new Request(`https://api.test${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }),
    h.env,
    {} as ExecutionContext,
  )
  return readAnswer(response)
}

export async function register(h: Harness, email: string): Promise<Singer> {
  const res = await call(h, '/api/auth/register', {
    body: { email, password: PASSWORD },
  })
  expect(res.status).toBe(200)
  return res.body as unknown as Singer
}

/** The Stripe-Signature header Stripe would send for this body. */
export function signature(
  payload: string,
  options: { timestamp?: number; secret?: string } = {},
): string {
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000)
  const digest = createHmac('sha256', options.secret ?? WEBHOOK_SECRET)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  return `t=${timestamp},v1=${digest}`
}

/** POST a raw body to the webhook with the given signature header. */
export async function post(
  h: Harness,
  payload: string,
  header: string,
): Promise<Answer> {
  const response = await worker.fetch(
    new Request('https://api.test/api/billing/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': header,
      },
      body: payload,
    }),
    h.env,
    {} as ExecutionContext,
  )
  return readAnswer(response)
}

/** Deliver an event to the webhook, signed as Stripe signs it. */
export async function deliver(h: Harness, event: StripeEvent): Promise<Answer> {
  const payload = JSON.stringify(event)
  return post(h, payload, signature(payload))
}

/** Run the 6-hourly reconciliation sweep once. */
export async function sweep(h: Harness): Promise<void> {
  await reconcileBilling(h.env)
}

/** A separation paid with credits, through the real debit route. */
export async function spend(
  h: Harness,
  singer: Singer,
  jobRef: string,
): Promise<Answer> {
  return call(h, '/api/billing/debit', {
    token: singer.token,
    body: { tier: 'gpu', jobRef },
  })
}

export function balance(h: Harness, userId: string): number {
  const row = h.sqlite
    .prepare(
      'SELECT COALESCE(SUM(delta), 0) AS total FROM creditLedger WHERE userId = ?',
    )
    .get(userId) as { total: number }
  return row.total
}

export interface Row {
  delta: number
  reason: string
  jobRef: string | null
  idempotencyKey: string
}

export function rows(h: Harness, userId: string): Row[] {
  return h.sqlite
    .prepare(
      'SELECT delta, reason, jobRef, idempotencyKey FROM creditLedger WHERE userId = ? ORDER BY rowid',
    )
    .all(userId) as unknown as Row[]
}

/** The rows money going back wrote: refunds and disputes. */
export function takeBacks(h: Harness, userId: string): Row[] {
  return rows(h, userId).filter(
    (row) =>
      row.reason === 'purchase-refund' || row.reason === 'purchase-dispute',
  )
}

export function recorded(h: Harness, eventId: string): boolean {
  return (
    h.sqlite
      .prepare('SELECT id FROM billingEvents WHERE id = ?')
      .get(eventId) !== undefined
  )
}

export function recordedCount(h: Harness): number {
  return (
    h.sqlite.prepare('SELECT COUNT(*) AS n FROM billingEvents').get() as {
      n: number
    }
  ).n
}

export interface Alert {
  subject: string
  text: string
  to: string[]
}

/** The billing alerts the worker would have mailed. */
export function alerts(h: Harness): Alert[] {
  return h.sent
    .filter((request) => request.url === 'https://api.resend.com/emails')
    .map((request) => JSON.parse(request.body) as Alert)
    .filter((mail) => mail.subject.startsWith('[MercuryPitch billing]'))
}

/** Stripe's reads of one kind: `/v1/charges/`, `/v1/refunds`,
 *  `/v1/disputes` or `/v1/events`. */
export function stripeReads(h: Harness, path: string): URL[] {
  return h.sent
    .map((request) => new URL(request.url))
    .filter(
      (url) => url.host === 'api.stripe.com' && url.pathname.startsWith(path),
    )
}

/**
 * D1 with an outage: the next `times` statements whose SQL matches
 * `pattern` throw, as D1 does when it is unavailable, and so does a batch
 * that holds one, as a whole. Everything else runs.
 */
export function failingD1(h: Harness, pattern: RegExp, times = 1): D1Database {
  const db = new SqliteD1Database(h.sqlite)
  let left = times
  const sqlOf = new WeakMap<object, string>()
  const statement = (
    sql: string,
    inner: SqliteD1Statement,
  ): SqliteD1Statement => {
    const proxy = new Proxy(inner, {
      get(target, property, receiver) {
        if (property === 'bind') {
          return (...values: SQLInputValue[]) =>
            statement(sql, target.bind(...values))
        }
        const value: unknown = Reflect.get(target, property, receiver)
        const query =
          property === 'first' || property === 'all' || property === 'run'
        if (query && left > 0 && pattern.test(sql)) {
          return async () => {
            left -= 1
            throw new Error('D1_ERROR: stubbed outage')
          }
        }
        return typeof value === 'function'
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value
      },
    })
    sqlOf.set(proxy, sql)
    return proxy
  }
  return {
    prepare: (sql: string) => statement(sql, db.prepare(sql)),
    batch: async (statements: SqliteD1Statement[]) => {
      const hit = statements.some((entry) =>
        pattern.test(sqlOf.get(entry) ?? ''),
      )
      if (hit && left > 0) {
        left -= 1
        throw new Error('D1_ERROR: stubbed outage')
      }
      return db.batch(statements)
    },
  } as unknown as D1Database
}
