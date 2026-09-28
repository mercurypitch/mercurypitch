// @vitest-environment node
//
// ── Sandbox events on production, bounded (store review) ──
//
// App Review buys in the store's sandbox. While a store build is in review,
// the production Worker may apply those events too, when
// REVENUECAT_SANDBOX_ON_PRODUCTION is `bounded`: for its own users only, one
// sandbox period grant a UTC day per account, a budget of songs a UTC day
// across the deployment, and the rollover cap. The grants and the
// entitlement are marked as the sandbox's, and a sandbox event only ever
// touches the sandbox's periods and entitlement (revenuecat-sandbox.ts).
//
// Real SQLite with every migration applied, through the worker's own fetch.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, interleaved, SqliteD1Database } from './sqlite-d1'

const WEBHOOK_AUTH = 'Bearer sandbox-on-production-webhook'
const IOS = 'capacitor://localhost'
const PRODUCT = 'mercurypitch_karaoke_monthly'
const FIVE_MINUTES = 5 * 60_000

let sqlite: DatabaseSync
let env: Env
let events = 0
let devices = 0

interface Call {
  method?: string
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
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
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

/** A phone's anonymous identity on this deployment, as the app has it. */
async function phone(): Promise<Phone> {
  devices += 1
  const suffix = String(devices).padStart(4, '0')
  const userId = `00000000-0000-4000-8000-000000${suffix}5b`
  const response = await call('/api/auth/anonymous', {
    body: {
      deviceId: userId,
      deviceSecret: `sb${suffix}Aa2Bb3Cc4Dd5Ee6Ff7Gg8Hh9Ii0Jj1Kk2Ll3M`,
    },
  })
  expect(response.status).toBe(200)
  const { token } = (await response.json()) as { token: string }
  return { userId, token }
}

/** An account signed in with a password, as a transfer's target is. */
function account(id: string): void {
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT INTO users (id, createdAt, updatedAt, authProvider, email, emailVerified, tokenVersion)
       VALUES (?, ?, ?, 'password', ?, 0, 1)`,
    )
    .run(id, now, now, `${id.slice(-4)}@example.com`)
}

/** Credits bought on the web: the singer's own, never a subscription's. */
function credits(userId: string, delta: number, key: string): void {
  sqlite
    .prepare(
      `INSERT INTO creditLedger (id, createdAt, userId, delta, reason, jobRef, idempotencyKey)
       VALUES (?, ?, ?, ?, 'purchase', NULL, ?)`,
    )
    .run(`seed-${key}`, new Date().toISOString(), userId, delta, key)
}

/** A RevenueCat event from the store's sandbox, as its webhook sends it. */
function sandboxEvent(
  userId: string,
  type: string,
  fields: Record<string, unknown> = {},
): { api_version: string; event: Record<string, unknown> } {
  events += 1
  return {
    api_version: '1.0',
    event: {
      id: `sandbox-event-${events}`,
      type,
      app_user_id: userId,
      original_app_user_id: userId,
      aliases: [userId],
      product_id: PRODUCT,
      entitlement_ids: ['cloud'],
      transaction_id: `sandbox-txn-${userId.slice(-6)}`,
      expiration_at_ms: Date.now() + FIVE_MINUTES,
      environment: 'SANDBOX',
      store: 'APP_STORE',
      ...fields,
    },
  }
}

/** The same, from a paid purchase. */
function paidEvent(
  userId: string,
  type: string,
  fields: Record<string, unknown> = {},
): { api_version: string; event: Record<string, unknown> } {
  return sandboxEvent(userId, type, {
    environment: 'PRODUCTION',
    transaction_id: `paid-txn-${userId.slice(-6)}`,
    expiration_at_ms: Date.now() + 30 * 86_400_000,
    ...fields,
  })
}

async function deliver(body: unknown): Promise<Record<string, unknown>> {
  const response = await call('/api/billing/revenuecat', {
    body,
    headers: { Authorization: WEBHOOK_AUTH },
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Record<string, unknown>
}

interface Row {
  reason: string
  delta: number
  jobRef: string | null
}

function rowsOf(userId: string): Row[] {
  return (
    sqlite
      .prepare(
        'SELECT reason, delta, jobRef FROM creditLedger WHERE userId = ? ORDER BY rowid',
      )
      .all(userId) as unknown as Row[]
  ).map((row) => ({ ...row, delta: Number(row.delta) }))
}

function balanceOf(userId: string): number {
  return rowsOf(userId).reduce((sum, row) => sum + row.delta, 0)
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

async function appSongs(who: Phone): Promise<Record<string, unknown>> {
  const response = await call('/api/billing/me', {
    token: who.token,
    origin: IOS,
  })
  expect(response.status).toBe(200)
  return ((await response.json()) as { songs: Record<string, unknown> }).songs
}

function budgetRecord(): Array<{ day: string; songs: number }> {
  return (
    sqlite
      .prepare('SELECT day, songs FROM revenuecatSandboxGrants ORDER BY rowid')
      .all() as Array<{ day: string; songs: number }>
  ).map((row) => ({ day: row.day, songs: Number(row.songs) }))
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
    JWT_SECRET: 'sandbox-on-production-jwt',
    ALLOWED_ORIGINS: `http://localhost,${IOS},https://localhost`,
    REVENUECAT_WEBHOOK_AUTH: WEBHOOK_AUTH,
    // The production deployment, with the review switch on.
    REVENUECAT_ENVIRONMENT: 'PRODUCTION',
    REVENUECAT_SANDBOX_ON_PRODUCTION: 'bounded',
  }
  events = 0
  devices = 0
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  sqlite.close()
})

