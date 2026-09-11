// @vitest-environment node
//
// ── Sign in with Apple, end to end against real SQLite ───────────────
//
// The routes as the phone reaches them: POST /api/auth/apple with a real
// signed identity token, Apple's server-to-server notifications, the grant
// stored for deletion, and POST /api/auth/refresh. Everything below runs
// against node:sqlite with the actual migrations applied, so the SQL is
// exercised as written — including migration 0043, whose column nothing else
// would notice was missing until a phone tried to sign in.
//
// Only Apple's own endpoints are mocked: the JWKS, the token exchange and the
// revoke call. The tokens themselves are signed with a key pair generated in
// the test, so no fixture pretends to be a signature.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type { Env } from '../src/auth'
import { resetAppleJwksCache } from '../src/apple-auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const CLIENT_ID = 'com.irchiinnuss.mercurypitch'
const KEY_ID = 'INTEGRATIONKID'
const APPLE_SUB = '000999.deadbeef.0001'
const DEVICE_ID = '00000000-0000-4000-8000-0000000000a1'
const DEVICE_SECRET = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const PASSWORD = 'ApplePass123'
const PROD_ORIGINS = 'https://mercurypitch.com,capacitor://localhost'

const encoder = new TextEncoder()

let sqlite: DatabaseSync
let perksSqlite: DatabaseSync
let env: Env
let signing: CryptoKeyPair
let publicJwk: JsonWebKey
let appleCalls: { url: string; body: URLSearchParams }[]

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function encodeSegment(value: object): string {
  return b64url(encoder.encode(JSON.stringify(value)))
}

async function signAppleToken(
  claims: Record<string, unknown>,
  key: CryptoKey = signing.privateKey,
): Promise<string> {
  const header = encodeSegment({ alg: 'RS256', kid: KEY_ID })
  const payload = encodeSegment(claims)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(`${header}.${payload}`),
  )
  return `${header}.${payload}.${b64url(signature)}`
}

function identityToken(
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return signAppleToken({
    iss: 'https://appleid.apple.com',
    aud: CLIENT_ID,
    sub: APPLE_SUB,
    iat: now,
    exp: now + 600,
    email: 'apple-singer@example.com',
    email_verified: 'true',
    is_private_email: 'false',
    ...overrides,
  })
}

function notificationToken(event: Record<string, unknown>): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return signAppleToken({
    iss: 'https://appleid.apple.com',
    aud: CLIENT_ID,
    iat: now,
    exp: now + 600,
    jti: 'notification-1',
    events: JSON.stringify({ event_time: Date.now(), ...event }),
  })
}

