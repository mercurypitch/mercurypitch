// @vitest-environment node
//
// ── Two requests for one sign-up ─────────────────────────────────────
//
// Sign-up paths read, then write: look for the row, create or upgrade it.
// D1 has no transaction to hold between the two, so a second request for the
// same sign-up (two tabs on a first launch, a double tap) can land in the
// gap. Each case below runs that second request to completion inside the
// first one's gap, against real SQL, and asks that neither caller is answered
// with a 500 or handed a session that is already dead.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, justBefore, SqliteD1Database } from './sqlite-d1'

let sqlite: DatabaseSync
let d1: SqliteD1Database
let env: Env

async function call(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token !== undefined) headers.Authorization = `Bearer ${token}`
  const response = await worker.fetch(
    new Request(`https://api.test${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
    {} as ExecutionContext,
  )
  const text = await response.text()
  return {
    status: response.status,
    body: text === '' ? null : JSON.parse(text),
  }
}

function usersWithId(id: string): number {
  return (
    sqlite.prepare('SELECT COUNT(*) AS n FROM users WHERE id = ?').get(id) as {
      n: number
    }
  ).n
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  d1 = new SqliteD1Database(sqlite)
  env = {
    DB: d1 as unknown as D1Database,
    JWT_SECRET: 'sign-up-races-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
  }
})

afterEach(() => {
  sqlite.close()
})

describe('two first sign-ins for one device', () => {
  const deviceId = '00000000-0000-4000-8000-0000000000d1'
  const deviceSecret = 'device-secret-for-the-race-test-0001'

  it('gives both a session for that device', async () => {
    let second: { status: number; body: any } | undefined
    justBefore(d1, /INSERT INTO users/, async () => {
      second = await call('POST', '/api/auth/anonymous', {
        deviceId,
        deviceSecret,
      })
    })
    const first = await call('POST', '/api/auth/anonymous', {
      deviceId,
      deviceSecret,
    })

    expect([first.status, second?.status]).toEqual([200, 200])
    expect(first.body.user.id).toBe(deviceId)
    expect(second?.body.user.id).toBe(deviceId)
    expect(usersWithId(deviceId)).toBe(1)
    // Both tokens work.
    for (const token of [first.body.token, second?.body.token]) {
      expect((await call('GET', '/api/auth/me', undefined, token)).status).toBe(
        200,
      )
    }
  })

  it('still asks the request that lost the race for the device secret', async () => {
    let owner: { status: number } | undefined
    justBefore(d1, /INSERT INTO users/, async () => {
      owner = await call('POST', '/api/auth/anonymous', {
        deviceId,
        deviceSecret,
      })
    })
    const stranger = await call('POST', '/api/auth/anonymous', {
      deviceId,
      deviceSecret: 'a-different-secret-than-the-owners-0002',
    })

    expect(owner?.status).toBe(200)
    expect(stranger.status).toBe(403)
  })
})

describe('a double-submitted sign-up', () => {
  const password = 'Correct-Horse-Battery-9'

  it('answers the second with 409, never 500', async () => {
    const body = { email: 'double@example.com', password }
    let second: { status: number; body: any } | undefined
    justBefore(d1, /INSERT INTO users \(/, async () => {
      second = await call('POST', '/api/auth/register', body)
    })
    const first = await call('POST', '/api/auth/register', body)

    expect([first.status, second?.status].sort()).toEqual([200, 409])
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS n FROM users WHERE email = 'double@example.com'",
        )
        .get(),
    ).toEqual({ n: 1 })
  })

  it('upgrades one device once, and the session it hands out works', async () => {
    const deviceId = '00000000-0000-4000-8000-0000000000d2'
    const deviceSecret = 'device-secret-for-the-race-test-0003'
    expect(
      (await call('POST', '/api/auth/anonymous', { deviceId, deviceSecret }))
        .status,
    ).toBe(200)
    const body = { email: 'tap@example.com', password, deviceId, deviceSecret }

    // Both requests read the device while it is still anonymous; the second
    // upgrades it before the first's UPDATE runs.
    let second: { status: number; body: any } | undefined
    justBefore(d1, /UPDATE users SET authProvider = 'password'/, async () => {
      second = await call('POST', '/api/auth/register', body)
    })
    const first = await call('POST', '/api/auth/register', body)

    const won = [first, second].filter((r) => r?.status === 200)
    expect(won).toHaveLength(1)
    expect([first.status, second?.status]).toContain(409)
    // Before, both upgraded, and the second bump of tokenVersion revoked the
    // session the first winner had just been handed.
    expect(
      (await call('GET', '/api/auth/me', undefined, won[0]?.body.token)).status,
    ).toBe(200)
  })
})
