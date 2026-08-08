// ============================================================
// Billing endpoints — the money paths, end to end through handleBilling
// ============================================================
//
// `billing-core.ts` is unit-tested for its arithmetic; this covers the layer
// where a mistake costs somebody real money: the webhook that grants credits,
// the debit that spends them, and the refund that gives them back.
//
// The ledger fake is append-only with a real UNIQUE(idempotencyKey), and the
// conditional debit INSERT evaluates its balance guard against the rows the
// fake actually holds. That matters: every idempotency and overdraw guarantee
// in this file is a property of that constraint, so stubbing it out would
// leave the tests asserting nothing.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from './auth'
import { handleBilling } from './billing'

const JWT_SECRET = 'test-jwt-secret'
const WEBHOOK_SECRET = 'whsec_test_secret'
const SERVICE_KEY = 'test-service-key'
const ALICE = 'user-alice'
const JOB_REF = 'rp_gpu_abc123'

// ── D1 fake ──────────────────────────────────────────────────────────

interface LedgerRow {
  id: string
  userId: string
  delta: number
  reason: string
  jobRef: string | null
  idempotencyKey: string | null
}

class FakeDb {
  /** Append-only, exactly like the real table. */
  readonly ledger: LedgerRow[] = []
  readonly billingEvents = new Set<string>()
  readonly users = new Map<string, { tokenVersion: number }>()
  /** planId → credits, or null for "not priced yet". */
  readonly plans = new Map<string, number | null>()
  /** Forced 429 for a named bucket, to exercise the admission gate. */
  rateLimited: string | null = null

  balance(userId: string): number {
    return this.ledger
      .filter((r) => r.userId === userId)
      .reduce((sum, r) => sum + r.delta, 0)
  }

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql.replace(/\s+/g, ' ').trim())
  }
}

class FakeStatement {
  private values: unknown[] = []

  constructor(
    private readonly db: FakeDb,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]): FakeStatement {
    this.values = values
    return this
  }

  async first<T>(): Promise<T | null> {
    const { sql, values, db } = this

    if (sql.startsWith('INSERT INTO auth_ratelimit')) {
      const bucket = String(values[1])
      return (
        db.rateLimited === bucket
          ? { count: 9_999, windowStart: 0 }
          : { count: 1, windowStart: 0 }
      ) as T
    }
    if (sql.startsWith('SELECT tokenVersion, lastActiveAt, suspendedAt')) {
      const user = db.users.get(String(values[0]))
      return user === undefined
        ? null
        : ({
            tokenVersion: user.tokenVersion,
            lastActiveAt: new Date().toISOString(),
            suspendedAt: null,
          } as T)
    }
    if (sql.startsWith('SELECT credits FROM pricingPlans')) {
      const credits = db.plans.get(String(values[0]))
      return credits === undefined ? null : ({ credits } as T)
    }
    if (sql === 'SELECT delta FROM creditLedger WHERE idempotencyKey = ?') {
      const row = db.ledger.find((r) => r.idempotencyKey === values[0])
      return row === undefined ? null : ({ delta: row.delta } as T)
    }
    if (
      sql === 'SELECT userId, delta FROM creditLedger WHERE idempotencyKey = ?'
    ) {
      const row = db.ledger.find((r) => r.idempotencyKey === values[0])
      return row === undefined
        ? null
        : ({ userId: row.userId, delta: row.delta } as T)
    }
    if (sql === 'SELECT id FROM billingEvents WHERE id = ?') {
      return db.billingEvents.has(String(values[0]))
        ? ({ id: values[0] } as T)
        : null
    }
    throw new Error(`Unexpected first() SQL: ${sql}`)
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql === 'SELECT delta FROM creditLedger WHERE userId = ?') {
      const userId = String(this.values[0])
      return {
        results: this.db.ledger
          .filter((r) => r.userId === userId)
          .map((r) => ({ delta: r.delta })) as T[],
      }
    }
    throw new Error(`Unexpected all() SQL: ${this.sql}`)
  }

  async run(): Promise<{ meta: { changes: number } }> {
    const { sql, values, db } = this

    // The debit: INSERT ... SELECT ... WHERE balance >= cost. Both the UNIQUE
    // key and the balance guard have to be honoured here or the test proves
    // nothing about either.
    if (
      sql.startsWith('INSERT OR IGNORE INTO creditLedger') &&
      sql.includes("SELECT ?, ?, ?, ?, 'uvr-job', ?, ?")
    ) {
      const [id, , userId, delta, jobRef, key, guardUserId, required] = values
      if (db.ledger.some((r) => r.idempotencyKey === key)) {
        return { meta: { changes: 0 } }
      }
      if (db.balance(String(guardUserId)) < Number(required)) {
        return { meta: { changes: 0 } }
      }
      db.ledger.push({
        id: String(id),
        userId: String(userId),
        delta: Number(delta),
        reason: 'uvr-job',
        jobRef: String(jobRef),
        idempotencyKey: String(key),
      })
      return { meta: { changes: 1 } }
    }

    if (
      sql.startsWith('INSERT OR IGNORE INTO creditLedger') &&
      sql.includes("'uvr-refund'")
    ) {
      const [id, , userId, delta, jobRef, key] = values
      if (db.ledger.some((r) => r.idempotencyKey === key)) {
        return { meta: { changes: 0 } }
      }
      db.ledger.push({
        id: String(id),
        userId: String(userId),
        delta: Number(delta),
        reason: 'uvr-refund',
        jobRef: String(jobRef),
        idempotencyKey: String(key),
      })
      return { meta: { changes: 1 } }
    }

    if (sql.startsWith('INSERT OR IGNORE INTO billingEvents')) {
      const id = String(values[0])
      const fresh = !db.billingEvents.has(id)
      db.billingEvents.add(id)
      return { meta: { changes: fresh ? 1 : 0 } }
    }

    if (sql.startsWith('UPDATE users SET lastActiveAt')) {
      return { meta: { changes: 1 } }
    }

    throw new Error(`Unexpected run() SQL: ${sql}`)
  }
}

