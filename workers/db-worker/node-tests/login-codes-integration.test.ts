// @vitest-environment node
//
// ── A mailed code must buy exactly one session, for exactly one row ──
//
// The feature's whole security argument is that guessing is never open-ended:
// the ceremony names one row, five wrong guesses burn it, ten minutes end it,
// and one success spends it. Each of those is a line somebody could delete
// without any other test noticing, so each gets one here.
//
// The other half is the part nobody sees: /request must answer identically for
// an address with an account and one without. A test that only exercises the
// happy path would let that regress silently, which is the failure mode that
// turns this endpoint into an address oracle.
//
// Run against real SQLite with the real migrations, driving the worker through
// its own HTTP surface.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { LOGIN_CODE_MAX_ATTEMPTS, LOGIN_CODE_MAX_LIVE, } from '../src/login-codes'
import { totpCode } from '../src/totp'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const PASSWORD = 'Mailed123pass'
const TOTP_KEK = 'login-code-integration-kek'

let sqlite: DatabaseSync
let env: Env

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

function authedPost(
  token: string,
  path: string,
  body: unknown,
): Promise<Response> {
  return workerRequest(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

async function register(
  email: string,
): Promise<{ token: string; userId: string }> {
  const response = await post('/api/auth/register', {
    email,
    password: PASSWORD,
    displayName: 'Mailed Singer',
  })
  expect(response.status).toBe(200)
  return (await response.json()) as { token: string; userId: string }
}

// ── Reading the code ─────────────────────────────────────────────────
//
// With no RESEND_API_KEY the worker logs the code instead of mailing it, which
// is the affordance that makes the flow testable locally at all. Capturing it
// here pins that affordance as well as using it.
const logged: string[] = []
let logSpy: ReturnType<typeof vi.spyOn>

function lastMailedCode(): string {
  for (let i = logged.length - 1; i >= 0; i -= 1) {
    const match = /sign-in code \(email skipped[^)]*\): (\d{6})/.exec(
      logged[i] as string,
    )
    if (match) return match[1] as string
  }
  throw new Error('no sign-in code was logged')
}

/** Ask for a code and hand back both halves of what the browser now holds. */
async function requestCode(
  email: string,
): Promise<{ ceremony: string; code: string }> {
  const response = await post('/api/auth/email-code/request', { email })
  expect(response.status).toBe(200)
  const body = (await response.json()) as { ok: boolean; ceremony: string }
  expect(body.ok).toBe(true)
  return { ceremony: body.ceremony, code: lastMailedCode() }
}

function verify(ceremony: string, code: string): Promise<Response> {
  return post('/api/auth/email-code/verify', { ceremony, code })
}

function liveCodeRows(email: string): number {
  const row = sqlite
    .prepare(
      'SELECT COUNT(*) AS n FROM loginCodes WHERE email = ? AND usedAt IS NULL',
    )
    .get(email) as { n: number }
  return row.n
}

function freshDatabase(overrides: Partial<Env> = {}): void {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'login-code-integration-secret',
    TOTP_KEK,
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY: 'login-code-test-admin',
    ...overrides,
  }
}

beforeEach(() => {
  logged.length = 0
  logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '))
  })
  freshDatabase()
})

afterEach(() => {
  logSpy.mockRestore()
  sqlite.close()
})

