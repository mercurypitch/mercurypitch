// @vitest-environment node
//
// ── The native app's launch gift (S7b E6) ────────────────────────────
//
// An account made in the native app while the launch promo runs gets songs
// of its own to spend there: a separate ledger grant (reason app-gift), never
// a code anybody types (App Review 3.1.1), and never the web's credits (S7
// D9). It rides on the featured code's claim (launch-offer.ts), in the same
// batch as the claim's own writes, so it inherits the claim's guards: once
// per account, once per address even after the account is deleted, and not
// once the code is closed or full. APP_GIFT_SONGS says how many; unset, the
// gift is off.
//
// "Made in the app" is the request that creates the account arriving from a
// Capacitor origin (capacitor://localhost on iOS, https://localhost on
// Android). Signing in to an account made elsewhere, or confirming one, is
// not a sign-up and grants nothing.
//
// The featured code is the test's own (LAUNCH_TEST, open until 2099), so the
// suite does not start failing the day the real campaign closes.
//
// Real SQLite with every migration applied, through the worker's own fetch.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import { resetAppleJwksCache } from '../src/apple-auth'
import type { Env } from '../src/auth'
import worker from '../src/index'
import type { PromoRow } from '../src/promo-claim'
import { claimPromo } from '../src/promo-claim'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const IOS = 'capacitor://localhost'
const ANDROID = 'https://localhost'
const WEB = 'http://localhost'
const SECRET = 'app-gift-integration-key-0123456789abcdef'
const PROMO_ID = 'promo-app-gift-test'
const PROMO_ENDS = '2099-01-01T00:00:00.000Z'
const APPLE_CLIENT = 'com.irchiinnuss.mercurypitch'
const GOOGLE_CLIENT = 'app-gift-test.apps.googleusercontent.com'
const KEY_ID = 'APPGIFTKID'
const DEVICE = '00000000-0000-4000-8000-00000000a6f1'
const DEVICE_SECRET = 'ag1Aa2Bb3Cc4Dd5Ee6Ff7Gg8Hh9Ii0Jj1Kk2Ll3Mm4'
const PASSWORD = 'Singer123!pass'

const encoder = new TextEncoder()

let sqlite: DatabaseSync
let perksSqlite: DatabaseSync
let env: Env
let signing: CryptoKeyPair
let publicJwk: JsonWebKey
const logged: string[] = []

interface Call {
  method?: string
  token?: string
  origin?: string
  body?: unknown
}

