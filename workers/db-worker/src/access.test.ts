// Cloudflare Access token verification.
//
// These tests sign real RS256 tokens with a generated keypair and serve
// the matching JWKS from a stubbed fetch, so the assertions exercise the
// actual signature check rather than a mock of it. The cases that matter
// most are the negative ones: this module is the only thing standing
// between a `*.cloudflareaccess.com` token and admin writes.

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Env } from './auth'
import { accessConfigured, resolveAdmin, verifyAccessJwt } from './access'

const TEAM = 'example-team.cloudflareaccess.com'
const ISSUER = `https://${TEAM}`
const AUD = 'aud-tag-for-the-admin-app'
const KID = 'test-key-1'

let keyPair: CryptoKeyPair
let jwks: { keys: Record<string, unknown>[] }

const b64url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const b64urlJson = (value: unknown): string =>
  b64url(new TextEncoder().encode(JSON.stringify(value)))

const nowSec = () => Math.floor(Date.now() / 1000)

/** Sign a token with the real key, so only the payload varies per test. */
async function signToken(
  payload: Record<string, unknown>,
  header: Record<string, unknown> = {},
): Promise<string> {
  const head = b64urlJson({ alg: 'RS256', kid: KID, typ: 'JWT', ...header })
  const body = b64urlJson(payload)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  )
  return `${head}.${body}.${b64url(new Uint8Array(signature))}`
}

/** A token that would be valid if nothing were overridden. */
const goodPayload = (over: Record<string, unknown> = {}) => ({
  aud: [AUD],
  iss: ISSUER,
  email: 'owner@example.com',
  exp: nowSec() + 3600,
  iat: nowSec() - 10,
  ...over,
})

const env = (over: Partial<Env> = {}): Env =>
  ({
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
    ...over,
  }) as Env

const withToken = (token: string | null, asCookie = false): Request =>
  new Request('https://api.example.com/api/weekly', {
    headers:
      token === null
        ? {}
        : asCookie
          ? { Cookie: `foo=bar; CF_Authorization=${token}` }
          : { 'Cf-Access-Jwt-Assertion': token },
  })

beforeAll(async () => {
  keyPair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const pub = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  jwks = { keys: [{ ...pub, kid: KID, alg: 'RS256', use: 'sig' }] }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === `${ISSUER}/cdn-cgi/access/certs`) {
        return new Response(JSON.stringify(jwks), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    }),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('accessConfigured', () => {
  it('is true only when the team domain and audience are both set', () => {
    expect(accessConfigured(env())).toBe(true)
    expect(accessConfigured(env({ ACCESS_AUD: '' }))).toBe(false)
    expect(accessConfigured(env({ ACCESS_TEAM_DOMAIN: '' }))).toBe(false)
    expect(accessConfigured({} as Env)).toBe(false)
  })
})

describe('verifyAccessJwt', () => {
  it('accepts a well-formed token and returns the signed-in email', async () => {
    const token = await signToken(goodPayload())
    await expect(verifyAccessJwt(withToken(token), env())).resolves.toEqual({
      subject: 'owner@example.com',
      kind: 'user',
    })
  })

  it('reads the token from the CF_Authorization cookie too', async () => {
    const token = await signToken(goodPayload())
    await expect(
      verifyAccessJwt(withToken(token, true), env()),
    ).resolves.toEqual({ subject: 'owner@example.com', kind: 'user' })
  })

  it('returns null when the environment is not behind Access', async () => {
    // Never verify — and never fetch certs — where Access is not set up.
    const token = await signToken(goodPayload())
    await expect(
      verifyAccessJwt(withToken(token), env({ ACCESS_AUD: '' })),
    ).resolves.toBeNull()
  })

  it('returns null with no token at all', async () => {
    await expect(verifyAccessJwt(withToken(null), env())).resolves.toBeNull()
  })

  // ── The checks that carry the security weight ──────────────────────

  it('rejects a token minted for a different Access application', async () => {
    // Same team, same signing key, wrong app: without the audience check
    // any token in the account would open the admin surface.
    const token = await signToken(goodPayload({ aud: ['some-other-app'] }))
    await expect(verifyAccessJwt(withToken(token), env())).resolves.toBeNull()
  })

  it('rejects a token from another issuer', async () => {
    const token = await signToken(
      goodPayload({ iss: 'https://attacker.cloudflareaccess.com' }),
    )
    await expect(verifyAccessJwt(withToken(token), env())).resolves.toBeNull()
  })

  it('rejects an expired session', async () => {
    const token = await signToken(goodPayload({ exp: nowSec() - 120 }))
    await expect(verifyAccessJwt(withToken(token), env())).resolves.toBeNull()
  })

  it('rejects a token issued in the future', async () => {
    const token = await signToken(
      goodPayload({ iat: nowSec() + 600, exp: nowSec() + 3600 }),
    )
    await expect(verifyAccessJwt(withToken(token), env())).resolves.toBeNull()
  })

  it('rejects an unsigned token claiming alg none', async () => {
    // The classic downgrade: a valid-looking payload with the signature
    // dropped. Pinning RS256 means the header never gets to decide.
    const head = b64urlJson({ alg: 'none', kid: KID, typ: 'JWT' })
    const body = b64urlJson(goodPayload())
    await expect(
      verifyAccessJwt(withToken(`${head}.${body}.`), env()),
    ).resolves.toBeNull()
  })

  it('rejects an HS256 header even with a real signature attached', async () => {
    const real = await signToken(goodPayload())
    const [, body, sig] = real.split('.')
    const head = b64urlJson({ alg: 'HS256', kid: KID, typ: 'JWT' })
    await expect(
      verifyAccessJwt(withToken(`${head}.${body}.${sig}`), env()),
    ).resolves.toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const token = await signToken(goodPayload({ email: 'owner@example.com' }))
    const [head, , sig] = token.split('.')
    const swapped = b64urlJson(goodPayload({ email: 'attacker@example.com' }))
    await expect(
      verifyAccessJwt(withToken(`${head}.${swapped}.${sig}`), env()),
    ).resolves.toBeNull()
  })

  it('rejects a token signed by a key that is not in the JWKS', async () => {
    const other = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair
    const head = b64urlJson({ alg: 'RS256', kid: KID, typ: 'JWT' })
    const body = b64urlJson(goodPayload())
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      other.privateKey,
      new TextEncoder().encode(`${head}.${body}`),
    )
    await expect(
      verifyAccessJwt(
        withToken(`${head}.${body}.${b64url(new Uint8Array(signature))}`),
        env(),
      ),
    ).resolves.toBeNull()
  })

  it('rejects a malformed token without throwing', async () => {
    for (const bad of ['', 'not-a-jwt', 'a.b', 'a.b.c.d', '...']) {
      await expect(verifyAccessJwt(withToken(bad), env())).resolves.toBeNull()
    }
  })

  // ── Identity shapes ────────────────────────────────────────────────

  it('accepts a service token by its common name', async () => {
    // Seed scripts authenticate this way: no email, a common_name instead.
    const token = await signToken({
      aud: [AUD],
      iss: ISSUER,
      common_name: 'seed-script.access',
      exp: nowSec() + 3600,
    })
    await expect(verifyAccessJwt(withToken(token), env())).resolves.toEqual({
      subject: 'seed-script.access',
      kind: 'service',
    })
  })

  it('rejects a token that proves no identity at all', async () => {
    const token = await signToken({
      aud: [AUD],
      iss: ISSUER,
      exp: nowSec() + 3600,
    })
    await expect(verifyAccessJwt(withToken(token), env())).resolves.toBeNull()
  })

  it('accepts a plain string audience, not only an array', async () => {
    const token = await signToken(goodPayload({ aud: AUD }))
    await expect(verifyAccessJwt(withToken(token), env())).resolves.toEqual({
      subject: 'owner@example.com',
      kind: 'user',
    })
  })

  // ── The optional extra allowlist ───────────────────────────────────

  it('honours ACCESS_ALLOWED_EMAILS when it is set', async () => {
    const token = await signToken(goodPayload({ email: 'someone@example.com' }))
    await expect(
      verifyAccessJwt(
        withToken(token),
        env({ ACCESS_ALLOWED_EMAILS: 'owner@example.com, other@example.com' }),
      ),
    ).resolves.toBeNull()
  })

  it('matches the allowlist case-insensitively', async () => {
    const token = await signToken(goodPayload({ email: 'Owner@Example.com' }))
    await expect(
      verifyAccessJwt(
        withToken(token),
        env({ ACCESS_ALLOWED_EMAILS: 'owner@example.com' }),
      ),
    ).resolves.toEqual({ subject: 'Owner@Example.com', kind: 'user' })
  })

  it('falls back to the Access policy when the allowlist is empty', async () => {
    const token = await signToken(goodPayload())
    await expect(
      verifyAccessJwt(withToken(token), env({ ACCESS_ALLOWED_EMAILS: '  ' })),
    ).resolves.toEqual({ subject: 'owner@example.com', kind: 'user' })
  })
})

