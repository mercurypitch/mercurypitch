// @vitest-environment node
//
// ── A Google redirect names the sign-in it answers ───────────────────
//
// The session a Google sign-in produces travels back in a URL fragment, and a
// fragment is a link anyone can write. So the app keeps a nonce for each
// sign-in it starts (src/lib/google-return-nonce.ts) and takes a session,
// ceremony or error only when it comes back beside that nonce. This file pins
// the worker's half: a well-formed nonce rides in the signed state and comes
// back on every redirect a verified state produces, and a start without one
// (an older app) gets the old answer.
//
// Run against real SQLite with the real migrations, driving the worker through
// its own HTTP surface. Only Google and Resend are stubbed.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { totpCode } from '../src/totp'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const DEV = 'https://dev.mercurypitch.com'
const NONCE = 'n0nce-for-this-browser_0123456789abcdefABCDEF'

let sqlite: DatabaseSync
let env: Env

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'google-return-nonce-secret',
    TOTP_KEK: 'google-return-nonce-kek',
    ALLOWED_ORIGINS: `localhost,${DEV}`,
    APP_FALLBACK_ORIGIN: DEV,
    GOOGLE_CLIENT_ID: 'test-google-client',
    GOOGLE_CLIENT_SECRET: 'test-google-secret',
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://api.resend.com/emails') {
        return Response.json({ id: 're_1' })
      }
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ id_token: 'redirect-id-token' })
      }
      if (url === 'https://www.googleapis.com/oauth2/v3/tokeninfo') {
        return Response.json({
          aud: 'test-google-client',
          sub: 'google-singer',
          email: 'google-singer@example.com',
          email_verified: 'true',
          name: 'Google Singer',
        })
      }
      throw new Error(`unexpected fetch to ${url}`)
    },
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  sqlite.close()
})

function call(path: string, init?: RequestInit): Promise<Response> {
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
  return call(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: DEV, ...headers },
    body: JSON.stringify(body),
  })
}

/** Start a sign-in the way the app does, and hand back the signed state. */
async function startSignIn(nonce?: unknown): Promise<string> {
  const started = await post('/api/auth/google/start', {
    returnTo: `${DEV}/`,
    ...(nonce === undefined ? {} : { nonce }),
  })
  expect(started.status).toBe(200)
  const { url } = (await started.json()) as { url: string }
  return new URL(url).searchParams.get('state') as string
}

/** Where Google's return to the callback sends the browser next. */
async function callback(state: string, query = 'code=valid'): Promise<string> {
  const response = await call(
    `/api/auth/google/callback?${query}&state=${encodeURIComponent(state)}`,
  )
  expect(response.status).toBe(302)
  return response.headers.get('Location') as string
}

function fragment(location: string): URLSearchParams {
  return new URLSearchParams(new URL(location).hash.slice(1))
}

describe('a sign-in started with a nonce', () => {
  it('gets it back beside the session', async () => {
    const location = await callback(await startSignIn(NONCE))

    const params = fragment(location)
    expect(params.get('gauth')).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)
    expect(params.get('gauth_new')).toBe('1')
    expect(params.get('gauth_nonce')).toBe(NONCE)
  })

  it('gets it back beside the error Google sent', async () => {
    const location = await callback(
      await startSignIn(NONCE),
      'error=access_denied',
    )

    expect(location).toBe(
      `${DEV}/#gauth_error=access_denied&gauth_nonce=${NONCE}`,
    )
  })

  it('gets it back beside a suspension', async () => {
    await callback(await startSignIn(NONCE))
    sqlite
      .prepare("UPDATE users SET suspendedAt = ? WHERE authProvider = 'google'")
      .run(new Date().toISOString())

    const location = await callback(await startSignIn(NONCE))

    expect(location).toBe(
      `${DEV}/#gauth_error=account_suspended&gauth_nonce=${NONCE}`,
    )
  })

  it('gets it back beside the second-factor ceremony', async () => {
    const first = fragment(await callback(await startSignIn(NONCE)))
    const token = first.get('gauth') as string
    const authed = (path: string, body: unknown): Promise<Response> =>
      post(path, body, { Authorization: `Bearer ${token}` })
    const setup = await authed('/api/auth/2fa/setup', {})
    expect(setup.status).toBe(200)
    const { secret } = (await setup.json()) as { secret: string }
    const enabled = await authed('/api/auth/2fa/enable', {
      code: await totpCode(secret, Math.floor(Date.now() / 1000 / 30)),
    })
    expect(enabled.status).toBe(200)

    const params = fragment(await callback(await startSignIn(NONCE)))

    expect(params.get('gauth')).toBeNull()
    expect(params.get('gauth_2fa')).not.toBeNull()
    expect(params.get('gauth_nonce')).toBe(NONCE)
  })
})

describe('a sign-in started without a usable nonce', () => {
  it('gets none back when the app sent none, as an older app expects', async () => {
    const params = fragment(await callback(await startSignIn()))

    expect(params.get('gauth')).not.toBeNull()
    expect(params.has('gauth_nonce')).toBe(false)
  })

  it('drops a nonce that is not one the app could have minted', async () => {
    for (const malformed of ['short', 'has spaces in it, sixteen+', 42]) {
      const params = fragment(await callback(await startSignIn(malformed)))

      expect(params.has('gauth_nonce')).toBe(false)
    }
  })

  // The worker cannot read a nonce out of a state it cannot read, which is
  // why the app honours this one code without one.
  it('goes home from an unreadable state with no nonce at all', async () => {
    const location = await callback('body.!!!not-base64!!!')

    expect(location).toBe(`${DEV}/#gauth_error=expired_state`)
  })
})
