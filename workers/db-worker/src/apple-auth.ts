// ============================================================
// Sign in with Apple — identity tokens, the client secret, revocation
// ============================================================
//
// Everything Apple-specific that is pure crypto or a call to Apple: verifying
// an identity token against their JWKS, minting the ES256 client secret,
// trading an authorization code for a refresh token, and handing that grant
// back at account deletion. No route handling and no user resolution — those
// live in apple-routes.ts, which imports downward into auth.ts.
//
// Why this file imports nothing but a type from auth.ts: auth.ts has to call
// `revokeAndForgetAppleGrant` on the deletion path, so anything auth.ts needs
// must sit BELOW it. apple-routes.ts sits above and is dispatched from
// index.ts, exactly like twofa-routes.ts.
//
// There is no JWT library here, and there must not be one. The Worker already
// hand-rolls HS256 (auth.ts), HMAC ceremonies (auth-ceremony.ts) and WebAuthn
// signature checks (passkeys.ts) on crypto.subtle; Apple adds RS256 for their
// tokens and ES256 for ours.

import type { Env } from './auth'

const APPLE_ISSUER = 'https://appleid.apple.com'
const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys'
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token'
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke'

/** Apple rotates signing keys rarely and publishes several at once. */
const JWKS_TTL_MS = 24 * 60 * 60 * 1000

/** Clock slack on `exp`, matching the tolerance Apple's own samples use. */
const CLOCK_SKEW_SECONDS = 60

/**
 * Apple caps the client secret at six months. Six months minus a day, so a
 * secret minted at the edge of a leap second is still inside their window.
 */
const CLIENT_SECRET_TTL_SECONDS = 180 * 24 * 60 * 60 - 24 * 60 * 60

/**
 * The Sign in with Apple client ids a token may be issued to — the bundle id
 * for a native app, a Services ID for the web. Comma-separated, so the owner
 * can add one without a code change.
 */
