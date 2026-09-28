// @vitest-environment node
//
// ── The songs the native app can spend (plan S7 D9 and D5, owner 28 Sep) ──
//
// Credits bought on the web are not spendable in the native app in V1: the
// app sees and spends the Karaoke subscription's songs, and a signed-in
// singer's one free song a month. The web keeps spending the whole balance.
// The server decides which: the app's own origin says a request is the
// app's, and so does the main worker when it spends on the app's behalf.
// Either only ever narrows what can be spent.
//
// Real SQLite with every migration applied, through the worker's own fetch:
// the app's debit is written only on the ledger it was computed from, and
// only the real engine can say whether that guard holds.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const WEBHOOK_AUTH = 'Bearer native-songs-webhook-secret'
const SERVICE_KEY = 'native-songs-service-key'
const IOS = 'capacitor://localhost'
const ANDROID = 'https://localhost'
const DEVICE = '00000000-0000-4000-8000-00000000d0a1'
const DEVICE_SECRET = 'ns1Aa2Bb3Cc4Dd5Ee6Ff7Gg8Hh9Ii0Jj1Kk2Ll3Mm4'
/** A song over 12 minutes costs a second song (billing-core, uvrJobCost). */
const TWO_SONGS_LONG = 900

let sqlite: DatabaseSync
let env: Env
let events = 0

interface Call {
  method?: string
  token?: string
  origin?: string
  body?: unknown
  headers?: Record<string, string>
}

