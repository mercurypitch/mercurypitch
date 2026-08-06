// @vitest-environment node

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { PERK_IDS } from '../src/perks'

class SqliteD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
    private readonly values: SQLInputValue[] = [],
  ) {}

  bind(...values: SQLInputValue[]): SqliteD1Statement {
    return new SqliteD1Statement(this.database, this.sql, values)
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.database.prepare(this.sql).get(...this.values)
    if (row === undefined) return null
    return (column === undefined ? row : row[column]) as T
  }

  async all<T>(): Promise<{ success: true; results: T[] }> {
    return {
      success: true,
      results: this.database.prepare(this.sql).all(...this.values) as T[],
    }
  }

  execute(): { success: true; meta: { changes: number } } {
    const result = this.database.prepare(this.sql).run(...this.values)
    return { success: true, meta: { changes: Number(result.changes) } }
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    return this.execute()
  }

  batchExecute(): {
    success: true
    meta?: { changes: number }
    results?: unknown[]
  } {
    if (/^\s*SELECT\b/i.test(this.sql)) {
      return {
        success: true,
        results: this.database.prepare(this.sql).all(...this.values),
      }
    }
    return this.execute()
  }
}

class SqliteD1Database {
  constructor(readonly native: DatabaseSync) {}

  prepare(sql: string): SqliteD1Statement {
    return new SqliteD1Statement(this.native, sql)
  }

  async batch(statements: SqliteD1Statement[]): Promise<
    Array<{
      success: true
      meta?: { changes: number }
      results?: unknown[]
    }>
  > {
    this.native.exec('BEGIN IMMEDIATE')
    try {
      const results = statements.map((statement) => statement.batchExecute())
      this.native.exec('COMMIT')
      return results
    } catch (error) {
      this.native.exec('ROLLBACK')
      throw error
    }
  }
}

const PROVISION_KEY = 'a'.repeat(64)
const CAMPAIGN_ID = '2026_08_06_mercurypitch_release_candidate'
const TESTER_ID = 'human_tester_01'

let sqlite: DatabaseSync
let env: Env

function applyMigrations(target: DatabaseSync): void {
  const directory = join(import.meta.dirname, '../migrations')
  for (const filename of readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    target.exec(readFileSync(join(directory, filename), 'utf8'))
  }
}

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function operatorRequest(
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<Response> {
  return workerRequest(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Testing-Provision-Key': PROVISION_KEY,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function futureIso(days = 30): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function provisionBody(
  grants: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    campaignId: CAMPAIGN_ID,
    testerId: TESTER_ID,
    displayName: 'Release tester',
    expiresAt: futureIso(),
    grants,
  }
}

async function provision(grants: Record<string, unknown> = {}): Promise<{
  account: Record<string, unknown>
  credentials: { email: string; password: string }
}> {
  const response = await operatorRequest(
    '/api/admin/testing-accounts',
    'POST',
    provisionBody(grants),
  )
  expect(response.status).toBe(201)
  return response.json()
}

async function login(email: string, password: string): Promise<Response> {
  return workerRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    ALLOW_TEST_ACCOUNT_PROVISIONING: '1',
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'managed-testing-jwt-secret',
    STRIPE_SECRET_KEY: 'sk_test_not_called',
    TESTING_PROVISION_KEY: PROVISION_KEY,
  }
})

afterEach(() => sqlite.close())

