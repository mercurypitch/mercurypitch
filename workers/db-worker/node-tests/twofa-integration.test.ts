// @vitest-environment node
//
// ── A password alone must not buy a session for a 2FA account ────────
//
// The whole feature reduces to that sentence, and to the ways it can be got
// wrong: issuing the token anyway and hoping the client asks for a code;
// leaving the sessions that predate enrollment alive; letting a spent code
// work twice; giving the disable path its own guessing budget; storing the
// secret where a leaked database hands it out.
//
// Run against real SQLite with the real migrations applied, driving the worker
// through its own HTTP surface, so the ceremony really does travel in the body
// and the SQL really is the SQL that ships.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { totpCode } from '../src/totp'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const ADMIN_KEY = 'twofa-test-admin'
const PASSWORD = 'Twofa123pass'
const TOTP_KEK = 'twofa-integration-kek-value'

let sqlite: DatabaseSync
let env: Env

interface Account {
  token: string
  userId: string
}

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function post(path: string, body: unknown): Promise<Response> {
  return workerRequest(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36',
    },
    body: JSON.stringify(body),
  })
}

function authed(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return workerRequest(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string>),
    },
  })
}

function authedPost(
  token: string,
  path: string,
  body: unknown,
): Promise<Response> {
  return authed(token, path, { method: 'POST', body: JSON.stringify(body) })
}

async function register(email: string): Promise<Account> {
  const response = await post('/api/auth/register', {
    email,
    password: PASSWORD,
    displayName: 'Twofa Singer',
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Account
}

// ── A virtual clock, because every code is single-use ────────────────
//
// `lastUsedStep` spends a code the moment it is accepted, so a test that asks
// for "the current code" twice inside the same thirty seconds is asking to be
// refused — correctly. Rather than sleeping, move the clock: `freshCode`
// advances one step and returns the code for it, which is exactly what a
// person waiting for their authenticator to roll over does.
const realNow = Date.now
let clockOffsetMs = 0

function useVirtualClock(): void {
  clockOffsetMs = 0
  Date.now = () => realNow() + clockOffsetMs
}

async function freshCode(secret: string): Promise<string> {
  clockOffsetMs += 30_000
  return totpCode(secret, Math.floor(Date.now() / 1000 / 30))
}

/** Walk the whole enrollment: setup, confirm a real code, keep the sheet. */
async function enroll(
  account: Account,
): Promise<{ secret: string; recoveryCodes: string[] }> {
  const setup = await authedPost(account.token, '/api/auth/2fa/setup', {})
  expect(setup.status).toBe(200)
  const { secret } = (await setup.json()) as { secret: string }

  const enable = await authedPost(account.token, '/api/auth/2fa/enable', {
    code: await freshCode(secret),
  })
  expect(enable.status).toBe(200)
  const { recoveryCodes } = (await enable.json()) as { recoveryCodes: string[] }
  return { secret, recoveryCodes }
}

async function login(email: string): Promise<Response> {
  return post('/api/auth/login', { email, password: PASSWORD })
}

async function meStatus(token: string): Promise<number> {
  return (await authed(token, '/api/auth/me')).status
}

function sessionRowCount(userId: string): number {
  const row = sqlite
    .prepare('SELECT COUNT(*) AS n FROM authSessions WHERE userId = ?')
    .get(userId) as { n: number }
  return row.n
}

function freshDatabase(overrides: Partial<Env> = {}): void {
  useVirtualClock()
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'twofa-integration-secret',
    TOTP_KEK,
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
    ...overrides,
  }
}

afterEach(() => {
  Date.now = realNow
  sqlite.close()
})

describe('signing in with a second factor', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('answers with a challenge instead of a session', async () => {
    const account = await register('challenge@example.com')
    await enroll(account)

    const response = await login('challenge@example.com')
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    // The thing that must never regress: no token comes back, so a client that
    // ignores `twofaRequired` entirely still cannot get in.
    expect(body.twofaRequired).toBe(true)
    expect(body.token).toBeUndefined()
    expect(typeof body.ceremony).toBe('string')
  })

  it('trades a valid code for the session', async () => {
    const account = await register('trade@example.com')
    const { secret } = await enroll(account)

    const { ceremony } = (await (await login('trade@example.com')).json()) as {
      ceremony: string
    }
    const verified = await post('/api/auth/2fa/verify', {
      ceremony,
      code: await freshCode(secret),
    })
    expect(verified.status).toBe(200)
    const { token } = (await verified.json()) as { token: string }
    expect(await meStatus(token)).toBe(200)
  })

  it('accepts a recovery code, and spends it', async () => {
    const account = await register('recovery@example.com')
    const { recoveryCodes } = await enroll(account)
    const code = recoveryCodes[0] as string

    const first = (await (await login('recovery@example.com')).json()) as {
      ceremony: string
    }
    expect(
      (await post('/api/auth/2fa/verify', { ceremony: first.ceremony, code }))
        .status,
    ).toBe(200)

    // Single use. A sheet of ten is ten sign-ins, not an unlimited bypass.
    const second = (await (await login('recovery@example.com')).json()) as {
      ceremony: string
    }
    expect(
      (await post('/api/auth/2fa/verify', { ceremony: second.ceremony, code }))
        .status,
    ).toBe(401)
  })

  it('normalises a recovery code the way people retype it', async () => {
    const account = await register('retype@example.com')
    const { recoveryCodes } = await enroll(account)
    const typed = (recoveryCodes[0] as string).toLowerCase().replace('-', ' ')

    const { ceremony } = (await (await login('retype@example.com')).json()) as {
      ceremony: string
    }
    expect(
      (await post('/api/auth/2fa/verify', { ceremony, code: typed })).status,
    ).toBe(200)
  })

  it('will not let a code be replayed inside its own window', async () => {
    const account = await register('replay@example.com')
    const { secret } = await enroll(account)
    // Held, not re-derived: the point is presenting the SAME code twice while
    // the clock has not moved on.
    const code = await freshCode(secret)

    const first = (await (await login('replay@example.com')).json()) as {
      ceremony: string
    }
    expect(
      (await post('/api/auth/2fa/verify', { ceremony: first.ceremony, code }))
        .status,
    ).toBe(200)

    // Same code, still within its thirty seconds: shoulder-surfing it buys
    // nothing.
    const second = (await (await login('replay@example.com')).json()) as {
      ceremony: string
    }
    expect(
      (await post('/api/auth/2fa/verify', { ceremony: second.ceremony, code }))
        .status,
    ).toBe(401)
  })

  it('refuses a code with no ceremony to spend it against', async () => {
    const account = await register('noceremony@example.com')
    const { secret } = await enroll(account)
    const response = await post('/api/auth/2fa/verify', {
      code: await freshCode(secret),
    })
    expect(response.status).toBe(401)
  })

  it('leaves accounts without 2FA signing in with one request', async () => {
    await register('plain@example.com')
    const body = (await (await login('plain@example.com')).json()) as Record<
      string,
      unknown
    >
    expect(body.twofaRequired).toBeUndefined()
    expect(typeof body.token).toBe('string')
  })
})