export function appleClientIds(env: Env): string[] {
  return (env.APPLE_CLIENT_IDS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

/** The relay domain Apple issues when the signer hides their address. */
export const APPLE_PRIVATE_RELAY_DOMAIN = '@privaterelay.appleid.com'

const encoder = new TextEncoder()

// ── base64url ────────────────────────────────────────────────────────
//
// A local copy, like auth-ceremony.ts and background-capabilities.ts keep:
// four lines each, and a shared module would make three files depend on a
// fifth for `atob`.

function b64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

/** A JWS segment is base64url and nothing else. */
const SEGMENT_RE = /^[A-Za-z0-9_-]+$/

// ── The JWKS ─────────────────────────────────────────────────────────

interface AppleJwk {
  kty: string
  kid: string
  alg?: string
  n: string
  e: string
}

interface JwksCache {
  keys: AppleJwk[]
  fetchedAt: number
}

/**
 * Module state, which on Workers means "per isolate, until it is evicted".
 * That is the right lifetime: an isolate serving a burst of sign-ins fetches
 * Apple's keys once, and an idle one costs nothing.
 */
let jwksCache: JwksCache | null = null

/** Exported for tests — module state outlives a single `it`. */
export function resetAppleJwksCache(): void {
  jwksCache = null
}

async function fetchAppleJwks(): Promise<AppleJwk[]> {
  const response = await fetch(APPLE_KEYS_URL, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Apple JWKS responded ${response.status}`)
  }
  const body = (await response.json()) as { keys?: AppleJwk[] }
  const keys = Array.isArray(body.keys) ? body.keys : []
  if (keys.length === 0) throw new Error('Apple JWKS carried no keys')
  jwksCache = { keys, fetchedAt: Date.now() }
  return keys
}

/**
 * The key a token names, refetching at most once.
 *
 * An unknown `kid` is the signal that Apple has rotated, so it forces one
 * refetch even while the cache is fresh — and only one, because a token
 * naming a key that does not exist is otherwise a free way to make every
 * request fan out to Apple.
 */
async function appleSigningKey(kid: string): Promise<AppleJwk | null> {
  const cached = jwksCache
  if (cached !== null && Date.now() - cached.fetchedAt < JWKS_TTL_MS) {
    const hit = cached.keys.find((key) => key.kid === kid)
    if (hit !== undefined) return hit
  }
  const keys = await fetchAppleJwks()
  return keys.find((key) => key.kid === kid) ?? null
}

// ── Token verification ───────────────────────────────────────────────

interface JwsHeader {
  alg?: string
  kid?: string
}

/** The claims Apple puts in either token kind, before any interpretation. */
export interface AppleClaims {
  iss?: string
  aud?: string
  sub?: string
  exp?: number
  iat?: number
  nonce?: string
  nonce_supported?: boolean
  email?: string
  email_verified?: boolean | string
  is_private_email?: boolean | string
  events?: string
}

function decodeJson<T>(segment: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(segment))) as T
  } catch {
    return null
  }
}

/**
 * Verify a JWT Apple signed: signature, issuer, audience, expiry.
 *
 * Returns the raw claims, so the identity path and the server-notification
 * path can each demand what only they require. Null on every failure —
 * telling a caller WHY a token was rejected is telling an attacker too.
 */
export async function verifyAppleJwt(
  token: string,
  audiences: string[],
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<AppleClaims | null> {
  if (audiences.length === 0) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerSegment, payloadSegment, signatureSegment] = parts
  if (
    !SEGMENT_RE.test(headerSegment) ||
    !SEGMENT_RE.test(payloadSegment) ||
    !SEGMENT_RE.test(signatureSegment)
  ) {
    return null
  }

  const header = decodeJson<JwsHeader>(headerSegment)
  // RS256 and nothing else. Accepting whatever `alg` says is the classic JWT
  // hole: `none` verifies everything, and HS256 would verify a token signed
  // with Apple's PUBLIC key, which anybody can fetch.
  if (header === null || header.alg !== 'RS256') return null
  if (typeof header.kid !== 'string' || header.kid === '') return null

  let jwk: AppleJwk | null
  try {
    jwk = await appleSigningKey(header.kid)
  } catch (error) {
    console.warn('[apple] could not reach the Apple JWKS:', String(error))
    return null
  }
  if (jwk === null) return null

  let verified = false
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlDecode(signatureSegment) as BufferSource,
      encoder.encode(`${headerSegment}.${payloadSegment}`),
    )
  } catch {
    return null
  }
  if (!verified) return null

  const claims = decodeJson<AppleClaims>(payloadSegment)
  if (claims === null) return null
  if (claims.iss !== APPLE_ISSUER) return null
  if (typeof claims.aud !== 'string' || !audiences.includes(claims.aud)) {
    return null
  }
  if (typeof claims.exp !== 'number') return null
  if (claims.exp + CLOCK_SKEW_SECONDS <= nowSeconds) return null
  if (typeof claims.iat !== 'number') return null
  return claims
}

/** Apple sends these as strings in some flows and booleans in others. */
function appleBoolean(value: boolean | string | undefined): boolean {
  return value === true || value === 'true'
}

/** What a verified identity token says about the person signing in. */
export interface AppleIdentity {
  sub: string
  aud: string
  email: string | null
  emailVerified: boolean
  isPrivateEmail: boolean
}

/**
 * Verify a Sign in with Apple identity token.
 *
 * `expectedNonce` is the nonce the client sent us. Apple echoes the nonce it
 * was given, so when either side has one they must agree — that is the whole
 * replay defence, and a token whose `nonce_supported` claim is true but whose
 * nonce is missing has been tampered with.
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  audiences: string[],
  expectedNonce?: string,
): Promise<AppleIdentity | null> {
  const claims = await verifyAppleJwt(identityToken, audiences)
  if (claims === null) return null
  if (typeof claims.sub !== 'string' || claims.sub === '') return null
  if (claims.nonce !== undefined || expectedNonce !== undefined) {
    if (claims.nonce !== expectedNonce) return null
  }
  const email = typeof claims.email === 'string' ? claims.email : null
  return {
    sub: claims.sub,
    aud: claims.aud as string,
    email,
    emailVerified: appleBoolean(claims.email_verified),
    isPrivateEmail:
      appleBoolean(claims.is_private_email) ||
      (email?.toLowerCase().endsWith(APPLE_PRIVATE_RELAY_DOMAIN) ?? false),
  }
}

// ── Server-to-server notifications ───────────────────────────────────

/** One decoded entry of the `events` claim. */
export interface AppleServerEvent {
  type: string
  sub: string
  email: string | null
  isPrivateEmail: boolean
  eventTime: number | null
}

/**
 * The `events` claim, which is a JSON STRING holding one event object — not
 * an array and not a nested object, however much it reads like one.
 */
export function parseAppleServerEvent(
  claims: AppleClaims,
): AppleServerEvent | null {
  if (typeof claims.events !== 'string') return null
  let parsed: {
    type?: string
    sub?: string
    email?: string
    is_private_email?: boolean | string
    event_time?: number
  }
  try {
    parsed = JSON.parse(claims.events) as typeof parsed
  } catch {
    return null
  }
  if (typeof parsed.type !== 'string' || parsed.type === '') return null
  if (typeof parsed.sub !== 'string' || parsed.sub === '') return null
  return {
    type: parsed.type,
    sub: parsed.sub,
    email: typeof parsed.email === 'string' ? parsed.email : null,
    isPrivateEmail: appleBoolean(parsed.is_private_email),
    eventTime: typeof parsed.event_time === 'number' ? parsed.event_time : null,
  }
}

// ── The client secret (ES256) ────────────────────────────────────────

export interface AppleSigninSecrets {
  privateKeyPem: string
  keyId: string
  teamId: string
}

/**
 * The three secrets the token-exchange and revocation calls need, or null.
 *
 * Null is an ordinary state, not a misconfiguration: sign-in works without
 * them, and dev runs without them until the owner puts the `.p8` in place.
 */
export function appleSigninSecrets(env: Env): AppleSigninSecrets | null {
  const privateKeyPem = env.APPLE_SIGNIN_PRIVATE_KEY?.trim()
  const keyId = env.APPLE_SIGNIN_KEY_ID?.trim()
  const teamId = env.APPLE_TEAM_ID?.trim()
  if (!privateKeyPem || !keyId || !teamId) return null
  return { privateKeyPem, keyId, teamId }
}

/**
 * PKCS#8 bytes from Apple's `.p8` download.
 *
 * Tolerates a key whose newlines survived as the literal characters `\` and
 * `n`, which is what happens when a PEM is pasted through a shell or a JSON
 * secret file rather than piped.
 */
function pkcs8FromPem(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '')
  return Uint8Array.from(atob(body), (character) => character.charCodeAt(0))
}

/**
 * The short-lived JWT that stands in for a client secret at Apple's token and
 * revoke endpoints. `sub` is the client id the identity token was issued to,
 * so a build signing in under a different bundle id revokes under that one.
 */
export async function mintAppleClientSecret(
  secrets: AppleSigninSecrets,
  clientId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8FromPem(secrets.privateKeyPem) as BufferSource,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const header = b64urlEncode(
    encoder.encode(
      JSON.stringify({ alg: 'ES256', kid: secrets.keyId, typ: 'JWT' }),
    ),
  )
  const payload = b64urlEncode(
    encoder.encode(
      JSON.stringify({
        iss: secrets.teamId,
        iat: nowSeconds,
        exp: nowSeconds + CLIENT_SECRET_TTL_SECONDS,
        aud: APPLE_ISSUER,
        sub: clientId,
      }),
    ),
  )
  // WebCrypto's ECDSA signature is already the raw r||s pair JWS wants; a
  // DER-encoded one would need unwrapping first.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(`${header}.${payload}`),
  )
  return `${header}.${payload}.${b64urlEncode(signature)}`
}

// ── Code exchange and revocation ─────────────────────────────────────

/**
 * Trade the one-shot authorization code for a refresh token.
 *
 * Null on any failure, and deliberately non-fatal for the caller: the refresh
 * token exists only so deletion can revoke the grant (App Store 5.1.1(v)).
 * Failing a sign-in because Apple's token endpoint was slow would trade the
 * thing the user asked for against a courtesy they will never see.
 */
export async function exchangeAppleAuthorizationCode(
  secrets: AppleSigninSecrets,
  clientId: string,
  authorizationCode: string,
): Promise<string | null> {
  try {
    const clientSecret = await mintAppleClientSecret(secrets, clientId)
    const response = await fetch(APPLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
      }),
    })
    const body = (await response.json()) as {
      refresh_token?: string
      error?: string
    }
    if (!response.ok || typeof body.refresh_token !== 'string') {
      console.warn(
        `[apple] authorization-code exchange failed: ${response.status} ${body.error ?? 'no refresh token'}`,
      )
      return null
    }
    return body.refresh_token
  } catch (error) {
    console.warn('[apple] authorization-code exchange threw:', String(error))
    return null
  }
}

/** Hand a refresh token back to Apple. True when they accepted the revocation. */
async function revokeAtApple(
  secrets: AppleSigninSecrets,
  clientId: string,
  refreshToken: string,
): Promise<boolean> {
  try {
    const clientSecret = await mintAppleClientSecret(secrets, clientId)
    const response = await fetch(APPLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: 'refresh_token',
      }),
    })
    if (!response.ok) {
      console.warn(`[apple] revoke responded ${response.status}`)
      return false
    }
    return true
  } catch (error) {
    console.warn('[apple] revoke threw:', String(error))
    return false
  }
}

// ── The stored grant ─────────────────────────────────────────────────
//
// `users.appleRefreshToken` holds base64url(iv || AES-GCM ciphertext) of
// `{"clientId":…,"refreshToken":…}`. The client id rides along because
// revocation has to name it and, by deletion time, the identity token that
// carried it is long gone.

interface StoredAppleGrant {
  clientId: string
  refreshToken: string
}

/**
 * The sealing key, derived rather than provisioned — the same shape the Drive
 * refresh token uses, with its own `info` string so the two cannot open each
 * other's ciphertext.
 */
async function appleGrantKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(16),
      info: encoder.encode('mp-apple-refresh-token'),
    },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function sealAppleGrant(
  secret: string,
  grant: StoredAppleGrant,
): Promise<string> {
  const key = await appleGrantKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(grant)),
  )
  const joined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  joined.set(iv, 0)
  joined.set(new Uint8Array(ciphertext), iv.byteLength)
  return b64urlEncode(joined)
}

async function openAppleGrant(
  secret: string,
  sealed: string,
): Promise<StoredAppleGrant | null> {
  try {
    const joined = b64urlDecode(sealed)
    const key = await appleGrantKey(secret)
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: joined.slice(0, 12) },
      key,
      joined.slice(12) as BufferSource,
    )
    const grant = JSON.parse(
      new TextDecoder().decode(plain),
    ) as StoredAppleGrant
    if (
      typeof grant.clientId !== 'string' ||
      typeof grant.refreshToken !== 'string'
    ) {
      return null
    }
    return grant
  } catch {
    // Sealed under a rotated JWT_SECRET. Treated as "no grant stored", which
    // is also how it behaves: nothing here can be revoked with it.
    return null
  }
}

/** Seal the grant onto the account's row. Best-effort by contract. */
export async function storeAppleRefreshToken(
  env: Env,
  userId: string,
  clientId: string,
  refreshToken: string,
): Promise<void> {
  const sealed = await sealAppleGrant(env.JWT_SECRET as string, {
    clientId,
    refreshToken,
  })
  await env.DB.prepare(
    'UPDATE users SET appleRefreshToken = ?, updatedAt = ? WHERE id = ?',
  )
    .bind(sealed, new Date().toISOString(), userId)
    .run()
}

/**
 * Withdraw the grant at Apple, then forget our copy.
 *
 * Shared by account deletion and by the `account-delete` / `consent-revoked`
 * server notification, so the two cannot drift. Deliberately best-effort:
 * Apple's own guidance is that a deletion completes whether or not the revoke
 * call succeeds, and the column is cleared either way.
 */
export async function revokeAndForgetAppleGrant(
  env: Env,
  userId: string,
): Promise<void> {
  const row = await env.DB.prepare(
    'SELECT appleRefreshToken FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<{ appleRefreshToken: string | null }>()
  const sealed = row?.appleRefreshToken
  if (!sealed) return

  const secrets = appleSigninSecrets(env)
  const grant = await openAppleGrant(env.JWT_SECRET as string, sealed)
  if (secrets !== null && grant !== null) {
    const revoked = await revokeAtApple(
      secrets,
      grant.clientId,
      grant.refreshToken,
    )
    console.info(
      `[apple] grant revocation for ${userId}: ${revoked ? 'accepted' : 'refused'}`,
    )
  } else {
    console.info(
      `[apple] grant for ${userId} dropped without revoking (${secrets === null ? 'no signing key configured' : 'sealed under a rotated secret'})`,
    )
  }

  await env.DB.prepare(
    'UPDATE users SET appleRefreshToken = NULL, updatedAt = ? WHERE id = ?',
  )
    .bind(new Date().toISOString(), userId)
    .run()
}