/** Apple's three endpoints, and nothing else on the network. */
function stubApple(): void {
  appleCalls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.url
      const body = new URLSearchParams((init?.body as string) ?? '')
      appleCalls.push({ url, body })
      if (url === 'https://appleid.apple.com/auth/keys') {
        return new Response(
          JSON.stringify({
            keys: [
              {
                kty: 'RSA',
                kid: KEY_ID,
                use: 'sig',
                alg: 'RS256',
                n: publicJwk.n,
                e: publicJwk.e,
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url === 'https://appleid.apple.com/auth/token') {
        return new Response(
          JSON.stringify({ refresh_token: 'apple-refresh-token' }),
          { status: 200 },
        )
      }
      if (url === 'https://appleid.apple.com/auth/revoke') {
        return new Response('', { status: 200 })
      }
      throw new Error(`Unexpected fetch: ${url}`)
    }),
  )
}

function request(path: string, init?: RequestInit): Promise<Response> {
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
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function signInWithApple(
  body: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await post('/api/auth/apple', {
    identityToken: await identityToken(),
    ...body,
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Record<string, unknown>
}

interface UserRow {
  id: string
  authProvider: string
  providerId: string | null
  email: string | null
  emailVerified: number
  tokenVersion: number
  appleRefreshToken: string | null
}

function userBySub(sub: string): UserRow | undefined {
  return sqlite.prepare('SELECT * FROM users WHERE providerId = ?').get(sub) as
    | UserRow
    | undefined
}

function userById(id: string): UserRow {
  return sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow
}

function freshDatabase(overrides: Partial<Env> = {}): void {
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
    JWT_SECRET: 'apple-integration-secret',
    // A local development origin: the one shape the Turnstile gate lets by
    // with no secret configured, and what registering a password account in
    // these tests needs.
    ALLOWED_ORIGINS: 'http://localhost',
    APPLE_CLIENT_IDS: CLIENT_ID,
    ...overrides,
  }
  resetAppleJwksCache()
  stubApple()
}

beforeAll(async () => {
  signing = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )
  publicJwk = await crypto.subtle.exportKey('jwk', signing.publicKey)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  sqlite.close()
  perksSqlite.close()
})

/**
 * The three APPLE_SIGNIN_* secrets, with a P-256 key generated here so the
 * ES256 client secret is really signed. Module-level because both the grant
 * tests and the notification tests need a grant that actually exists.
 */
const signinSecrets: Partial<Env> = {
  APPLE_SIGNIN_KEY_ID: KEY_ID,
  APPLE_TEAM_ID: 'TEAM123456',
}

beforeAll(async () => {
  const ec = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', ec.privateKey)
  const body = Buffer.from(pkcs8).toString('base64')
  signinSecrets.APPLE_SIGNIN_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`
})

describe('POST /api/auth/apple', () => {
  beforeEach(() => freshDatabase())

  it('creates an account on the first sign-in and returns to it on the second', async () => {
    const first = await signInWithApple({
      user: { name: { firstName: 'Ada', lastName: 'Lovelace' } },
    })
    expect(first.isNew).toBe(true)
    const created = userBySub(APPLE_SUB)
    expect(created?.authProvider).toBe('apple')
    expect(created?.email).toBe('apple-singer@example.com')
    expect(created?.emailVerified).toBe(1)
    expect(
      sqlite
        .prepare('SELECT displayName FROM userProfiles WHERE id = ?')
        .get(created?.id),
    ).toEqual({ displayName: 'Ada Lovelace' })

    const second = await signInWithApple()
    expect(second.isNew).toBe(false)
    expect(second.userId).toBe(first.userId)
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({
      n: 1,
    })
  })

  it('upgrades the anonymous account the device proves it owns', async () => {
    const anonymous = await post('/api/auth/anonymous', {
      deviceId: DEVICE_ID,
      deviceSecret: DEVICE_SECRET,
    })
    expect(anonymous.status).toBe(200)

    const signedIn = await signInWithApple({
      deviceId: DEVICE_ID,
      deviceSecret: DEVICE_SECRET,
    })
    // The same row, so every session record and badge stays attached.
    expect(signedIn.userId).toBe(DEVICE_ID)
    expect(signedIn.isNew).toBe(true)
    expect(userById(DEVICE_ID).authProvider).toBe('apple')
    expect(userById(DEVICE_ID).providerId).toBe(APPLE_SUB)
  })

  it('adopts a password account with the same verified address', async () => {
    const registered = await post('/api/auth/register', {
      email: 'apple-singer@example.com',
      password: PASSWORD,
    })
    expect(registered.status).toBe(200)
    const { userId } = (await registered.json()) as { userId: string }

    const signedIn = await signInWithApple()
    expect(signedIn.userId).toBe(userId)
    expect(userById(userId).providerId).toBe(APPLE_SUB)
  })

  it('never adopts an account on the strength of a private relay address', async () => {
    // The relay address is minted per app and per Apple ID. Treating it as
    // proof of the mailbox would hand over any account that happened to be
    // registered under it.
    const registered = await post('/api/auth/register', {
      email: 'relay-user@privaterelay.appleid.com',
      password: PASSWORD,
    })
    expect(registered.status).toBe(200)
    const { userId } = (await registered.json()) as { userId: string }

    const response = await post('/api/auth/apple', {
      identityToken: await identityToken({
        email: 'relay-user@privaterelay.appleid.com',
        is_private_email: 'true',
      }),
    })
    // A fresh identity, not the password account. The email cannot be reused
    // on the new row (users.email is UNIQUE), so it is stored without one.
    expect(response.status).toBe(200)
    const body = (await response.json()) as { userId: string }
    expect(body.userId).not.toBe(userId)
    expect(userById(userId).providerId).toBeNull()
  })

  it('never resolves an Apple subject onto another provider account', async () => {
    // The lookup used to be `WHERE providerId = ?` with no provider filter,
    // while the unique index is (authProvider, providerId). A Google account
    // whose subject string collides with an Apple one would have been handed
    // straight over.
    const googleId = '00000000-0000-4000-8000-0000000000b2'
    sqlite
      .prepare(
        `INSERT INTO users (id, createdAt, updatedAt, authProvider, providerId, email, emailVerified, tokenVersion)
         VALUES (?, ?, ?, 'google', ?, 'google-twin@example.com', 1, 1)`,
      )
      .run(
        googleId,
        new Date().toISOString(),
        new Date().toISOString(),
        APPLE_SUB,
      )

    const signedIn = await signInWithApple()
    expect(signedIn.userId).not.toBe(googleId)
    expect(userById(googleId).authProvider).toBe('google')
  })

  it('refuses a token signed by anybody else', async () => {
    const impostor = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )
    const now = Math.floor(Date.now() / 1000)
    const forged = await signAppleToken(
      {
        iss: 'https://appleid.apple.com',
        aud: CLIENT_ID,
        sub: 'forged-sub',
        iat: now,
        exp: now + 600,
      },
      impostor.privateKey,
    )
    const response = await post('/api/auth/apple', { identityToken: forged })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'invalid_token' })
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({
      n: 0,
    })
  })

  it('asks for an identity token before anything else', async () => {
    const response = await post('/api/auth/apple', {})
    expect(response.status).toBe(400)
  })

  it('answers 501 where Apple sign-in is not configured', async () => {
    freshDatabase({ APPLE_CLIENT_IDS: undefined })
    const response = await post('/api/auth/apple', {
      identityToken: await identityToken(),
    })
    expect(response.status).toBe(501)
  })
})

describe('the Apple grant', () => {
  it('exchanges the authorization code and seals the refresh token', async () => {
    freshDatabase(signinSecrets)
    const signedIn = await signInWithApple({ authorizationCode: 'code-abc' })

    const exchange = appleCalls.find(
      (call) => call.url === 'https://appleid.apple.com/auth/token',
    )
    expect(exchange?.body.get('grant_type')).toBe('authorization_code')
    expect(exchange?.body.get('code')).toBe('code-abc')

    const stored = userById(String(signedIn.userId)).appleRefreshToken
    expect(stored).not.toBeNull()
    // Sealed, not stashed: a stolen database copy is not a set of live grants.
    expect(stored).not.toContain('apple-refresh-token')
  })

  it('signs in unchanged when the signing key is not configured yet', async () => {
    freshDatabase()
    const signedIn = await signInWithApple({ authorizationCode: 'code-abc' })
    expect(signedIn.token).toBeTypeOf('string')
    expect(
      appleCalls.some(
        (call) => call.url === 'https://appleid.apple.com/auth/token',
      ),
    ).toBe(false)
    expect(userById(String(signedIn.userId)).appleRefreshToken).toBeNull()
  })

  it('hands the grant back to Apple when the account is deleted', async () => {
    freshDatabase(signinSecrets)
    const signedIn = await signInWithApple({ authorizationCode: 'code-abc' })

    const deleted = await request('/api/auth/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${String(signedIn.token)}` },
    })
    expect(deleted.status).toBe(200)

    const revoke = appleCalls.find(
      (call) => call.url === 'https://appleid.apple.com/auth/revoke',
    )
    expect(revoke?.body.get('token_type_hint')).toBe('refresh_token')
    expect(revoke?.body.get('token')).toBe('apple-refresh-token')
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({
      n: 0,
    })
  })

  it('completes the deletion even when Apple refuses the revocation', async () => {
    freshDatabase(signinSecrets)
    const signedIn = await signInWithApple({ authorizationCode: 'code-abc' })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 400 })),
    )

    const deleted = await request('/api/auth/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${String(signedIn.token)}` },
    })
    expect(deleted.status).toBe(200)
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({
      n: 0,
    })
  })
})

