// @vitest-environment node
//
// ── Signing out on one device must not sign out the others ───────────
//
// The defect this closes: `POST /api/auth/logout` incremented
// `users.tokenVersion`, which is a single counter shared by every token the
// account has ever been issued. So signing out on a phone signed out the
// laptop and the television with it, there was no way to see where an account
// was signed in, and no way to end one device.
//
// It also blocked the thing 2FA enrollment has to do — evict every session
// that got in on one factor while keeping the one doing the enrolling. The
// last describe below is that behaviour, tested here rather than with the 2FA
// routes because it is a property of the session table, not of TOTP.
//
// Run against real SQLite with the real migrations applied, so the SQL is
// exercised as written.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import { endOtherSessions, sweepExpiredSessions } from '../src/auth-sessions'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const ADMIN_KEY = 'auth-sessions-test-admin'
const PASSWORD = 'Sessions123pass'

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

function post(
  path: string,
  body: unknown,
  userAgent = 'Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36',
): Promise<Response> {
  return workerRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': userAgent },
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

async function register(email: string): Promise<Account> {
  const response = await post('/api/auth/register', {
    email,
    password: PASSWORD,
    displayName: 'Sessions Singer',
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Account
}

/** Sign the same account in again, as if from another device. */
async function login(email: string, userAgent: string): Promise<Account> {
  const response = await post(
    '/api/auth/login',
    { email, password: PASSWORD },
    userAgent,
  )
  expect(response.status).toBe(200)
  return (await response.json()) as Account
}

async function meStatus(token: string): Promise<number> {
  return (await authed(token, '/api/auth/me')).status
}

/**
 * A token exactly as the released build minted them: correctly signed, correct
 * tokenVersion, and no `sid` claim at all. Hand-rolled rather than obtained
 * from the worker, because the worker can no longer produce one — which is the
 * whole point of the tests below.
 */
async function legacyToken(userId: string): Promise<string> {
  const secret = env.JWT_SECRET as string
  const b64url = (bytes: Uint8Array): string =>
    Buffer.from(bytes)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  const encode = (value: object): string =>
    b64url(new TextEncoder().encode(JSON.stringify(value)))
  const { tokenVersion } = sqlite
    .prepare('SELECT tokenVersion FROM users WHERE id = ?')
    .get(userId) as { tokenVersion: number }
  const now = Math.floor(Date.now() / 1000)
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: userId,
    provider: 'password',
    iat: now,
    exp: now + 3600,
    v: tokenVersion,
  })}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  )
  return `${data}.${b64url(new Uint8Array(signature))}`
}

function sessionRowCount(userId: string): number {
  const row = sqlite
    .prepare('SELECT COUNT(*) AS n FROM authSessions WHERE userId = ?')
    .get(userId) as { n: number }
  return row.n
}

function freshDatabase(): void {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'auth-sessions-integration-secret',
    // Registration passes through the Turnstile gate; a local origin with no
    // TURNSTILE_SECRET is the one configuration it lets by, and it is what a
    // developer running the worker locally has.
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
  }
}

afterEach(() => {
  sqlite.close()
})

describe('one row per signed-in device', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('records a session for every sign-in', async () => {
    const first = await register('devices@example.com')
    expect(sessionRowCount(first.userId)).toBe(1)

    await login('devices@example.com', 'Mozilla/5.0 (iPhone) Safari/604.1')
    expect(sessionRowCount(first.userId)).toBe(2)
  })

  it('lists the devices, and says which one is asking', async () => {
    const laptop = await register('list@example.com')
    const phone = await login(
      'list@example.com',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Safari/604.1',
    )

    const response = await authed(phone.token, '/api/auth/sessions')
    expect(response.status).toBe(200)
    const { sessions } = (await response.json()) as {
      sessions: { id: string; label: string; current: boolean }[]
    }
    expect(sessions).toHaveLength(2)
    expect(sessions.filter((s) => s.current)).toHaveLength(1)
    expect(sessions.map((s) => s.label).sort()).toEqual([
      'Chrome on Mac',
      'Safari on iPhone',
    ])
    // The laptop's token is untouched by the phone merely looking.
    expect(await meStatus(laptop.token)).toBe(200)
  })
})

