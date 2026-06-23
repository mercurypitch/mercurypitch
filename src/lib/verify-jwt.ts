// Dependency-free HS256 JWT verification (signature + expiry only).
//
// Used to gate state-changing requests at the edge (the main worker) without a
// database round-trip. Mirrors the token signed by workers/db-worker/auth.ts.
// It deliberately does NOT check `tokenVersion` revocation (that would need the
// users table) — signature + `exp` is enough to stop anonymous abuse of
// expensive endpoints such as UVR separation.

const encoder = new TextEncoder()

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = globalThis.atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export interface VerifiedJwt {
  sub: string
  provider?: string
  exp: number
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

/** Verify an HS256 JWT's signature and expiry. Returns the payload, or null
 *  when the token is malformed, mis-signed, or expired. */
export async function verifyJwt(
  token: string,
  secret: string,
): Promise<VerifiedJwt | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts

  let valid: boolean
  try {
    valid = await globalThis.crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      b64urlDecode(sig) as BufferSource,
      encoder.encode(`${header}.${body}`) as BufferSource,
    )
  } catch {
    return null
  }
  if (!valid) return null

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlDecode(body)),
    ) as VerifiedJwt
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
      return null
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/** Extract and verify the Bearer token from a request's Authorization header.
 *  Returns null when the secret is unset or the token is absent/invalid. */
export async function verifyBearer(
  request: Request,
  secret: string | undefined,
): Promise<VerifiedJwt | null> {
  if (secret === undefined || secret === '') return null
  const header = request.headers.get('Authorization')
  if (header === null || !header.startsWith('Bearer ')) return null
  return verifyJwt(header.slice(7), secret)
}
