// ============================================================
// Jam background capabilities — short-lived room-scoped R2 access
// ============================================================
//
// A capability is intentionally not a user session. It authorizes one
// allowlisted background for one Jam Room, for long enough that guests can
// fetch the host-selected art and turn it into a local blob URL. Keeping it
// in a request header avoids leaking the bearer token through URLs/referrers.

import type { PremiumBackgroundId } from './premium-background-catalog'
import { isJamPremiumBackgroundId } from './premium-background-catalog'

const CAPABILITY_AUDIENCE = 'jam-premium-background'
const CAPABILITY_PREFIX = 'mpbg2'
export const BACKGROUND_CAPABILITY_TTL_SECONDS = 5 * 60
export const JAM_ROOM_ID_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const encoder = new TextEncoder()
const workerCrypto = Reflect.get(globalThis, 'crypto') as Crypto

interface BackgroundCapabilityPayload {
  aud: typeof CAPABILITY_AUDIENCE
  backgroundId: PremiumBackgroundId
  capabilityId: string
  exp: number
  iat: number
  roomId: string
  v: 2
  version: number
}

export interface MintedBackgroundCapability {
  expiresAt: string
  token: string
}

export interface BackgroundCapabilityScope {
  backgroundId: PremiumBackgroundId
  capabilityId: string
  roomId: string
  version: number
}

export interface VerifiedBackgroundCapability extends BackgroundCapabilityScope {
  expiresAt: string
  issuedAt: string
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
  return workerCrypto.subtle.importKey(
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
  scope: BackgroundCapabilityScope,
  secret: string,
  nowMs = Date.now(),
): Promise<MintedBackgroundCapability> {
  if (
    !isJamPremiumBackgroundId(scope.backgroundId) ||
    !UUID_RE.test(scope.capabilityId) ||
    !JAM_ROOM_ID_RE.test(scope.roomId) ||
    !Number.isInteger(scope.version) ||
    scope.version < 1
  ) {
    throw new Error('Invalid background capability scope')
  }
  const issuedAt = Math.floor(nowMs / 1000)
  const expiresAt = issuedAt + BACKGROUND_CAPABILITY_TTL_SECONDS
  const payload: BackgroundCapabilityPayload = {
    aud: CAPABILITY_AUDIENCE,
    backgroundId: scope.backgroundId,
    capabilityId: scope.capabilityId,
    exp: expiresAt,
    iat: issuedAt,
    roomId: scope.roomId,
    v: 2,
    version: scope.version,
  }
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)))
  const signature = new Uint8Array(
    await workerCrypto.subtle.sign(
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
  expectedVersion: number,
  secret: string,
  nowMs = Date.now(),
): Promise<VerifiedBackgroundCapability | null> {
  if (
    !isJamPremiumBackgroundId(expectedBackgroundId) ||
    token.length > 2048 ||
    !JAM_ROOM_ID_RE.test(expectedRoomId) ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    return null
  }

  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== CAPABILITY_PREFIX) return null
  const [, body, encodedSignature] = parts
  if (
    !/^[A-Za-z0-9_-]+$/.test(body) ||
    !/^[A-Za-z0-9_-]+$/.test(encodedSignature)
  ) {
    return null
  }

  let signature: Uint8Array
  try {
    signature = b64urlDecode(encodedSignature)
  } catch {
    return null
  }
  if (signature.byteLength !== 32) return null

  const signatureValid = await workerCrypto.subtle.verify(
    'HMAC',
    await capabilityKey(secret),
    signature,
    encoder.encode(`${CAPABILITY_PREFIX}.${body}`),
  )
  if (signatureValid !== true) return null

  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)))
  } catch {
    return null
  }
  if (typeof payload !== 'object' || payload === null) return null

  const candidate = payload as Partial<BackgroundCapabilityPayload>
  const now = Math.floor(nowMs / 1000)
  if (
    candidate.v !== 2 ||
    candidate.aud !== CAPABILITY_AUDIENCE ||
    candidate.backgroundId !== expectedBackgroundId
  ) {
    return null
  }
  if (
    typeof candidate.capabilityId !== 'string' ||
    !UUID_RE.test(candidate.capabilityId) ||
    candidate.roomId !== expectedRoomId ||
    candidate.version !== expectedVersion ||
    !Number.isInteger(candidate.iat) ||
    !Number.isInteger(candidate.exp)
  ) {
    return null
  }
  const issuedAt = candidate.iat as number
  const expiresAt = candidate.exp as number
  if (
    issuedAt > now + 30 ||
    expiresAt <= now ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > BACKGROUND_CAPABILITY_TTL_SECONDS
  ) {
    return null
  }
  return {
    backgroundId: expectedBackgroundId,
    capabilityId: candidate.capabilityId,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    issuedAt: new Date(issuedAt * 1000).toISOString(),
    roomId: expectedRoomId,
    version: expectedVersion,
  }
}