describe('enrollment', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('demands nothing until a code has been confirmed', async () => {
    // An enrollment somebody started and walked away from must never lock
    // them out: only a CONFIRMED credential makes sign-in ask for a code.
    const account = await register('abandoned@example.com')
    const setup = await authedPost(account.token, '/api/auth/2fa/setup', {})
    expect(setup.status).toBe(200)

    const body = (await (
      await login('abandoned@example.com')
    ).json()) as Record<string, unknown>
    expect(body.twofaRequired).toBeUndefined()
    expect(typeof body.token).toBe('string')
  })

  it('refuses a wrong code and stays unconfirmed', async () => {
    const account = await register('wrongcode@example.com')
    const setup = await authedPost(account.token, '/api/auth/2fa/setup', {})
    const { secret } = (await setup.json()) as { secret: string }
    // A code from far outside the drift window: correctly generated, wrong.
    const stale = await totpCode(secret, Math.floor(Date.now() / 1000 / 30) - 9)

    const enable = await authedPost(account.token, '/api/auth/2fa/enable', {
      code: stale,
    })
    expect(enable.status).toBe(401)
    const status = await authed(account.token, '/api/auth/2fa/status')
    expect(await status.json()).toMatchObject({ enabled: false })
  })

  it('will not silently replace a confirmed credential', async () => {
    // Otherwise anyone holding a live session could swap the second factor
    // for one of their own, which is the exact attack 2FA is meant to stop.
    const account = await register('replace@example.com')
    await enroll(account)
    const again = await authedPost(account.token, '/api/auth/2fa/setup', {})
    expect(again.status).toBe(409)
  })

  it('signs out every other device, and keeps the enrolling one', async () => {
    const enrolling = await register('evict@example.com')
    const other = (await (await login('evict@example.com')).json()) as Account
    expect(sessionRowCount(enrolling.userId)).toBe(2)

    await enroll(enrolling)

    // The point of the whole feature: an intruder the enrollment is aimed at
    // loses their foothold at the moment it is turned on.
    expect(await meStatus(other.token)).toBe(401)
    expect(await meStatus(enrolling.token)).toBe(200)
    expect(sessionRowCount(enrolling.userId)).toBe(1)
  })

  it('hands back ten recovery codes, exactly once', async () => {
    const account = await register('sheet@example.com')
    const { recoveryCodes } = await enroll(account)
    expect(recoveryCodes).toHaveLength(10)
    expect(new Set(recoveryCodes).size).toBe(10)
    for (const code of recoveryCodes)
      expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/)

    // Only hashes are kept, so no later request — and no leaked database —
    // can produce them again.
    const stored = sqlite
      .prepare('SELECT codeHash FROM recoveryCodes WHERE userId = ?')
      .all(account.userId) as { codeHash: string }[]
    expect(stored).toHaveLength(10)
    for (const row of stored) expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/)
    for (const code of recoveryCodes) {
      expect(stored.some((row) => row.codeHash.includes(code))).toBe(false)
    }
  })

  it('never stores the TOTP secret in the clear', async () => {
    const account = await register('atrest@example.com')
    const { secret } = await enroll(account)
    const row = sqlite
      .prepare('SELECT secretEnc FROM totpCredentials WHERE userId = ?')
      .get(account.userId) as { secretEnc: string }
    // A leaked database must not hand out every singer's second factor
    // alongside their password hashes.
    expect(row.secretEnc).not.toContain(secret)
    expect(row.secretEnc).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })
})