describe('signing in with a mailed code', () => {
  it('trades the code for a real session', async () => {
    await register('mailed@example.com')
    const { ceremony, code } = await requestCode('mailed@example.com')

    const response = await verify(ceremony, code)
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(typeof body.token).toBe('string')

    // And a device row, so the new sign-in shows up in the device list like
    // any other.
    const sessions = sqlite
      .prepare('SELECT COUNT(*) AS n FROM authSessions WHERE userId = ?')
      .get(body.userId as string) as { n: number }
    expect(sessions.n).toBeGreaterThanOrEqual(1)
  })

  it('will not let the same code buy a second session', async () => {
    await register('once@example.com')
    const { ceremony, code } = await requestCode('once@example.com')

    expect((await verify(ceremony, code)).status).toBe(200)
    expect((await verify(ceremony, code)).status).toBe(401)
  })

  it('burns the row after five wrong guesses, right code or not', async () => {
    await register('burn@example.com')
    const { ceremony, code } = await requestCode('burn@example.com')

    for (let i = 0; i < LOGIN_CODE_MAX_ATTEMPTS; i += 1) {
      const wrong = String((Number(code) + i + 1) % 1_000_000).padStart(6, '0')
      expect((await verify(ceremony, wrong)).status).toBe(401)
    }
    // The correct code no longer works: the budget belongs to the row, not to
    // the guess.
    expect((await verify(ceremony, code)).status).toBe(401)
  })

  it('holds the cap under a burst of parallel guesses', async () => {
    // The attempt used to be read, compared, then incremented in a second
    // statement, so guesses in flight together all saw a budget. Spending
    // the attempt first, in one UPDATE with the cap in its WHERE, is what
    // bounds a burst.
    await register('burst@example.com')
    const { ceremony, code } = await requestCode('burst@example.com')
    const wrongs = Array.from({ length: 20 }, (_, i) =>
      String((Number(code) + i + 1) % 1_000_000).padStart(6, '0'),
    )
    const responses = await Promise.all(
      wrongs.map((wrong) => verify(ceremony, wrong)),
    )
    for (const response of responses) expect(response.status).toBe(401)
    const row = sqlite
      .prepare('SELECT attempts FROM loginCodes WHERE email = ?')
      .get('burst@example.com') as { attempts: number }
    expect(row.attempts).toBe(LOGIN_CODE_MAX_ATTEMPTS)
    expect((await verify(ceremony, code)).status).toBe(401)
  })

  it('refuses a code past its ten minutes', async () => {
    await register('stale@example.com')
    const { ceremony, code } = await requestCode('stale@example.com')
    sqlite.exec(`UPDATE loginCodes SET expiresAt = '2020-01-01T00:00:00.000Z'`)
    expect((await verify(ceremony, code)).status).toBe(401)
  })

  it("refuses a code held against another request's ceremony", async () => {
    // The ceremony addresses a row. Pairing one browser's token with another
    // browser's code must fail even though both are live and both are correct
    // for their own row.
    await register('a@example.com')
    await register('b@example.com')
    const first = await requestCode('a@example.com')
    const second = await requestCode('b@example.com')

    expect((await verify(second.ceremony, first.code)).status).toBe(401)
    expect((await verify(first.ceremony, second.code)).status).toBe(401)
    // Each still works with its own partner, so the refusal above was the
    // pairing and not something incidental.
    expect((await verify(first.ceremony, first.code)).status).toBe(200)
  })

  it('refuses a forged ceremony', async () => {
    await register('forged@example.com')
    const { code } = await requestCode('forged@example.com')
    expect((await verify('not.atoken', code)).status).toBe(401)
    expect((await verify('', code)).status).toBe(401)
  })
})