describe('managed testing accounts', () => {
  it('stays hidden unless explicitly enabled and dedicated-key authorized', async () => {
    env.ALLOW_TEST_ACCOUNT_PROVISIONING = undefined
    const disabled = await operatorRequest(
      '/api/admin/testing-accounts',
      'POST',
      provisionBody(),
    )
    expect(disabled.status).toBe(404)

    env.ALLOW_TEST_ACCOUNT_PROVISIONING = '1'
    const unauthorized = await workerRequest('/api/admin/testing-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(provisionBody()),
    })
    expect(unauthorized.status).toBe(401)

    const reservedRegistration = await workerRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'public@testing.mercurypitch.com',
        password: 'Managed-Test-Account-1234',
      }),
    })
    expect(reservedRegistration.status).toBe(400)
  })

  it('validates grants and provisions exactly one verified synthetic user', async () => {
    const invalid = await operatorRequest(
      '/api/admin/testing-accounts',
      'POST',
      provisionBody({ credits: 13 }),
    )
    expect(invalid.status).toBe(400)

    const first = await provision({
      credits: 25,
      perks: [PERK_IDS[0]],
      supporter: true,
    })
    expect(first.credentials.email).toMatch(
      /^mc-test-[a-f0-9]{24}@testing\.mercurypitch\.com$/,
    )
    expect(first.credentials.password).toHaveLength(40)
    expect(first.account).toMatchObject({
      campaignId: CAMPAIGN_ID,
      status: 'active',
      testerId: TESTER_ID,
      grants: {
        credits: 25,
        features: ['lab-access'],
        perks: [PERK_IDS[0]],
        supporter: true,
      },
    })

    const repeat = await operatorRequest(
      '/api/admin/testing-accounts',
      'POST',
      provisionBody({
        credits: 25,
        perks: [PERK_IDS[0]],
        supporter: true,
      }),
    )
    expect(repeat.status).toBe(200)
    const repeatJson = (await repeat.json()) as Record<string, unknown>
    expect(repeatJson).not.toHaveProperty('credentials')
    expect(
      sqlite.prepare('SELECT COUNT(*) AS count FROM managedTestAccounts').get(),
    ).toEqual({ count: 1 })
    expect(
      sqlite.prepare('SELECT SUM(delta) AS total FROM creditLedger').get(),
    ).toEqual({ total: 25 })
  })

  it('labels active sessions, exposes local perks, and refuses billing', async () => {
    const created = await provision({
      credits: 10,
      perks: [PERK_IDS[0]],
      supporter: true,
    })
    const loginResponse = await login(
      created.credentials.email,
      created.credentials.password,
    )
    expect(loginResponse.status).toBe(200)
    const session = (await loginResponse.json()) as {
      token: string
      user: Record<string, unknown>
    }
    expect(session.user).toMatchObject({
      isTestAccount: true,
      testAccountExpiresAt: expect.any(String),
    })

    const me = await workerRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${session.token}` },
    })
    expect(me.status).toBe(200)
    await expect(me.json()).resolves.toMatchObject({
      user: { isTestAccount: true },
    })

    const perks = await workerRequest('/api/perks/me', {
      headers: { Authorization: `Bearer ${session.token}` },
    })
    expect(perks.status).toBe(200)
    await expect(perks.json()).resolves.toMatchObject({
      features: ['lab-access'],
      perks: [PERK_IDS[0]],
    })

    const checkout = await workerRequest('/api/billing/checkout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planId: 'anything' }),
    })
    expect(checkout.status).toBe(403)
  })

  it('updates allowlisted grants, rotates credentials, expires, and revokes', async () => {
    const created = await provision()
    const userId = String(created.account.userId)
    const firstLogin = await login(
      created.credentials.email,
      created.credentials.password,
    )
    const firstSession = (await firstLogin.json()) as { token: string }

    const granted = await operatorRequest(
      `/api/admin/testing-accounts/${userId}/grants`,
      'PATCH',
      { credits: 50, perks: [PERK_IDS[0]], supporter: true },
    )
    expect(granted.status).toBe(200)
    await expect(granted.json()).resolves.toMatchObject({
      account: { grants: { credits: 50, supporter: true } },
    })

    const cannotReclaim = await operatorRequest(
      `/api/admin/testing-accounts/${userId}/grants`,
      'PATCH',
      { credits: 10 },
    )
    expect(cannotReclaim.status).toBe(400)

    const rotated = await operatorRequest(
      `/api/admin/testing-accounts/${userId}/rotate-password`,
      'POST',
    )
    expect(rotated.status).toBe(200)
    const rotatedJson = (await rotated.json()) as {
      credentials: { email: string; password: string }
    }
    expect(
      await login(created.credentials.email, created.credentials.password),
    ).toHaveProperty('status', 401)
    const rotatedLogin = await login(
      rotatedJson.credentials.email,
      rotatedJson.credentials.password,
    )
    expect(rotatedLogin.status).toBe(200)
    const rotatedSession = (await rotatedLogin.json()) as { token: string }
    expect(
      await workerRequest('/api/auth/me', {
        headers: { Authorization: `Bearer ${firstSession.token}` },
      }),
    ).toHaveProperty('status', 401)

    sqlite
      .prepare('UPDATE managedTestAccounts SET expiresAt = ? WHERE userId = ?')
      .run('2026-01-01T00:00:00.000Z', userId)
    const expiredLogin = await login(
      rotatedJson.credentials.email,
      rotatedJson.credentials.password,
    )
    expect(expiredLogin.status).toBe(403)

    const renewed = await operatorRequest(
      `/api/admin/testing-accounts/${userId}/renew`,
      'POST',
      { expiresAt: futureIso(7) },
    )
    expect(renewed.status).toBe(200)
    await expect(renewed.json()).resolves.toMatchObject({
      account: { status: 'active' },
    })
    expect(
      await workerRequest('/api/auth/me', {
        headers: { Authorization: `Bearer ${rotatedSession.token}` },
      }),
    ).toHaveProperty('status', 401)
    const activeAgain = await login(
      rotatedJson.credentials.email,
      rotatedJson.credentials.password,
    )
    expect(activeAgain.status).toBe(200)
    const activeSession = (await activeAgain.json()) as { token: string }

    const revoked = await operatorRequest(
      `/api/admin/testing-accounts/${userId}/revoke`,
      'POST',
    )
    expect(revoked.status).toBe(200)
    await expect(revoked.json()).resolves.toMatchObject({
      account: { status: 'revoked' },
    })
    expect(
      await workerRequest('/api/auth/me', {
        headers: { Authorization: `Bearer ${activeSession.token}` },
      }),
    ).toHaveProperty('status', 403)

    const cannotRenewRevoked = await operatorRequest(
      `/api/admin/testing-accounts/${userId}/renew`,
      'POST',
      { expiresAt: futureIso(7) },
    )
    expect(cannotRenewRevoked.status).toBe(409)
  })
})
