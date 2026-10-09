// @vitest-environment node
//
// ── The launch gift, claimed when an email is confirmed ──────────────
//
// While a promo code is featured, an account claims it the moment its email
// is confirmed, however that happens: the confirm link, a mailed code, a
// password reset, or Google and Apple creating the account (launch-offer.ts,
// owner decision D2). This file pins who gets it and who does not: never an
// unconfirmed or anonymous account, never a managed tester, never twice, never
// once the code is closed or full, and never again for an address that had it
// on an account since deleted. A claim that fails must never fail the sign-in
// it rides on.
//
// The featured code here is the test's own (LAUNCH_TEST, open until 2099), so
// the suite does not start failing the day the real campaign closes; the real
// LAUNCH row is unfeatured for every test.
//
// Real SQLite with every migration applied, through the worker's own fetch.

import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import { resolveFederatedUser } from '../src/auth'
import worker from '../src/index'
import { claimLaunchGift } from '../src/launch-offer'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const SECRET = 'launch-gift-integration-key-0123456789abc'
const PASSWORD = 'Singer123!pass'
const PROMO_ID = 'promo-launch-test'
const NEW_PASSWORD = 'Another456!pass'
const MAIL = {
  appOrigin: 'http://localhost',
  voiceprint: null,
  signupSource: null,
}

let sqlite: DatabaseSync
let perksSqlite: DatabaseSync
let env: Env
const logged: string[] = []

interface Call {
  method?: string
  token?: string
  body?: unknown
}

function call(path: string, init: Call = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (init.token !== undefined) headers.Authorization = `Bearer ${init.token}`
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

interface Singer {
  userId: string
  token: string
}

/** A new password account for `email`, its email not confirmed yet. */
async function register(email: string): Promise<Singer> {
  const response = await call('/api/auth/register', {
    body: { email, password: PASSWORD },
  })
  expect(response.status).toBe(200)
  const { userId, token } = (await response.json()) as Singer
  return { userId, token }
}

function sha256(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}

/** Open the confirm link for the account's address, as the mail's link does. */
async function openConfirmLink(singer: Singer, email: string): Promise<string> {
  const token = `confirm-${singer.userId}`
  sqlite
    .prepare(
      'INSERT INTO emailVerifications (tokenHash, userId, email, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      sha256(token),
      singer.userId,
      email,
      new Date().toISOString(),
      new Date(Date.now() + 60_000).toISOString(),
    )
  const response = await call(
    `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
  )
  expect(response.status).toBe(302)
  return response.headers.get('Location') ?? ''
}

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

/** Ask for a mailed code and type it back. */
async function signInWithCode(
  email: string,
  kind: 'sign-in' | 'sign-up',
): Promise<{ status: number; body: Record<string, unknown> }> {
  const asked = await call('/api/auth/email-code/request', {
    body: { email, signUp: kind === 'sign-up' },
  })
  expect(asked.status).toBe(200)
  const { ceremony } = (await asked.json()) as { ceremony: unknown }
  const response = await call('/api/auth/email-code/verify', {
    body: { ceremony, code: lastCode(kind) },
  })
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  }
}

async function deleteAccount(singer: Singer): Promise<void> {
  const response = await call('/api/auth/me', {
    method: 'DELETE',
    token: singer.token,
  })
  expect(response.status).toBe(200)
}

function seedFeaturedPromo(overrides: Record<string, unknown> = {}): void {
  const row = {
    maxRedemptions: null,
    redemptionCount: 0,
    startsAt: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
    active: 1,
    featured: 1,
    ...overrides,
  }
  sqlite.exec("UPDATE promoCodes SET featured = 0 WHERE id = 'promo-2026-q4'")
  sqlite
    .prepare(
      `INSERT INTO promoCodes
         (id, code, credits, maxRedemptions, redemptionCount, startsAt, expiresAt, active, featured, createdAt, updatedAt)
       VALUES (?, 'LAUNCH_TEST', 5, ?, ?, ?, ?, ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(
      PROMO_ID,
      row.maxRedemptions as number | null,
      row.redemptionCount as number,
      row.startsAt as string | null,
      row.expiresAt as string,
      row.active as number,
      row.featured as number,
    )
}

/** The account's claims of the test code, as the ledger and the slots hold them. */
function claimsOf(userId: string): { slots: number; credits: number } {
  const slots = sqlite
    .prepare(
      'SELECT COUNT(*) AS n FROM promoRedemptions WHERE promoCodeId = ? AND userId = ?',
    )
    .get(PROMO_ID, userId) as { n: number }
  const credits = sqlite
    .prepare(
      "SELECT COALESCE(SUM(delta), 0) AS total FROM creditLedger WHERE userId = ? AND reason = 'promo'",
    )
    .get(userId) as { total: number }
  return { slots: slots.n, credits: credits.total }
}

function redemptionCount(): number {
  const row = sqlite
    .prepare('SELECT redemptionCount FROM promoCodes WHERE id = ?')
    .get(PROMO_ID) as { redemptionCount: number }
  return row.redemptionCount
}

function emailVerified(userId: string): number {
  const row = sqlite
    .prepare('SELECT emailVerified FROM users WHERE id = ?')
    .get(userId) as { emailVerified: number }
  return row.emailVerified
}

beforeEach(() => {
  logged.length = 0
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '))
  })
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
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
    JWT_SECRET: 'launch-gift-integration-jwt',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY: 'launch-gift-integration-admin',
    FREE_SONG_EMAIL_SECRET: SECRET,
  }
  seedFeaturedPromo()
})