describe('the switch', () => {
  it('is off while unset: a sandbox purchase on production changes nothing', async () => {
    env = { ...env, REVENUECAT_SANDBOX_ON_PRODUCTION: undefined }
    const reviewer = await phone()

    const answer = await deliver(
      sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'),
    )

    expect(answer).toEqual({
      received: true,
      ignored: 'another store environment',
    })
    expect(rowsOf(reviewer.userId)).toEqual([])
    expect(entitlementOf(reviewer.userId)).toBeUndefined()
  })

  it('takes one word, `bounded`, and nothing else', async () => {
    for (const setting of ['true', '1', 'on', 'yes', 'unbounded', '']) {
      env = { ...env, REVENUECAT_SANDBOX_ON_PRODUCTION: setting }
      const reviewer = await phone()
      const answer = await deliver(
        sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'),
      )
      expect(answer.ignored, setting).toBe('another store environment')
      expect(rowsOf(reviewer.userId), setting).toEqual([])
    }

    env = { ...env, REVENUECAT_SANDBOX_ON_PRODUCTION: ' Bounded ' }
    const reviewer = await phone()
    expect(
      await deliver(sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE')),
    ).toMatchObject({ sandbox: true, granted: 20 })
  })

  it('changes nothing on the sandbox deployment, which takes them as its own', async () => {
    env = { ...env, REVENUECAT_ENVIRONMENT: 'SANDBOX' }
    const tester = await phone()

    const first = await deliver(sandboxEvent(tester.userId, 'INITIAL_PURCHASE'))
    const renewal = await deliver(sandboxEvent(tester.userId, 'RENEWAL'))
    const paid = await deliver(paidEvent(tester.userId, 'RENEWAL'))

    expect(first).toEqual({ received: true, granted: 20 })
    expect(renewal).toEqual({ received: true, granted: 20 })
    expect(paid).toMatchObject({ ignored: 'another store environment' })
    expect(rowsOf(tester.userId).map((row) => row.reason)).toEqual([
      'subscription',
      'subscription',
    ])
    expect(entitlementOf(tester.userId)?.source).toBe(`revenuecat:${PRODUCT}`)
  })

  it('leaves paid purchases on production as they were: no bound', async () => {
    const singer = await phone()

    const first = await deliver(paidEvent(singer.userId, 'INITIAL_PURCHASE'))
    const renewal = await deliver(
      paidEvent(singer.userId, 'RENEWAL', { transaction_id: 'paid-2' }),
    )

    expect(first).toEqual({ received: true, granted: 20 })
    expect(renewal).toEqual({ received: true, granted: 20 })
    expect(rowsOf(singer.userId).map((row) => row.reason)).toEqual([
      'subscription',
      'subscription',
    ])
    expect(entitlementOf(singer.userId)?.source).toBe(`revenuecat:${PRODUCT}`)
    expect(budgetRecord()).toEqual([])
  })

  it('ignores a user this deployment does not know, as ever', async () => {
    const answer = await deliver(
      sandboxEvent('00000000-0000-4000-8000-00000000dead', 'INITIAL_PURCHASE'),
    )

    expect(answer).toEqual({
      received: true,
      sandbox: true,
      ignored: 'unknown user',
    })
    expect(
      sqlite.prepare('SELECT COUNT(*) AS n FROM creditLedger').get(),
    ).toEqual({ n: 0 })
    expect(budgetRecord()).toEqual([])
  })

  it('takes only events that name the sandbox as theirs', async () => {
    const reviewer = await phone()

    for (const environment of [undefined, '', 'sandbox', 'STAGING']) {
      const answer = await deliver(
        sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE', { environment }),
      )
      expect(answer, String(environment)).toEqual({
        received: true,
        ignored: 'another store environment',
      })
    }
    expect(rowsOf(reviewer.userId)).toEqual([])
  })

  it('is unset on production in the deployed config', () => {
    const config = readFileSync(resolve(__dirname, '../wrangler.jsonc'), 'utf8')
    expect(config).not.toMatch(/"REVENUECAT_SANDBOX_ON_PRODUCTION"\s*:/)
    expect(config).not.toMatch(/"REVENUECAT_SANDBOX_DAILY_SONGS"\s*:/)
  })
})

describe('a sandbox purchase on production', () => {
  it('grants a period’s songs, marked as the sandbox’s', async () => {
    const reviewer = await phone()

    const answer = await deliver(
      sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'),
    )

    expect(answer).toEqual({ received: true, sandbox: true, granted: 20 })
    expect(rowsOf(reviewer.userId)).toEqual([
      {
        reason: 'subscription-sandbox',
        delta: 20,
        jobRef: `sandbox-txn-${reviewer.userId.slice(-6)}`,
      },
    ])
    expect(entitlementOf(reviewer.userId)?.source).toBe(
      `revenuecat-sandbox:${PRODUCT}`,
    )
    expect(await appSongs(reviewer)).toMatchObject({
      subscribed: true,
      left: 20,
    })
    expect(
      sqlite
        .prepare(
          "SELECT type FROM billingEvents WHERE id = 'rc:sandbox-event-1'",
        )
        .get(),
    ).toEqual({ type: 'revenuecat-sandbox:INITIAL_PURCHASE' })
  })

  it('grants once a UTC day per account: the day’s renewals give no songs', async () => {
    const reviewer = await phone()
    await deliver(sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'))
    const later = Date.now() + 2 * FIVE_MINUTES

    const renewal = await deliver(
      sandboxEvent(reviewer.userId, 'RENEWAL', {
        transaction_id: 'sandbox-renewal',
        expiration_at_ms: later,
      }),
    )

    expect(renewal).toEqual({
      received: true,
      sandbox: true,
      granted: 0,
      withheld: 'one a day',
    })
    expect(rowsOf(reviewer.userId).map((row) => row.delta)).toEqual([20, 0])
    expect(entitlementOf(reviewer.userId)?.expiresAt).toBe(
      new Date(later).toISOString(),
    )
    expect(budgetRecord().map((row) => row.songs)).toEqual([20])
  })

  it('grants again once the UTC day turns, whatever the hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T23:58:00.000Z'))
    const reviewer = await phone()
    await deliver(sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'))

    vi.setSystemTime(new Date('2026-10-02T00:02:00.000Z'))
    const renewal = await deliver(
      sandboxEvent(reviewer.userId, 'RENEWAL', { transaction_id: 'next-day' }),
    )

    expect(renewal).toMatchObject({ granted: 20 })
    expect(budgetRecord()).toEqual([
      { day: '2026-10-01', songs: 20 },
      { day: '2026-10-02', songs: 20 },
    ])
  })

  it('keeps to the rollover cap, which counts the sandbox’s songs', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const reviewer = await phone()
    const granted: unknown[] = []
    for (const day of [
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]) {
      vi.setSystemTime(new Date(`${day}T12:00:00.000Z`))
      const answer = await deliver(
        sandboxEvent(reviewer.userId, 'RENEWAL', { transaction_id: day }),
      )
      granted.push(answer.granted)
    }

    expect(granted).toEqual([20, 20, 10, 0])
    expect(balanceOf(reviewer.userId)).toBe(50)
  })

  it('never makes a paid period grant more than the cap allows', async () => {
    const singer = await phone()
    await deliver(sandboxEvent(singer.userId, 'INITIAL_PURCHASE'))

    const paid = await deliver(paidEvent(singer.userId, 'INITIAL_PURCHASE'))
    const again = await deliver(
      paidEvent(singer.userId, 'RENEWAL', { transaction_id: 'paid-2' }),
    )

    expect([paid.granted, again.granted]).toEqual([20, 10])
    expect(balanceOf(singer.userId)).toBe(50)
  })
})