function call(path: string, init: Call = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (init.token !== undefined) headers.Authorization = `Bearer ${init.token}`
  if (init.origin !== undefined) headers.Origin = init.origin
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  return worker.fetch(
    new Request(`https://api.test${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers,
      redirect: 'manual',
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    }),
    env,
    {} as ExecutionContext,
  )
}

interface Session {
  userId: string
  token: string
  isNew: boolean
}

async function session(response: Response): Promise<Session> {
  expect(response.status).toBe(200)
  const body = (await response.json()) as Session
  return { userId: body.userId, token: body.token, isNew: body.isNew }
}

// ── Sign-in and sign-up, as the app and the web make them ──

/** Read a mailed code back from the log line the worker writes without Resend. */
function lastCode(kind: 'sign-in' | 'sign-up'): string {
  const pattern = new RegExp(`${kind} code \\(email skipped[^)]*\\): (\\d{6})`)
  const codes = logged.flatMap((line) => {
    const match = pattern.exec(line)
    return match ? [match[1] as string] : []
  })
  const code = codes[codes.length - 1]
  if (code === undefined) throw new Error(`no ${kind} code was logged`)
  return code
}

/** Ask for a mailed code and type it back, from `origin`. */
async function withCode(
  email: string,
  kind: 'sign-in' | 'sign-up',
  origin?: string,
): Promise<Session> {
  const asked = await call('/api/auth/email-code/request', {
    body: { email, signUp: kind === 'sign-up' },
    origin,
  })
  expect(asked.status).toBe(200)
  const { ceremony } = (await asked.json()) as { ceremony: unknown }
  return session(
    await call('/api/auth/email-code/verify', {
      body: { ceremony, code: lastCode(kind) },
      origin,
    }),
  )
}

/** A password account made on the web, its email not confirmed. */
async function registerOnTheWeb(email: string): Promise<Session> {
  return session(
    await call('/api/auth/register', {
      body: { email, password: PASSWORD },
      origin: WEB,
    }),
  )
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function segment(value: object): string {
  return b64url(encoder.encode(JSON.stringify(value)))
}

/** An Apple identity token, signed with the key the stubbed JWKS serves. */
async function appleToken(sub: string, email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = segment({ alg: 'RS256', kid: KEY_ID })
  const payload = segment({
    iss: 'https://appleid.apple.com',
    aud: APPLE_CLIENT,
    sub,
    iat: now,
    exp: now + 600,
    email,
    email_verified: 'true',
    is_private_email: 'false',
  })
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    signing.privateKey,
    encoder.encode(`${header}.${payload}`),
  )
  return `${header}.${payload}.${b64url(signature)}`
}

async function withApple(
  sub: string,
  email: string,
  origin?: string,
  device?: { deviceId: string; deviceSecret: string },
): Promise<Session> {
  return session(
    await call('/api/auth/apple', {
      body: { identityToken: await appleToken(sub, email), ...device },
      origin,
    }),
  )
}

/** Google's tokeninfo answers for every `google:<sub>:<email>` token. */
async function withGoogle(
  sub: string,
  email: string,
  origin?: string,
): Promise<Session> {
  return session(
    await call('/api/auth/google', {
      body: { idToken: `google:${sub}:${email}` },
      origin,
    }),
  )
}

/** Apple's keys and Google's tokeninfo, and nothing else on the network. */
function stubProviders(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url
      if (url === 'https://appleid.apple.com/auth/keys') {
        return Response.json({
          keys: [
            {
              kty: 'RSA',
              kid: KEY_ID,
              use: 'sig',
              alg: 'RS256',
              n: publicJwk.n,
              e: publicJwk.e,
            },
          ],
        })
      }
      if (url === 'https://www.googleapis.com/oauth2/v3/tokeninfo') {
        const idToken = new URLSearchParams(String(init?.body)).get('id_token')
        const [, sub, email] = (idToken ?? '').split(':')
        return Response.json({
          aud: GOOGLE_CLIENT,
          sub,
          email,
          email_verified: 'true',
        })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }),
  )
}

// ── What the account holds ──

/** The account's app-gift songs and web launch credits, as the ledger has them. */
function grantsOf(userId: string): { gift: number; promo: number } {
  const total = (reason: string): number =>
    (
      sqlite
        .prepare(
          'SELECT COALESCE(SUM(delta), 0) AS total FROM creditLedger WHERE userId = ? AND reason = ?',
        )
        .get(userId, reason) as { total: number }
    ).total
  return { gift: total('app-gift'), promo: total('promo') }
}

interface Me {
  creditBalance: number
  songs: Record<string, unknown>
}

async function me(token: string, origin?: string): Promise<Me> {
  const response = await call('/api/billing/me', { token, origin })
  expect(response.status).toBe(200)
  return (await response.json()) as Me
}

/** The GPU tier at one credit a song, as dev prices it. */
function priceTheGpu(): void {
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO pricingPlans
         (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active)
       VALUES ('tier-runpod-gpu', ?, ?, 'tier', 'Cloud GPU', '', 'song', NULL, 'eur', 1, NULL, NULL, 2, 1)`,
    )
    .run(now, now)
}

function debitFromTheApp(token: string, jobRef: string): Promise<Response> {
  return call('/api/billing/debit', {
    token,
    origin: IOS,
    body: { tier: 'gpu', model: 'roformer', jobRef },
  })
}

