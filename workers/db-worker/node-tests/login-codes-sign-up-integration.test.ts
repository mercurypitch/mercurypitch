// @vitest-environment node
//
// ── A mailed code that sets an account up ────────────────────────────
//
// The phone offers one way in by email: type the address, get six digits,
// type them back. Until this change a code only ever addressed an existing
// account, so on the phone a new singer had to fall back to a password and a
// captcha. Now an address with no account can get a code too, and typing it
// back creates the account (S6 decision 05, option A).
//
// The sign-in half is pinned in login-codes-integration.test.ts. This file
// pins what the sign-up half must never do: answer a known and an unknown
// address differently, take an address somebody else holds, hand an anonymous
// device's history to a caller who cannot prove the device is theirs, or keep
// a stranger's address after its ten minutes are over.
//
// Opt-in. Only a client that asks with `signUp: true` (the native sheet) gets
// a sign-up code; the web's email-code pane sends no flag and keeps its
// answer, a ceremony that can never match anything.
//
// Run against real SQLite with the real migrations, driving the worker through
// its own HTTP surface.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const PASSWORD = 'Mailed123pass'
// Made up for this file: a v4-shaped id and two secrets of the accepted shape.
const DEVICE = '0c1d2e3f-4a5b-4c6d-8e7f-000000000001'
const DEVICE_SECRET = 'phone-secret-aaaaaaaaaaaaaaaaaaaa'
const WRONG_SECRET = 'phone-secret-bbbbbbbbbbbbbbbbbbbb'

