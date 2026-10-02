// @vitest-environment node
//
// ── Promo codes and redemptions integration test ─────────────────────
//
// Tests the full promo code lifecycle against a test-owned code (LAUNCH_TEST,
// seeded per test with a far-future expiry, so the suite does not start
// failing the day the real campaign closes):
// - Anonymous and unverified email users are rejected.
// - Verified email users successfully redeem active promo codes.
// - Duplicate redemptions by the same user are rejected.
// - Expired, not-yet-open, inactive and capped promo codes are rejected.
// - The three writes of a grant land together or not at all.
// - GET /api/billing/me reports redeemed promo codes reactively.
// - GET /api/billing/promo/featured offers the featured code only while it
//   is open, and says nothing about its cap.
// - Admin edits through the table API: dates are validated, the redemption
//   counter is untouchable, and only one code can be featured.
// The seeded campaign rows (PRODUCT_HUNT, then LAUNCH) are checked separately,
// under a fixed clock.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

let sqlite: DatabaseSync
let perksSqlite: DatabaseSync
let env: Env

const ADMIN_KEY = 'test-admin-key-promo'

interface Account {
  userId: string
  token: string
  displayName: string
}

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function authed(
  account: Account,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return workerRequest(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${account.token}`,
      ...(init.headers as Record<string, string>),
    },
  })
}

function post(
  account: Account,
  path: string,
  body: unknown,
): Promise<Response> {
  return authed(account, path, { method: 'POST', body: JSON.stringify(body) })
}

async function register(displayName: string): Promise<Account> {
  const response = await workerRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `${displayName.toLowerCase().replace(/\s+/g, '-')}@example.com`,
      password: 'password123',
      displayName,
    }),
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { token: string; userId: string }
  return { ...body, displayName }
}

async function anonymous(deviceId: string): Promise<Account> {
  const response = await workerRequest('/api/auth/anonymous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId,
      deviceSecret: `secret-${deviceId.replace(/-/g, '')}`,
    }),
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { token: string; userId: string }
  return { ...body, displayName: `Anon-${deviceId.slice(0, 6)}` }
}

function seedPromo(overrides: Partial<Record<string, unknown>> = {}): void {
  const row = {
    id: 'promo-test',
    code: 'LAUNCH_TEST',
    credits: 5,
    maxRedemptions: null,
    redemptionCount: 0,
    startsAt: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
    active: 1,
    ...overrides,
  }
  sqlite
    .prepare(
      `INSERT INTO promoCodes
         (id, code, credits, maxRedemptions, redemptionCount, startsAt, expiresAt, active, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(
      row.id as string,
      row.code as string,
      row.credits as number,
      row.maxRedemptions as number | null,
      row.redemptionCount as number,
      row.startsAt as string | null,
      row.expiresAt as string | null,
      row.active as number,
    )
}

async function verified(displayName: string): Promise<Account> {
  const user = await register(displayName)
  sqlite
    .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
    .run(user.userId)
  return user
}

describe('Promo codes integration', () => {
  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    applyMigrations(sqlite)
    seedPromo()
    // Account deletion purges email-keyed perk grants first; give it the
    // table it looks for, or it answers 503 before erasing anything.
    perksSqlite = new DatabaseSync(':memory:')
    perksSqlite.exec(
      'CREATE TABLE perkGrants (email TEXT, perkId TEXT, revokedAt TEXT)',
    )

    env = {
      DB: new SqliteD1Database(sqlite),
      PERKS_DB: new SqliteD1Database(perksSqlite),
      JWT_SECRET: 'test-jwt-secret-promo',
      PASSWORD_SALT: 'test-salt',
      ALLOWED_ORIGINS: 'localhost',
      ADMIN_KEY: ADMIN_KEY,
    } as unknown as Env
  })

  afterEach(() => {
    vi.useRealTimers()
    sqlite.close()
    perksSqlite.close()
  })

  it('rejects anonymous accounts from redeeming promo codes', async () => {
    const anon = await anonymous('3f1b9c22-7a44-4f0e-9a1e-2c6d8b5e4a10')
    const res = await post(anon, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/create an account/i)
  })

  it('rejects registered accounts with unverified emails', async () => {
    const user = await register('Unverified Singer')
    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/verify your email/i)
  })

  it('allows verified accounts to redeem an open code and grants its credits', async () => {
    const user = await register('Verified Singer')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user.userId)

    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      code: string
      creditsGranted: number
      newBalance: number
    }
    expect(body.success).toBe(true)
    expect(body.code).toBe('LAUNCH_TEST')
    expect(body.creditsGranted).toBe(5)
    expect(body.newBalance).toBe(5)

    // Check creditLedger in DB
    const ledger = sqlite
      .prepare('SELECT delta, reason FROM creditLedger WHERE userId = ?')
      .all(user.userId) as Array<{ delta: number; reason: string }>
    expect(ledger).toEqual([{ delta: 5, reason: 'promo' }])

    // Check promoRedemptions
    const redemptions = sqlite
      .prepare('SELECT promoCodeId FROM promoRedemptions WHERE userId = ?')
      .all(user.userId) as Array<{ promoCodeId: string }>
    expect(redemptions).toHaveLength(1)

    // Check /api/billing/me reports redeemedPromos
    const meRes = await authed(user, '/api/billing/me')
    expect(meRes.status).toBe(200)
    const meBody = (await meRes.json()) as {
      creditBalance: number
      redeemedPromos: string[]
    }
    expect(meBody.creditBalance).toBe(5)
    expect(meBody.redeemedPromos).toEqual(['LAUNCH_TEST'])
  })

  it('handles case-insensitive promo code entry (launch_test)', async () => {
    const user = await register('Case Singer')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user.userId)

    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'launch_test',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; code: string }
    expect(body.success).toBe(true)
    expect(body.code).toBe('LAUNCH_TEST')
  })

  it('rejects duplicate redemption by the same user', async () => {
    const user = await register('Double Singer')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user.userId)

    const first = await post(user, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    })
    expect(first.status).toBe(200)

    const second = await post(user, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    })
    expect(second.status).toBe(400)
    const body = (await second.json()) as { error: string }
    expect(body.error).toMatch(/already redeemed/i)
  })

  it('allows multiple distinct users to redeem the promo code', async () => {
    const user1 = await register('Singer One')
    const user2 = await register('Singer Two')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user1.userId)
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user2.userId)

    const res1 = await post(user1, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    })
    expect(res1.status).toBe(200)

    const res2 = await post(user2, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    })
    expect(res2.status).toBe(200)

    const promoRow = sqlite
      .prepare('SELECT redemptionCount FROM promoCodes WHERE code = ?')
      .get('LAUNCH_TEST') as { redemptionCount: number }
    expect(promoRow.redemptionCount).toBe(2)
  })

  it('rejects invalid or non-existent promo codes', async () => {
    const user = await register('Typo Singer')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user.userId)

    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'DOES_NOT_EXIST',
    })
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/invalid or inactive/i)
  })

  it('rejects expired promo codes', async () => {
    // Seed an expired promo
    sqlite
      .prepare(
        `INSERT INTO promoCodes (id, code, credits, expiresAt, active, createdAt, updatedAt)
         VALUES ('promo-old', 'EXPIRED_CODE', 10, '2020-01-01T00:00:00.000Z', 1, '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')`,
      )
      .run()

    const user = await register('Late Singer')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user.userId)

    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'EXPIRED_CODE',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/expired/i)
  })

  it('rejects promo code when maxRedemptions cap is reached', async () => {
    // Seed a promo with maxRedemptions = 1
    sqlite
      .prepare(
        `INSERT INTO promoCodes (id, code, credits, maxRedemptions, redemptionCount, active, createdAt, updatedAt)
         VALUES ('promo-capped', 'CAPPED_CODE', 5, 1, 1, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      )
      .run()

    const user = await register('Capped Singer')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user.userId)

    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'CAPPED_CODE',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/maximum redemption limit/i)
  })

  it('rejects a promo code that has not opened yet', async () => {
    seedPromo({
      id: 'promo-future',
      code: 'FUTURE_CODE',
      startsAt: '2099-01-01T00:00:00.000Z',
    })
    const user = await verified('Early Singer')
    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'FUTURE_CODE',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/not active yet/i)
  })

  it('treats a disabled promo code as unknown', async () => {
    seedPromo({ id: 'promo-off', code: 'OFF_CODE', active: 0 })
    const user = await verified('Late Singer')
    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'OFF_CODE',
    })
    expect(res.status).toBe(404)
    const rows = sqlite
      .prepare('SELECT COUNT(*) AS n FROM promoRedemptions WHERE userId = ?')
      .get(user.userId) as { n: number }
    expect(rows.n).toBe(0)
  })

  it('gives the last slot to exactly one of two racing users', async () => {
    seedPromo({ id: 'promo-last', code: 'LAST_SLOT', maxRedemptions: 1 })
    const one = await verified('Racer One')
    const two = await verified('Racer Two')

    const [a, b] = await Promise.all([
      post(one, '/api/billing/promo/redeem', { code: 'LAST_SLOT' }),
      post(two, '/api/billing/promo/redeem', { code: 'LAST_SLOT' }),
    ])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 400])
    const refused = a.status === 400 ? a : b
    const body = (await refused.json()) as { error: string }
    expect(body.error).toMatch(/maximum redemption limit/i)

    const promoRow = sqlite
      .prepare('SELECT redemptionCount FROM promoCodes WHERE code = ?')
      .get('LAST_SLOT') as { redemptionCount: number }
    expect(promoRow.redemptionCount).toBe(1)
    const ledger = sqlite
      .prepare("SELECT COUNT(*) AS n FROM creditLedger WHERE reason = 'promo'")
      .get() as { n: number }
    expect(ledger.n).toBe(1)
  })

  it('lands the slot, the counter and the credits together or not at all', async () => {
    const user = await verified('Unlucky Singer')
    // Make the third write of the grant fail. If the three were separate
    // statements, the slot would already be taken and the credits never paid.
    sqlite.exec(
      "CREATE TRIGGER promo_ledger_outage BEFORE INSERT ON creditLedger BEGIN SELECT RAISE(ABORT, 'ledger outage'); END",
    )
    const failed = await post(user, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    }).catch(() => null)
    expect(failed === null || failed.status >= 500).toBe(true)

    const slots = sqlite
      .prepare('SELECT COUNT(*) AS n FROM promoRedemptions WHERE userId = ?')
      .get(user.userId) as { n: number }
    expect(slots.n).toBe(0)
    const promoRow = sqlite
      .prepare('SELECT redemptionCount FROM promoCodes WHERE code = ?')
      .get('LAUNCH_TEST') as { redemptionCount: number }
    expect(promoRow.redemptionCount).toBe(0)

    sqlite.exec('DROP TRIGGER promo_ledger_outage')
    const retry = await post(user, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    })
    expect(retry.status).toBe(200)
    const body = (await retry.json()) as { newBalance: number }
    expect(body.newBalance).toBe(5)
  })

  it('rate-limits guessing at ten attempts per five minutes per account', async () => {
    const user = await verified('Guessing Singer')
    for (let i = 0; i < 10; i++) {
      const res = await post(user, '/api/billing/promo/redeem', {
        code: `GUESS_${i}`,
      })
      expect(res.status).toBe(404)
    }
    const blocked = await post(user, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    })
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    const slots = sqlite
      .prepare('SELECT COUNT(*) AS n FROM promoRedemptions WHERE userId = ?')
      .get(user.userId) as { n: number }
    expect(slots.n).toBe(0)
  })

  it('erases the redemption with the account and keeps the campaign count', async () => {
    const user = await verified('Leaving Singer')
    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'LAUNCH_TEST',
    })
    expect(res.status).toBe(200)

    const gone = await authed(user, '/api/auth/me', { method: 'DELETE' })
    expect(gone.status).toBe(200)

    const slots = sqlite
      .prepare('SELECT COUNT(*) AS n FROM promoRedemptions WHERE userId = ?')
      .get(user.userId) as { n: number }
    expect(slots.n).toBe(0)
    const promoRow = sqlite
      .prepare('SELECT redemptionCount FROM promoCodes WHERE code = ?')
      .get('LAUNCH_TEST') as { redemptionCount: number }
    expect(promoRow.redemptionCount).toBe(1)
  })

  describe('the seeded PRODUCT_HUNT campaign', () => {
    it('is seeded open until the end of September 2026', () => {
      const row = sqlite
        .prepare(
          'SELECT code, credits, maxRedemptions, startsAt, expiresAt, active FROM promoCodes WHERE id = ?',
        )
        .get('promo-ph-2026') as Record<string, unknown>
      expect(row).toEqual({
        code: 'PRODUCT_HUNT',
        credits: 5,
        maxRedemptions: 1000,
        startsAt: null,
        expiresAt: '2026-09-30T23:59:59.000Z',
        active: 1,
      })
    })

    it('redeems during the campaign and refuses after it', async () => {
      vi.useFakeTimers({
        toFake: ['Date'],
        now: new Date('2026-09-25T12:00:00.000Z'),
      })
      const during = await verified('Launch Day Singer')
      const ok = await post(during, '/api/billing/promo/redeem', {
        code: 'PRODUCT_HUNT',
      })
      expect(ok.status).toBe(200)
      const granted = (await ok.json()) as { creditsGranted: number }
      expect(granted.creditsGranted).toBe(5)

      vi.setSystemTime(new Date('2026-10-01T00:00:00.000Z'))
      const late = await verified('October Singer')
      const refused = await post(late, '/api/billing/promo/redeem', {
        code: 'PRODUCT_HUNT',
      })
      expect(refused.status).toBe(400)
      const body = (await refused.json()) as { error: string }
      expect(body.error).toMatch(/expired/i)
    })
  })

  describe('the seeded LAUNCH campaign', () => {
    it('is seeded featured, open from 2 October 2026 to the end of 1 January 2027', () => {
      const row = sqlite
        .prepare(
          'SELECT code, credits, maxRedemptions, redemptionCount, startsAt, expiresAt, active, featured FROM promoCodes WHERE id = ?',
        )
        .get('promo-2026-q4') as Record<string, unknown>
      expect(row).toEqual({
        code: 'LAUNCH',
        credits: 5,
        maxRedemptions: 1000,
        redemptionCount: 0,
        startsAt: '2026-10-02T00:00:00.000Z',
        expiresAt: '2027-01-01T23:59:59.000Z',
        active: 1,
        featured: 1,
      })
    })

    it('redeems on the last day and refuses the day after', async () => {
      vi.useFakeTimers({
        toFake: ['Date'],
        now: new Date('2027-01-01T22:00:00.000Z'),
      })
      const lastDay = await verified('New Year Singer')
      const ok = await post(lastDay, '/api/billing/promo/redeem', {
        code: 'LAUNCH',
      })
      expect(ok.status).toBe(200)
      const granted = (await ok.json()) as { creditsGranted: number }
      expect(granted.creditsGranted).toBe(5)

      vi.setSystemTime(new Date('2027-01-02T00:00:00.000Z'))
      const late = await verified('January Singer')
      const refused = await post(late, '/api/billing/promo/redeem', {
        code: 'LAUNCH',
      })
      expect(refused.status).toBe(400)
      const body = (await refused.json()) as { error: string }
      expect(body.error).toMatch(/expired/i)
    })

    it('refuses before it opens', async () => {
      vi.useFakeTimers({
        toFake: ['Date'],
        now: new Date('2026-10-01T12:00:00.000Z'),
      })
      const early = await verified('Early October Singer')
      const refused = await post(early, '/api/billing/promo/redeem', {
        code: 'LAUNCH',
      })
      expect(refused.status).toBe(400)
      const body = (await refused.json()) as { error: string }
      expect(body.error).toMatch(/not active yet/i)
    })
  })

  describe('GET /api/billing/promo/featured', () => {
    async function featured(): Promise<unknown> {
      // No Authorization header: the header pill asks before anyone signs in.
      const response = await workerRequest('/api/billing/promo/featured')
      expect(response.status).toBe(200)
      return response.json()
    }

    beforeEach(() => {
      vi.useFakeTimers({
        toFake: ['Date'],
        now: new Date('2026-11-15T12:00:00.000Z'),
      })
    })

    it('offers the featured code with only its code, credits and end', async () => {
      expect(await featured()).toEqual({
        promo: {
          code: 'LAUNCH',
          credits: 5,
          expiresAt: '2027-01-01T23:59:59.000Z',
        },
      })
    })

    it('offers nothing once the featured code has ended', async () => {
      vi.setSystemTime(new Date('2027-01-02T00:00:00.000Z'))
      expect(await featured()).toEqual({ promo: null })
    })

    it('offers nothing while the featured code is switched off', async () => {
      sqlite
        .prepare("UPDATE promoCodes SET active = 0 WHERE code = 'LAUNCH'")
        .run()
      expect(await featured()).toEqual({ promo: null })
    })

    it('offers nothing once the featured code is fully claimed', async () => {
      sqlite
        .prepare(
          "UPDATE promoCodes SET redemptionCount = 1000 WHERE code = 'LAUNCH'",
        )
        .run()
      expect(await featured()).toEqual({ promo: null })
    })

    it('never offers an open code that is not featured', async () => {
      // LAUNCH_TEST, seeded for every test, is open; only LAUNCH was featured.
      sqlite
        .prepare("UPDATE promoCodes SET featured = 0 WHERE code = 'LAUNCH'")
        .run()
      expect(await featured()).toEqual({ promo: null })
    })
  })

  describe('editing codes through the admin table API', () => {
    function patch(id: string, body: unknown): Promise<Response> {
      return workerRequest(`/api/promoCodes/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY,
        },
        body: JSON.stringify(body),
      })
    }

    function launchRow(): Record<string, unknown> {
      return sqlite
        .prepare(
          'SELECT credits, expiresAt, redemptionCount, featured FROM promoCodes WHERE id = ?',
        )
        .get('promo-2026-q4') as Record<string, unknown>
    }

    it('moves an end date', async () => {
      const response = await patch('promo-2026-q4', {
        expiresAt: '2027-01-31T23:59:59.000Z',
      })
      expect(response.status).toBe(200)
      expect(launchRow().expiresAt).toBe('2027-01-31T23:59:59.000Z')
    })

    it('refuses an end date that is not a timestamp and keeps the old one', async () => {
      const response = await patch('promo-2026-q4', {
        expiresAt: '1.01.2027',
      })
      expect(response.status).toBe(400)
      expect(launchRow().expiresAt).toBe('2027-01-01T23:59:59.000Z')
    })

    it('never lets a write move the redemption counter', async () => {
      sqlite
        .prepare(
          "UPDATE promoCodes SET redemptionCount = 8 WHERE id = 'promo-2026-q4'",
        )
        .run()
      const response = await patch('promo-2026-q4', {
        redemptionCount: 0,
        credits: 6,
      })
      expect(response.status).toBe(200)
      expect(launchRow()).toMatchObject({ credits: 6, redemptionCount: 8 })
    })

    it('features a second code only after the first stops being featured', async () => {
      const clash = await patch('promo-test', { featured: true })
      expect(clash.status).toBe(400)
      expect(launchRow().featured).toBe(1)

      expect((await patch('promo-2026-q4', { featured: false })).status).toBe(
        200,
      )
      expect((await patch('promo-test', { featured: true })).status).toBe(200)

      const response = await workerRequest('/api/billing/promo/featured')
      expect(await response.json()).toEqual({
        promo: {
          code: 'LAUNCH_TEST',
          credits: 5,
          expiresAt: '2099-01-01T00:00:00.000Z',
        },
      })
    })

    it('reads the featured flag back as a boolean', async () => {
      const response = await workerRequest('/api/promoCodes/promo-2026-q4', {
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
      expect(response.status).toBe(200)
      const row = (await response.json()) as { featured: unknown }
      expect(row.featured).toBe(true)
    })
  })
})