describe('the day’s budget of sandbox songs', () => {
  it('refuses a grant that would pass it, and says so', async () => {
    env = { ...env, REVENUECAT_SANDBOX_DAILY_SONGS: '30' }
    const first = await phone()
    const second = await phone()

    const granted = await deliver(
      sandboxEvent(first.userId, 'INITIAL_PURCHASE'),
    )
    const refused = await deliver(
      sandboxEvent(second.userId, 'INITIAL_PURCHASE'),
    )

    expect(granted).toMatchObject({ granted: 20 })
    expect(refused).toEqual({
      received: true,
      sandbox: true,
      granted: 0,
      withheld: 'daily budget',
    })
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("today's 30 songs are given"),
    )
    // The period is recorded, for a refund to name, and the subscription
    // shows, with no songs.
    expect(rowsOf(second.userId)).toEqual([
      {
        reason: 'subscription-sandbox',
        delta: 0,
        jobRef: `sandbox-txn-${second.userId.slice(-6)}`,
      },
    ])
    expect(entitlementOf(second.userId)?.source).toBe(
      `revenuecat-sandbox:${PRODUCT}`,
    )
    expect(budgetRecord().map((row) => row.songs)).toEqual([20])
  })

  it('lets a grant use it to the last song', async () => {
    env = { ...env, REVENUECAT_SANDBOX_DAILY_SONGS: '40' }
    const answers: unknown[] = []
    for (let n = 0; n < 3; n += 1) {
      const reviewer = await phone()
      const answer = await deliver(
        sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'),
      )
      answers.push(answer.granted)
    }

    expect(answers).toEqual([20, 20, 0])
  })

  it('is 200 songs a day unless set, and set to 0 gives none', async () => {
    const answers: unknown[] = []
    for (let n = 0; n < 11; n += 1) {
      const reviewer = await phone()
      const answer = await deliver(
        sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'),
      )
      answers.push(answer.granted)
    }
    expect(answers).toEqual([20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 0])

    env = { ...env, REVENUECAT_SANDBOX_DAILY_SONGS: '0' }
    const none = await phone()
    expect(
      await deliver(sandboxEvent(none.userId, 'INITIAL_PURCHASE')),
    ).toMatchObject({ granted: 0, withheld: 'daily budget' })
  })

  it('starts again each UTC day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    env = { ...env, REVENUECAT_SANDBOX_DAILY_SONGS: '20' }
    vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'))
    const first = await phone()
    const second = await phone()
    await deliver(sandboxEvent(first.userId, 'INITIAL_PURCHASE'))
    const sameDay = await deliver(
      sandboxEvent(second.userId, 'INITIAL_PURCHASE'),
    )

    vi.setSystemTime(new Date('2026-10-02T12:00:00.000Z'))
    const nextDay = await deliver(
      sandboxEvent(second.userId, 'RENEWAL', { transaction_id: 'day-2' }),
    )

    expect([sameDay.granted, nextDay.granted]).toEqual([0, 20])
  })

  it('still counts the songs of an account that was deleted', async () => {
    env = { ...env, REVENUECAT_SANDBOX_DAILY_SONGS: '20' }
    const first = await phone()
    const second = await phone()
    await deliver(sandboxEvent(first.userId, 'INITIAL_PURCHASE'))

    const deleted = await call('/api/auth/me', {
      method: 'DELETE',
      token: first.token,
      ip: '203.0.113.9',
    })
    expect(deleted.status).toBe(200)
    expect(rowsOf(first.userId)).toEqual([])

    expect(
      await deliver(sandboxEvent(second.userId, 'INITIAL_PURCHASE')),
    ).toMatchObject({ granted: 0, withheld: 'daily budget' })
  })

  it('gives its last songs to one account when two ask at once', async () => {
    env = {
      ...env,
      DB: interleaved(new SqliteD1Database(sqlite)),
      REVENUECAT_SANDBOX_DAILY_SONGS: '20',
    }
    const first = await phone()
    const second = await phone()

    const answers = await Promise.all([
      deliver(sandboxEvent(first.userId, 'INITIAL_PURCHASE')),
      deliver(sandboxEvent(second.userId, 'INITIAL_PURCHASE')),
    ])

    expect(answers.map((answer) => answer.granted).sort()).toEqual([0, 20])
    expect(budgetRecord().map((row) => row.songs)).toEqual([20])
    expect(balanceOf(first.userId) + balanceOf(second.userId)).toBe(20)
  })

  it('keeps one grant a day to an account whose renewals arrive at once', async () => {
    env = { ...env, DB: interleaved(new SqliteD1Database(sqlite)) }
    const reviewer = await phone()

    const answers = await Promise.all([
      deliver(sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE')),
      deliver(
        sandboxEvent(reviewer.userId, 'RENEWAL', { transaction_id: 'twin' }),
      ),
    ])

    expect(answers.map((answer) => answer.granted).sort()).toEqual([0, 20])
    expect(balanceOf(reviewer.userId)).toBe(20)
  })

  it('is counted in a record that names no account', () => {
    const columns = sqlite
      .prepare("SELECT name FROM pragma_table_info('revenuecatSandboxGrants')")
      .all()
      .map((column) => column.name)

    expect(columns).toEqual(['grantId', 'day', 'songs', 'createdAt'])
  })
})

