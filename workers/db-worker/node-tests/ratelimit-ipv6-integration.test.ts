// @vitest-environment node
//
// ── One IPv6 allocation is one rate-limit budget ──────────────────────
//
// `ipRateLimitKey` is unit-tested on its own; this is the wiring. The two
// places an anonymous caller is throttled by address — `rateLimitSubject`
// (every generic write, the leaderboard, the weekly board) and the mirror
// event beacon's own limiter — must share ONE budget across a /64, or a
// tenant with a whole allocation mints a fresh budget per request by walking
// its own range. IPv4 stays per address: one address is one host.
//
// Run against real SQLite with the real migrations, driving the worker
// through its own HTTP surface.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

/** The limits in auth.ts this file relies on (per key, per window). */
const MIRROR_EVENT_LIMIT = 60
const CRUD_WRITE_LIMIT = 120
const LOGIN_LIMIT = 10
const REGISTER_LIMIT = 5
const PASSKEY_VERIFY_LIMIT = 20

let sqlite: DatabaseSync
let env: Env

/** POST /api/mirror/event as an anonymous beacon from `ip`. */
function mirrorEvent(ip: string): Promise<Response> {
  return worker.fetch(
    new Request('https://api.test/api/mirror/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': ip,
      },
      body: JSON.stringify({
        clientId: 'client-aaaaaaaa',
        event: 'mirror_view',
      }),
    }),
    env,
    {} as ExecutionContext,
  )
}

/**
 * POST /api/sessionRecords with no token from `ip`. The generic write limiter
 * (`crud-write`, keyed by rateLimitSubject) runs BEFORE handleCreate answers
 * 401 for the missing token, so each call spends one unit of the budget.
 */
function anonymousWrite(ip: string): Promise<Response> {
  return worker.fetch(
    new Request('https://api.test/api/sessionRecords', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': ip,
      },
      body: '{}',
    }),
    env,
    {} as ExecutionContext,
  )
}

/**
 * POST /api/auth/<route> from `ip`. The auth routes key their own limiter on
 * the address (a login cannot be bucketed by the user it has not proven), and
 * that key must be the same /64 bucket as everywhere else.
 */
function authPost(
  route: string,
  body: (call: number) => Record<string, string>,
): (ip: string) => Promise<Response> {
  let call = 0
  return (ip: string) => {
    call += 1
    return worker.fetch(
      new Request(`https://api.test/api/auth/${route}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': ip,
        },
        body: JSON.stringify(body(call)),
      }),
      env,
      {} as ExecutionContext,
    )
  }
}

/** Spend the whole budget from `ip`, asserting every call is `status`. */
async function exhaust(
  send: (ip: string) => Promise<Response>,
  ip: string,
  limit: number,
  status: number,
): Promise<void> {
  for (let i = 0; i < limit; i += 1) {
    expect((await send(ip)).status, `call ${i + 1} from ${ip}`).toBe(status)
  }
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'ratelimit-ipv6-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
  }
})

afterEach(() => {
  sqlite.close()
})

describe('the mirror event limiter', () => {
  it('shares one budget across a /64', async () => {
    await exhaust(mirrorEvent, '2001:db8:1:2::1', MIRROR_EVENT_LIMIT, 201)

    // A different address in the SAME /64 does not get a fresh budget.
    const sibling = await mirrorEvent('2001:db8:1:2::ffff')
    expect(sibling.status).toBe(429)
    expect(sibling.headers.get('Retry-After')).not.toBeNull()

    // Nor does the far end of the allocation, written out in full.
    expect((await mirrorEvent('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).status).toBe(
      429,
    )
  })

  it('gives a different /64 its own budget', async () => {
    await exhaust(mirrorEvent, '2001:db8:1:2::1', MIRROR_EVENT_LIMIT, 201)
    expect((await mirrorEvent('2001:db8:1:2::2')).status).toBe(429)

    // One hextet over is another allocation, so another tenant.
    expect((await mirrorEvent('2001:db8:1:3::1')).status).toBe(201)
  })

  it('keeps IPv4 per address', async () => {
    await exhaust(mirrorEvent, '203.0.113.7', MIRROR_EVENT_LIMIT, 201)
    expect((await mirrorEvent('203.0.113.7')).status).toBe(429)

    // The next address along is a different host, so a different budget.
    expect((await mirrorEvent('203.0.113.8')).status).toBe(201)
  })
})

describe('the generic write limiter (rateLimitSubject)', () => {
  it('shares one budget across a /64 for anonymous writes', async () => {
    // Every call answers 401 (no token), which is after the limiter ran.
    await exhaust(anonymousWrite, '2001:db8:9:9::1', CRUD_WRITE_LIMIT, 401)

    const sibling = await anonymousWrite('2001:db8:9:9::2')
    expect(sibling.status).toBe(429)
    expect(sibling.headers.get('Retry-After')).not.toBeNull()

    // And a different /64 is still let through to the (401) handler.
    expect((await anonymousWrite('2001:db8:9:a::1')).status).toBe(401)
  })
})

describe('the auth route limiters', () => {
  it('login shares one budget across a /64', async () => {
    // Every attempt is a wrong password for an account that does not exist
    // (401), and every one of them spends the address budget: the limiter
    // runs before the handler, and only a CORRECT login clears it. A fresh
    // address per call keeps the separate per-email limiter out of the way,
    // so what trips below is the address bucket and nothing else.
    const login = authPost('login', (n) => ({
      email: `nobody-${n}@example.com`,
      password: 'wrong-password-1',
    }))
    await exhaust(login, '2001:db8:7:7::1', LOGIN_LIMIT, 401)

    const sibling = await login('2001:db8:7:7::2')
    expect(sibling.status).toBe(429)
    expect(sibling.headers.get('Retry-After')).not.toBeNull()

    // The neighbouring /64 still gets to the handler.
    expect((await login('2001:db8:7:8::1')).status).toBe(401)
  })

  it('register shares one budget across a /64', async () => {
    // Each call registers a fresh address, so every one is a real sign-up
    // (200) until the /64 is spent; the next address in it gets 429.
    const register = authPost('register', (n) => ({
      email: `tenant-${n}@example.com`,
      password: 'Longenough1',
      displayName: 'Tenant',
    }))
    await exhaust(register, '2001:db8:8:8::1', REGISTER_LIMIT, 200)

    const sibling = await register('2001:db8:8:8::ffff')
    expect(sibling.status).toBe(429)
    expect(sibling.headers.get('Retry-After')).not.toBeNull()
    // And no account was created for the refused call.
    const rows = sqlite
      .prepare('SELECT COUNT(*) AS n FROM users WHERE email LIKE ?')
      .get('tenant-%@example.com') as { n: number }
    expect(rows.n).toBe(REGISTER_LIMIT)
  })

  it('passkey sign-in shares one budget across a /64 (own module, same key)', async () => {
    // The passkey routes keep their own limiter in passkey-routes.ts; what is
    // pinned here is that it keys on the same /64 bucket as auth.ts. A body
    // with no ceremony is refused (401) after the limiter has counted it.
    const verify = authPost('passkey/login/verify', () => ({}))
    await exhaust(verify, '2001:db8:6:6::1', PASSKEY_VERIFY_LIMIT, 401)

    const sibling = await verify('2001:db8:6:6::2')
    expect(sibling.status).toBe(429)
    expect(sibling.headers.get('Retry-After')).not.toBeNull()

    expect((await verify('2001:db8:6:7::1')).status).toBe(401)
  })
})