function seedFeaturedPromo(overrides: Record<string, unknown> = {}): void {
  const row = {
    maxRedemptions: null,
    redemptionCount: 0,
    expiresAt: PROMO_ENDS,
    active: 1,
    ...overrides,
  }
  sqlite.exec("UPDATE promoCodes SET featured = 0 WHERE id = 'promo-2026-q4'")
  sqlite
    .prepare(
      `INSERT INTO promoCodes
         (id, code, credits, maxRedemptions, redemptionCount, startsAt, expiresAt, active, featured, createdAt, updatedAt)
       VALUES (?, 'LAUNCH_TEST', 5, ?, ?, NULL, ?, ?, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(
      PROMO_ID,
      row.maxRedemptions as number | null,
      row.redemptionCount as number,
      row.expiresAt as string,
      row.active as number,
    )
}

function freshDatabase(overrides: Partial<Env> = {}): void {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  // Deleting an account purges email-keyed perk grants first.
  perksSqlite = new DatabaseSync(':memory:')
  perksSqlite.exec(
    'CREATE TABLE perkGrants (email TEXT, perkId TEXT, revokedAt TEXT)',
  )
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    PERKS_DB: new SqliteD1Database(perksSqlite) as unknown as D1Database,
    JWT_SECRET: 'app-gift-integration-jwt',
    // As dev lists them: a local web origin (which also lets the Turnstile
    // gate by with no secret), and the app's two origins.
    ALLOWED_ORIGINS: `${WEB},${IOS},${ANDROID}`,
    FREE_SONG_EMAIL_SECRET: SECRET,
    APPLE_CLIENT_IDS: APPLE_CLIENT,
    GOOGLE_CLIENT_IDS: GOOGLE_CLIENT,
    APP_GIFT_SONGS: '5',
    ...overrides,
  }
  seedFeaturedPromo()
  priceTheGpu()
  resetAppleJwksCache()
  stubProviders()
}

beforeAll(async () => {
  signing = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  publicJwk = (await crypto.subtle.exportKey(
    'jwk',
    signing.publicKey,
  )) as JsonWebKey
})

beforeEach(() => {
  logged.length = 0
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '))
  })
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  sqlite.close()
  perksSqlite.close()
})

describe('an account made in the app gets the launch gift', () => {
  beforeEach(() => freshDatabase())

  it('from a sign-up code typed in the app, beside the web launch credits', async () => {
    const singer = await withCode('coded@example.com', 'sign-up', IOS)

    expect(singer.isNew).toBe(true)
    expect(grantsOf(singer.userId)).toEqual({ gift: 5, promo: 5 })
  })

  it('from Sign in with Apple making the account on an iPhone', async () => {
    const singer = await withApple('apple-sub-1', 'apple@example.com', IOS)

    expect(singer.isNew).toBe(true)
    expect(grantsOf(singer.userId)).toEqual({ gift: 5, promo: 5 })
  })

  it('from Google making the account on an Android phone', async () => {
    const singer = await withGoogle(
      'google-sub-1',
      'google@example.com',
      ANDROID,
    )

    expect(singer.isNew).toBe(true)
    expect(grantsOf(singer.userId)).toEqual({ gift: 5, promo: 5 })
  })

  it("from Apple turning the phone's anonymous identity into an account", async () => {
    const anonymous = await session(
      await call('/api/auth/anonymous', {
        body: { deviceId: DEVICE, deviceSecret: DEVICE_SECRET },
        origin: IOS,
      }),
    )

    const singer = await withApple('apple-sub-2', 'upgrade@example.com', IOS, {
      deviceId: DEVICE,
      deviceSecret: DEVICE_SECRET,
    })

    expect(singer.userId).toBe(anonymous.userId)
    expect(singer.isNew).toBe(true)
    expect(grantsOf(singer.userId)).toEqual({ gift: 5, promo: 5 })
  })

  it('once: signing in again in the app grants nothing more', async () => {
    const first = await withApple('apple-sub-3', 'again@example.com', IOS)
    const second = await withApple('apple-sub-3', 'again@example.com', IOS)

    expect(second.userId).toBe(first.userId)
    expect(second.isNew).toBe(false)
    expect(grantsOf(first.userId)).toEqual({ gift: 5, promo: 5 })
  })
})

describe('the launch gift is never', () => {
  beforeEach(() => freshDatabase())

  it('for an account made on the web, which keeps the web launch credits', async () => {
    const byCode = await withCode('web-coded@example.com', 'sign-up', WEB)
    const byGoogle = await withGoogle(
      'google-sub-web',
      'web-google@example.com',
    )

    expect(grantsOf(byCode.userId)).toEqual({ gift: 0, promo: 5 })
    expect(grantsOf(byGoogle.userId)).toEqual({ gift: 0, promo: 5 })
  })

  it('for signing in to an account made on the web', async () => {
    const made = await withCode('made-on-web@example.com', 'sign-up', WEB)

    const signedIn = await withCode('made-on-web@example.com', 'sign-in', IOS)

    expect(signedIn.userId).toBe(made.userId)
    expect(grantsOf(made.userId)).toEqual({ gift: 0, promo: 5 })
  })

  it('for confirming, in the app, an account made on the web', async () => {
    const made = await registerOnTheWeb('unconfirmed@example.com')
    expect(grantsOf(made.userId)).toEqual({ gift: 0, promo: 0 })

    // Typing a mailed code proves the inbox, which claims the web credits.
    const signedIn = await withCode('unconfirmed@example.com', 'sign-in', IOS)

    expect(signedIn.userId).toBe(made.userId)
    expect(grantsOf(made.userId)).toEqual({ gift: 0, promo: 5 })
  })

  it('again for an address that had it on an account since deleted', async () => {
    const first = await withCode('twice@example.com', 'sign-up', IOS)
    expect(grantsOf(first.userId).gift).toBe(5)
    const deleted = await call('/api/auth/me', {
      method: 'DELETE',
      token: first.token,
      origin: IOS,
    })
    expect(deleted.status).toBe(200)

    const second = await withCode('twice@example.com', 'sign-up', IOS)

    expect(second.userId).not.toBe(first.userId)
    expect(grantsOf(second.userId)).toEqual({ gift: 0, promo: 0 })
  })

  it('from typing the featured code, even in the app', async () => {
    const made = await registerOnTheWeb('typed@example.com')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(made.userId)

    const redeemed = await call('/api/billing/promo/redeem', {
      token: made.token,
      origin: IOS,
      body: { code: 'LAUNCH_TEST' },
    })

    expect(redeemed.status).toBe(200)
    expect(grantsOf(made.userId)).toEqual({ gift: 0, promo: 5 })
  })

  it.each([
    ['unset', undefined],
    ['zero', '0'],
    ['not a number', 'five'],
    ['a fraction', '2.5'],
    ['negative', '-5'],
    ['over ten', '50'],
  ])('while APP_GIFT_SONGS is %s', async (_, songs) => {
    sqlite.close()
    perksSqlite.close()
    freshDatabase({ APP_GIFT_SONGS: songs })

    const singer = await withApple('apple-sub-off', 'off@example.com', IOS)

    expect(grantsOf(singer.userId)).toEqual({ gift: 0, promo: 5 })
  })

  it.each([
    ['closed', { expiresAt: '2020-01-01T00:00:00.000Z' }],
    ['full', { maxRedemptions: 1, redemptionCount: 1 }],
    ['switched off', { active: 0 }],
  ])('once the featured code is %s', async (_, overrides) => {
    sqlite.exec(`DELETE FROM promoCodes WHERE id = '${PROMO_ID}'`)
    seedFeaturedPromo(overrides)

    const singer = await withApple(
      'apple-sub-closed',
      'closed@example.com',
      IOS,
    )

    expect(grantsOf(singer.userId)).toEqual({ gift: 0, promo: 0 })
  })

  it('without the claim: a code that filled up after it was read grants neither', async () => {
    const made = await registerOnTheWeb('raced@example.com')
    const stale: PromoRow = {
      id: PROMO_ID,
      code: 'LAUNCH_TEST',
      credits: 5,
      maxRedemptions: 1,
      redemptionCount: 0,
      startsAt: null,
      expiresAt: PROMO_ENDS,
      active: 1,
    }
    sqlite.exec(
      `UPDATE promoCodes SET maxRedemptions = 1, redemptionCount = 1 WHERE id = '${PROMO_ID}'`,
    )

    const outcome = await claimPromo(
      env,
      stale,
      { userId: made.userId, email: 'raced@example.com' },
      new Date(),
      5,
    )

    expect(outcome).toBe('full')
    expect(grantsOf(made.userId)).toEqual({ gift: 0, promo: 0 })
  })
})

describe('the app spends the launch gift', () => {
  beforeEach(() => freshDatabase())

  it("after the month's free song, and reports it", async () => {
    const singer = await withCode('spender@example.com', 'sign-up', IOS)
    expect((await me(singer.token, IOS)).songs).toMatchObject({
      left: 6,
      free: 1,
      gift: 5,
    })

    expect((await debitFromTheApp(singer.token, 'job-1')).status).toBe(200)
    expect((await me(singer.token, IOS)).songs).toMatchObject({
      left: 5,
      free: 0,
      gift: 5,
    })

    expect((await debitFromTheApp(singer.token, 'job-2')).status).toBe(200)
    expect((await me(singer.token, IOS)).songs).toMatchObject({
      left: 4,
      free: 0,
      gift: 4,
    })
  })

  it('while the web counts it among the songs it spends after its own credits', async () => {
    const singer = await withCode('both@example.com', 'sign-up', IOS)

    const web = await me(singer.token, WEB)

    expect(web.creditBalance).toBe(10)
    expect(web.songs).not.toHaveProperty('gift')
  })
})

describe('GET /api/billing/promo/featured says whether the app gift is live', () => {
  async function featured(): Promise<Record<string, unknown>> {
    const response = await call('/api/billing/promo/featured')
    expect(response.status).toBe(200)
    return (await response.json()) as Record<string, unknown>
  }

  it('with its songs and the day the featured code ends', async () => {
    freshDatabase()

    expect((await featured()).appGift).toEqual({ songs: 5, endsAt: PROMO_ENDS })
  })

  it('as null while APP_GIFT_SONGS is unset', async () => {
    freshDatabase({ APP_GIFT_SONGS: undefined })

    const body = await featured()

    expect(body.appGift).toBeNull()
    expect(body.promo).not.toBeNull()
  })

  it('as null once the featured code is closed', async () => {
    freshDatabase()
    sqlite.exec(
      `UPDATE promoCodes SET expiresAt = '2020-01-01T00:00:00.000Z' WHERE id = '${PROMO_ID}'`,
    )

    const body = await featured()

    expect(body.appGift).toBeNull()
    expect(body.promo).toBeNull()
  })
})
