// ============================================================
// Jam background capabilities — short-lived room-scoped R2 access
// ============================================================
//
// A capability is intentionally not a user session. It authorizes one
// allowlisted background for one Jam Room, for long enough that guests can
// fetch the host-selected art and turn it into a local blob URL. Keeping it
// in a request header avoids leaking the bearer token through URLs/referrers.

import type { PremiumBackgroundId } from './premium-background-catalog'

const CAPABILITY_AUDIENCE = 'jam-premium-background'
const CAPABILITY_PREFIX = 'mpbg1'
export const BACKGROUND_CAPABILITY_TTL_SECONDS = 15 * 60
export const JAM_ROOM_ID_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/

const encoder = new TextEncoder()

interface BackgroundCapabilityPayload {
  aud: typeof CAPABILITY_AUDIENCE
  backgroundId: PremiumBackgroundId
  exp: number
  iat: number
  roomId: string
  v: 1
}

export interface MintedBackgroundCapability {
  expiresAt: string
  token: string
}

function b64urlEncode(data: Uint8Array): string {
  let binary = ''
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(value: string): Uint8Array {
  const padding =
    value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function capabilityKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Reject missing or trivially weak deployment secrets before minting. */
export function hasSecureCapabilitySecret(
  secret: string | undefined,
): secret is string {
  return secret !== undefined && encoder.encode(secret).byteLength >= 32
}

export async function mintBackgroundCapability(
  backgroundId: PremiumBackgroundId,
  roomId: string,
  secret: string,
  nowMs = Date.now(),
): Promise<MintedBackgroundCapability> {
  const issuedAt = Math.floor(nowMs / 1000)
  const expiresAt = issuedAt + BACKGROUND_CAPABILITY_TTL_SECONDS
  const payload: BackgroundCapabilityPayload = {
    aud: CAPABILITY_AUDIENCE,
    backgroundId,
    exp: expiresAt,
    iat: issuedAt,
    roomId,
    v: 1,
  }
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)))
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      await capabilityKey(secret),
      encoder.encode(`${CAPABILITY_PREFIX}.${body}`),
    ),
  )
  return {
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    token: `${CAPABILITY_PREFIX}.${body}.${b64urlEncode(signature)}`,
  }
}

/**
 * Verify signature, scope and lifetime. All malformed inputs fail closed;
 * callers should never need to distinguish a typo from a forged token.
 */
export async function verifyBackgroundCapability(
  token: string,
  expectedBackgroundId: PremiumBackgroundId,
  expectedRoomId: string,
  secret: string,
  nowMs = Date.now(),
): Promise<boolean> {
  if (token.length > 2048 || !JAM_ROOM_ID_RE.test(expectedRoomId)) return false

  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== CAPABILITY_PREFIX) return false
  const [, body, encodedSignature] = parts
  if (
    !/^[A-Za-z0-9_-]+$/.test(body) ||
    !/^[A-Za-z0-9_-]+$/.test(encodedSignature)
  ) {
    return false
  }

  let signature: Uint8Array
  try {
    signature = b64urlDecode(encodedSignature)
  } catch {
    return false
  }
  if (signature.byteLength !== 32) return false

  const signatureValid = await crypto.subtle.verify(
    'HMAC',
    await capabilityKey(secret),
    signature,
    encoder.encode(`${CAPABILITY_PREFIX}.${body}`),
  )
  if (!signatureValid) return false

  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)))
  } catch {
    return false
  }
  if (typeof payload !== 'object' || payload === null) return false

  const candidate = payload as Partial<BackgroundCapabilityPayload>
  const now = Math.floor(nowMs / 1000)
  return (
    candidate.v === 1 &&
    candidate.aud === CAPABILITY_AUDIENCE &&
    candidate.backgroundId === expectedBackgroundId &&
    candidate.roomId === expectedRoomId &&
    Number.isInteger(candidate.iat) &&
    Number.isInteger(candidate.exp) &&
    (candidate.iat as number) <= now + 30 &&
    (candidate.exp as number) > now &&
    (candidate.exp as number) > (candidate.iat as number) &&
    (candidate.exp as number) - (candidate.iat as number) <=
      BACKGROUND_CAPABILITY_TTL_SECONDS
  )
}