describe('what /request tells the world', () => {
  it('answers an unknown address exactly like a known one', async () => {
    // The one property that makes this endpoint safe to expose. Both branches
    // must produce the same keys and the same shape of ceremony.
    await register('known@example.com')

    const known = (await (
      await post('/api/auth/email-code/request', { email: 'known@example.com' })
    ).json()) as Record<string, unknown>
    const unknown = (await (
      await post('/api/auth/email-code/request', {
        email: 'nobody@example.com',
      })
    ).json()) as Record<string, unknown>

    expect(Object.keys(known).sort()).toEqual(Object.keys(unknown).sort())
    expect(unknown.ok).toBe(true)
    expect(typeof unknown.ceremony).toBe('string')
  })

  it('writes no row for an address with no account', async () => {
    await post('/api/auth/email-code/request', { email: 'ghost@example.com' })
    const rows = sqlite
      .prepare('SELECT COUNT(*) AS n FROM loginCodes')
      .get() as {
      n: number
    }
    expect(rows.n).toBe(0)
  })

  it('hands the unknown branch a ceremony that can never match', async () => {
    // It addresses row 0, and AUTOINCREMENT starts at 1. Nothing the holder
    // types can turn it into a session.
    const response = await post('/api/auth/email-code/request', {
      email: 'ghost@example.com',
    })
    const { ceremony } = (await response.json()) as { ceremony: string }
    for (const guess of ['000000', '123456', '999999']) {
      expect((await verify(ceremony, guess)).status).toBe(401)
    }
  })

  it('rejects a malformed address before doing any work', async () => {
    const response = await post('/api/auth/email-code/request', {
      email: 'not-an-address',
    })
    expect(response.status).toBe(400)
  })

  it('is unavailable in a pull-request preview', async () => {
    freshDatabase({ PR_PREVIEW: 'true' })
    const response = await post('/api/auth/email-code/request', {
      email: 'preview@example.com',
    })
    expect(response.status).toBe(503)
  })
})

describe('codes already in flight', () => {
  it('does not invalidate the code somebody is busy typing', async () => {
    // A new /request must not be a way to cancel someone else's code — that
    // would be a denial of service anybody could fire at any address.
    await register('flight@example.com')
    const first = await requestCode('flight@example.com')
    await requestCode('flight@example.com')

    expect((await verify(first.ceremony, first.code)).status).toBe(200)
  })

  it('caps how many live codes one address may hold', async () => {
    await register('cap@example.com')
    for (let i = 0; i < LOGIN_CODE_MAX_LIVE + 2; i += 1) {
      await requestCode('cap@example.com')
    }
    expect(liveCodeRows('cap@example.com')).toBe(LOGIN_CODE_MAX_LIVE)
  })

  it('prunes the oldest first', async () => {
    await register('prune@example.com')
    const oldest = await requestCode('prune@example.com')
    for (let i = 0; i < LOGIN_CODE_MAX_LIVE; i += 1) {
      await requestCode('prune@example.com')
    }
    expect((await verify(oldest.ceremony, oldest.code)).status).toBe(401)
  })
})

describe('what a mailed code proves', () => {
  it('confirms the address, because that is the same proof', async () => {
    const account = await register('confirm@example.com')
    const before = sqlite
      .prepare('SELECT emailVerified FROM users WHERE id = ?')
      .get(account.userId) as { emailVerified: number }
    expect(before.emailVerified).toBe(0)

    const { ceremony, code } = await requestCode('confirm@example.com')
    expect((await verify(ceremony, code)).status).toBe(200)

    const after = sqlite
      .prepare('SELECT emailVerified FROM users WHERE id = ?')
      .get(account.userId) as { emailVerified: number }
    expect(after.emailVerified).toBe(1)
  })

  it('is one factor, so a 2FA account still owes a code', async () => {
    const account = await register('both@example.com')
    const setup = await authedPost(account.token, '/api/auth/2fa/setup', {})
    const { secret } = (await setup.json()) as { secret: string }
    const step = Math.floor(Date.now() / 1000 / 30)
    expect(
      (
        await authedPost(account.token, '/api/auth/2fa/enable', {
          code: await totpCode(secret, step),
        })
      ).status,
    ).toBe(200)

    const { ceremony, code } = await requestCode('both@example.com')
    const response = await verify(ceremony, code)
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.twofaRequired).toBe(true)
    expect(body.token).toBeUndefined()
  })

  it('stops working when the account changes its address', async () => {
    // The code was mailed to an address that no longer speaks for the account.
    const account = await register('moved@example.com')
    const { ceremony, code } = await requestCode('moved@example.com')
    sqlite
      .prepare('UPDATE users SET email = ? WHERE id = ?')
      .run('elsewhere@example.com', account.userId)

    expect((await verify(ceremony, code)).status).toBe(401)
  })
})