// The rollout policy, which is what actually decides admin. Staged on
// purpose: enabling Access must not lock the owner out of the browser
// studio, which reaches the API cross-origin and cannot carry the Access
// cookie yet.
describe('resolveAdmin', () => {
  const noAccess = { ADMIN_KEY: 'k' } as Env

  it('falls back to the key where Access is not configured', async () => {
    await expect(resolveAdmin(withToken(null), noAccess, true)).resolves.toBe(
      true,
    )
    await expect(resolveAdmin(withToken(null), noAccess, false)).resolves.toBe(
      false,
    )
  })

  it('accepts a verified Access token with no key at all', async () => {
    const token = await signToken(goodPayload())
    await expect(resolveAdmin(withToken(token), env(), false)).resolves.toBe(
      true,
    )
  })

  it('stage one: the key still works alongside Access', async () => {
    // Without this the browser studio would break the moment Access is
    // switched on for an environment.
    await expect(resolveAdmin(withToken(null), env(), true)).resolves.toBe(true)
  })

  it('stage two: ACCESS_STRICT retires the key', async () => {
    await expect(
      resolveAdmin(withToken(null), env({ ACCESS_STRICT: '1' }), true),
    ).resolves.toBe(false)
  })

  it('stage two still admits a verified Access token', async () => {
    const token = await signToken(goodPayload())
    await expect(
      resolveAdmin(withToken(token), env({ ACCESS_STRICT: '1' }), false),
    ).resolves.toBe(true)
  })

  it('ACCESS_STRICT alone changes nothing where Access is unconfigured', async () => {
    // Otherwise a stray var on a preview would lock out the only gate it
    // has.
    await expect(
      resolveAdmin(withToken(null), { ACCESS_STRICT: '1' } as Env, true),
    ).resolves.toBe(true)
  })

  it('rejects a forged token even in stage one, key absent', async () => {
    const head = b64urlJson({ alg: 'none', kid: KID, typ: 'JWT' })
    const body = b64urlJson(goodPayload())
    await expect(
      resolveAdmin(withToken(`${head}.${body}.`), env(), false),
    ).resolves.toBe(false)
  })
})
