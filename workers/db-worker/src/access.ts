// ============================================================
// Cloudflare Access — edge identity in front of the admin surface
// ============================================================
//
// Access authenticates at Cloudflare's edge (one-time PIN, Google, or a
// service token) and forwards a signed JWT. Nothing here runs a login
// flow; this module only decides whether the token in front of it is
// real, current, and issued for THIS application.
//
// Why the Worker verifies rather than trusting the header: `X-Admin-Key`
// is one shared bearer secret with no identity, no audit trail and no
// revocation short of rotating it everywhere. Access gives all three —
// but only if the token is checked. A worker that trusts an unverified
// `Cf-Access-Jwt-Assertion` is wide open the moment anyone reaches it on
// a hostname Access does not sit in front of (a `*.workers.dev` URL, for
// instance). Verifying the signature closes that door: an attacker off
// the protected hostname has no token this code will accept.
//
// Configuration — all three are set with `wrangler secret put`, never as
// vars in wrangler.jsonc, because this repository is public and the team
// domain and audience tag identify the account:
//   ACCESS_TEAM_DOMAIN  e.g. "<team>.cloudflareaccess.com"
//   ACCESS_AUD          the Access application's Audience (AUD) tag
//   ACCESS_ALLOWED_EMAILS  optional extra comma-separated allowlist
//
// With both of the first two set, a verified Access identity is accepted for
// admin routes. The shared key remains a staged fallback until ACCESS_STRICT=1
// is also configured; with either Access setting missing — local dev, PR
// previews — the key remains the only gate, so the dev loop does not change.

import type { Env } from './auth'

export interface AccessIdentity {
  /** Sign-in email, or a service token's common name. */
  subject: string
  kind: 'user' | 'service'
}

export interface AdminResolution {
  accessIdentity: AccessIdentity | null
  authorized: boolean
}

/** RS256 is the only algorithm Access issues, and the only one accepted.
 *  Pinning it is what stops an `alg: "none"` or HS256-confusion token. */
const ALLOWED_ALG = 'RS256'

/** Keys rotate; an hour is well inside Cloudflare's rotation window and
 *  keeps the common path free of a second network round trip. */
const JWKS_TTL_MS = 3_600_000

/** Clock skew tolerated on exp/iat, in seconds. */
const SKEW_SEC = 60

interface CachedJwks {
  url: string
  fetchedAt: number
  keys: Map<string, CryptoKey>
}

let jwksCache: CachedJwks | null = null

/** True when this environment is behind Access at all. */
export function accessConfigured(env: Env): boolean {
  return (env.ACCESS_TEAM_DOMAIN ?? '') !== '' && (env.ACCESS_AUD ?? '') !== ''
}

function teamOrigin(env: Env): string {
  const domain = (env.ACCESS_TEAM_DOMAIN ?? '').replace(/^https?:\/\//, '')
  return `https://${domain.replace(/\/$/, '')}`
}

// ── Encoding helpers ─────────────────────────────────────────────────

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function decodeJson(segment: string): Record<string, unknown> | null {
  try {
    return JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(segment)),
    ) as Record<string, unknown>
  } catch {
    return null
  }
}

// ── The token itself ─────────────────────────────────────────────────

/**
 * Access sends the token as a header on proxied requests and as a cookie
 * on browser navigations. Both are read: the cookie is what a fetch from
 * the admin page carries when it goes to the same protected hostname.
 */
function readToken(request: Request): string | null {
  const header = request.headers.get('Cf-Access-Jwt-Assertion')
  if (header !== null && header !== '') return header
  const cookie = request.headers.get('Cookie') ?? ''
  const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie)
  return match ? match[1]! : null
}

// ── JWKS ─────────────────────────────────────────────────────────────

