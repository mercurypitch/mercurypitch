// ── The ceremony token ───────────────────────────────────────────────
//
// Some sign-in steps take two requests: the server says "prove one more
// thing", the client answers. Between those the server has to remember what it
// asked, for whom, and how long the offer stands — without keeping state.
//
// A signed blob does that:
//
//   b64url(JSON{purpose, exp, …claims}) . b64url(HMAC-SHA256(payload))
//
// The HMAC makes it unforgeable, `exp` makes it short-lived, and `purpose`
// stops a token minted for one ceremony being spent on another. Holding one
// grants nothing except the right to attempt the answer it was minted for.
//
// It travels in the JSON body, not a cookie. The worker answers every request
// with `Access-Control-Allow-Origin: *`, and the CORS specification forbids
// credentialed requests against a wildcard origin — so cookies cannot reach
// this API at all without replacing the wildcard with a reflected-origin
// allowlist across every endpoint in the app. Against XSS a body-carried token
// is weaker than an httpOnly cookie, but the session JWT this ceremony ends in
// already lives in localStorage, so script running in the page can already do
// everything a stolen ceremony token would allow: no new exposure. It gains
// one thing worth naming — no ambient authority, so none of these endpoints
// has a CSRF surface.

/**
 * Compare without an early exit.
 *
 * A local copy of auth.ts's `timingSafeEqual` rather than an import: auth.ts
 * imports this module for the login fork, and a cycle between the two would
 * make module-initialisation order load-bearing in a file nobody wants to have
 * to think that hard about. Six lines is the cheaper price.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export type CeremonyPurpose =
  /** First factor proved; a TOTP code is still owed. */
  | '2fa'
  /** A 6-digit code was mailed; this names the row it may be checked against. */
  | 'logincode'
  | 'webauthn-reg'
  | 'webauthn-auth'

/** Claims carried by each purpose. Everything is public to the holder. */
export interface CeremonyClaims {
  purpose: CeremonyPurpose
  exp: number
  /** '2fa': whose sign-in this is, and how the first factor was proved. */
  userId?: string
  provider?: string
  /** 'logincode': the one row this browser may attempt, and for which address. */
  codeId?: number
  email?: string
  /** 'webauthn-*': the challenge the authenticator must sign. */
  challenge?: string
}

const encoder = new TextEncoder()

function b64urlEncode(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/** A ceremony token is base64url and a dot, and nothing else. */
const SEGMENT_RE = /^[A-Za-z0-9_-]+$/

/** How long each kind of ceremony stays open, in seconds. */
export const CEREMONY_TTL: Record<CeremonyPurpose, number> = {
  // Long enough to open an authenticator app and read a code; short enough
  // that a proved first factor is not a standing invitation.
  '2fa': 300,
  // Matches the mailed code's own ten-minute life — a ceremony that expired
  // first would refuse a code the email still says is good.
  logincode: 600,
  'webauthn-reg': 300,
  'webauthn-auth': 300,
}

/**
 * Mint a token for one ceremony. `exp` is set here rather than by the caller,
 * so no route can accidentally issue a long-lived one.
 */
export async function issueCeremony(
  secret: string,
  claims: Omit<CeremonyClaims, 'exp'>,
): Promise<string> {
  const full: CeremonyClaims = {
    ...claims,
    exp: Math.floor(Date.now() / 1000) + CEREMONY_TTL[claims.purpose],
  }
  const payload = b64urlEncode(encoder.encode(JSON.stringify(full)))
  const mac = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(payload),
  )
  return `${payload}.${b64urlEncode(mac)}`
}

/**
 * Verify a token and assert what it was minted for.
 *
 * `purpose` is a parameter rather than something the caller checks afterwards,
 * because "read the claims, then remember to check the purpose" is exactly the
 * step that gets skipped. Returns null for anything wrong — forged, expired,
 * malformed, or minted for a different ceremony — so a caller cannot
 * accidentally treat one failure as milder than another.
 */
export async function readCeremony(
  secret: string | undefined,
  token: string | undefined,
  purpose: CeremonyPurpose,
): Promise<CeremonyClaims | null> {
  if (secret === undefined || secret === '') return null
  if (token === undefined || token === '') return null
  const [payload, mac] = token.split('.')
  if (payload === undefined || mac === undefined) return null
  if (!SEGMENT_RE.test(payload) || !SEGMENT_RE.test(mac)) return null

  const expected = b64urlEncode(
    await crypto.subtle.sign(
      'HMAC',
      await hmacKey(secret),
      encoder.encode(payload),
    ),
  )
  if (!timingSafeEqual(mac, expected)) return null

  try {
    const claims = JSON.parse(
      new TextDecoder().decode(b64urlDecode(payload)),
    ) as CeremonyClaims
    if (claims.purpose !== purpose) return null
    if (typeof claims.exp !== 'number') return null
    if (claims.exp < Math.floor(Date.now() / 1000)) return null
    return claims
  } catch {
    return null
  }
}
