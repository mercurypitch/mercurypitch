// @vitest-environment node
//
// ── The Karaoke subscription's songs, end to end (plan S8, Stage 2) ──
//
// RevenueCat tells the db-worker when a singer subscribes, renews, stops or
// moves the subscription to another account. Each period grants songs into
// the existing credits ledger (one song is one credit up to 12 minutes), with
// unused songs rolling over to a cap (owner, 27 Sep: 20 a month, a cap of 50,
// both config). The ledger stays append-only and every grant is idempotent on
// the RevenueCat event id, the way the Stripe webhook is on Stripe's.
//
// Real SQLite with every migration applied, through the worker's own fetch:
// the grant is one INSERT ... SELECT that reads the balance as it writes, and
// only the real engine can say whether that SQL does what it claims.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const WEBHOOK_AUTH = 'Bearer revenuecat-integration-secret'
const DEVICE = '00000000-0000-4000-8000-00000000c0a1'
const DEVICE_SECRET = 'rc1Aa2Bb3Cc4Dd5Ee6Ff7Gg8Hh9Ii0Jj1Kk2Ll3Mm4'
const ACCOUNT = '00000000-0000-4000-8000-00000000c0b2'
const OTHER_ACCOUNT = '00000000-0000-4000-8000-00000000c0c3'
const PERIOD_END = Date.parse('2026-10-27T12:00:00.000Z')

let sqlite: DatabaseSync
let env: Env
let events = 0

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return workerRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

/** A RevenueCat event, in the shape its webhook sends (api_version 1.0). */
function rcEvent(
  type: string,
  fields: Record<string, unknown> = {},
): { api_version: string; event: Record<string, unknown> } {
  events += 1
  return {
    api_version: '1.0',
    event: {
      id: `rc-event-${events}`,
      type,
      app_user_id: DEVICE,
      original_app_user_id: DEVICE,
      aliases: [DEVICE],
      product_id: 'mercurypitch_karaoke_monthly',
      entitlement_ids: ['cloud'],
      period_type: 'NORMAL',
      purchased_at_ms: PERIOD_END - 30 * 86_400_000,
      expiration_at_ms: PERIOD_END,
      environment: 'SANDBOX',
      store: 'APP_STORE',
      ...fields,
    },
  }
}

function deliver(
  body: unknown,
  authorization: string | null = WEBHOOK_AUTH,
): Promise<Response> {
  return postJson(
    '/api/billing/revenuecat',
    body,
    authorization === null ? {} : { Authorization: authorization },
  )
}

function balanceOf(userId: string): number {
  const row = sqlite
    .prepare(
      'SELECT COALESCE(SUM(delta), 0) AS balance FROM creditLedger WHERE userId = ?',
    )
    .get(userId) as { balance: number }
  return Number(row.balance)
}

function entitlementOf(
  userId: string,
): { source: string | null; expiresAt: string | null } | undefined {
  return sqlite
    .prepare(
      "SELECT source, expiresAt FROM entitlements WHERE userId = ? AND feature = 'cloud'",
    )
    .get(userId) as
    | { source: string | null; expiresAt: string | null }
    | undefined
}