afterEach(() => {
  vi.restoreAllMocks()
  sqlite.close()
  perksSqlite.close()
})

describe('confirming an email claims the featured code', () => {
  it('claims it from the confirm link, and /me reports the claim', async () => {
    const singer = await register('linked@example.com')
    expect(claimsOf(singer.userId)).toEqual({ slots: 0, credits: 0 })

    const landing = await openConfirmLink(singer, 'linked@example.com')

    expect(landing).toMatch(/#everified=1$/)
    expect(emailVerified(singer.userId)).toBe(1)
    expect(claimsOf(singer.userId)).toEqual({ slots: 1, credits: 5 })
    expect(redemptionCount()).toBe(1)
    const me = await call('/api/billing/me', { token: singer.token })
    const body = (await me.json()) as {
      creditBalance: number
      redeemedPromos: string[]
      promoClaims: { code: string; credits: number; claimedAt: string }[]
    }
    expect(body.creditBalance).toBe(5)
    expect(body.redeemedPromos).toEqual(['LAUNCH_TEST'])
    expect(body.promoClaims).toEqual([
      { code: 'LAUNCH_TEST', credits: 5, claimedAt: expect.any(String) },
    ])
  })

  it('claims it when an unconfirmed account types a mailed sign-in code', async () => {
    const singer = await register('coded@example.com')

    const { status } = await signInWithCode('coded@example.com', 'sign-in')

    expect(status).toBe(200)
    expect(emailVerified(singer.userId)).toBe(1)
    expect(claimsOf(singer.userId)).toEqual({ slots: 1, credits: 5 })
  })

  it('claims it for the account a sign-up code creates', async () => {
    const { status, body } = await signInWithCode(
      'fresh@example.com',
      'sign-up',
    )

    expect(status).toBe(200)
    expect(claimsOf(body.userId as string)).toEqual({ slots: 1, credits: 5 })
  })

  it('claims it when a password reset proves an unconfirmed inbox', async () => {
    const singer = await register('reset@example.com')
    sqlite
      .prepare(
        'INSERT INTO passwordResets (tokenHash, userId, email, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        sha256('reset-token'),
        singer.userId,
        'reset@example.com',
        new Date().toISOString(),
        new Date(Date.now() + 60_000).toISOString(),
      )

    const response = await call('/api/auth/reset-password', {
      body: { token: 'reset-token', password: NEW_PASSWORD },
    })

    expect(response.status).toBe(200)
    expect(claimsOf(singer.userId)).toEqual({ slots: 1, credits: 5 })
  })

  it('claims it for a new Google account with a verified address', async () => {
    const { row, isNew } = await resolveFederatedUser(
      {
        provider: 'google',
        sub: 'google-sub-new',
        email: 'google@example.com',
        emailVerified: true,
        linkableByEmail: true,
      },
      undefined,
      env,
      MAIL,
    )

    expect(isNew).toBe(true)
    expect(claimsOf(row.id)).toEqual({ slots: 1, credits: 5 })
  })

  it("claims it when Google upgrades this device's anonymous account", async () => {
    const anon = await call('/api/auth/anonymous', {
      body: {
        deviceId: '5d2a7c11-0b3e-4f6a-9c8d-000000000101',
        deviceSecret: 'device-secret-aaaaaaaaaaaaaaaaaaaa',
      },
    })
    const { userId } = (await anon.json()) as { userId: string }

    const { row } = await resolveFederatedUser(
      {
        provider: 'google',
        sub: 'google-sub-upgrade',
        email: 'upgraded@example.com',
        emailVerified: true,
        linkableByEmail: true,
      },
      userId,
      env,
      MAIL,
    )

    expect(row.id).toBe(userId)
    expect(claimsOf(userId)).toEqual({ slots: 1, credits: 5 })
  })

  it('claims nothing for a provider address nobody has verified', async () => {
    const { row } = await resolveFederatedUser(
      {
        provider: 'google',
        sub: 'google-sub-unverified',
        email: 'unverified-google@example.com',
        emailVerified: false,
        linkableByEmail: true,
      },
      undefined,
      env,
      MAIL,
    )

    expect(claimsOf(row.id)).toEqual({ slots: 0, credits: 0 })
  })
})

describe('who does not get it', () => {
  it('gives nothing to an account that has not confirmed its email', async () => {
    const singer = await register('waiting@example.com')

    await claimLaunchGift(env, singer.userId)

    expect(claimsOf(singer.userId)).toEqual({ slots: 0, credits: 0 })
    const me = await call('/api/billing/me', { token: singer.token })
    const body = (await me.json()) as { promoClaims: unknown[] }
    expect(body.promoClaims).toEqual([])
  })

  it('gives nothing to an anonymous account', async () => {
    const anon = await call('/api/auth/anonymous', {
      body: {
        deviceId: '5d2a7c11-0b3e-4f6a-9c8d-000000000102',
        deviceSecret: 'device-secret-bbbbbbbbbbbbbbbbbbbb',
      },
    })
    const { userId } = (await anon.json()) as { userId: string }
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(userId)

    await claimLaunchGift(env, userId)

    expect(claimsOf(userId)).toEqual({ slots: 0, credits: 0 })
  })

  it('gives nothing to a managed testing account', async () => {
    const singer = await register('tester-to-be@example.com')
    sqlite
      .prepare('UPDATE users SET email = ?, emailVerified = 1 WHERE id = ?')
      .run('qa-1@testing.mercurypitch.com', singer.userId)

    await claimLaunchGift(env, singer.userId)

    expect(claimsOf(singer.userId)).toEqual({ slots: 0, credits: 0 })
  })

  it.each([
    ['ended', { expiresAt: '2020-01-01T00:00:00.000Z' }],
    ['not open yet', { startsAt: '2098-01-01T00:00:00.000Z' }],
    ['switched off', { active: 0 }],
    ['fully claimed', { maxRedemptions: 3, redemptionCount: 3 }],
    ['not featured', { featured: 0 }],
  ])('gives nothing while the code is %s', async (_state, overrides) => {
    sqlite.prepare('DELETE FROM promoCodes WHERE id = ?').run(PROMO_ID)
    seedFeaturedPromo(overrides)
    const singer = await register('closed@example.com')

    const landing = await openConfirmLink(singer, 'closed@example.com')

    expect(landing).toMatch(/#everified=1$/)
    expect(claimsOf(singer.userId)).toEqual({ slots: 0, credits: 0 })
  })

  it('claims once, however many times the inbox is proved', async () => {
    const singer = await register('twice@example.com')
    await openConfirmLink(singer, 'twice@example.com')
    await claimLaunchGift(env, singer.userId)
    await signInWithCode('twice@example.com', 'sign-in')

    expect(claimsOf(singer.userId)).toEqual({ slots: 1, credits: 5 })
    expect(redemptionCount()).toBe(1)
  })
})

describe('an address that had it on a deleted account', () => {
  it('claims nothing on the new account, and the Claim card says why', async () => {
    const first = await register('again@example.com')
    await openConfirmLink(first, 'again@example.com')
    await deleteAccount(first)

    const second = await register('again@example.com')
    await openConfirmLink(second, 'again@example.com')

    expect(claimsOf(second.userId)).toEqual({ slots: 0, credits: 0 })
    expect(redemptionCount()).toBe(1)
    const typed = await call('/api/billing/promo/redeem', {
      token: second.token,
      body: { code: 'LAUNCH_TEST' },
    })
    expect(typed.status).toBe(400)
    expect(((await typed.json()) as { error: string }).error).toBe(
      'This email address has already claimed this promo code.',
    )
  })

  it('keeps a keyed code of the address, never the address', async () => {
    const singer = await register('Recorded@Example.com')
    await openConfirmLink(singer, 'recorded@example.com')

    const records = sqlite
      .prepare('SELECT promoCodeId, kind, emailHash FROM promoEmailClaims')
      .all() as { promoCodeId: string; kind: string; emailHash: string }[]
    expect(records).toEqual([
      { promoCodeId: PROMO_ID, kind: 'claim', emailHash: expect.any(String) },
    ])
    expect(records[0]?.emailHash).toMatch(/^[0-9a-f]{64}$/)
    expect(records[0]?.emailHash).not.toContain('recorded')
  })

  it('is bounded per account only while the key is unset', async () => {
    delete env.FREE_SONG_EMAIL_SECRET
    const first = await register('unkeyed@example.com')
    await openConfirmLink(first, 'unkeyed@example.com')
    await deleteAccount(first)

    const second = await register('unkeyed@example.com')
    await openConfirmLink(second, 'unkeyed@example.com')

    expect(claimsOf(second.userId)).toEqual({ slots: 1, credits: 5 })
    const records = sqlite
      .prepare('SELECT COUNT(*) AS n FROM promoEmailClaims')
      .get() as { n: number }
    expect(records.n).toBe(0)
  })
})

describe('a claim that fails', () => {
  it('never fails the confirmation it rides on', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const singer = await register('outage@example.com')
    sqlite.exec(
      "CREATE TRIGGER launch_gift_outage BEFORE INSERT ON promoRedemptions BEGIN SELECT RAISE(ABORT, 'promo outage'); END",
    )

    const landing = await openConfirmLink(singer, 'outage@example.com')

    expect(landing).toMatch(/#everified=1$/)
    expect(emailVerified(singer.userId)).toBe(1)
    expect(claimsOf(singer.userId)).toEqual({ slots: 0, credits: 0 })
    expect(redemptionCount()).toBe(0)
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('[promo] claim on confirmation failed'),
    )
  })
})
