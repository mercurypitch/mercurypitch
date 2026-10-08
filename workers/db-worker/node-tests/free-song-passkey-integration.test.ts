// @vitest-environment node
//
// ── The month's free song goes by the account, never the token ──
//
// An anonymous identity can add a passkey, and then signs in with it: its
// token says "passkey", while the account is still anonymous, with no email
// (passkey-routes.ts). The free song is for signed-in singers only (owner,
// 28 Sep: S7 D5), so it asks the account (app-songs.ts), and a passkey on an
// anonymous identity gets none (review of PR 880, finding 1).
//
// The ceremony is real: a software authenticator with one P-256 key and
// attestation "none", through the worker's own routes and real SQLite.

import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { isoCBOR } from '@simplewebauthn/server/helpers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const IOS = 'capacitor://localhost'
const ANDROID = 'https://localhost'
const WEB = 'http://localhost:3000'
const DEVICE = '00000000-0000-4000-8000-00000000f5a1'
const DEVICE_SECRET = 'fp1Aa2Bb3Cc4Dd5Ee6Ff7Gg8Hh9Ii0Jj1Kk2Ll3Mm4'

let sqlite: DatabaseSync
let env: Env

interface Call {
  method?: string
  token?: string
  origin?: string
  body?: unknown
}

function call(path: string, init: Call = {}): Promise<Response> {
  const headers: Record<string, string> = {}
  if (init.token !== undefined) headers.Authorization = `Bearer ${init.token}`
  if (init.origin !== undefined) headers.Origin = init.origin
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  return worker.fetch(
    new Request(`https://api.test${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    }),
    env,
    {} as ExecutionContext,
  )
}

const b64u = (bytes: Uint8Array | Buffer): string =>
  Buffer.from(bytes).toString('base64url')
const sha = (data: Uint8Array | string): Buffer =>
  createHash('sha256').update(data).digest()

/** A software platform authenticator: one P-256 key, attestation "none". */
function authenticator() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  })
  const jwk = publicKey.export({ format: 'jwk' }) as { x: string; y: string }
  const credId = randomBytes(16)
  const cose = new Map<number, number | Uint8Array>([
    [1, 2],
    [3, -7],
    [-1, 1],
    [-2, new Uint8Array(Buffer.from(jwk.x, 'base64url'))],
    [-3, new Uint8Array(Buffer.from(jwk.y, 'base64url'))],
  ])
  const coseBytes = Buffer.from(isoCBOR.encode(cose))
  const clientData = (type: string, challenge: string): Buffer =>
    Buffer.from(
      JSON.stringify({ type, challenge, origin: WEB, crossOrigin: false }),
    )
  return {
    register(challenge: string) {
      const length = Buffer.alloc(2)
      length.writeUInt16BE(credId.length)
      const authData = Buffer.concat([
        sha('localhost'),
        Buffer.from([0x45]),
        Buffer.alloc(4),
        Buffer.alloc(16),
        length,
        credId,
        coseBytes,
      ])
      const attestationObject = isoCBOR.encode(
        new Map<string, unknown>([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', new Uint8Array(authData)],
        ]) as never,
      )
      return {
        id: b64u(credId),
        rawId: b64u(credId),
        type: 'public-key',
        response: {
          clientDataJSON: b64u(clientData('webauthn.create', challenge)),
          attestationObject: b64u(attestationObject),
          transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      }
    },
    assert(challenge: string, userId: string) {
      const clientDataJSON = clientData('webauthn.get', challenge)
      const counter = Buffer.alloc(4)
      counter.writeUInt32BE(1)
      const authData = Buffer.concat([
        sha('localhost'),
        Buffer.from([0x05]),
        counter,
      ])
      const signature = sign(
        'sha256',
        Buffer.concat([authData, sha(clientDataJSON)]),
        privateKey,
      )
      return {
        id: b64u(credId),
        rawId: b64u(credId),
        type: 'public-key',
        response: {
          clientDataJSON: b64u(clientDataJSON),
          authenticatorData: b64u(authData),
          signature: b64u(signature),
          userHandle: b64u(Buffer.from(userId)),
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      }
    },
  }
}

/** The phone's anonymous identity adds a passkey, then signs in with it. */
async function passkeyOnAnAnonymousIdentity(): Promise<string> {
  const anonymous = await call('/api/auth/anonymous', {
    body: { deviceId: DEVICE, deviceSecret: DEVICE_SECRET },
  })
  expect(anonymous.status).toBe(200)
  const { token } = (await anonymous.json()) as { token: string }

  const key = authenticator()
  const registration = await call('/api/auth/passkey/register/options', {
    token,
    body: {},
  })
  expect(registration.status).toBe(200)
  const reg = (await registration.json()) as {
    options: { challenge: string }
    ceremony: string
  }
  const registered = await call('/api/auth/passkey/register/verify', {
    token,
    body: {
      ceremony: reg.ceremony,
      response: key.register(reg.options.challenge),
    },
  })
  expect(registered.status).toBe(200)

  const loginOptions = await call('/api/auth/passkey/login/options', {
    body: {},
  })
  expect(loginOptions.status).toBe(200)
  const login = (await loginOptions.json()) as {
    options: { challenge: string }
    ceremony: string
  }
  const signedIn = await call('/api/auth/passkey/login/verify', {
    body: {
      ceremony: login.ceremony,
      response: key.assert(login.options.challenge, DEVICE),
    },
  })
  expect(signedIn.status).toBe(200)
  return ((await signedIn.json()) as { token: string }).token
}

function tokenProvider(token: string): string {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
  ) as { provider: string }
  return payload.provider
}

function priceTheGpu(): void {
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO pricingPlans
         (id, createdAt, updatedAt, kind, label, description, unit, amount, currency, credits, stripePriceId, badge, sortOrder, active)
       VALUES ('tier-runpod-gpu', ?, ?, 'tier', 'Cloud GPU', '', 'song', NULL, 'eur', 1, NULL, NULL, 2, 1)`,
    )
    .run(now, now)
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'free-song-passkey-jwt',
    PASSKEY_RP_ID: 'localhost',
    ALLOWED_ORIGINS: `${WEB},${IOS},${ANDROID}`,
  }
  priceTheGpu()
})

afterEach(() => {
  vi.restoreAllMocks()
  sqlite.close()
})

describe('a passkey on an anonymous identity', () => {
  it('signs in as "passkey", and the account stays anonymous', async () => {
    const token = await passkeyOnAnAnonymousIdentity()

    expect(tokenProvider(token)).toBe('passkey')
    expect(
      sqlite
        .prepare('SELECT authProvider, email FROM users WHERE id = ?')
        .get(DEVICE),
    ).toEqual({ authProvider: 'anonymous', email: null })
  })

  it('gets no free song: the app sees none and cannot spend one', async () => {
    const token = await passkeyOnAnAnonymousIdentity()

    const me = await call('/api/billing/me', { token, origin: IOS })
    const debit = await call('/api/billing/debit', {
      token,
      origin: IOS,
      body: { tier: 'gpu', model: 'roformer', jobRef: 'rp_gpu_passkey-free' },
    })

    expect(((await me.json()) as { songs: unknown }).songs).toMatchObject({
      left: 0,
      free: 0,
    })
    expect(debit.status).toBe(402)
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS claims FROM creditLedger WHERE reason = 'free-song'",
        )
        .get(),
    ).toEqual({ claims: 0 })
  })
})