async function loadJwks(env: Env): Promise<Map<string, CryptoKey>> {
  const url = `${teamOrigin(env)}/cdn-cgi/access/certs`
  const now = Date.now()
  if (
    jwksCache !== null &&
    jwksCache.url === url &&
    now - jwksCache.fetchedAt < JWKS_TTL_MS
  ) {
    return jwksCache.keys
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Access certs ${res.status}`)
  const body = (await res.json()) as { keys?: JsonWebKey[] }
  const keys = new Map<string, CryptoKey>()
  for (const jwk of body.keys ?? []) {
    const kid = (jwk as { kid?: string }).kid
    if (kid === undefined || jwk.kty !== 'RSA') continue
    try {
      keys.set(
        kid,
        await crypto.subtle.importKey(
          'jwk',
          { ...jwk, alg: ALLOWED_ALG, ext: true },
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify'],
        ),
      )
    } catch {
      // A key we cannot import is a key we cannot trust — skip it rather
      // than failing the whole set, so one bad entry during a rotation
      // does not lock the admin out.
    }
  }
  if (keys.size === 0) throw new Error('Access certs contained no usable keys')
  jwksCache = { url, fetchedAt: now, keys }
  return keys
}

/** Drop the cache so the next verify re-fetches (used on an unknown kid). */
function invalidateJwks(): void {
  jwksCache = null
}

// ── Verification ─────────────────────────────────────────────────────

/**
 * Verify the Access token on `request`. Returns the identity it proves,
 * or null for anything unverifiable — an absent token, a bad signature,
 * the wrong audience, an expired session. Never throws: a network blip
 * fetching the certs must read as "not admin", not as a 500.
 */
export async function verifyAccessJwt(
  request: Request,
  env: Env,
): Promise<AccessIdentity | null> {
  if (!accessConfigured(env)) return null
  const token = readToken(request)
  if (token === null) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [rawHeader, rawPayload, rawSignature] = parts as [
    string,
    string,
    string,
  ]

  const header = decodeJson(rawHeader)
  if (header === null || header.alg !== ALLOWED_ALG) return null
  const kid = typeof header.kid === 'string' ? header.kid : null
  if (kid === null) return null

  try {
    let keys = await loadJwks(env)
    let key = keys.get(kid)
    if (key === undefined) {
      // Unknown kid usually means the signing keys rotated inside our TTL.
      invalidateJwks()
      keys = await loadJwks(env)
      key = keys.get(kid)
    }
    if (key === undefined) return null

    const signed = new TextEncoder().encode(`${rawHeader}.${rawPayload}`)
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlToBytes(rawSignature),
      signed,
    )
    if (!ok) return null
  } catch (err) {
    console.error('[access] verification failed', err)
    return null
  }

  const payload = decodeJson(rawPayload)
  if (payload === null) return null

  // Audience — the one check that ties a valid Cloudflare token to THIS
  // application. Without it any token from the same team is accepted.
  const aud = payload.aud
  const audList = Array.isArray(aud)
    ? aud
    : typeof aud === 'string'
      ? [aud]
      : []
  if (!audList.includes(env.ACCESS_AUD ?? '')) return null

  if (payload.iss !== teamOrigin(env)) return null

  const nowSec = Math.floor(Date.now() / 1000)
  const exp = typeof payload.exp === 'number' ? payload.exp : 0
  if (exp + SKEW_SEC < nowSec) return null
  const iat = typeof payload.iat === 'number' ? payload.iat : null
  if (iat !== null && iat - SKEW_SEC > nowSec) return null

  // A human sign-in carries `email`; a service token carries `common_name`
  // and no email at all.
  const email = typeof payload.email === 'string' ? payload.email : ''
  const commonName =
    typeof payload.common_name === 'string' ? payload.common_name : ''

  if (email !== '') {
    const allowed = (env.ACCESS_ALLOWED_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s !== '')
    // Empty list means "whoever the Access policy let through", which is
    // already an explicit allowlist in the Cloudflare dashboard.
    if (allowed.length > 0 && !allowed.includes(email.toLowerCase())) {
      return null
    }
    return { subject: email, kind: 'user' }
  }

  if (commonName !== '') return { subject: commonName, kind: 'service' }
  return null
}

/**
 * The admin decision, given whether the shared key also matched.
 *
 * Rollout is deliberately two-staged, because turning Access on and
 * retiring the key in the same move would lock the owner out of the
 * browser studio: the studio is served from the app origin and calls the
 * API cross-origin, so it cannot carry an Access cookie until that is
 * solved. So:
 *
 *   1. Configure Access. A verified token is now sufficient on its own,
 *      scripts move to service tokens, and every admin action gains an
 *      identity — while the key keeps the browser studio working.
 *   2. Set ACCESS_STRICT=1 once the studio reaches the API through an
 *      Access-authenticated path. The shared key stops being accepted
 *      anywhere, which is the end state.
 *
 * Where Access is not configured at all (local wrangler, PR previews),
 * the key is the only gate and nothing about the dev loop changes.
 */
export async function resolveAdminWithIdentity(
  request: Request,
  env: Env,
  keyMatches: boolean,
): Promise<AdminResolution> {
  if (accessConfigured(env)) {
    const accessIdentity = await verifyAccessJwt(request, env)
    if (accessIdentity !== null) {
      return { accessIdentity, authorized: true }
    }
    if ((env.ACCESS_STRICT ?? '') === '1') {
      return { accessIdentity: null, authorized: false }
    }
  }
  return { accessIdentity: null, authorized: keyMatches }
}

export async function resolveAdmin(
  request: Request,
  env: Env,
  keyMatches: boolean,
): Promise<boolean> {
  return (await resolveAdminWithIdentity(request, env, keyMatches)).authorized
}