describe('signing out', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('ends this device and leaves the others signed in', async () => {
    const laptop = await register('one@example.com')
    const phone = await login('one@example.com', 'Mozilla/5.0 (iPhone)')

    const out = await authed(phone.token, '/api/auth/logout', {
      method: 'POST',
    })
    expect(out.status).toBe(200)
    expect(await out.json()).toEqual({ ok: true, scope: 'device' })

    // The regression this whole migration exists for.
    expect(await meStatus(phone.token)).toBe(401)
    expect(await meStatus(laptop.token)).toBe(200)
  })

  it('ends every device when asked to, including this one', async () => {
    const laptop = await register('all@example.com')
    const phone = await login('all@example.com', 'Mozilla/5.0 (iPhone)')

    const out = await authed(laptop.token, '/api/auth/logout-all', {
      method: 'POST',
    })
    expect(out.status).toBe(200)
    expect(await out.json()).toEqual({ ok: true, scope: 'all' })

    expect(await meStatus(laptop.token)).toBe(401)
    expect(await meStatus(phone.token)).toBe(401)
    expect(sessionRowCount(laptop.userId)).toBe(0)
  })

  it('ends a named device from the list', async () => {
    const laptop = await register('named@example.com')
    const phone = await login('named@example.com', 'Mozilla/5.0 (iPhone)')

    const listed = (await (
      await authed(laptop.token, '/api/auth/sessions')
    ).json()) as { sessions: { id: string; current: boolean }[] }
    const other = listed.sessions.find((s) => !s.current)
    expect(other).toBeDefined()

    const revoked = await authed(
      laptop.token,
      `/api/auth/sessions/${other?.id ?? ''}`,
      { method: 'DELETE' },
    )
    expect(revoked.status).toBe(200)
    expect(await meStatus(phone.token)).toBe(401)
    expect(await meStatus(laptop.token)).toBe(200)
  })

  it('will not end a session belonging to someone else', async () => {
    const mine = await register('mine@example.com')
    const theirs = await register('theirs@example.com')
    const theirSession = sqlite
      .prepare('SELECT id FROM authSessions WHERE userId = ?')
      .get(theirs.userId) as { id: string }

    // Scoped by the DELETE itself, so a wrong owner is indistinguishable from
    // a nonexistent id — this cannot be used to probe which ids exist.
    const response = await authed(
      mine.token,
      `/api/auth/sessions/${theirSession.id}`,
      { method: 'DELETE' },
    )
    expect(response.status).toBe(404)
    expect(await meStatus(theirs.token)).toBe(200)
  })
})

describe('tokens issued before the sessions table existed', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('keeps working, because a hard cutover would sign everyone out', async () => {
    const account = await register('legacy@example.com')
    const legacy = await legacyToken(account.userId)
    // The deploy-day guarantee: a token with no `sid` names no row, and must
    // go on verifying until it expires on its own.
    expect(await meStatus(legacy)).toBe(200)
  })

  it('is still revoked by the version counter', async () => {
    const account = await register('legacyrevoke@example.com')
    const legacy = await legacyToken(account.userId)
    sqlite
      .prepare('UPDATE users SET tokenVersion = tokenVersion + 1 WHERE id = ?')
      .run(account.userId)
    // tokenVersion is the only lever that reaches a sid-less token, which is
    // exactly why it stays after this migration.
    expect(await meStatus(legacy)).toBe(401)
  })

  it('signs out for real, instead of reporting a sign-out that did nothing', async () => {
    const account = await register('fallback@example.com')
    const legacy = await legacyToken(account.userId)

    const out = await authed(legacy, '/api/auth/logout', { method: 'POST' })
    expect(out.status).toBe(200)
    // There is no row to delete, so it falls back to revoking everything.
    // Answering a cheerful `ok` while leaving the session alive is the one
    // thing a sign-out must never do.
    expect(await out.json()).toEqual({ ok: true, scope: 'all' })
    expect(await meStatus(legacy)).toBe(401)
    expect(await meStatus(account.token)).toBe(401)
  })
})

