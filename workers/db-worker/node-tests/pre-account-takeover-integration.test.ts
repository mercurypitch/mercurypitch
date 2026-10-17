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
// Driven through the worker's own HTTP surface against real SQLite.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const OWNER_EMAIL = 'owner@example.com'
const STRANGER_PASSWORD = 'Stranger123pass'

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
    const reg = await post('/api/auth/register', {
      email: OWNER_EMAIL,
      password: STRANGER_PASSWORD,
      displayName: 'Placeholder',
    })
    expect(reg.status).toBe(200)
    const stranger = (await reg.json()) as { token: string; userId: string }

    // The real owner signs in with a code mailed to their inbox.
    const reqCode = await post('/api/auth/email-code/request', {
      email: OWNER_EMAIL,
    })
    expect(reqCode.status).toBe(200)
    const { ceremony } = (await reqCode.json()) as { ceremony: string }
    const verify = await post('/api/auth/email-code/verify', {
      ceremony,
      code: lastMailedCode(),
    })
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
    const verified = sqlite
      .prepare('SELECT emailVerified, passwordHash FROM users WHERE id = ?')
      .get(owner.userId) as { emailVerified: number; passwordHash: unknown }
    expect(verified.emailVerified).toBe(1)
    expect(verified.passwordHash).toBeNull()
  })
})