function call(path: string, init: Call = {}): Promise<Response> {
  const headers: Record<string, string> = { ...init.headers }
  if (init.token !== undefined) headers.Authorization = `Bearer ${init.token}`
  if (init.origin !== undefined) headers.Origin = init.origin
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  return worker.fetch(
    new Request(`https://api.test${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    }),
    env,
    {} as ExecutionContext,
  )
}

/** The phone's identity, anonymous, as the native app is at first. */
async function anonymousToken(): Promise<string> {
  const response = await call('/api/auth/anonymous', {
    body: { deviceId: DEVICE, deviceSecret: DEVICE_SECRET },
  })
  expect(response.status).toBe(200)
  return ((await response.json()) as { token: string }).token
}

/** The same identity, signed up: an account, the same user id. */
async function signedInToken(): Promise<string> {
  await anonymousToken()
  const response = await call('/api/auth/register', {
    body: {
      email: 'singer@example.com',
      password: 'Singer123!pass',
      deviceId: DEVICE,
      deviceSecret: DEVICE_SECRET,
    },
  })
  expect(response.status).toBe(200)
  return ((await response.json()) as { token: string }).token
}

function seedRow(delta: number, reason: string, key: string): void {
  sqlite
    .prepare(
      `INSERT INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    )
    .run(`seed-${key}`, new Date().toISOString(), DEVICE, delta, reason, key)
}

function balance(): number {
  const row = sqlite
    .prepare(
      'SELECT COALESCE(SUM(delta), 0) AS balance FROM creditLedger WHERE userId = ?',
    )
    .get(DEVICE) as { balance: number }
  return Number(row.balance)
}

function rows(reason: string): Array<{ delta: number; jobRef: string | null }> {
  return (
    sqlite
      .prepare(
        'SELECT delta, jobRef FROM creditLedger WHERE userId = ? AND reason = ? ORDER BY rowid',
      )
      .all(DEVICE, reason) as Array<{ delta: number; jobRef: string | null }>
  ).map((row) => ({ delta: Number(row.delta), jobRef: row.jobRef }))
}

/** Another write lands between the next ledger read and the write after
 *  it: what a concurrent separation or grant does, deterministically. */
function raceTheNextWrite(write: () => void): void {
  const db = env.DB as unknown as SqliteD1Database
  const batch = db.batch.bind(db)
  let raced = false
  db.batch = async (statements) => {
    if (!raced) {
      raced = true
      write()
    }
    return batch(statements)
  }
}

/** The month's free song, claimed by another job, as the app writes it. */
function claimTheFreeSong(jobRef: string): void {
  const month = new Date().toISOString().slice(0, 7)
  sqlite
    .prepare(
      `INSERT INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       VALUES (?, ?, ?, 0, 'free-song', ?, ?)`,
    )
    .run(
      `claim-${jobRef}`,
      new Date().toISOString(),
      DEVICE,
      jobRef,
      `free-song:${DEVICE}:${month}:0`,
    )
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

/** A RevenueCat event for the phone's identity, as its webhook sends it. */
function rcEvent(
  type: string,
  fields: Record<string, unknown> = {},
): { api_version: string; event: Record<string, unknown> } {
  events += 1
  return {
    api_version: '1.0',
    event: {
      id: `native-event-${events}`,
      type,
      app_user_id: DEVICE,
      original_app_user_id: DEVICE,
      aliases: [DEVICE],
      product_id: 'com.irchiinnuss.mercurypitch.cloud.monthly',
      entitlement_ids: ['cloud'],
      transaction_id: 'txn-1',
      expiration_at_ms: Date.now() + 30 * 86_400_000,
      environment: 'SANDBOX',
      store: 'APP_STORE',
      ...fields,
    },
  }
}

async function deliver(body: unknown): Promise<Record<string, unknown>> {
  const response = await call('/api/billing/revenuecat', {
    body,
    headers: { Authorization: WEBHOOK_AUTH },
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Record<string, unknown>
}

interface Me {
  creditBalance: number
  songs: Record<string, unknown>
}

async function me(token: string, origin?: string): Promise<Me> {
  const response = await call('/api/billing/me', {
    token,
    ...(origin === undefined ? {} : { origin }),
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Me
}

interface Spend {
  origin?: string
  from?: unknown
  durationSeconds?: number
}

function spendBody(spend: Spend, extra: Record<string, unknown> = {}) {
  return {
    tier: 'gpu',
    model: 'roformer',
    ...extra,
    ...(spend.durationSeconds === undefined
      ? {}
      : { durationSeconds: spend.durationSeconds }),
    ...(spend.from === undefined ? {} : { from: spend.from }),
  }
}

function admit(token: string, spend: Spend = {}): Promise<Response> {
  return call('/api/billing/uvr-admit', {
    token,
    body: spendBody(spend),
    ...(spend.origin === undefined ? {} : { origin: spend.origin }),
  })
}

function debit(
  token: string,
  jobRef: string,
  spend: Spend = {},
): Promise<Response> {
  return call('/api/billing/debit', {
    token,
    body: spendBody(spend, { jobRef }),
    ...(spend.origin === undefined ? {} : { origin: spend.origin }),
  })
}

async function refund(jobRef: string): Promise<Record<string, unknown>> {
  const response = await call('/api/billing/refund', {
    body: { jobRef },
    headers: { 'X-Service-Key': SERVICE_KEY },
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Record<string, unknown>
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
    JWT_SECRET: 'native-songs-integration-jwt',
    // As dev and prod list them: the web, and the app's two origins.
    ALLOWED_ORIGINS: `http://localhost,${IOS},${ANDROID}`,
    REVENUECAT_WEBHOOK_AUTH: WEBHOOK_AUTH,
    REVENUECAT_ENVIRONMENT: 'SANDBOX',
    BILLING_SERVICE_KEY: SERVICE_KEY,
  }
  events = 0
  priceTheGpu()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  sqlite.close()
})

describe('what the app sees', () => {
  it('is the subscription’s songs, never bought or promo credits', async () => {
    const token = await anonymousToken()
    seedRow(30, 'purchase', 'bought-pack')
    seedRow(5, 'promo', 'promo-code')
    await deliver(rcEvent('INITIAL_PURCHASE'))

    for (const origin of [IOS, ANDROID]) {
      const app = await me(token, origin)
      expect(app.songs).toMatchObject({ subscribed: true, left: 20, free: 0 })
      expect(app.creditBalance).toBe(20)
    }
    const web = await me(token)
    expect(web.creditBalance).toBe(55)
    expect(web.songs).toMatchObject({ left: 55 })
  })

  it('is nothing for a singer with only web credits', async () => {
    const token = await anonymousToken()
    seedRow(30, 'purchase', 'bought-pack')

    const app = await me(token, IOS)

    expect(app.songs).toMatchObject({ subscribed: false, left: 0, free: 0 })
    expect(app.creditBalance).toBe(0)
  })
})

describe('what the app can spend', () => {
  it('is never web credits: admission and the debit both refuse', async () => {
    const token = await anonymousToken()
    seedRow(30, 'purchase', 'bought-pack')

    const admitted = await admit(token, { origin: IOS })
    const debited = await debit(token, 'rp_gpu_web-credits', { origin: IOS })

    expect(admitted.status).toBe(402)
    expect(await admitted.json()).toMatchObject({ required: 1, balance: 0 })
    expect(debited.status).toBe(402)
    expect(balance()).toBe(30)
    expect((await admit(token)).status).toBe(200)
  })

  it('is the same when the main worker spends for the app', async () => {
    const token = await anonymousToken()
    seedRow(30, 'purchase', 'bought-pack')

    expect((await admit(token, { from: 'app' })).status).toBe(402)
    expect(
      (await debit(token, 'rp_gpu_via-worker', { from: 'app' })).status,
    ).toBe(402)
    expect(balance()).toBe(30)
  })

  it('cannot be widened by anything the request says', async () => {
    const token = await anonymousToken()
    seedRow(30, 'purchase', 'bought-pack')

    for (const from of ['web', 'all', null, 1, { app: false }]) {
      const response = await debit(token, 'rp_gpu_widen', {
        origin: ANDROID,
        from,
      })
      expect(response.status, JSON.stringify(from)).toBe(402)
    }
    expect(balance()).toBe(30)
  })

  it('spends the subscription’s songs and leaves bought credits alone', async () => {
    const token = await anonymousToken()
    seedRow(30, 'purchase', 'bought-pack')
    await deliver(rcEvent('INITIAL_PURCHASE'))

    const response = await debit(token, 'rp_gpu_song-1', { origin: IOS })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ debited: 1, balance: 19 })
    expect((await me(token, IOS)).songs).toMatchObject({ left: 19 })
    expect(balance()).toBe(49)
  })

  it('gives a failed separation’s songs back to the subscription', async () => {
    const token = await anonymousToken()
    seedRow(30, 'purchase', 'bought-pack')
    await deliver(rcEvent('INITIAL_PURCHASE'))
    const response = await debit(token, 'rp_gpu_failed', {
      origin: IOS,
      durationSeconds: TWO_SONGS_LONG,
    })
    expect(await response.json()).toMatchObject({ debited: 2 })
    expect((await me(token, IOS)).songs).toMatchObject({ left: 18 })

    expect(await refund('rp_gpu_failed')).toMatchObject({ refunded: 2 })

    expect((await me(token, IOS)).songs).toMatchObject({ left: 20 })
    expect(balance()).toBe(50)
  })

  it('says a retried debit was paid already, even with no songs left', async () => {
    env = { ...env, SONGS_PER_PERIOD: '1' }
    const token = await anonymousToken()
    await deliver(rcEvent('INITIAL_PURCHASE'))

    const first = await debit(token, 'rp_gpu_retried', { origin: IOS })
    const retry = await debit(token, 'rp_gpu_retried', { origin: IOS })

    expect(first.status).toBe(200)
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ debited: 1, duplicate: true })
    expect(rows('uvr-job')).toEqual([{ delta: -1, jobRef: 'rp_gpu_retried' }])
  })

  it('spends one song once when two separations race for it', async () => {
    env = { ...env, SONGS_PER_PERIOD: '1' }
    const token = await anonymousToken()
    seedRow(30, 'purchase', 'bought-pack')
    await deliver(rcEvent('INITIAL_PURCHASE'))

    const statuses = (
      await Promise.all([
        debit(token, 'rp_gpu_race-a', { origin: IOS }),
        debit(token, 'rp_gpu_race-b', { origin: IOS }),
      ])
    ).map((response) => response.status)

    expect(statuses.sort()).toEqual([200, 402])
    expect(balance()).toBe(30)
  })

  it('writes nothing on a ledger that changed after it was read', async () => {
    env = { ...env, SONGS_PER_PERIOD: '1' }
    const token = await anonymousToken()
    await deliver(rcEvent('INITIAL_PURCHASE'))
    // A web separation spends the one song between the app's read and write.
    raceTheNextWrite(() => seedRow(-1, 'uvr-job', 'web-in-between'))

    const response = await debit(token, 'rp_gpu_raced', { origin: IOS })

    expect(response.status).toBe(402)
    expect(balance()).toBe(0)
  })

  it('leaves the rollover cap counting subscription songs only', async () => {
    const token = await anonymousToken()
    seedRow(30, 'purchase', 'bought-pack')
    await deliver(rcEvent('INITIAL_PURCHASE'))
    await deliver(rcEvent('RENEWAL'))
    await debit(token, 'rp_gpu_cap-1', { origin: IOS })
    await debit(token, 'rp_gpu_cap-2', { origin: IOS })

    await deliver(rcEvent('RENEWAL'))

    expect(rows('subscription').map((row) => row.delta)).toEqual([20, 20, 12])
    expect((await me(token, IOS)).songs).toMatchObject({ left: 50 })
    expect(balance()).toBe(80)
  })
})

describe('the web', () => {
  it('still spends the whole balance, bought credits included', async () => {
    const token = await anonymousToken()
    seedRow(3, 'purchase', 'bought-pack')

    const response = await debit(token, 'rp_gpu_web')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ debited: 1, balance: 2 })
    expect(balance()).toBe(2)
  })
})

