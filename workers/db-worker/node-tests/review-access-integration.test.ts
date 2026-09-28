// @vitest-environment node
//
// ── Play review access: a few songs for the store's reviewer ──
//
// Google Play's reviewers cannot buy, so Play Console's "App access" field
// carries a code, the Android app takes it, and the server grants a small,
// bounded number of songs for it: once per account, from the Android app
// only, rate-limited, and never more accounts than the deployment allows.
// The songs are the app's to spend, like the subscription's, and the
// rollover cap never counts them.
//
// The code here is a test fixture. The real one is issued by
// packages/purchase-kit/scripts/make-review-code.ts and never committed; the
// digest below is computed exactly as that script computes it, so a code it
// issues is a code this route takes.

import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reviewUnlockDigestInput } from '../../../packages/purchase-kit/src/review-unlock'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const WEBHOOK_AUTH = 'Bearer review-access-webhook-secret'
const SERVICE_KEY = 'review-access-service-key'
const IOS = 'capacitor://localhost'
const ANDROID = 'https://localhost'
const WEB = 'http://localhost'
const TEST_CODE = 'REVIEW-TEST-CODE'
const DIGEST = createHash('sha256')
  .update(reviewUnlockDigestInput('mercurypitch', TEST_CODE))
  .digest('hex')

let sqlite: DatabaseSync
let env: Env
let events = 0
let devices = 0

interface Call {
  token?: string
  origin?: string
  ip?: string
  body?: unknown
  headers?: Record<string, string>
}

function call(path: string, init: Call = {}): Promise<Response> {
  const headers: Record<string, string> = { ...init.headers }
  if (init.token !== undefined) headers.Authorization = `Bearer ${init.token}`
  if (init.origin !== undefined) headers.Origin = init.origin
  if (init.ip !== undefined) headers['CF-Connecting-IP'] = init.ip
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  return worker.fetch(
    new Request(`https://api.test${path}`, {
      method: init.body === undefined ? 'GET' : 'POST',
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    }),
    env,
    {} as ExecutionContext,
  )
}

interface Phone {
  userId: string
  token: string
}

/** A phone's anonymous identity, as the app has on first launch. */
async function phone(): Promise<Phone> {
  devices += 1
  const suffix = String(devices).padStart(4, '0')
  const userId = `00000000-0000-4000-8000-00000000${suffix}`
  const response = await call('/api/auth/anonymous', {
    body: {
      deviceId: userId,
      deviceSecret: `rv${suffix}Aa2Bb3Cc4Dd5Ee6Ff7Gg8Hh9Ii0Jj1Kk2Ll3M`,
    },
  })
  expect(response.status).toBe(200)
  const { token } = (await response.json()) as { token: string }
  return { userId, token }
}

function redeem(
  who: Phone,
  code: unknown,
  options: { origin?: string | null; ip?: string } = {},
): Promise<Response> {
  const origin = options.origin === undefined ? ANDROID : options.origin
  return call('/api/billing/review-access', {
    token: who.token,
    body: { code },
    ...(origin === null ? {} : { origin }),
    ...(options.ip === undefined ? {} : { ip: options.ip }),
  })
}

function reviewRows(): Array<{ userId: string; delta: number }> {
  return (
    sqlite
      .prepare(
        "SELECT userId, delta FROM creditLedger WHERE reason = 'review-access' ORDER BY rowid",
      )
      .all() as Array<{ userId: string; delta: number }>
  ).map((row) => ({ userId: row.userId, delta: Number(row.delta) }))
}

async function appSongsLeft(who: Phone): Promise<unknown> {
  const response = await call('/api/billing/me', {
    token: who.token,
    origin: ANDROID,
  })
  expect(response.status).toBe(200)
  return ((await response.json()) as { songs: { left: unknown } }).songs.left
}