// ── Harness ──────────────────────────────────────────────────────────

function respond(body: object | null, init?: ResponseInit): Response {
  return new Response(body == null ? null : JSON.stringify(body), {
    ...init,
    headers:
      body == null
        ? init?.headers
        : { ...init?.headers, 'Content-Type': 'application/json' },
  })
}

function makeEnv(db: FakeDb, overrides: Partial<Env> = {}): Env {
  return {
    DB: db as unknown as D1Database,
    JWT_SECRET,
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    BILLING_SERVICE_KEY: SERVICE_KEY,
    ...overrides,
  } as Env
}

const encoder = new TextEncoder()

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function hmac(secret: string, data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', key, encoder.encode(data))
}

/** A token the worker's own `verifyJwt` accepts — same alg, same claims. */
async function bearer(userId: string, version = 1): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(
    encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  )
  const body = b64url(
    encoder.encode(
      JSON.stringify({
        sub: userId,
        provider: 'password',
        iat: now,
        exp: now + 3600,
        v: version,
      }),
    ),
  )
  const sig = b64url(await hmac(JWT_SECRET, `${header}.${body}`))
  return `Bearer ${header}.${body}.${sig}`
}

/** A `Stripe-Signature` header the worker will accept for this payload. */
async function stripeSignature(payload: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const digest = await hmac(WEBHOOK_SECRET, `${timestamp}.${payload}`)
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `t=${timestamp},v1=${hex}`
}