describe('POST /api/auth/apple/notifications', () => {
  beforeEach(() => {
    freshDatabase({ ALLOWED_ORIGINS: PROD_ORIGINS, ...signinSecrets })
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('is reachable without a browser origin, where the sign-in route is not', async () => {
    // The whole point of the exemption: Apple's servers send no Origin, and
    // an origin the allowlist does not carry must still not reach a handler.
    const blocked = await post(
      '/api/auth/apple',
      { identityToken: await identityToken() },
      { Origin: 'https://not-ours.test' },
    )
    expect(blocked.status).toBe(403)

    const allowed = await post(
      '/api/auth/apple/notifications',
      { payload: await notificationToken({ type: 'ping', sub: APPLE_SUB }) },
      { Origin: 'https://not-ours.test' },
    )
    expect(allowed.status).toBe(200)
  })

  it('drops the grant and ends every session on consent-revoked', async () => {
    const signedIn = await signInWithApple({ authorizationCode: 'code-abc' })
    const userId = String(signedIn.userId)
    const before = userById(userId)
    expect(before.appleRefreshToken).not.toBeNull()

    const response = await post('/api/auth/apple/notifications', {
      payload: await notificationToken({
        type: 'consent-revoked',
        sub: APPLE_SUB,
      }),
    })
    expect(response.status).toBe(200)

    const after = userById(userId)
    // The identity STAYS. Apple's `sub` survives re-authorisation, so this
    // row is what the singer comes back to; clearing providerId would leave
    // an 'apple' account with no sign-in method at all and orphan every
    // session on it. What goes is the grant and every live token.
    expect(after.providerId).toBe(APPLE_SUB)
    expect(after.appleRefreshToken).toBeNull()
    expect(after.tokenVersion).toBe(before.tokenVersion + 1)
    expect(
      appleCalls.some(
        (call) => call.url === 'https://appleid.apple.com/auth/revoke',
      ),
    ).toBe(true)
    // The practice history survives — this is a sign-out, not an erasure.
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({
      n: 1,
    })

    const me = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${String(signedIn.token)}` },
    })
    expect(me.status).toBe(401)
  })

  it('returns the singer to the same account after account-delete', async () => {
    // A relay identity on purpose: it is the one that cannot be recovered by
    // address. `linkableByEmail` is false for a private relay, so the moment
    // the row stops matching on `sub` the next authorisation builds a SECOND
    // account beside the first and every take stays on the orphan.
    const relay = {
      identityToken: await identityToken({
        email: 'relay-abc@privaterelay.appleid.com',
        is_private_email: 'true',
      }),
    }
    const first = await signInWithApple(relay)
    const response = await post('/api/auth/apple/notifications', {
      payload: await notificationToken({
        type: 'account-delete',
        sub: APPLE_SUB,
      }),
    })
    expect(response.status).toBe(200)

    // `account-delete` is Apple's word for "this Apple ID no longer uses
    // your app", not ours for "erase the singer". Authorising again is the
    // ordinary sequel, and it has to land on the same row — which is exactly
    // what nulling providerId would have prevented.
    const again = await signInWithApple(relay)
    expect(again.userId).toBe(first.userId)
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM users').get()).toEqual({
      n: 1,
    })
  })

  it('flips the address flag when the relay is disabled and enabled again', async () => {
    const signedIn = await signInWithApple()
    const userId = String(signedIn.userId)

    await post('/api/auth/apple/notifications', {
      payload: await notificationToken({
        type: 'email-disabled',
        sub: APPLE_SUB,
        email: 'apple-singer@example.com',
      }),
    })
    expect(userById(userId).emailVerified).toBe(0)

    await post('/api/auth/apple/notifications', {
      payload: await notificationToken({
        type: 'email-enabled',
        sub: APPLE_SUB,
        email: 'apple-singer@example.com',
      }),
    })
    expect(userById(userId).emailVerified).toBe(1)
  })

  it('answers 200 to an event type it has never heard of', async () => {
    await signInWithApple()
    const response = await post('/api/auth/apple/notifications', {
      payload: await notificationToken({
        type: 'something-new-in-2027',
        sub: APPLE_SUB,
      }),
    })
    expect(response.status).toBe(200)
  })

  it('refuses a payload Apple did not sign', async () => {
    const response = await post('/api/auth/apple/notifications', {
      payload: 'not.a.token',
    })
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'invalid_token' })
  })
})

describe('an account that adopted the Apple identity by address', () => {
  beforeEach(() => {
    freshDatabase(signinSecrets)
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('is still found by a consent-revoked notification', async () => {
    // The lookup used to filter on `authProvider = 'apple'`. An account that
    // adopted the identity through the verified-email link keeps authProvider
    // 'password' with the Apple sub in providerId, so the filtered lookup
    // walked straight past it: withdrawing consent did nothing at all, and
    // every session on the account stayed live.
    const registered = await post('/api/auth/register', {
      email: 'apple-singer@example.com',
      password: PASSWORD,
    })
    expect(registered.status).toBe(200)
    const { userId } = (await registered.json()) as { userId: string }

    const signedIn = await signInWithApple({ authorizationCode: 'code-abc' })
    expect(signedIn.userId).toBe(userId)
    const before = userById(userId)
    expect(before.authProvider).toBe('password')
    expect(before.providerId).toBe(APPLE_SUB)
    expect(before.appleRefreshToken).not.toBeNull()

    const response = await post('/api/auth/apple/notifications', {
      payload: await notificationToken({
        type: 'consent-revoked',
        sub: APPLE_SUB,
      }),
    })
    expect(response.status).toBe(200)

    const after = userById(userId)
    expect(after.tokenVersion).toBe(before.tokenVersion + 1)
    expect(after.appleRefreshToken).toBeNull()
    // Kept, as everywhere else: the password is this account's other way in,
    // and the Apple identity still names it.
    expect(after.providerId).toBe(APPLE_SUB)
    expect(after.authProvider).toBe('password')

    const me = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${String(signedIn.token)}` },
    })
    expect(me.status).toBe(401)
  })

  it('keeps its own address when Apple flags a relay it does not use', async () => {
    // The other side of widening the lookup: this row is reachable now, and
    // its address is the one the singer registered with. A relay flag names
    // a different mailbox entirely, so it has nothing to apply here — and
    // applying it would send this account's password reset to an address
    // Apple can switch off.
    const registered = await post('/api/auth/register', {
      email: 'apple-singer@example.com',
      password: PASSWORD,
    })
    expect(registered.status).toBe(200)
    const { userId } = (await registered.json()) as { userId: string }
    await signInWithApple()

    const response = await post('/api/auth/apple/notifications', {
      payload: await notificationToken({
        type: 'email-disabled',
        sub: APPLE_SUB,
        email: 'relay-xyz@privaterelay.appleid.com',
      }),
    })
    expect(response.status).toBe(200)

    const after = userById(userId)
    expect(after.email).toBe('apple-singer@example.com')
    expect(after.emailVerified).toBe(1)
  })
})