/** The GPU tier at one credit a song, as dev prices it. */
function priceTheGpu(): void {
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO pricingPlans
         (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active)
       VALUES ('tier-runpod-gpu', ?, ?, 'tier', 'Server (GPU)', '', 'song', NULL, 'eur', 1, NULL, NULL, 2, 1)`,
    )
    .run(now, now)
}

function debit(who: Phone, jobRef: string): Promise<Response> {
  return call('/api/billing/debit', {
    token: who.token,
    origin: ANDROID,
    body: { tier: 'gpu', model: 'roformer', jobRef },
  })
}

async function refund(jobRef: string): Promise<void> {
  const response = await call('/api/billing/refund', {
    body: { jobRef },
    headers: { 'X-Service-Key': SERVICE_KEY },
  })
  expect(response.status).toBe(200)
}

/** A subscription period for `who`, as RevenueCat's webhook sends it. */
async function subscribe(who: Phone): Promise<void> {
  events += 1
  const response = await call('/api/billing/revenuecat', {
    headers: { Authorization: WEBHOOK_AUTH },
    body: {
      api_version: '1.0',
      event: {
        id: `review-access-event-${events}`,
        type: 'INITIAL_PURCHASE',
        app_user_id: who.userId,
        original_app_user_id: who.userId,
        aliases: [who.userId],
        product_id: 'cloud:monthly',
        entitlement_ids: ['cloud'],
        transaction_id: `txn-${events}`,
        expiration_at_ms: Date.now() + 30 * 86_400_000,
        environment: 'SANDBOX',
        store: 'PLAY_STORE',
      },
    },
  })
  expect(response.status).toBe(200)
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'review-access-integration-jwt',
    ALLOWED_ORIGINS: `${WEB},${IOS},${ANDROID}`,
    REVENUECAT_WEBHOOK_AUTH: WEBHOOK_AUTH,
    REVENUECAT_ENVIRONMENT: 'SANDBOX',
    BILLING_SERVICE_KEY: SERVICE_KEY,
    REVIEW_ACCESS_CODE_SHA256: DIGEST,
  }
  events = 0
  devices = 0
  priceTheGpu()
})

afterEach(() => {
  vi.restoreAllMocks()
  sqlite.close()
})

describe('Play review access', () => {
  it('is off while the Worker has no digest to check against', async () => {
    env = { ...env, REVIEW_ACCESS_CODE_SHA256: undefined }
    const reviewer = await phone()

    const response = await redeem(reviewer, TEST_CODE)

    expect(response.status).toBe(501)
    expect(reviewRows()).toEqual([])
  })

  it('is for the Android app only', async () => {
    const reviewer = await phone()

    for (const origin of [IOS, WEB, null]) {
      const response = await redeem(reviewer, TEST_CODE, { origin })
      expect(response.status, String(origin)).toBe(403)
    }
    expect(reviewRows()).toEqual([])
  })

  it('refuses any other code, and grants nothing for it', async () => {
    const reviewer = await phone()

    for (const code of ['REVIEW-TEST-CODF', '', 42, null]) {
      const response = await redeem(reviewer, code)
      expect(response.status, String(code)).toBe(403)
    }
    expect(reviewRows()).toEqual([])
  })

  it('needs an identity', async () => {
    const response = await call('/api/billing/review-access', {
      origin: ANDROID,
      body: { code: TEST_CODE },
    })

    expect(response.status).toBe(401)
    expect(reviewRows()).toEqual([])
  })

  it('grants three songs once per account, and says so again after', async () => {
    const reviewer = await phone()

    const first = await redeem(reviewer, TEST_CODE)
    const again = await redeem(reviewer, TEST_CODE)

    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ granted: 3, left: 3 })
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ granted: 0, already: true, left: 3 })
    expect(reviewRows()).toEqual([{ userId: reviewer.userId, delta: 3 }])
    expect(await appSongsLeft(reviewer)).toBe(3)
  })

  it('takes the code as a person types it', async () => {
    const reviewer = await phone()

    const response = await redeem(reviewer, '  review test code ')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ granted: 3 })
  })

  it('grants a small number of songs whatever the setting says', async () => {
    env = { ...env, REVIEW_ACCESS_SONGS: '100' }
    const many = await phone()
    expect(await (await redeem(many, TEST_CODE)).json()).toMatchObject({
      granted: 5,
    })

    env = { ...env, REVIEW_ACCESS_SONGS: 'plenty' }
    const unreadable = await phone()
    expect(await (await redeem(unreadable, TEST_CODE)).json()).toMatchObject({
      granted: 3,
    })

    env = { ...env, REVIEW_ACCESS_SONGS: '1' }
    const one = await phone()
    expect(await (await redeem(one, TEST_CODE)).json()).toMatchObject({
      granted: 1,
    })
  })

  it('grants no more accounts than the deployment allows', async () => {
    env = { ...env, REVIEW_ACCESS_ACCOUNTS: '2' }
    const first = await phone()
    const second = await phone()
    const third = await phone()

    expect((await redeem(first, TEST_CODE)).status).toBe(200)
    expect((await redeem(second, TEST_CODE)).status).toBe(200)
    const late = await redeem(third, TEST_CODE)
    const repeat = await redeem(first, TEST_CODE)

    expect(late.status).toBe(409)
    expect(repeat.status).toBe(200)
    expect(await repeat.json()).toMatchObject({ granted: 0, already: true })
    expect(reviewRows().map((row) => row.userId)).toEqual([
      first.userId,
      second.userId,
    ])
  })

  it('limits the tries an account gets, the right code included', async () => {
    const reviewer = await phone()

    for (let tries = 0; tries < 5; tries += 1) {
      expect((await redeem(reviewer, 'REVIEW-WRONG-CODE')).status).toBe(403)
    }
    const response = await redeem(reviewer, TEST_CODE)

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).not.toBeNull()
    expect(reviewRows()).toEqual([])
  })

  it('limits the tries one address gets across accounts', async () => {
    const ip = '203.0.113.7'
    for (let account = 0; account < 5; account += 1) {
      const guesser = await phone()
      for (let tries = 0; tries < 4; tries += 1) {
        expect(
          (await redeem(guesser, 'REVIEW-WRONG-CODE', { ip })).status,
        ).toBe(403)
      }
    }
    const next = await phone()

    expect((await redeem(next, TEST_CODE, { ip })).status).toBe(429)
    expect((await redeem(next, TEST_CODE, { ip: '203.0.113.8' })).status).toBe(
      200,
    )
  })
})

describe('the songs review access grants', () => {
  it('are spent from the app, and come back when a separation fails', async () => {
    const reviewer = await phone()
    await redeem(reviewer, TEST_CODE)

    const debited = await debit(reviewer, 'rp_gpu_review-1')

    expect(debited.status).toBe(200)
    expect(await appSongsLeft(reviewer)).toBe(2)
    await refund('rp_gpu_review-1')
    expect(await appSongsLeft(reviewer)).toBe(3)
  })

  it('run out like any other songs', async () => {
    env = { ...env, REVIEW_ACCESS_SONGS: '1' }
    const reviewer = await phone()
    await redeem(reviewer, TEST_CODE)

    expect((await debit(reviewer, 'rp_gpu_review-a')).status).toBe(200)
    expect((await debit(reviewer, 'rp_gpu_review-b')).status).toBe(402)
    expect(await appSongsLeft(reviewer)).toBe(0)
  })

  it('never make a subscription period grant less', async () => {
    const reviewer = await phone()
    await redeem(reviewer, TEST_CODE)

    await subscribe(reviewer)

    expect(await appSongsLeft(reviewer)).toBe(23)
  })

  it('are no subscription', async () => {
    const reviewer = await phone()
    await redeem(reviewer, TEST_CODE)

    const response = await call('/api/billing/me', {
      token: reviewer.token,
      origin: ANDROID,
    })
    const body = (await response.json()) as {
      songs: { subscribed: boolean }
      entitlements: unknown[]
    }

    expect(body.songs.subscribed).toBe(false)
    expect(body.entitlements).toEqual([])
  })
})