describe('the month’s free song', () => {
  it('is one song a month for a signed-in singer, from the app', async () => {
    const token = await signedInToken()
    expect((await me(token, IOS)).songs).toMatchObject({ left: 1, free: 1 })

    const first = await debit(token, 'rp_gpu_free-1', { origin: IOS })
    const second = await debit(token, 'rp_gpu_free-2', { origin: IOS })

    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ debited: 1, balance: 0 })
    expect(second.status).toBe(402)
    expect((await me(token, IOS)).songs).toMatchObject({ left: 0, free: 0 })
    expect(rows('free-song')).toEqual([{ delta: 0, jobRef: 'rp_gpu_free-1' }])
    expect(balance()).toBe(0)
  })

  it('is none for an anonymous singer', async () => {
    const token = await anonymousToken()

    expect((await me(token, IOS)).songs).toMatchObject({ left: 0, free: 0 })
    expect((await debit(token, 'rp_gpu_anon', { origin: IOS })).status).toBe(
      402,
    )
    expect(rows('free-song')).toEqual([])
  })

  it('goes first, and the rollover cap never counts it', async () => {
    const token = await signedInToken()
    await deliver(rcEvent('INITIAL_PURCHASE'))
    expect((await me(token, IOS)).songs).toMatchObject({ left: 21, free: 1 })

    await debit(token, 'rp_gpu_free-first', { origin: IOS })
    expect((await me(token, IOS)).songs).toMatchObject({ left: 20, free: 0 })

    await deliver(rcEvent('RENEWAL'))
    await deliver(rcEvent('RENEWAL'))
    expect(rows('subscription').map((row) => row.delta)).toEqual([20, 20, 10])
    expect(balance()).toBe(50)
  })

  it('comes back when the separation it paid for failed', async () => {
    const token = await signedInToken()
    await debit(token, 'rp_gpu_free-failed', { origin: IOS })

    expect(await refund('rp_gpu_free-failed')).toMatchObject({ refunded: 0 })
    expect((await me(token, IOS)).songs).toMatchObject({ left: 1, free: 1 })
    expect(await refund('rp_gpu_free-failed')).toMatchObject({ refunded: 0 })
    expect(rows('free-song-back')).toHaveLength(1)

    expect(
      (await debit(token, 'rp_gpu_free-again', { origin: IOS })).status,
    ).toBe(200)
    expect((await me(token, IOS)).songs).toMatchObject({ free: 0 })
  })

  it('pays for one song of a longer one, and both come back', async () => {
    const token = await signedInToken()
    await deliver(rcEvent('INITIAL_PURCHASE'))

    const response = await debit(token, 'rp_gpu_long', {
      origin: IOS,
      durationSeconds: TWO_SONGS_LONG,
    })
    expect(await response.json()).toMatchObject({ debited: 2 })
    expect((await me(token, IOS)).songs).toMatchObject({ left: 19, free: 0 })
    expect(balance()).toBe(19)

    expect(await refund('rp_gpu_long')).toMatchObject({ refunded: 1 })
    expect((await me(token, IOS)).songs).toMatchObject({ left: 21, free: 1 })
    expect(balance()).toBe(20)
  })

  it('refills on the 1st, in UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.parse('2026-09-30T23:00:00.000Z'))
    const token = await signedInToken()
    await debit(token, 'rp_gpu_september', { origin: IOS })
    expect((await me(token, IOS)).songs).toMatchObject({ free: 0 })

    vi.setSystemTime(Date.parse('2026-10-01T00:00:01.000Z'))

    expect((await me(token, IOS)).songs).toMatchObject({ left: 1, free: 1 })
  })

  it('never carries an unused one over to the next month', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.parse('2026-10-20T12:00:00.000Z'))
    const token = await signedInToken()
    expect((await me(token, IOS)).songs).toMatchObject({ left: 1, free: 1 })

    vi.setSystemTime(Date.parse('2026-11-01T00:00:01.000Z'))

    expect((await me(token, IOS)).songs).toMatchObject({ left: 1, free: 1 })
  })

  it('is taken once when two separations race for it', async () => {
    const token = await signedInToken()

    const statuses = (
      await Promise.all([
        debit(token, 'rp_gpu_free-race-a', { origin: IOS }),
        debit(token, 'rp_gpu_free-race-b', { origin: IOS }),
      ])
    ).map((response) => response.status)

    expect(statuses.sort()).toEqual([200, 402])
    expect(rows('free-song')).toHaveLength(1)
  })

  it('is not taken twice by a claim that lands after it was read', async () => {
    const token = await signedInToken()
    raceTheNextWrite(() => claimTheFreeSong('rp_gpu_other-job'))

    const response = await debit(token, 'rp_gpu_claim-raced', { origin: IOS })

    expect(response.status).toBe(402)
    expect(rows('free-song')).toEqual([
      { delta: 0, jobRef: 'rp_gpu_other-job' },
    ])
    expect(rows('uvr-job')).toEqual([])
  })

  it('is never a credit on the web', async () => {
    const token = await signedInToken()

    expect((await me(token)).creditBalance).toBe(0)
    expect((await debit(token, 'rp_gpu_web-free')).status).toBe(402)
    expect(rows('free-song')).toEqual([])
  })

  it('can be switched off', async () => {
    env = { ...env, FREE_MONTHLY_SONG: 'off' }
    const token = await signedInToken()

    expect((await me(token, IOS)).songs).toMatchObject({ left: 0, free: 0 })
    expect((await debit(token, 'rp_gpu_off', { origin: IOS })).status).toBe(402)
  })
})

