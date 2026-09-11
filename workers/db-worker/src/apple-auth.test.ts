// ============================================================
// Apple token verification — the half an attacker talks to
// ============================================================
//
// Every test here signs its own tokens with a key pair generated in the test,
// so the fixtures are real signatures over real claims and nothing is stubbed
// below the crypto. Apple's JWKS endpoint is the only thing mocked, because
// it is the only thing that is not ours.
//
// The cases that matter most are the refusals: a token signed by somebody
// else's key, a header claiming an algorithm we do not use, an audience for a
// different app, and a nonce that does not match the one the client sent.

import type { Mock } from 'vitest'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type { AppleClaims } from './apple-auth'
import { exchangeAppleAuthorizationCode, mintAppleClientSecret, parseAppleServerEvent, resetAppleJwksCache, verifyAppleIdentityToken, verifyAppleJwt, } from './apple-auth'

const CLIENT_ID = 'com.irchiinnuss.mercurypitch'
const KEY_ID = 'AAAATESTKID'
const encoder = new TextEncoder()

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeSegment(value: object): string {
  return b64url(encoder.encode(JSON.stringify(value)))
}

let signing: CryptoKeyPair
let other: CryptoKeyPair
let publicJwk: JsonWebKey

async function rsaKeyPair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
}

beforeAll(async () => {
  signing = await rsaKeyPair()
  other = await rsaKeyPair()
  // The Workers types give exportKey and generateKey one union return each;
  // the format and the algorithm decide which half, and here they are fixed.
  publicJwk = (await crypto.subtle.exportKey(
    'jwk',
    signing.publicKey,
  )) as JsonWebKey
})

interface TokenOptions {
  kid?: string
  alg?: string
  key?: CryptoKey
}

async function signToken(
  claims: Record<string, unknown>,
  options: TokenOptions = {},
): Promise<string> {
  const header = encodeSegment({
    alg: options.alg ?? 'RS256',
    kid: options.kid ?? KEY_ID,
  })
  const payload = encodeSegment(claims)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    options.key ?? signing.privateKey,
    encoder.encode(`${header}.${payload}`),
  )
  return `${header}.${payload}.${b64url(signature)}`
}

function identityClaims(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return {
    iss: 'https://appleid.apple.com',
    aud: CLIENT_ID,
    sub: '000123.abcdef.0001',
    iat: now,
    exp: now + 600,
    email: 'singer@example.com',
    email_verified: 'true',
    ...overrides,
  }
}

