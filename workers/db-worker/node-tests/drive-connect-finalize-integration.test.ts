// @vitest-environment node
//
// ── Connecting a Drive cannot attach it to a different account ───────
//
// The connect callback runs in whichever browser completed Google's consent,
// which need not be the one that started the connect. It must therefore store
// nothing against the state's account; it hands back a grant sealed to the
// starter, and POST /drive/finish stores it only for a caller whose own token
// proves it IS that account. This drives the real callback (Google stubbed)
// and then tries to finish the grant as the wrong account and the right one.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const GOOGLE_CLIENT = 'drive-finalize.apps.googleusercontent.com'
const RETURN_TO = 'http://localhost:3000/'

let sqlite: DatabaseSync
let env: Env

function fetchWorker(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

async function register(
  email: string,
): Promise<{ token: string; userId: string }> {
  const res = await fetchWorker('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36',
    },
    body: JSON.stringify({
      email,
      password: 'DriveFinal123pass',
      displayName: 'Drive User',
    }),
  })
  expect(res.status).toBe(200)
  return (await res.json()) as { token: string; userId: string }
}

/** Start a connect as `token` and return the signed `state` Google would echo. */
async function startStateFor(token: string): Promise<string> {
  const res = await fetchWorker('/api/auth/drive/start', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ returnTo: RETURN_TO }),
  })
  expect(res.status).toBe(200)
  const { url } = (await res.json()) as { url: string }
  const state = new URL(url).searchParams.get('state')
  expect(state).not.toBeNull()
  return state as string
}

/** Drive the callback with Google stubbed; return the sealed pending blob. */
async function pendingGrantFrom(state: string): Promise<string> {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const href =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    if (href.includes('oauth2.googleapis.com/token')) {
      return new Response(
        JSON.stringify({
          id_token: 'stub-id-token',
          access_token: 'stub-access',
          refresh_token: 'stub-refresh-token',
          scope: 'https://www.googleapis.com/auth/drive.file',
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (href.includes('oauth2/v3/tokeninfo')) {
      return new Response(
        JSON.stringify({
          aud: GOOGLE_CLIENT,
          sub: 'google-sub',
          email: 'drive-owner@example.com',
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
    throw new Error(`unexpected fetch in drive finalize test: ${href}`)
  })
  const res = await fetchWorker(
    `/api/auth/google/callback?code=auth-code&state=${encodeURIComponent(state)}`,
  )
  vi.unstubAllGlobals()
  expect(res.status).toBe(302)
  const location = res.headers.get('Location') ?? ''
  const hash = new URL(location).hash.replace(/^#/, '')
  const pending = new URLSearchParams(hash).get('gdrive_pending')
  expect(pending).not.toBeNull()
  return pending as string
}

function finish(token: string, pending: string): Promise<Response> {
  return fetchWorker('/api/auth/drive/finish', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pending }),
  })
}

function driveRows(userId: string): number {
  return (
    sqlite
      .prepare('SELECT COUNT(*) AS n FROM googleDriveTokens WHERE userId = ?')
      .get(userId) as { n: number }
  ).n
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'drive-finalize-secret',
    ALLOWED_ORIGINS: 'http://localhost',
    GOOGLE_CLIENT_ID: GOOGLE_CLIENT,
    GOOGLE_CLIENT_SECRET: 'stub-google-secret',
  } as Env
})

afterEach(() => {
  vi.unstubAllGlobals()
  sqlite.close()
})

describe('connect-Drive finalize binding', () => {
  it('stores nothing in the callback, and binds finish to the starter', async () => {
    const alice = await register('alice@example.com')
    const bob = await register('bob@example.com')

    const state = await startStateFor(alice.token)
    const pending = await pendingGrantFrom(state)

    // The callback itself stored no token — storage only happens at finish.
    expect(driveRows(alice.userId)).toBe(0)

    // Bob completing (or replaying) Alice's grant cannot attach a Drive to
    // Bob, and cannot attach it to Alice either.
    const asBob = await finish(bob.token, pending)
    expect(asBob.status).toBe(403)
    expect(driveRows(alice.userId)).toBe(0)
    expect(driveRows(bob.userId)).toBe(0)

    // Alice, the account that started it, finishes it.
    const asAlice = await finish(alice.token, pending)
    expect(asAlice.status).toBe(200)
    expect(driveRows(alice.userId)).toBe(1)
  })

  it('refuses an unauthenticated or empty finish', async () => {
    expect(
      (
        await fetchWorker('/api/auth/drive/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pending: 'anything' }),
        })
      ).status,
    ).toBe(401)

    const alice = await register('solo@example.com')
    const empty = await finish(alice.token, '')
    expect(empty.status).toBe(400)
    const junk = await finish(alice.token, 'not-a-sealed-grant')
    expect(junk.status).toBe(400)
  })

  it('refuses a grant older than DRIVE_PENDING_TTL_MS', async () => {
    const alice = await register('late@example.com')
    const pending = await pendingGrantFrom(await startStateFor(alice.token))

    // Only the clock moves, and only once the grant exists: its expiry was
    // stamped at consent time, so this is the starter finishing too late,
    // not a grant born expired. Date alone is faked so nothing on the
    // request path that waits on a real timer can stall.
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now() + 6 * 60 * 1000)
      const late = await finish(alice.token, pending)
      expect(late.status).toBe(400)
      expect(((await late.json()) as { error: string }).error).toMatch(
        /expired/,
      )
    } finally {
      vi.useRealTimers()
    }
    expect(driveRows(alice.userId)).toBe(0)
  })

  it('refuses a tampered grant and stores nothing', async () => {
    const alice = await register('tamper@example.com')
    const pending = await pendingGrantFrom(await startStateFor(alice.token))

    // One character flipped in the middle of the ciphertext, to another
    // character the encoding accepts: the seal must reject it outright, not
    // open a grant with a bit changed.
    const mid = Math.floor(pending.length / 2)
    const flipped = pending[mid] === 'A' ? 'B' : 'A'
    const tampered = pending.slice(0, mid) + flipped + pending.slice(mid + 1)
    expect(tampered).not.toBe(pending)

    const res = await finish(alice.token, tampered)
    expect(res.status).toBe(400)
    expect(driveRows(alice.userId)).toBe(0)

    // The control: the untouched grant still finishes, so the refusal above
    // was the tamper and not a grant that was never good.
    expect((await finish(alice.token, pending)).status).toBe(200)
    expect(driveRows(alice.userId)).toBe(1)
  })
})