describe('a refund the store reversed', () => {
  // RevenueCat's REFUND_REVERSED (App Store only): Apple took back a refund
  // it had granted. What the refund took is the singer's again.
  async function subscribedThenRefunded(token: string): Promise<void> {
    await deliver(rcEvent('INITIAL_PURCHASE'))
    for (let job = 0; job < 5; job += 1) {
      await debit(token, `rp_gpu_sung-${job}`, { origin: IOS })
    }
    await deliver(
      rcEvent('CANCELLATION', { cancel_reason: 'CUSTOMER_SUPPORT' }),
    )
    expect((await me(token, IOS)).songs).toMatchObject({
      subscribed: false,
      left: 0,
    })
  }

  it('gives back the songs and the subscription the refund took', async () => {
    const token = await anonymousToken()
    await subscribedThenRefunded(token)
    const periodEnd = Date.now() + 20 * 86_400_000

    const outcome = await deliver(
      rcEvent('REFUND_REVERSED', { expiration_at_ms: periodEnd }),
    )

    expect(outcome).toMatchObject({ received: true, restored: 15 })
    expect((await me(token, IOS)).songs).toMatchObject({
      subscribed: true,
      left: 15,
      renewsAt: new Date(periodEnd).toISOString(),
    })
  })

  it('gives them back once for a reversal delivered twice', async () => {
    const token = await anonymousToken()
    await subscribedThenRefunded(token)
    const reversal = rcEvent('REFUND_REVERSED')

    await deliver(reversal)
    const again = await deliver(reversal)

    expect(again).toMatchObject({ duplicate: true })
    expect((await me(token, IOS)).songs).toMatchObject({ left: 15 })
  })

  it('gives them back once when a retry comes after the record was lost', async () => {
    const token = await anonymousToken()
    await subscribedThenRefunded(token)
    const reversal = rcEvent('REFUND_REVERSED')
    await deliver(reversal)
    sqlite.prepare('DELETE FROM billingEvents').run()

    await deliver(reversal)
    await deliver(rcEvent('REFUND_REVERSED'))

    expect(
      rows('subscription-refund-reversed').map((row) => row.delta),
    ).toEqual([15, 0])
    expect((await me(token, IOS)).songs).toMatchObject({ left: 15 })
  })

  it('gives back nothing when nothing was taken back', async () => {
    const token = await anonymousToken()
    await deliver(rcEvent('INITIAL_PURCHASE'))

    const outcome = await deliver(rcEvent('REFUND_REVERSED'))

    expect(outcome).toMatchObject({ restored: 0 })
    expect((await me(token, IOS)).songs).toMatchObject({ left: 20 })
  })

  it('gives back subscription songs: the app spends them, the cap counts them', async () => {
    const token = await anonymousToken()
    seedRow(30, 'purchase', 'bought-pack')
    await subscribedThenRefunded(token)
    await deliver(rcEvent('REFUND_REVERSED'))

    await deliver(rcEvent('RENEWAL'))

    expect(rows('subscription').map((row) => row.delta)).toEqual([20, 20])
    expect((await me(token, IOS)).songs).toMatchObject({ left: 35 })
    expect(balance()).toBe(65)
  })

  it('changes nothing for a reversal from another store environment', async () => {
    const token = await anonymousToken()
    await subscribedThenRefunded(token)

    const outcome = await deliver(
      rcEvent('REFUND_REVERSED', { environment: 'PRODUCTION' }),
    )

    expect(outcome).toMatchObject({ ignored: 'another store environment' })
    expect((await me(token, IOS)).songs).toMatchObject({ left: 0 })
  })
})