/** Apple's key set, with whichever kids the test wants in it. */
function stubJwks(kid = KEY_ID): Mock<() => Promise<Response>> {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          keys: [
            {
              kty: 'RSA',
              kid,
              use: 'sig',
              alg: 'RS256',
              n: publicJwk.n,
              e: publicJwk.e,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  resetAppleJwksCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('verifyAppleIdentityToken', () => {
  it('accepts a token Apple signed, and normalises the string booleans', async () => {
    stubJwks()
    const identity = await verifyAppleIdentityToken(
      await signToken(
        identityClaims({ email_verified: 'true', is_private_email: 'false' }),
      ),
      [CLIENT_ID],
    )
    expect(identity).toEqual({
      sub: '000123.abcdef.0001',
      aud: CLIENT_ID,
      email: 'singer@example.com',
      emailVerified: true,
      isPrivateEmail: false,
    })
  })

  it('reads a relay address as private even when Apple omits the flag', async () => {
    stubJwks()
    const identity = await verifyAppleIdentityToken(
      await signToken(
        identityClaims({ email: 'abc123@privaterelay.appleid.com' }),
      ),
      [CLIENT_ID],
    )
    expect(identity?.isPrivateEmail).toBe(true)
  })

  it('refuses a token signed by another key', async () => {
    stubJwks()
    const forged = await signToken(identityClaims(), {
      key: other.privateKey,
    })
    expect(await verifyAppleIdentityToken(forged, [CLIENT_ID])).toBeNull()
  })

  it('refuses an algorithm we do not use', async () => {
    // `none` verifies anything, and HS256 would verify a token signed with
    // Apple's PUBLIC key — which anybody can download.
    stubJwks()
    for (const alg of ['none', 'HS256', 'RS512']) {
      const token = await signToken(identityClaims(), { alg })
      expect(await verifyAppleIdentityToken(token, [CLIENT_ID])).toBeNull()
    }
  })

  it('refuses a token minted for another app', async () => {
    stubJwks()
    const token = await signToken(identityClaims({ aud: 'com.someone.else' }))
    expect(await verifyAppleIdentityToken(token, [CLIENT_ID])).toBeNull()
  })

  it('accepts any audience in the configured list', async () => {
    stubJwks()
    const token = await signToken(
      identityClaims({ aud: 'com.irchiinnuss.mercurypitch.web' }),
    )
    const identity = await verifyAppleIdentityToken(token, [
      CLIENT_ID,
      'com.irchiinnuss.mercurypitch.web',
    ])
    expect(identity?.aud).toBe('com.irchiinnuss.mercurypitch.web')
  })

  it('refuses an issuer that is not Apple', async () => {
    stubJwks()
    const token = await signToken(
      identityClaims({ iss: 'https://appleid.apple.com.evil.test' }),
    )
    expect(await verifyAppleIdentityToken(token, [CLIENT_ID])).toBeNull()
  })

  it('refuses an expired token but tolerates a minute of clock skew', async () => {
    stubJwks()
    const now = Math.floor(Date.now() / 1000)
    const justExpired = await signToken(identityClaims({ exp: now - 30 }))
    const longExpired = await signToken(identityClaims({ exp: now - 600 }))
    expect(
      await verifyAppleIdentityToken(justExpired, [CLIENT_ID]),
    ).not.toBeNull()
    expect(await verifyAppleIdentityToken(longExpired, [CLIENT_ID])).toBeNull()
  })

  it('refuses a token with no subject', async () => {
    stubJwks()
    const claims = identityClaims()
    delete claims.sub
    expect(
      await verifyAppleIdentityToken(await signToken(claims), [CLIENT_ID]),
    ).toBeNull()
  })

  it('refuses a token with no issued-at claim', async () => {
    stubJwks()
    const claims = identityClaims()
    delete claims.iat
    expect(
      await verifyAppleIdentityToken(await signToken(claims), [CLIENT_ID]),
    ).toBeNull()
  })

  describe('the nonce', () => {
    it('accepts a token whose nonce matches the one the client sent', async () => {
      stubJwks()
      const token = await signToken(
        identityClaims({ nonce: 'n-0123', nonce_supported: true }),
      )
      expect(
        await verifyAppleIdentityToken(token, [CLIENT_ID], 'n-0123'),
      ).not.toBeNull()
    })

    it('refuses a mismatch in either direction', async () => {
      stubJwks()
      const withNonce = await signToken(identityClaims({ nonce: 'n-0123' }))
      const withoutNonce = await signToken(identityClaims())
      // Token carries one, request does not: a replay of somebody else's
      // token stripped of its context.
      expect(await verifyAppleIdentityToken(withNonce, [CLIENT_ID])).toBeNull()
      // Request expects one, token has none.
      expect(
        await verifyAppleIdentityToken(withoutNonce, [CLIENT_ID], 'n-0123'),
      ).toBeNull()
      expect(
        await verifyAppleIdentityToken(withNonce, [CLIENT_ID], 'n-9999'),
      ).toBeNull()
    })
  })

  it('refuses anything that is not three base64url segments', async () => {
    stubJwks()
    for (const junk of ['', 'a.b', 'a.b.c.d', 'a.!.c', 'not-a-token']) {
      expect(await verifyAppleIdentityToken(junk, [CLIENT_ID])).toBeNull()
    }
  })

  it('refuses every token when no audience is configured', async () => {
    const fetchMock = stubJwks()
    expect(
      await verifyAppleIdentityToken(await signToken(identityClaims()), []),
    ).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the JWKS cache', () => {
  it('fetches Apple once for a burst of sign-ins', async () => {
    const fetchMock = stubJwks()
    const token = await signToken(identityClaims())
    await verifyAppleIdentityToken(token, [CLIENT_ID])
    await verifyAppleIdentityToken(token, [CLIENT_ID])
    await verifyAppleIdentityToken(token, [CLIENT_ID])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches when a token names a key it has never seen', async () => {
    const fetchMock = stubJwks()
    await verifyAppleIdentityToken(await signToken(identityClaims()), [
      CLIENT_ID,
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Apple rotates: a new kid, and the cached set no longer contains it.
    stubJwks('ROTATEDKID')
    const rotated = await verifyAppleIdentityToken(
      await signToken(identityClaims(), { kid: 'ROTATEDKID' }),
      [CLIENT_ID],
    )
    expect(rotated).not.toBeNull()
  })

  it('refetches once for a flood of tokens naming a key that does not exist', async () => {
    // Without the negative cache this is a free amplifier: an unauthenticated
    // caller sends tokens naming a bogus kid and every single one forces its
    // own round trip to appleid.apple.com, whose throttling then lands on
    // real sign-ins rather than on the flood.
    const fetchMock = stubJwks()
    const bogus = await signToken(identityClaims(), { kid: 'NOSUCHKID' })
    expect(await verifyAppleIdentityToken(bogus, [CLIENT_ID])).toBeNull()
    expect(await verifyAppleIdentityToken(bogus, [CLIENT_ID])).toBeNull()
    expect(await verifyAppleIdentityToken(bogus, [CLIENT_ID])).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('asks about a refused kid again once the refusal has aged out', async () => {
    stubJwks()
    const token = await signToken(
      identityClaims({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      { kid: 'LATERKID' },
    )
    expect(await verifyAppleIdentityToken(token, [CLIENT_ID])).toBeNull()

    // Apple publishes the key. Nothing changes while the refusal is fresh,
    // which is the whole point of remembering it...
    const rotated = stubJwks('LATERKID')
    expect(await verifyAppleIdentityToken(token, [CLIENT_ID])).toBeNull()
    expect(rotated).not.toHaveBeenCalled()

    // ...and eleven minutes on the key is picked up, so a refusal is never
    // permanent: a real rotation costs at most one TTL of 401s.
    const elevenMinutesOn = Date.now() + 11 * 60 * 1000
    vi.spyOn(Date, 'now').mockReturnValue(elevenMinutesOn)
    expect(await verifyAppleIdentityToken(token, [CLIENT_ID])).not.toBeNull()
    expect(rotated).toHaveBeenCalledTimes(1)
  })

  it('refuses rather than throwing when Apple cannot be reached', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    expect(
      await verifyAppleIdentityToken(await signToken(identityClaims()), [
        CLIENT_ID,
      ]),
    ).toBeNull()
  })
})

describe('parseAppleServerEvent', () => {
  it('reads the events claim, which is a JSON string', async () => {
    stubJwks()
    const token = await signToken({
      iss: 'https://appleid.apple.com',
      aud: CLIENT_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 600,
      jti: 'notification-1',
      events: JSON.stringify({
        type: 'consent-revoked',
        sub: '000123.abcdef.0001',
        email: 'abc@privaterelay.appleid.com',
        is_private_email: 'true',
        event_time: 1_757_000_000_000,
      }),
    })
    const claims = (await verifyAppleJwt(token, [CLIENT_ID])) as AppleClaims
    expect(claims).not.toBeNull()
    expect(parseAppleServerEvent(claims)).toEqual({
      type: 'consent-revoked',
      sub: '000123.abcdef.0001',
      email: 'abc@privaterelay.appleid.com',
      isPrivateEmail: true,
      eventTime: 1_757_000_000_000,
    })
  })

  it('returns null for a payload with no usable event', () => {
    expect(parseAppleServerEvent({})).toBeNull()
    expect(parseAppleServerEvent({ events: 'not json' })).toBeNull()
    expect(
      parseAppleServerEvent({ events: '{"type":"account-delete"}' }),
    ).toBeNull()
  })
})

describe('the client secret', () => {
  let ec: CryptoKeyPair
  let pem: string

  beforeAll(async () => {
    ec = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair
    // Workers types give exportKey one union return; 'pkcs8' is always bytes.
    const pkcs8 = (await crypto.subtle.exportKey(
      'pkcs8',
      ec.privateKey,
    )) as ArrayBuffer
    const body = btoa(String.fromCharCode(...new Uint8Array(pkcs8)))
    pem = `-----BEGIN PRIVATE KEY-----\n${body.replace(/(.{64})/g, '$1\n')}\n-----END PRIVATE KEY-----\n`
  })

  it('mints an ES256 JWT Apple can verify with the public half', async () => {
    const secret = await mintAppleClientSecret(
      { privateKeyPem: pem, keyId: KEY_ID, teamId: 'TEAM123456' },
      CLIENT_ID,
    )
    const [header, payload, signature] = secret.split('.')
    expect(
      JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/'))),
    ).toEqual({
      alg: 'ES256',
      kid: KEY_ID,
      typ: 'JWT',
    })
    const claims = JSON.parse(
      atob(payload.replace(/-/g, '+').replace(/_/g, '/')),
    ) as Record<string, unknown>
    expect(claims.iss).toBe('TEAM123456')
    expect(claims.sub).toBe(CLIENT_ID)
    expect(claims.aud).toBe('https://appleid.apple.com')
    // Apple refuses a secret that outlives six months.
    expect((claims.exp as number) - (claims.iat as number)).toBeLessThanOrEqual(
      15_777_000,
    )

    const raw = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
      (character) => character.charCodeAt(0),
    )
    expect(
      await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        ec.publicKey,
        raw,
        encoder.encode(`${header}.${payload}`),
      ),
    ).toBe(true)
  })

  it('reads a key whose newlines survived as literal backslash-n', async () => {
    const mangled = pem.replace(/\n/g, '\\n')
    await expect(
      mintAppleClientSecret(
        { privateKeyPem: mangled, keyId: KEY_ID, teamId: 'TEAM123456' },
        CLIENT_ID,
      ),
    ).resolves.toContain('.')
  })

  it('exchanges an authorization code, and survives Apple refusing', async () => {
    // Typed parameters so `mock.calls` is readable; a bare `vi.fn()` infers
    // an empty tuple and every argument read is a type error.
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(JSON.stringify({ refresh_token: 'r-token' }), {
          status: 200,
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const secrets = { privateKeyPem: pem, keyId: KEY_ID, teamId: 'TEAM123456' }
    expect(
      await exchangeAppleAuthorizationCode(secrets, CLIENT_ID, 'code-1'),
    ).toBe('r-token')
    const sent = new URLSearchParams(fetchMock.mock.calls[0][1].body as string)
    expect(sent.get('grant_type')).toBe('authorization_code')
    expect(sent.get('client_id')).toBe(CLIENT_ID)
    expect(sent.get('code')).toBe('code-1')

    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'invalid_grant' }), {
            status: 400,
          }),
      ),
    )
    expect(
      await exchangeAppleAuthorizationCode(secrets, CLIENT_ID, 'code-2'),
    ).toBeNull()
  })
})