describe('POST /api/auth/refresh', () => {
  beforeEach(() => freshDatabase())

  it('trades a live session for a token dated from now', async () => {
    const signedIn = await signInWithApple()
    const token = String(signedIn.token)

    const response = await post(
      '/api/auth/refresh',
      {},
      { Authorization: `Bearer ${token}` },
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      token: string
      expiresAt: string
    }
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now())

    // The same device, not a second one: a refresh per foreground must not
    // fill the account's session list with duplicates of one phone.
    expect(
      sqlite
        .prepare('SELECT COUNT(*) AS n FROM authSessions WHERE userId = ?')
        .get(String(signedIn.userId)),
    ).toEqual({ n: 1 })

    const me = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${body.token}` },
    })
    expect(me.status).toBe(200)
  })

  it('works with no request body at all', async () => {
    const signedIn = await signInWithApple()
    const response = await request('/api/auth/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${String(signedIn.token)}` },
    })
    expect(response.status).toBe(200)
  })

  it('refuses once the session behind the token is gone', async () => {
    const signedIn = await signInWithApple()
    const token = String(signedIn.token)
    expect(
      (await post('/api/auth/logout', {}, { Authorization: `Bearer ${token}` }))
        .status,
    ).toBe(200)

    const response = await post(
      '/api/auth/refresh',
      {},
      { Authorization: `Bearer ${token}` },
    )
    expect(response.status).toBe(401)
  })

  it('refuses a caller with no token', async () => {
    expect((await post('/api/auth/refresh', {})).status).toBe(401)
  })
})