describe('enrolling a second factor evicts the sessions that predate it', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('keeps the enrolling device and ends every other', async () => {
    const enrolling = await register('enroll@example.com')
    const intruder = await login('enroll@example.com', 'Mozilla/5.0 (Windows)')
    expect(sessionRowCount(enrolling.userId)).toBe(2)

    const keep = sqlite
      .prepare(
        'SELECT id FROM authSessions WHERE userId = ? ORDER BY createdAt ASC',
      )
      .get(enrolling.userId) as { id: string }
    await endOtherSessions(
      env.DB as unknown as D1Database,
      enrolling.userId,
      keep.id,
    )

    expect(sessionRowCount(enrolling.userId)).toBe(1)
    expect(await meStatus(enrolling.token)).toBe(200)
    expect(await meStatus(intruder.token)).toBe(401)
  })

  it('ends every session when the enroller has no session to keep', async () => {
    // A caller whose own token predates 0038 has no `sid`. Signing them out
    // too is the safe direction: they can sign back in with the factor they
    // just enrolled, and the intruder cannot.
    const account = await register('nokeep@example.com')
    await endOtherSessions(
      env.DB as unknown as D1Database,
      account.userId,
      null,
    )
    expect(sessionRowCount(account.userId)).toBe(0)
  })
})

describe('the expiry sweep', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('drops rows past the token lifetime and keeps live ones', async () => {
    const account = await register('sweep@example.com')
    sqlite
      .prepare(
        `INSERT INTO authSessions (id, userId, provider, createdAt, lastSeenAt)
         VALUES ('ancient', ?, 'password', datetime('now', '-400 days'),
                 datetime('now', '-400 days'))`,
      )
      .run(account.userId)
    expect(sessionRowCount(account.userId)).toBe(2)

    await sweepExpiredSessions(
      env.DB as unknown as D1Database,
      30 * 24 * 60 * 60,
    )

    expect(sessionRowCount(account.userId)).toBe(1)
    expect(await meStatus(account.token)).toBe(200)
  })

  it('leaves a row alone while its token could still verify', async () => {
    const account = await register('grace@example.com')
    // Exactly at the TTL, inside the day of slack the sweep allows. Removing
    // it here would sign someone out a moment before their token was due to
    // expire anyway, for no reason beyond two clocks disagreeing.
    sqlite
      .prepare(
        `UPDATE authSessions SET createdAt = datetime('now', '-30 days')
          WHERE userId = ?`,
      )
      .run(account.userId)

    await sweepExpiredSessions(
      env.DB as unknown as D1Database,
      30 * 24 * 60 * 60,
    )
    expect(sessionRowCount(account.userId)).toBe(1)
  })
})

describe('a correct password does not spend the guessing budget', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('lets one person sign in past the per-IP cap', async () => {
    // `login` allows ten per five minutes per IP, and an IP is not a person: a
    // household, a school music lab and a whole mobile carrier behind CGNAT
    // all share one. Counting successes locked out the only caller who cannot
    // possibly be the attacker.
    await register('busy@example.com')
    for (let attempt = 0; attempt < 14; attempt++) {
      const response = await post('/api/auth/login', {
        email: 'busy@example.com',
        password: PASSWORD,
      })
      expect(response.status).toBe(200)
    }
  })

  it('still counts the failures', async () => {
    await register('guessed@example.com')
    const statuses: number[] = []
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await post('/api/auth/login', {
        email: 'guessed@example.com',
        password: 'wrong-password-entirely',
      })
      statuses.push(response.status)
    }
    // Wrong passwords accumulate exactly as before and hit the cap.
    expect(statuses).toContain(429)
  })
})

describe('deleting the account takes its sessions with it', () => {
  beforeEach(() => {
    freshDatabase()
  })

  it('leaves no row naming a user id that no longer exists', async () => {
    const account = await register('erase@example.com')
    await login('erase@example.com', 'Mozilla/5.0 (iPhone)')
    expect(sessionRowCount(account.userId)).toBe(2)

    const deleted = await authed(account.token, '/api/auth/me', {
      method: 'DELETE',
    })
    expect(deleted.status).toBe(200)
    expect(sessionRowCount(account.userId)).toBe(0)
  })
})
