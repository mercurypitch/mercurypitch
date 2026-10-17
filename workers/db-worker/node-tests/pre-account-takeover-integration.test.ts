// @vitest-environment node
//
// ── Proving the inbox reclaims the account from whoever registered it ─
//
// Registration asks for no proof of the mailbox, so a stranger can register
// an address they do not own and keep a working password and session on it.
// The real owner then signs in the one way that proves the inbox — a mailed
// code — and must land in a CLEAN account: the stranger's password must stop
// working and their session must be revoked. This pins that.
//
// The reclaim fires exactly once, on the 0 -> 1 transition of emailVerified,
// and it revokes FIRST factors only: the password, every session, every
// passkey. A second factor (TOTP, recovery codes) is kept, so a mailed code
// is still challenged against it rather than quietly downgrading the account.
//
// Driven through the worker's own HTTP surface against real SQLite.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { totpCode } from '../src/totp'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const OWNER_EMAIL = 'owner@example.com'
const STRANGER_PASSWORD = 'Stranger123pass'
const NOW = '2026-10-17T12:00:00.000Z'
const TOTP_KEK = 'pre-account-takeover-kek'

let sqlite: DatabaseSync
let env: Env
const logged: string[] = []

function post(path: string, body: unknown, token?: string): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36',
        ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    }),
    env,
    {} as ExecutionContext,
  )
}

function authedGet(path: string, token: string): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env,
    {} as ExecutionContext,
  )
}

function lastMailedCode(): string {
  for (let i = logged.length - 1; i >= 0; i -= 1) {
    const m = /sign-in code \(email skipped[^)]*\): (\d{6})/.exec(
      logged[i] as string,
    )
    if (m) return m[1] as string
  }
  throw new Error('no sign-in code was logged')
}

/** A password registration — an account with no proof of the mailbox. */
async function register(
  email: string,
): Promise<{ token: string; userId: string }> {
  const reg = await post('/api/auth/register', {
    email,
    password: STRANGER_PASSWORD,
    displayName: 'Placeholder',
  })
  expect(reg.status).toBe(200)
  return (await reg.json()) as { token: string; userId: string }
}

/** Sign in by mailed code: the one path that proves the inbox. */
async function signInByCode(email: string): Promise<Response> {
  const reqCode = await post('/api/auth/email-code/request', { email })
  expect(reqCode.status).toBe(200)
  const { ceremony } = (await reqCode.json()) as { ceremony: string }
  return post('/api/auth/email-code/verify', {
    ceremony,
    code: lastMailedCode(),
  })
}

function userRow(userId: string): {
  emailVerified: number
  passwordHash: unknown
  tokenVersion: number
} {
  return sqlite
    .prepare(
      'SELECT emailVerified, passwordHash, tokenVersion FROM users WHERE id = ?',
    )
    .get(userId) as {
    emailVerified: number
    passwordHash: unknown
    tokenVersion: number
  }
}