describe('the rest of a sandbox subscription, on production', () => {
  it('ends with its EXPIRATION, and the songs stay', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'))
    const reviewer = await phone()
    await deliver(
      sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE', {
        expiration_at_ms: Date.parse('2026-10-01T12:05:00.000Z'),
      }),
    )

    // The store says when it ended, which may be after the period's end.
    vi.setSystemTime(new Date('2026-10-01T12:10:00.000Z'))
    const answer = await deliver(
      sandboxEvent(reviewer.userId, 'EXPIRATION', {
        expiration_at_ms: Date.parse('2026-10-01T12:06:00.000Z'),
      }),
    )

    expect(answer).toEqual({ received: true, sandbox: true })
    expect(entitlementOf(reviewer.userId)).toEqual({
      source: `revenuecat-sandbox:${PRODUCT}`,
      expiresAt: '2026-10-01T12:06:00.000Z',
    })
    expect(await appSongs(reviewer)).toMatchObject({
      subscribed: false,
      left: 20,
    })
  })

  it('gives back its songs with a refund, and ends', async () => {
    const reviewer = await phone()
    await deliver(sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'))

    const refunded = await deliver(
      sandboxEvent(reviewer.userId, 'CANCELLATION', {
        cancel_reason: 'CUSTOMER_SUPPORT',
      }),
    )

    expect(refunded).toEqual({ received: true, sandbox: true, clawedBack: 20 })
    expect(await appSongs(reviewer)).toMatchObject({
      subscribed: false,
      left: 0,
    })
  })

  it('gets them back when the store reverses the refund', async () => {
    const reviewer = await phone()
    await deliver(sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'))
    await deliver(
      sandboxEvent(reviewer.userId, 'CANCELLATION', {
        cancel_reason: 'CUSTOMER_SUPPORT',
      }),
    )

    const reversed = await deliver(
      sandboxEvent(reviewer.userId, 'REFUND_REVERSED'),
    )

    expect(reversed).toEqual({ received: true, sandbox: true, restored: 20 })
    expect(await appSongs(reviewer)).toMatchObject({
      subscribed: true,
      left: 20,
    })
    expect(entitlementOf(reviewer.userId)?.source).toBe(
      `revenuecat-sandbox:${PRODUCT}`,
    )
  })

  it('keeps them when the reversal arrives before the refund', async () => {
    const reviewer = await phone()
    await deliver(sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'))

    await deliver(sandboxEvent(reviewer.userId, 'REFUND_REVERSED'))
    const refunded = await deliver(
      sandboxEvent(reviewer.userId, 'CANCELLATION', {
        cancel_reason: 'CUSTOMER_SUPPORT',
      }),
    )

    expect(refunded).toMatchObject({ clawedBack: 0, reversedAlready: true })
    expect(await appSongs(reviewer)).toMatchObject({
      subscribed: true,
      left: 20,
    })
  })

  it('moves to the account it is transferred to, still the sandbox’s', async () => {
    const reviewer = await phone()
    const signedIn = '00000000-0000-4000-8000-00000000ac01'
    account(signedIn)
    await deliver(sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'))

    const moved = await deliver(
      sandboxEvent(signedIn, 'TRANSFER', {
        transferred_from: [reviewer.userId],
        transferred_to: [signedIn],
      }),
    )

    expect(moved).toEqual({ received: true, sandbox: true, moved: 20 })
    expect(entitlementOf(reviewer.userId)).toBeUndefined()
    expect(entitlementOf(signedIn)?.source).toBe(
      `revenuecat-sandbox:${PRODUCT}`,
    )
    expect(rowsOf(signedIn).filter((row) => row.delta !== 0)).toEqual([
      {
        reason: 'subscription-sandbox-transfer-in',
        delta: 20,
        jobRef: reviewer.userId,
      },
    ])

    // A refund on the account takes the moved songs back, as for paid ones.
    const refunded = await deliver(
      sandboxEvent(signedIn, 'CANCELLATION', {
        cancel_reason: 'CUSTOMER_SUPPORT',
      }),
    )
    expect(refunded).toMatchObject({ clawedBack: 20 })
    expect(balanceOf(signedIn)).toBe(0)
  })

  it('acknowledges every other event and changes nothing', async () => {
    const reviewer = await phone()
    await deliver(sandboxEvent(reviewer.userId, 'INITIAL_PURCHASE'))
    const before = {
      rows: rowsOf(reviewer.userId),
      entitlement: entitlementOf(reviewer.userId),
    }

    for (const type of [
      'BILLING_ISSUE',
      'UNCANCELLATION',
      'PRODUCT_CHANGE',
      'SUBSCRIPTION_PAUSED',
      'SUBSCRIPTION_EXTENDED',
      'NON_RENEWING_PURCHASE',
      'TEMPORARY_ENTITLEMENT_GRANT',
      'TEST',
    ]) {
      expect(await deliver(sandboxEvent(reviewer.userId, type)), type).toEqual({
        received: true,
        sandbox: true,
        ignored: type,
      })
    }
    expect(
      await deliver(
        sandboxEvent(reviewer.userId, 'CANCELLATION', {
          cancel_reason: 'UNSUBSCRIBE',
        }),
      ),
    ).toEqual({ received: true, sandbox: true, ignored: 'CANCELLATION' })
    expect(
      await deliver(
        sandboxEvent(reviewer.userId, 'RENEWAL', {
          entitlement_ids: ['another'],
        }),
      ),
    ).toEqual({ received: true, sandbox: true, ignored: 'another entitlement' })

    expect({
      rows: rowsOf(reviewer.userId),
      entitlement: entitlementOf(reviewer.userId),
    }).toEqual(before)
  })
})

describe('a sandbox event beside a paid subscription', () => {
  // A paid subscriber may buy in the sandbox too, from a test build: the
  // sandbox's events never take a paid period's songs or end a paid
  // subscription.
  async function paidThenSandbox(): Promise<Phone> {
    const singer = await phone()
    await deliver(paidEvent(singer.userId, 'INITIAL_PURCHASE'))
    await deliver(sandboxEvent(singer.userId, 'INITIAL_PURCHASE'))
    return singer
  }

  it('keeps the paid entitlement, which ends later', async () => {
    const singer = await paidThenSandbox()

    expect(entitlementOf(singer.userId)?.source).toBe(`revenuecat:${PRODUCT}`)
    expect(balanceOf(singer.userId)).toBe(40)
  })

  it('refunds only the sandbox’s songs, and leaves the paid subscription on', async () => {
    const singer = await paidThenSandbox()

    const refunded = await deliver(
      sandboxEvent(singer.userId, 'CANCELLATION', {
        cancel_reason: 'CUSTOMER_SUPPORT',
        transaction_id: 'a-transaction-nobody-knows',
      }),
    )

    expect(refunded).toMatchObject({ clawedBack: 20 })
    expect(rowsOf(singer.userId).at(-1)).toMatchObject({
      reason: 'subscription-refund',
      delta: -20,
    })
    expect(await appSongs(singer)).toMatchObject({
      subscribed: true,
      left: 20,
    })
    expect(entitlementOf(singer.userId)?.source).toBe(`revenuecat:${PRODUCT}`)
  })

  it('takes nothing when there is no sandbox period at all', async () => {
    const singer = await phone()
    await deliver(paidEvent(singer.userId, 'INITIAL_PURCHASE'))
    const paid = entitlementOf(singer.userId)

    const refunded = await deliver(
      sandboxEvent(singer.userId, 'CANCELLATION', {
        cancel_reason: 'CUSTOMER_SUPPORT',
      }),
    )
    const expired = await deliver(
      sandboxEvent(singer.userId, 'EXPIRATION', {
        expiration_at_ms: Date.now() + 40 * 86_400_000,
      }),
    )

    expect(refunded).toMatchObject({ clawedBack: 0 })
    expect(expired).toEqual({ received: true, sandbox: true })
    expect(entitlementOf(singer.userId)).toEqual(paid)
    expect(await appSongs(singer)).toMatchObject({
      subscribed: true,
      left: 20,
    })
  })

  it('gives back only a sandbox refund’s songs when the sandbox reverses it', async () => {
    const singer = await phone()
    await deliver(paidEvent(singer.userId, 'INITIAL_PURCHASE'))
    await deliver(
      paidEvent(singer.userId, 'CANCELLATION', {
        cancel_reason: 'CUSTOMER_SUPPORT',
      }),
    )
    await deliver(sandboxEvent(singer.userId, 'INITIAL_PURCHASE'))

    const reversed = await deliver(
      sandboxEvent(singer.userId, 'REFUND_REVERSED', {
        transaction_id: 'a-transaction-nobody-knows',
      }),
    )

    expect(reversed).toMatchObject({ restored: 0 })
    expect(balanceOf(singer.userId)).toBe(20)
  })

  it('lets a paid refund take the paid period’s songs, never the sandbox’s', async () => {
    const singer = await phone()
    await deliver(paidEvent(singer.userId, 'INITIAL_PURCHASE'))
    await deliver(sandboxEvent(singer.userId, 'INITIAL_PURCHASE'))

    // RevenueCat names the transaction; one it does not name is the latest
    // paid period's.
    const refunded = await deliver(
      paidEvent(singer.userId, 'CANCELLATION', {
        cancel_reason: 'CUSTOMER_SUPPORT',
        transaction_id: undefined,
      }),
    )

    expect(refunded).toMatchObject({ clawedBack: 20 })
    expect(rowsOf(singer.userId).at(-1)).toEqual({
      reason: 'subscription-refund',
      delta: -20,
      jobRef: 'rc:sandbox-event-1',
    })
    expect(balanceOf(singer.userId)).toBe(20)
  })

  it('does not move a paid entitlement with a sandbox transfer', async () => {
    const singer = await phone()
    const signedIn = '00000000-0000-4000-8000-00000000ac02'
    account(signedIn)
    await deliver(paidEvent(singer.userId, 'INITIAL_PURCHASE'))

    const moved = await deliver(
      sandboxEvent(signedIn, 'TRANSFER', {
        transferred_from: [singer.userId],
        transferred_to: [signedIn],
      }),
    )

    expect(moved).toEqual({ received: true, sandbox: true, moved: 0 })
    expect(entitlementOf(singer.userId)?.source).toBe(`revenuecat:${PRODUCT}`)
    expect(entitlementOf(signedIn)).toBeUndefined()
    expect([balanceOf(singer.userId), balanceOf(signedIn)]).toEqual([20, 0])
  })

  it('keeps the sandbox’s mark on songs a paid transfer moves', async () => {
    const singer = await phone()
    const signedIn = '00000000-0000-4000-8000-00000000ac04'
    account(signedIn)
    await deliver(sandboxEvent(singer.userId, 'INITIAL_PURCHASE'))
    await deliver(paidEvent(singer.userId, 'INITIAL_PURCHASE'))

    const moved = await deliver(
      paidEvent(signedIn, 'TRANSFER', {
        transferred_from: [singer.userId],
        transferred_to: [signedIn],
      }),
    )

    expect(moved).toEqual({ received: true, moved: 40 })
    expect(rowsOf(signedIn).filter((row) => row.delta !== 0)).toEqual([
      {
        reason: 'subscription-sandbox-transfer-in',
        delta: 20,
        jobRef: singer.userId,
      },
      { reason: 'subscription-transfer-in', delta: 20, jobRef: singer.userId },
    ])

    // A sandbox refund on the account takes the sandbox's songs only.
    const refunded = await deliver(
      sandboxEvent(signedIn, 'CANCELLATION', {
        cancel_reason: 'CUSTOMER_SUPPORT',
      }),
    )
    expect(refunded).toMatchObject({ clawedBack: 20 })
    expect(balanceOf(signedIn)).toBe(20)
  })

  it('moves only the sandbox’s songs, and leaves the rest for a paid transfer', async () => {
    const singer = await phone()
    const signedIn = '00000000-0000-4000-8000-00000000ac03'
    account(signedIn)
    await deliver(paidEvent(singer.userId, 'INITIAL_PURCHASE'))
    await deliver(sandboxEvent(singer.userId, 'INITIAL_PURCHASE'))
    credits(singer.userId, 5, 'bought-on-the-web')

    const sandboxMove = await deliver(
      sandboxEvent(signedIn, 'TRANSFER', {
        transferred_from: [singer.userId],
        transferred_to: [signedIn],
      }),
    )

    expect(sandboxMove).toEqual({ received: true, sandbox: true, moved: 20 })
    expect([balanceOf(singer.userId), balanceOf(signedIn)]).toEqual([25, 20])
    expect(rowsOf(signedIn)).toEqual([
      {
        reason: 'subscription-sandbox-transfer-in',
        delta: 20,
        jobRef: singer.userId,
      },
    ])
    expect(await appSongs(singer)).toMatchObject({ left: 20 })

    const paidMove = await deliver(
      paidEvent(signedIn, 'TRANSFER', {
        transferred_from: [singer.userId],
        transferred_to: [signedIn],
      }),
    )

    expect(paidMove).toEqual({ received: true, moved: 25 })
    expect([balanceOf(singer.userId), balanceOf(signedIn)]).toEqual([0, 45])
    expect(rowsOf(signedIn).slice(1)).toEqual([
      { reason: 'subscription-transfer-in', delta: 20, jobRef: singer.userId },
      { reason: 'transfer-in', delta: 5, jobRef: singer.userId },
    ])
    expect(entitlementOf(signedIn)?.source).toBe(`revenuecat:${PRODUCT}`)
  })
})