describe('turning it off', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('needs a current code', async () => {
    const account = await register('off@example.com')
    const { secret } = await enroll(account)

    expect(
      (
        await authedPost(account.token, '/api/auth/2fa/disable', {
          code: '000000',
        })
      ).status,
    ).toBe(401)

    expect(
      (
        await authedPost(account.token, '/api/auth/2fa/disable', {
          code: await freshCode(secret),
        })
      ).status,
    ).toBe(200)

    const body = (await (await login('off@example.com')).json()) as Record<
      string,
      unknown
    >
    expect(typeof body.token).toBe('string')
  })

  it('shares its guessing budget with the sign-in challenge', async () => {
    // Both routes accept the same proof. Attacking the weaker one must not
    // hand out a fresh allowance.
    const account = await register('budget@example.com')
    await enroll(account)

    for (let attempt = 0; attempt < 10; attempt++) {
      await authedPost(account.token, '/api/auth/2fa/disable', {
        code: '000000',
      })
    }
    const { ceremony } = (await (await login('budget@example.com')).json()) as {
      ceremony: string
    }
    const verify = await post('/api/auth/2fa/verify', {
      ceremony,
      code: '000000',
    })
    expect(verify.status).toBe(429)
  })

  it('takes the recovery codes with it', async () => {
    const account = await register('cleanup@example.com')
    const { secret } = await enroll(account)
    await authedPost(account.token, '/api/auth/2fa/disable', {
      code: await freshCode(secret),
    })
    const left = sqlite
      .prepare('SELECT COUNT(*) AS n FROM recoveryCodes WHERE userId = ?')
      .get(account.userId) as { n: number }
    expect(left.n).toBe(0)
  })
})

describe('an environment with no TOTP_KEK', () => {
  beforeEach(() => {
    freshDatabase({ TOTP_KEK: undefined })
  })

  it('says the feature is unavailable rather than throwing', async () => {
    const account = await register('nokek@example.com')
    const setup = await authedPost(account.token, '/api/auth/2fa/setup', {})
    expect(setup.status).toBe(503)

    const status = await authed(account.token, '/api/auth/2fa/status')
    expect(status.status).toBe(200)
    expect(await status.json()).toMatchObject({
      enabled: false,
      available: false,
    })
  })

  it('leaves ordinary sign-in completely alone', async () => {
    await register('unaffected@example.com')
    const body = (await (
      await login('unaffected@example.com')
    ).json()) as Record<string, unknown>
    expect(typeof body.token).toBe('string')
  })
})

describe('deleting the account', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('erases the second factor and its backup codes', async () => {
    const account = await register('erase2fa@example.com')
    await enroll(account)

    expect(
      (await authed(account.token, '/api/auth/me', { method: 'DELETE' }))
        .status,
    ).toBe(200)

    const credential = sqlite
      .prepare('SELECT COUNT(*) AS n FROM totpCredentials WHERE userId = ?')
      .get(account.userId) as { n: number }
    const codes = sqlite
      .prepare('SELECT COUNT(*) AS n FROM recoveryCodes WHERE userId = ?')
      .get(account.userId) as { n: number }
    // An encrypted TOTP secret is still a credential; an account that asked to
    // be forgotten must not keep one.
    expect(credential.n).toBe(0)
    expect(codes.n).toBe(0)
  })
})
