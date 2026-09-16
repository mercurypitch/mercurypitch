// @vitest-environment node
//
// ── Promo codes and redemptions integration test ─────────────────────
//
// Tests the full promo code lifecycle:
// - Anonymous and unverified email users are rejected.
// - Verified email users successfully redeem active promo codes.
// - Duplicate redemptions by the same user are rejected.
// - Expired and capped promo codes are rejected.
// - GET /api/billing/me reports redeemed promo codes reactively.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

let sqlite: DatabaseSync
let env: Env

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

describe('Promo codes integration', () => {
  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    applyMigrations(sqlite)

    env = {
      DB: new SqliteD1Database(sqlite),
      JWT_SECRET: 'test-jwt-secret-promo',
      PASSWORD_SALT: 'test-salt',
      ALLOWED_ORIGINS: 'localhost',
    } as unknown as Env
  })

  afterEach(() => {
    sqlite.close()
  })

  it('rejects anonymous accounts from redeeming promo codes', async () => {
    const anon = await anonymous('3f1b9c22-7a44-4f0e-9a1e-2c6d8b5e4a10')
    const res = await post(anon, '/api/billing/promo/redeem', {
      code: 'PRODUCT_HUNT',
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/create an account/i)
  })

  it('rejects registered accounts with unverified emails', async () => {
    const user = await register('Unverified Singer')
    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'PRODUCT_HUNT',
    })
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/verify your email/i)
  })

  it('allows verified accounts to redeem PRODUCT_HUNT and grants 5 credits', async () => {
    const user = await register('Verified Singer')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user.userId)

    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'PRODUCT_HUNT',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      code: string
      creditsGranted: number
      newBalance: number
    }
    expect(body.success).toBe(true)
    expect(body.code).toBe('PRODUCT_HUNT')
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
    expect(meBody.redeemedPromos).toEqual(['PRODUCT_HUNT'])
  })

  it('handles case-insensitive promo code entry (product_hunt)', async () => {
    const user = await register('Case Singer')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user.userId)

    const res = await post(user, '/api/billing/promo/redeem', {
      code: 'product_hunt',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; code: string }
    expect(body.success).toBe(true)
    expect(body.code).toBe('PRODUCT_HUNT')
  })

  it('rejects duplicate redemption by the same user', async () => {
    const user = await register('Double Singer')
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(user.userId)

    const first = await post(user, '/api/billing/promo/redeem', {
      code: 'PRODUCT_HUNT',
    })
    expect(first.status).toBe(200)

    const second = await post(user, '/api/billing/promo/redeem', {
      code: 'PRODUCT_HUNT',
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
      code: 'PRODUCT_HUNT',
    })
    expect(res1.status).toBe(200)

    const res2 = await post(user2, '/api/billing/promo/redeem', {
      code: 'PRODUCT_HUNT',
    })
    expect(res2.status).toBe(200)

    const promoRow = sqlite
      .prepare('SELECT redemptionCount FROM promoCodes WHERE code = ?')
      .get('PRODUCT_HUNT') as { redemptionCount: number }
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
})