function seedAccount(id: string): void {
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO users (id, createdAt, updatedAt, authProvider, email, emailVerified, tokenVersion)
       VALUES (?, ?, ?, 'password', ?, 1, 1)`,
    )
    .run(id, now, now, `${id.slice(-4)}@example.com`)
}

function seedCredits(userId: string, delta: number, key: string): void {
  sqlite
    .prepare(
      `INSERT INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       VALUES (?, ?, ?, ?, 'purchase', NULL, ?)`,
    )
    .run(`seed-${key}`, new Date().toISOString(), userId, delta, key)
}

/** The singer's app: signed in anonymously, as the native app is at first. */
async function anonymousToken(): Promise<string> {
  const response = await postJson('/api/auth/anonymous', {
    deviceId: DEVICE,
    deviceSecret: DEVICE_SECRET,
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { token: string }
  return body.token
}

async function songsFor(token: string): Promise<Record<string, unknown>> {
  const response = await workerRequest('/api/billing/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { songs: Record<string, unknown> }
  return body.songs
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
    JWT_SECRET: 'revenuecat-integration-secret-jwt',
    ALLOWED_ORIGINS: 'http://localhost',
    REVENUECAT_WEBHOOK_AUTH: WEBHOOK_AUTH,
  }
  events = 0
})

afterEach(() => {
  vi.restoreAllMocks()
  sqlite.close()
})

describe('the webhook', () => {
  it('is closed, not open, while no secret is set', async () => {
    await anonymousToken()
    env = { ...env, REVENUECAT_WEBHOOK_AUTH: undefined }

    const response = await deliver(rcEvent('INITIAL_PURCHASE'))

    expect(response.status).toBe(501)
    expect(balanceOf(DEVICE)).toBe(0)
  })

  it('turns away a delivery without the secret, or with another', async () => {
    await anonymousToken()

    const none = await deliver(rcEvent('INITIAL_PURCHASE'), null)
    const wrong = await deliver(rcEvent('INITIAL_PURCHASE'), 'Bearer guess')

    expect([none.status, wrong.status]).toEqual([401, 401])
    expect(balanceOf(DEVICE)).toBe(0)
  })

  it('turns away a body with no event id', async () => {
    const body = rcEvent('INITIAL_PURCHASE')
    delete body.event.id

    const response = await deliver(body)

    expect(response.status).toBe(400)
  })
})

describe('a subscription', () => {
  it('grants the month of songs, and /me says so', async () => {
    const token = await anonymousToken()

    const response = await deliver(rcEvent('INITIAL_PURCHASE'))

    expect(response.status).toBe(200)
    expect(balanceOf(DEVICE)).toBe(20)
    expect(entitlementOf(DEVICE)).toEqual({
      source: 'revenuecat:mercurypitch_karaoke_monthly',
      expiresAt: new Date(PERIOD_END).toISOString(),
    })
    expect(await songsFor(token)).toEqual({
      subscribed: true,
      left: 20,
      renewsAt: new Date(PERIOD_END).toISOString(),
      perPeriod: 20,
      cap: 50,
    })
  })

  it('grants once for an event delivered twice', async () => {
    await anonymousToken()
    const purchase = rcEvent('INITIAL_PURCHASE')

    const first = await deliver(purchase)
    const again = await deliver(purchase)

    expect([first.status, again.status]).toEqual([200, 200])
    expect(await again.json()).toMatchObject({ duplicate: true })
    expect(balanceOf(DEVICE)).toBe(20)
  })

  it('grants once when a retry comes after the record of it was lost', async () => {
    // A failure after the grant and before the event is recorded: RevenueCat
    // retries, the billingEvents check passes, and the ledger's own key is
    // all that stands between the singer and a second month of songs.
    await anonymousToken()
    const purchase = rcEvent('INITIAL_PURCHASE')
    await deliver(purchase)
    sqlite.prepare('DELETE FROM billingEvents').run()

    await deliver(purchase)

    expect(balanceOf(DEVICE)).toBe(20)
  })

  it('rolls unused songs over at each renewal, up to the cap', async () => {
    await anonymousToken()

    await deliver(rcEvent('INITIAL_PURCHASE'))
    await deliver(rcEvent('RENEWAL'))
    expect(balanceOf(DEVICE)).toBe(40)
    await deliver(rcEvent('RENEWAL'))
    expect(balanceOf(DEVICE)).toBe(50)
    await deliver(rcEvent('RENEWAL'))
    expect(balanceOf(DEVICE)).toBe(50)
  })

  it('tops up only to the cap when songs were left over', async () => {
    await anonymousToken()
    seedCredits(DEVICE, 45, 'left-over')

    await deliver(rcEvent('RENEWAL'))

    expect(balanceOf(DEVICE)).toBe(50)
  })

  it('takes its numbers from config', async () => {
    const token = await anonymousToken()
    env = { ...env, SONGS_PER_PERIOD: '30', SONGS_ROLLOVER_CAP: '60' }

    await deliver(rcEvent('INITIAL_PURCHASE'))
    await deliver(rcEvent('RENEWAL'))
    await deliver(rcEvent('RENEWAL'))

    expect(balanceOf(DEVICE)).toBe(60)
    expect(await songsFor(token)).toMatchObject({ perPeriod: 30, cap: 60 })
  })

  it('ends at expiration, and the songs left stay', async () => {
    const token = await anonymousToken()
    await deliver(rcEvent('INITIAL_PURCHASE'))
    // RevenueCat sends EXPIRATION once the period is over: a moment ago.
    const ended = Date.now() - 3_600_000

    const response = await deliver(
      rcEvent('EXPIRATION', { expiration_at_ms: ended }),
    )

    expect(response.status).toBe(200)
    expect(entitlementOf(DEVICE)?.expiresAt).toBe(new Date(ended).toISOString())
    expect(await songsFor(token)).toEqual({
      subscribed: false,
      left: 20,
      renewsAt: null,
      perPeriod: 20,
      cap: 50,
    })
  })

  it('grants nothing for another product, or a user it does not know', async () => {
    await anonymousToken()

    const other = await deliver(
      rcEvent('INITIAL_PURCHASE', { entitlement_ids: ['something-else'] }),
    )
    const stranger = await deliver(
      rcEvent('INITIAL_PURCHASE', {
        app_user_id: '$RCAnonymousID:0123456789abcdef',
        original_app_user_id: '$RCAnonymousID:0123456789abcdef',
        aliases: ['$RCAnonymousID:0123456789abcdef'],
      }),
    )

    expect([other.status, stranger.status]).toEqual([200, 200])
    expect(balanceOf(DEVICE)).toBe(0)
    expect(entitlementOf(DEVICE)).toBeUndefined()
  })

  it('finds the singer by an alias when the app user id is RevenueCat’s own', async () => {
    await anonymousToken()

    await deliver(
      rcEvent('INITIAL_PURCHASE', {
        app_user_id: '$RCAnonymousID:0123456789abcdef',
        original_app_user_id: '$RCAnonymousID:0123456789abcdef',
        aliases: ['$RCAnonymousID:0123456789abcdef', DEVICE],
      }),
    )

    expect(balanceOf(DEVICE)).toBe(20)
  })
})

describe('a subscription moved to another account', () => {
  it('takes the songs of the phone’s anonymous identity with it', async () => {
    await anonymousToken()
    seedAccount(ACCOUNT)
    await deliver(rcEvent('INITIAL_PURCHASE'))

    const response = await deliver(
      rcEvent('TRANSFER', {
        app_user_id: ACCOUNT,
        transferred_from: [DEVICE],
        transferred_to: [ACCOUNT],
      }),
    )

    expect(response.status).toBe(200)
    expect([balanceOf(DEVICE), balanceOf(ACCOUNT)]).toEqual([0, 20])
    expect(entitlementOf(DEVICE)).toBeUndefined()
    expect(entitlementOf(ACCOUNT)).toEqual({
      source: 'revenuecat:mercurypitch_karaoke_monthly',
      expiresAt: new Date(PERIOD_END).toISOString(),
    })
  })

  it('moves the songs once for a transfer delivered twice', async () => {
    await anonymousToken()
    seedAccount(ACCOUNT)
    await deliver(rcEvent('INITIAL_PURCHASE'))
    const transfer = rcEvent('TRANSFER', {
      app_user_id: ACCOUNT,
      transferred_from: [DEVICE],
      transferred_to: [ACCOUNT],
    })

    await deliver(transfer)
    await deliver(transfer)

    expect([balanceOf(DEVICE), balanceOf(ACCOUNT)]).toEqual([0, 20])
  })

  it('moves the songs once when a retry comes after the record was lost', async () => {
    await anonymousToken()
    seedAccount(ACCOUNT)
    await deliver(rcEvent('INITIAL_PURCHASE'))
    const transfer = rcEvent('TRANSFER', {
      app_user_id: ACCOUNT,
      transferred_from: [DEVICE],
      transferred_to: [ACCOUNT],
    })
    await deliver(transfer)
    sqlite.prepare('DELETE FROM billingEvents').run()

    await deliver(transfer)

    expect([balanceOf(DEVICE), balanceOf(ACCOUNT)]).toEqual([0, 20])
  })

  it('leaves a real account its own credits, and moves only the subscription', async () => {
    seedAccount(ACCOUNT)
    seedAccount(OTHER_ACCOUNT)
    seedCredits(OTHER_ACCOUNT, 7, 'bought-on-the-web')
    await deliver(rcEvent('INITIAL_PURCHASE', { app_user_id: OTHER_ACCOUNT }))

    await deliver(
      rcEvent('TRANSFER', {
        app_user_id: ACCOUNT,
        transferred_from: [OTHER_ACCOUNT],
        transferred_to: [ACCOUNT],
      }),
    )

    expect([balanceOf(OTHER_ACCOUNT), balanceOf(ACCOUNT)]).toEqual([27, 0])
    expect(entitlementOf(OTHER_ACCOUNT)).toBeUndefined()
    expect(entitlementOf(ACCOUNT)?.source).toBe(
      'revenuecat:mercurypitch_karaoke_monthly',
    )
  })
})

describe('an anonymous identity', () => {
  it('can be admitted for a separation once it has a song, and not before', async () => {
    const token = await anonymousToken()
    sqlite
      .prepare(
        `INSERT OR REPLACE INTO pricingPlans
           (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active)
         VALUES ('tier-runpod-gpu', ?, ?, 'tier', 'Server (GPU)', '', 'song', NULL, 'eur', 1, NULL, NULL, 2, 1)`,
      )
      .run(new Date().toISOString(), new Date().toISOString())
    const admit = () =>
      postJson(
        '/api/billing/uvr-admit',
        { tier: 'gpu', model: 'roformer', durationSeconds: 200 },
        { Authorization: `Bearer ${token}` },
      )

    const before = await admit()
    await deliver(rcEvent('INITIAL_PURCHASE'))
    const after = await admit()

    expect(before.status).toBe(402)
    expect(after.status).toBe(200)
    expect(await after.json()).toMatchObject({ allowed: true, balance: 20 })
  })
})

describe('signing up on the phone that subscribed', () => {
  it('keeps the songs: the account is the same identity, upgraded', async () => {
    await anonymousToken()
    await deliver(rcEvent('INITIAL_PURCHASE'))

    const signedUp = await postJson('/api/auth/register', {
      email: 'singer@example.com',
      password: 'Singer123!pass',
      deviceId: DEVICE,
      deviceSecret: DEVICE_SECRET,
    })
    expect(signedUp.status).toBe(200)
    const { token } = (await signedUp.json()) as { token: string }

    expect(await songsFor(token)).toMatchObject({ subscribed: true, left: 20 })
  })
})

describe('/me without a subscription', () => {
  it('counts the credits the account already has as its songs', async () => {
    const token = await anonymousToken()
    seedCredits(DEVICE, 3, 'dev-credits')

    expect(await songsFor(token)).toEqual({
      subscribed: false,
      left: 3,
      renewsAt: null,
      perPeriod: 20,
      cap: 50,
    })
  })
})