function countRows(table: string, userId: string): number {
  return (
    sqlite
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE userId = ?`)
      .get(userId) as { n: number }
  ).n
}

beforeEach(() => {
  logged.length = 0
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '))
  })
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'pre-account-takeover-secret',
    TOTP_KEK,
    ALLOWED_ORIGINS: 'http://localhost',
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  sqlite.close()
})

describe('an unverified account claimed by the inbox owner', () => {
  it('revokes the pre-sign-in password and session', async () => {
    // A stranger registers an address they do not own.
    const stranger = await register(OWNER_EMAIL)

    // The real owner signs in with a code mailed to their inbox.
    const verify = await signInByCode(OWNER_EMAIL)
    expect(verify.status).toBe(200)
    const owner = (await verify.json()) as { token: string; userId: string }

    // Same row (the owner did not get a second account)...
    expect(owner.userId).toBe(stranger.userId)

    // ...but the stranger is locked out: their password no longer works,
    const pwLogin = await post('/api/auth/login', {
      email: OWNER_EMAIL,
      password: STRANGER_PASSWORD,
    })
    expect(pwLogin.status).toBe(401)

    // and their old session token is revoked.
    const strangerSession = await authedGet('/api/auth/me', stranger.token)
    expect(strangerSession.status).toBe(401)

    // The owner's fresh session works, and the account is marked verified.
    const ownerSession = await authedGet('/api/auth/me', owner.token)
    expect(ownerSession.status).toBe(200)
    const verified = userRow(owner.userId)
    expect(verified.emailVerified).toBe(1)
    expect(verified.passwordHash).toBeNull()
  })

  it('also drops any passkey registered before the proof', async () => {
    const stranger = await register(OWNER_EMAIL)
    // A passkey is a FIRST factor: left in place it would let the stranger
    // back in after their password was cleared.
    sqlite
      .prepare(
        `INSERT INTO webauthnCredentials (id, userId, publicKey, counter, createdAt)
         VALUES ('cred-1', ?, 'pk', 0, ?)`,
      )
      .run(stranger.userId, NOW)
    expect(countRows('webauthnCredentials', stranger.userId)).toBe(1)
    const before = userRow(stranger.userId)

    const verify = await signInByCode(OWNER_EMAIL)
    expect(verify.status).toBe(200)

    expect(countRows('webauthnCredentials', stranger.userId)).toBe(0)
    // Exactly one bump: every token minted before the proof stops verifying,
    // and the owner's fresh one (minted after) carries the new version.
    const after = userRow(stranger.userId)
    expect(after.tokenVersion).toBe(before.tokenVersion + 1)
    expect(after.emailVerified).toBe(1)
  })

  it('a verified account signing in by code keeps its password and other sessions', async () => {
    const account = await register(OWNER_EMAIL)
    // Model an address already confirmed by the link: the reclaim is for the
    // 0 -> 1 transition only, so an account that has proven its inbox once
    // keeps everything on a later code sign-in.
    sqlite
      .prepare('UPDATE users SET emailVerified = 1 WHERE id = ?')
      .run(account.userId)
    const before = userRow(account.userId)
    expect(before.passwordHash).not.toBeNull()

    const verify = await signInByCode(OWNER_EMAIL)
    expect(verify.status).toBe(200)
    const body = (await verify.json()) as { token?: string }
    expect(typeof body.token).toBe('string')

    // The password still works...
    const pwLogin = await post('/api/auth/login', {
      email: OWNER_EMAIL,
      password: STRANGER_PASSWORD,
    })
    expect(pwLogin.status).toBe(200)
    // ...the session from registration is still signed in...
    expect((await authedGet('/api/auth/me', account.token)).status).toBe(200)
    // ...and nothing about the row's credentials moved.
    const after = userRow(account.userId)
    expect(after.passwordHash).not.toBeNull()
    expect(after.tokenVersion).toBe(before.tokenVersion)
    expect(after.emailVerified).toBe(1)
  })

  it('a second-factor account is still challenged, not reset', async () => {
    const stranger = await register(OWNER_EMAIL)
    // Whoever holds the unverified account enrols TOTP on it.
    const setup = await post('/api/auth/2fa/setup', {}, stranger.token)
    expect(setup.status).toBe(200)
    const { secret } = (await setup.json()) as { secret: string }
    const step = Math.floor(Date.now() / 1000 / 30)
    const enable = await post(
      '/api/auth/2fa/enable',
      { code: await totpCode(secret, step) },
      stranger.token,
    )
    expect(enable.status).toBe(200)
    expect(countRows('totpCredentials', stranger.userId)).toBe(1)
    const recoveryBefore = countRows('recoveryCodes', stranger.userId)
    expect(recoveryBefore).toBeGreaterThan(0)

    // The owner proves the inbox. The second factor stands: a mailed code is
    // one factor, so the owner owes the TOTP code and gets no session yet.
    const verify = await signInByCode(OWNER_EMAIL)
    expect(verify.status).toBe(200)
    const body = (await verify.json()) as Record<string, unknown>
    expect(body.twofaRequired).toBe(true)
    expect(body.token).toBeUndefined()

    // 2FA was NOT downgraded by the reclaim...
    expect(countRows('totpCredentials', stranger.userId)).toBe(1)
    expect(countRows('recoveryCodes', stranger.userId)).toBe(recoveryBefore)
    // ...while the first factor set before the proof is gone.
    const after = userRow(stranger.userId)
    expect(after.passwordHash).toBeNull()
    expect(after.emailVerified).toBe(1)
  })
})