async function post(
  route: string,
  env: Env,
  init: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const raw =
    typeof init.body === 'string' ? init.body : JSON.stringify(init.body ?? {})
  const response = await handleBilling(
    new Request(`https://api.test/api/billing/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      body: raw,
    }),
    env,
    `/api/billing/${route}`,
    respond,
  )
  if (response == null) throw new Error(`Route not handled: ${route}`)
  const text = await response.text()
  return {
    status: response.status,
    body: text === '' ? {} : (JSON.parse(text) as Record<string, unknown>),
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('billing endpoints', () => {
  let db: FakeDb
  let env: Env
  let auth: string

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    db = new FakeDb()
    db.users.set(ALICE, { tokenVersion: 1 })
    db.plans.set('tier-runpod-gpu', 1)
    env = makeEnv(db)
    auth = await bearer(ALICE)
  })

  /** Put credits on the books the way a purchase would. */
  function grant(userId: string, amount: number, key: string): void {
    db.ledger.push({
      id: `seed-${key}`,
      userId,
      delta: amount,
      reason: 'purchase',
      jobRef: null,
      idempotencyKey: key,
    })
  }

  describe('debit — the UVR separation charge', () => {
    it('charges once and leaves the balance short by the cost', async () => {
      grant(ALICE, 5, 'seed')

      const res = await post('debit', env, {
        headers: { Authorization: auth },
        body: { tier: 'gpu', jobRef: JOB_REF },
      })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ debited: 1, cost: 1 })
      expect(db.balance(ALICE)).toBe(4)
    })

    // The retry path is the whole reason the idempotency key exists: the main
    // worker calls debit after RunPod accepts, and a lost response there must
    // not be able to charge the same separation twice.
    it('a retried jobRef is a duplicate, never a second charge', async () => {
      grant(ALICE, 5, 'seed')
      const body = { tier: 'gpu', jobRef: JOB_REF }

      await post('debit', env, { headers: { Authorization: auth }, body })
      const retry = await post('debit', env, {
        headers: { Authorization: auth },
        body,
      })

      expect(retry.status).toBe(200)
      expect(retry.body).toMatchObject({ duplicate: true, debited: 1 })
      expect(db.balance(ALICE)).toBe(4)
      expect(db.ledger.filter((r) => r.reason === 'uvr-job')).toHaveLength(1)
    })

    it('refuses with 402 when the balance will not cover the job', async () => {
      const res = await post('debit', env, {
        headers: { Authorization: auth },
        body: { tier: 'gpu', jobRef: JOB_REF },
      })

      expect(res.status).toBe(402)
      expect(res.body).toMatchObject({ required: 1, balance: 0 })
      expect(db.ledger).toHaveLength(0)
    })

    // The guard lives inside the INSERT for exactly this: two jobs starting at
    // once must not both read "1 credit" and both spend it.
    it('two concurrent jobs cannot overdraw a one-credit balance', async () => {
      grant(ALICE, 1, 'seed')

      const [a, b] = await Promise.all([
        post('debit', env, {
          headers: { Authorization: auth },
          body: { tier: 'gpu', jobRef: 'rp_gpu_one' },
        }),
        post('debit', env, {
          headers: { Authorization: auth },
          body: { tier: 'gpu', jobRef: 'rp_gpu_two' },
        }),
      ])

      expect([a.status, b.status].sort()).toEqual([200, 402])
      expect(db.balance(ALICE)).toBe(0)
    })

    it('does not charge for a tier with no price set', async () => {
      db.plans.set('tier-runpod-gpu', null)
      grant(ALICE, 5, 'seed')

      const res = await post('debit', env, {
        headers: { Authorization: auth },
        body: { tier: 'gpu', jobRef: JOB_REF },
      })

      expect(res.body).toMatchObject({ debited: 0, cost: 0 })
      expect(db.balance(ALICE)).toBe(5)
    })

    it('rejects an unauthenticated caller before touching the ledger', async () => {
      const res = await post('debit', env, {
        body: { tier: 'gpu', jobRef: JOB_REF },
      })

      expect(res.status).toBe(401)
      expect(db.ledger).toHaveLength(0)
    })

    it.each([
      ['an unknown tier', { tier: 'tpu', jobRef: JOB_REF }],
      ['a missing jobRef', { tier: 'gpu' }],
      ['a jobRef with path characters', { tier: 'gpu', jobRef: '../etc' }],
      [
        'a model name with punctuation',
        { tier: 'gpu', jobRef: JOB_REF, model: 'a b/c' },
      ],
      [
        'a negative duration',
        { tier: 'gpu', jobRef: JOB_REF, durationSeconds: -1 },
      ],
      [
        'a day-long duration',
        { tier: 'gpu', jobRef: JOB_REF, durationSeconds: 90_000 },
      ],
    ])('rejects %s with 400', async (_label, body) => {
      grant(ALICE, 5, 'seed')
      const res = await post('debit', env, {
        headers: { Authorization: auth },
        body,
      })

      expect(res.status).toBe(400)
      expect(db.ledger.filter((r) => r.reason === 'uvr-job')).toHaveLength(0)
    })
  })

  describe('refund — undoing a failed separation', () => {
    async function debitFirst(): Promise<void> {
      grant(ALICE, 5, 'seed')
      await post('debit', env, {
        headers: { Authorization: auth },
        body: { tier: 'gpu', jobRef: JOB_REF },
      })
    }

    it('returns the credit to the user the debit named', async () => {
      await debitFirst()

      const res = await post('refund', env, {
        headers: { 'X-Service-Key': SERVICE_KEY },
        body: { jobRef: JOB_REF },
      })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ refunded: 1 })
      expect(db.balance(ALICE)).toBe(5)
    })

    it('refunds at most once, however often it is called', async () => {
      await debitFirst()
      const body = { jobRef: JOB_REF }
      const headers = { 'X-Service-Key': SERVICE_KEY }

      await post('refund', env, { headers, body })
      const again = await post('refund', env, { headers, body })

      expect(again.body).toMatchObject({ duplicate: true })
      expect(db.balance(ALICE)).toBe(5)
      expect(db.ledger.filter((r) => r.reason === 'uvr-refund')).toHaveLength(1)
    })

    // A user token must not reach this endpoint: it credits an account, and
    // the caller does not have to be the account it credits.
    it('rejects a user bearer token — the service key is the only key', async () => {
      await debitFirst()

      const res = await post('refund', env, {
        headers: { Authorization: auth },
        body: { jobRef: JOB_REF },
      })

      expect(res.status).toBe(401)
      expect(db.balance(ALICE)).toBe(4)
    })

    it('rejects a wrong service key', async () => {
      await debitFirst()

      const res = await post('refund', env, {
        headers: { 'X-Service-Key': `${SERVICE_KEY}x` },
        body: { jobRef: JOB_REF },
      })

      expect(res.status).toBe(401)
      expect(db.balance(ALICE)).toBe(4)
    })

    it('is a no-op for a job that was never charged', async () => {
      const res = await post('refund', env, {
        headers: { 'X-Service-Key': SERVICE_KEY },
        body: { jobRef: 'rp_gpu_neverran' },
      })

      expect(res.body).toEqual({ refunded: 0 })
      expect(db.ledger).toHaveLength(0)
    })

    it('is unavailable rather than open when no service key is configured', async () => {
      const open = makeEnv(db, { BILLING_SERVICE_KEY: undefined })

      const res = await post('refund', open, { body: { jobRef: JOB_REF } })

      expect(res.status).toBe(503)
    })
  })

  describe('webhook — the only writer of purchased credits', () => {
    const event = {
      id: 'evt_test_1',
      type: 'payment_intent.succeeded',
      data: { object: {} },
    }

    it('rejects a payload whose signature does not match', async () => {
      const payload = JSON.stringify(event)

      const res = await post('webhook', env, {
        body: payload,
        headers: { 'Stripe-Signature': 't=1,v1=deadbeef' },
      })

      expect(res.status).toBe(400)
      expect(db.billingEvents.size).toBe(0)
    })

    it('rejects a payload with no signature at all', async () => {
      const res = await post('webhook', env, { body: JSON.stringify(event) })

      expect(res.status).toBe(400)
      expect(db.billingEvents.size).toBe(0)
    })

    // Tampering is the case a length-only or prefix-only check would miss: the
    // signature is valid, for a different body.
    it('rejects a body edited after it was signed', async () => {
      const signed = JSON.stringify(event)
      const tampered = JSON.stringify({ ...event, id: 'evt_test_2' })

      const res = await post('webhook', env, {
        body: tampered,
        headers: { 'Stripe-Signature': await stripeSignature(signed) },
      })

      expect(res.status).toBe(400)
      expect(db.billingEvents.size).toBe(0)
    })

    it('accepts a correctly signed event and records it once', async () => {
      const payload = JSON.stringify(event)
      const headers = { 'Stripe-Signature': await stripeSignature(payload) }

      const first = await post('webhook', env, { body: payload, headers })
      const redelivery = await post('webhook', env, { body: payload, headers })

      expect(first.status).toBe(200)
      expect(first.body).toEqual({ received: true })
      expect(redelivery.body).toMatchObject({ duplicate: true })
      expect(db.billingEvents.size).toBe(1)
    })

    it('is unavailable rather than open when no webhook secret is set', async () => {
      const open = makeEnv(db, { STRIPE_WEBHOOK_SECRET: undefined })

      const res = await post('webhook', open, { body: JSON.stringify(event) })

      expect(res.status).toBe(503)
      expect(db.billingEvents.size).toBe(0)
    })
  })

  describe('uvr-admit — the pre-dispatch gate', () => {
    it('admits a user who can pay, quoting the cost', async () => {
      grant(ALICE, 5, 'seed')

      const res = await post('uvr-admit', env, {
        headers: { Authorization: auth },
        body: { tier: 'gpu' },
      })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ allowed: true, cost: 1, balance: 5 })
    })

    it('turns an empty balance away with 402 before any RunPod spend', async () => {
      const res = await post('uvr-admit', env, {
        headers: { Authorization: auth },
        body: { tier: 'gpu' },
      })

      expect(res.status).toBe(402)
      expect(res.body).toMatchObject({ required: 1, balance: 0 })
    })

    // Fail closed: an unpriced tier here means metering is not working, and
    // the answer to that is no free GPU jobs, not free GPU jobs.
    it('refuses rather than admitting free when the tier has no price', async () => {
      db.plans.set('tier-runpod-gpu', null)
      grant(ALICE, 5, 'seed')

      const res = await post('uvr-admit', env, {
        headers: { Authorization: auth },
        body: { tier: 'gpu' },
      })

      expect(res.status).toBe(503)
    })

    it('rate-limits per user with a Retry-After', async () => {
      grant(ALICE, 5, 'seed')
      db.rateLimited = 'uvr-process-burst'

      const response = await handleBilling(
        new Request('https://api.test/api/billing/uvr-admit', {
          method: 'POST',
          headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: 'gpu' }),
        }),
        env,
        '/api/billing/uvr-admit',
        respond,
      )

      expect(response?.status).toBe(429)
      expect(response?.headers.get('Retry-After')).not.toBeNull()
    })

    it('rejects an unauthenticated caller', async () => {
      const res = await post('uvr-admit', env, { body: { tier: 'gpu' } })

      expect(res.status).toBe(401)
    })
  })

  // Both routes create a session object on Stripe's side, so an unbounded
  // loop is their bill and their dashboard, not only our load.
  describe('Stripe session creation is capped', () => {
    it('429s a checkout flood before calling Stripe', async () => {
      const stripeEnv = makeEnv(db, { STRIPE_SECRET_KEY: 'sk_test_never_used' })
      db.rateLimited = 'billing-checkout'

      const response = await handleBilling(
        new Request('https://api.test/api/billing/checkout', {
          method: 'POST',
          headers: { Authorization: auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: 'tier-runpod-gpu' }),
        }),
        stripeEnv,
        '/api/billing/checkout',
        respond,
      )

      expect(response?.status).toBe(429)
      expect(response?.headers.get('Retry-After')).not.toBeNull()
    })

    it('429s a portal flood, sharing the checkout budget', async () => {
      const stripeEnv = makeEnv(db, { STRIPE_SECRET_KEY: 'sk_test_never_used' })
      db.rateLimited = 'billing-checkout'

      const response = await handleBilling(
        new Request('https://api.test/api/billing/portal', {
          method: 'GET',
          headers: { Authorization: auth },
        }),
        stripeEnv,
        '/api/billing/portal',
        respond,
      )

      expect(response?.status).toBe(429)
    })

    it('lets a normal checkout past the gate to the plan lookup', async () => {
      const stripeEnv = makeEnv(db, { STRIPE_SECRET_KEY: 'sk_test_never_used' })

      // Under the limit, control reaches the pricing query — which this fake
      // deliberately does not answer. Reaching it at all is the assertion:
      // the gate let a first-time buyer through.
      await expect(
        handleBilling(
          new Request('https://api.test/api/billing/checkout', {
            method: 'POST',
            headers: {
              Authorization: auth,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ planId: 'tier-runpod-gpu' }),
          }),
          stripeEnv,
          '/api/billing/checkout',
          respond,
        ),
      ).rejects.toThrow(/pricingPlans/)
    })
  })
})