let sqlite: DatabaseSync
// The shared perks database, which deleting an account also clears.
let perksSqlite: DatabaseSync
let env: Env

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
  headers: Record<string, string> = {},
): Promise<Response> {
  return workerRequest(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'Mozilla/5.0 (iPhone) Mobile/15E148',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

async function register(email: string): Promise<{ userId: string }> {
  const response = await post('/api/auth/register', {
    email,
    password: PASSWORD,
    displayName: 'Known Singer',
  })
  expect(response.status).toBe(200)
  return (await response.json()) as { userId: string }
}

// ── Reading the code ─────────────────────────────────────────────────
//
// With no RESEND_API_KEY the worker logs the code instead of mailing it, and
// says which kind it minted. That line is what the tests read the code from.
const logged: string[] = []
let logSpy: ReturnType<typeof vi.spyOn>

function codesLogged(kind: 'sign-in' | 'sign-up'): string[] {
  const pattern = new RegExp(`${kind} code \\(email skipped[^)]*\\): (\\d{6})`)
  return logged.flatMap((line) => {
    const match = pattern.exec(line)
    return match ? [match[1] as string] : []
  })
}

function lastCode(kind: 'sign-in' | 'sign-up'): string {
  const codes = codesLogged(kind)
  const code = codes[codes.length - 1]
  if (code === undefined) throw new Error(`no ${kind} code was logged`)
  return code
}

/** Ask for a code the way the native sheet does. */
async function askForCode(
  email: string,
  options: { signUp?: boolean; ip?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await post(
    '/api/auth/email-code/request',
    { email, signUp: options.signUp ?? true },
    options.ip === undefined ? {} : { 'CF-Connecting-IP': options.ip },
  )
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  }
}

async function verify(
  ceremony: unknown,
  code: string,
  device: { deviceId?: string; deviceSecret?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await post('/api/auth/email-code/verify', {
    ceremony,
    code,
    ...device,
  })
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  }
}

interface StoredUser {
  id: string
  authProvider: string
  email: string | null
  emailVerified: number
  passwordHash: string | null
}

function usersWithEmail(email: string): StoredUser[] {
  return sqlite
    .prepare(
      'SELECT id, authProvider, email, emailVerified, passwordHash FROM users WHERE email = ?',
    )
    .all(email) as unknown as StoredUser[]
}

function userById(id: string): StoredUser | undefined {
  return sqlite
    .prepare(
      'SELECT id, authProvider, email, emailVerified, passwordHash FROM users WHERE id = ?',
    )
    .get(id) as unknown as StoredUser | undefined
}

function codeRowsFor(email: string): number {
  const row = sqlite
    .prepare('SELECT COUNT(*) AS n FROM loginCodes WHERE email = ?')
    .get(email) as { n: number }
  return row.n
}

function freshDatabase(): void {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  perksSqlite = new DatabaseSync(':memory:')
  perksSqlite.exec(
    'CREATE TABLE perkGrants (email TEXT, perkId TEXT, revokedAt TEXT)',
  )
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    PERKS_DB: new SqliteD1Database(perksSqlite) as unknown as D1Database,
    JWT_SECRET: 'login-code-sign-up-secret',
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY: 'login-code-sign-up-admin',
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
  vi.unstubAllGlobals()
  vi.useRealTimers()
  sqlite.close()
  perksSqlite.close()
})

describe('a code for an address with no account', () => {
  it('sets up a confirmed account from the code, and signs it in', async () => {
    const { body: asked } = await askForCode('new@example.com')

    const { status, body } = await verify(asked.ceremony, lastCode('sign-up'))

    expect(status).toBe(200)
    expect(typeof body.token).toBe('string')
    expect(body.isNew).toBe(true)
    const [user] = usersWithEmail('new@example.com')
    expect(user?.id).toBe(body.userId)
    expect(user?.authProvider).toBe('password')
    expect(user?.emailVerified).toBe(1)
    expect(user?.passwordHash).toBeNull()
  })

  it('sets up one account, however often the same code is typed', async () => {
    const { body: asked } = await askForCode('once@example.com')
    const code = lastCode('sign-up')

    const first = await verify(asked.ceremony, code)
    const second = await verify(asked.ceremony, code)

    expect(first.status).toBe(200)
    expect(second.status).toBe(401)
    expect(usersWithEmail('once@example.com')).toHaveLength(1)
  })

  it('takes over the anonymous account the phone proves it holds', async () => {
    // In place, as the Apple, Google and password routes do, so everything
    // the phone practiced stays attached to the same id.
    const anonymous = await post('/api/auth/anonymous', {
      deviceId: DEVICE,
      deviceSecret: DEVICE_SECRET,
    })
    expect(anonymous.status).toBe(200)
    const { body: asked } = await askForCode('phone@example.com')

    const { status, body } = await verify(asked.ceremony, lastCode('sign-up'), {
      deviceId: DEVICE,
      deviceSecret: DEVICE_SECRET,
    })

    expect(status).toBe(200)
    expect(body.userId).toBe(DEVICE)
    expect(body.isNew).toBe(true)
    expect(userById(DEVICE)).toMatchObject({
      authProvider: 'password',
      email: 'phone@example.com',
      emailVerified: 1,
    })
    expect(usersWithEmail('phone@example.com')).toHaveLength(1)
  })

  it('sets up a separate account when the phone cannot prove the device', async () => {
    // The device id is public (it is printed on the leaderboard), so it is
    // never enough on its own to absorb somebody's history.
    await post('/api/auth/anonymous', {
      deviceId: DEVICE,
      deviceSecret: DEVICE_SECRET,
    })
    const { body: asked } = await askForCode('stranger@example.com')

    const { status, body } = await verify(asked.ceremony, lastCode('sign-up'), {
      deviceId: DEVICE,
      deviceSecret: WRONG_SECRET,
    })

    expect(status).toBe(200)
    expect(body.userId).not.toBe(DEVICE)
    expect(userById(DEVICE)).toMatchObject({
      authProvider: 'anonymous',
      email: null,
    })
  })

  it('does not take an address somebody claimed while the code was in flight', async () => {
    const { body: asked } = await askForCode('race@example.com')
    const code = lastCode('sign-up')
    const holder = await register('race@example.com')

    const { status } = await verify(asked.ceremony, code)

    expect(status).toBe(401)
    const users = usersWithEmail('race@example.com')
    expect(users).toHaveLength(1)
    expect(users[0]?.id).toBe(holder.userId)
    expect(users[0]?.emailVerified).toBe(0)
  })

  it('signs a known address in, not up, when the phone asks to set one up', async () => {
    const known = await register('known@example.com')
    const { body: asked } = await askForCode('known@example.com')

    const { status, body } = await verify(asked.ceremony, lastCode('sign-in'))

    expect(status).toBe(200)
    expect(body.userId).toBe(known.userId)
    expect(body.isNew).toBe(false)
    expect(codesLogged('sign-up')).toEqual([])
  })
})

describe('what a sign-up request tells the world', () => {
  it('answers a known and an unknown address alike, and mails both', async () => {
    await register('known@example.com')

    const known = await askForCode('known@example.com')
    const unknown = await askForCode('nobody@example.com')

    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    expect(Object.keys(unknown.body).sort()).toEqual(
      Object.keys(known.body).sort(),
    )
    expect(codesLogged('sign-in')).toHaveLength(1)
    expect(codesLogged('sign-up')).toHaveLength(1)
  })

  it('mails nothing to an unknown address that did not ask to sign up', async () => {
    // The web's email-code pane sends no flag, and its answer is unchanged.
    const { status, body } = await askForCode('ghost@example.com', {
      signUp: false,
    })

    expect(status).toBe(200)
    expect(typeof body.ceremony).toBe('string')
    expect(codesLogged('sign-up')).toEqual([])
    expect(codeRowsFor('ghost@example.com')).toBe(0)
  })

  // The sign-up budget is tighter than the sign-in one. A sign-up code goes to
  // an address nobody holds, and an unclaimed address never becomes "taken",
  // so this is the one mail a stranger can have sent to anybody again and
  // again. A real new singer needs one code, two at most (S6 security review,
  // finding 1). Each request below comes from a different IP: rotating them
  // must not buy a single extra mail.
  it('mints two sign-up codes an hour for an address, and refuses the third', async () => {
    const first = await askForCode('budget@example.com', {
      ip: '203.0.113.1',
    })
    const second = await askForCode('budget@example.com', {
      ip: '203.0.113.2',
    })
    expect(codesLogged('sign-up')).toHaveLength(2)

    const third = await askForCode('budget@example.com', {
      ip: '203.0.113.3',
    })

    // Refused silently, in the same shape as the two that were sent: a
    // visible refusal would say that the address has no account.
    expect(codesLogged('sign-up')).toHaveLength(2)
    expect(codeRowsFor('budget@example.com')).toBe(2)
    expect(third.status).toBe(200)
    expect(Object.keys(third.body).sort()).toEqual(
      Object.keys(first.body).sort(),
    )
    expect(second.status).toBe(200)
  })

  it('mints sign-up codes again once the hour is over', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    for (let i = 1; i <= 3; i += 1) {
      await askForCode('budget@example.com', { ip: `203.0.113.${i}` })
    }
    expect(codesLogged('sign-up')).toHaveLength(2)

    vi.setSystemTime(Date.now() + 60 * 60 * 1000)
    const afterTheHour = await askForCode('budget@example.com', {
      ip: '203.0.113.4',
    })

    expect(afterTheHour.status).toBe(200)
    expect(codesLogged('sign-up')).toHaveLength(3)
    const { status } = await verify(
      afterTheHour.body.ceremony,
      lastCode('sign-up'),
    )
    expect(status).toBe(200)
  })

  it('leaves a known address its five sign-in codes an hour', async () => {
    // The phone always asks with `signUp: true`, so a singer who already has
    // an account signs in through this same request. The tighter budget is
    // for addresses nobody holds, and must not reach them.
    await register('known@example.com')
    for (let i = 1; i <= 5; i += 1) {
      await askForCode('known@example.com', { ip: `203.0.113.${i}` })
    }
    expect(codesLogged('sign-in')).toHaveLength(5)

    await askForCode('known@example.com', { ip: '203.0.113.99' })

    expect(codesLogged('sign-in')).toHaveLength(5)
    expect(codesLogged('sign-up')).toEqual([])
  })

  it('mails the sign-up wording to a new address and the sign-in wording to a known one', async () => {
    env.RESEND_API_KEY = 'resend-test-key'
    const sent: { to: string[]; subject: string; text: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        sent.push(JSON.parse(String(init?.body)) as (typeof sent)[number])
        return new Response(JSON.stringify({ id: 'mail' }), { status: 200 })
      }),
    )
    await register('known@example.com')

    await askForCode('known@example.com')
    await askForCode('new@example.com')

    const toKnown = sent.filter((m) => m.to[0] === 'known@example.com')
    const toNew = sent.filter((m) => m.to[0] === 'new@example.com')
    expect(toKnown.at(-1)?.subject).toMatch(
      /^\d{6} is your MercuryPitch sign-in code$/,
    )
    expect(toNew).toHaveLength(1)
    expect(toNew[0]?.subject).toMatch(
      /^\d{6} is your MercuryPitch sign-up code$/,
    )
    expect(toNew[0]?.text).toContain(
      'No account is made unless the code is typed in',
    )
  })
})

describe('what is kept of an address', () => {
  it('forgets a sign-up code nobody used once its ten minutes are over', async () => {
    // It names an address with no account, so there is no account deletion
    // that would ever erase it.
    await askForCode('gone@example.com')
    sqlite.exec(`UPDATE loginCodes SET expiresAt = '2020-01-01T00:00:00.000Z'`)

    await askForCode('later@example.com')

    expect(codeRowsFor('gone@example.com')).toBe(0)
  })

  it('erases the code with the account it set up', async () => {
    const { body: asked } = await askForCode('leaving@example.com')
    const { body } = await verify(asked.ceremony, lastCode('sign-up'))

    const deleted = await workerRequest('/api/auth/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${String(body.token)}` },
    })

    expect(deleted.status).toBe(200)
    expect(codeRowsFor('leaving@example.com')).toBe(0)
  })
})
