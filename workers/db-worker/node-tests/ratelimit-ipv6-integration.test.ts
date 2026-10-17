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

/** The limits in auth.ts this file relies on (per key, per minute). */
const MIRROR_EVENT_LIMIT = 60
const CRUD_WRITE_LIMIT = 120

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
