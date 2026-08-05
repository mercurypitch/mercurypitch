// ============================================================
// Premium background delivery — entitlement-gated private R2 reads
// ============================================================
//
// Every request is authenticated and authorized before the bucket is read.
// The response is private browser-cache data; Cloudflare's shared cache must
// never turn one supporter's successful request into a public asset URL.

import { checkRateLimit, rateLimitSubject, type AuthUser, type Env, } from './auth'
import { hasSecureCapabilitySecret, JAM_ROOM_ID_RE, mintBackgroundCapability, verifyBackgroundCapability, } from './background-capabilities'
import { getPerksForUser } from './perks'
import { isJamPremiumBackgroundId, isPremiumBackgroundId, isPremiumBackgroundVariant, premiumBackgroundObjectKey, type PremiumBackgroundId, } from './premium-background-catalog'

const ROUTE_PREFIX = '/api/premium-backgrounds'
const DEFAULT_VARIANT = 'landscape-2k'
const CAPABILITY_HEADER = 'X-Jam-Background-Capability'
const ROOM_HEADER = 'X-Jam-Room-Id'
const CAPABILITY_REQUEST_MAX_BYTES = 512
const OWNER_TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonResponse(
  body: object,
  status: number,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/json',
    },
  })
}

async function hasActiveSupporterEntitlement(
  env: Env,
  userId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT expiresAt
       FROM entitlements
      WHERE userId = ?1
        AND feature = 'supporter'
      LIMIT 1`,
  )
    .bind(userId)
    .first<{ expiresAt: string | null }>()
  if (row === null) return false
  if (row.expiresAt === null) return true
  const expiry = Date.parse(row.expiresAt)
  return (
    Number.isFinite(expiry) &&
    new Date(expiry).toISOString() === row.expiresAt &&
    expiry > Date.now()
  )
}

async function mayReadBackground(
  env: Env,
  auth: AuthUser,
  id: PremiumBackgroundId,
): Promise<boolean> {
  if (await hasActiveSupporterEntitlement(env, auth.userId)) return true
  const perks = await getPerksForUser(env, auth.userId)
  return perks.includes(id)
}

type HostVerification = 'verified' | 'denied' | 'unavailable'

async function verifyJamRoomHost(
  env: Env,
  roomId: string,
  ownerToken: string,
): Promise<HostVerification> {
  if (env.JAM_WORKER === undefined) return 'unavailable'
  try {
    return (await env.JAM_WORKER.verifyHost(roomId, ownerToken))
      ? 'verified'
      : 'denied'
  } catch {
    return 'unavailable'
  }
}

async function parseCapabilityRequest(
  request: Request,
): Promise<{ ownerToken: string; roomId: string } | null> {
  const contentLength = request.headers.get('Content-Length')
  if (contentLength !== null && /^\d+$/.test(contentLength)) {
    const declaredLength = Number(contentLength)
    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength > CAPABILITY_REQUEST_MAX_BYTES
    ) {
      try {
        await request.body?.cancel()
      } catch {
        // A malformed or already-failed body is rejected below either way.
      }
      return null
    }
  }

  const reader = request.body?.getReader()
  if (reader === undefined) return null

  const decoder = new TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: false,
  })
  let byteLength = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) {
        text += decoder.decode()
        break
      }
      if (chunk.value.byteLength > CAPABILITY_REQUEST_MAX_BYTES - byteLength) {
        try {
          await reader.cancel()
        } catch {
          // Reject even if the source itself fails while cancellation propagates.
        }
        return null
      }
      byteLength += chunk.value.byteLength
      text += decoder.decode(chunk.value, { stream: true })
    }
  } catch {
    try {
      await reader.cancel()
    } catch {
      // The original read/decode failure is enough to reject the body.
    }
    return null
  } finally {
    reader.releaseLock()
  }

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof body !== 'object' || body === null) return null
  const candidate = body as { ownerToken?: unknown; roomId?: unknown }
  if (
    typeof candidate.roomId !== 'string' ||
    !JAM_ROOM_ID_RE.test(candidate.roomId) ||
    typeof candidate.ownerToken !== 'string' ||
    !OWNER_TOKEN_RE.test(candidate.ownerToken)
  ) {
    return null
  }
  return { ownerToken: candidate.ownerToken, roomId: candidate.roomId }
}

async function handleCapabilityMint(
  request: Request,
  env: Env,
  id: PremiumBackgroundId,
  auth: AuthUser | null,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders, {
      Allow: 'POST',
    })
  }
  if (!isJamPremiumBackgroundId(id)) {
    return jsonResponse({ error: 'Background not found' }, 404, corsHeaders)
  }
  if (auth === null) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)
  }
  const rateLimit = await checkRateLimit(
    env.DB,
    rateLimitSubject(request, auth),
    'background-capability',
  )
  if (!rateLimit.allowed) {
    const retryAfter = rateLimit.retryAfter ?? 60
    return jsonResponse(
      { error: `Too many requests. Retry after ${retryAfter} seconds.` },
      429,
      corsHeaders,
      { 'Retry-After': String(retryAfter) },
    )
  }
  if (!(await mayReadBackground(env, auth, id))) {
    return jsonResponse({ error: 'Forbidden' }, 403, corsHeaders)
  }
  if (!hasSecureCapabilitySecret(env.BACKGROUND_CAPABILITY_SECRET)) {
    return jsonResponse(
      { error: 'Jam background sharing unavailable' },
      503,
      corsHeaders,
    )
  }

  const input = await parseCapabilityRequest(request)
  if (input === null) {
    return jsonResponse({ error: 'Invalid room proof' }, 400, corsHeaders)
  }
  const hostVerification = await verifyJamRoomHost(
    env,
    input.roomId,
    input.ownerToken,
  )
  if (hostVerification === 'denied') {
    return jsonResponse({ error: 'Host proof rejected' }, 403, corsHeaders)
  }
  if (hostVerification === 'unavailable') {
    return jsonResponse(
      { error: 'Jam background sharing unavailable' },
      503,
      corsHeaders,
    )
  }

  const capability = await mintBackgroundCapability(
    id,
    input.roomId,
    env.BACKGROUND_CAPABILITY_SECRET,
  )
  return jsonResponse(
    {
      backgroundId: id,
      roomId: input.roomId,
      ...capability,
    },
    200,
    corsHeaders,
  )
}

type CapabilityVerification = 'absent' | 'valid' | 'invalid' | 'unavailable'

async function verifyGuestCapability(
  request: Request,
  env: Env,
  id: PremiumBackgroundId,
): Promise<CapabilityVerification> {
  const token = request.headers.get(CAPABILITY_HEADER)
  const roomId = request.headers.get(ROOM_HEADER)
  if (token === null && roomId === null) return 'absent'
  if (token === null || roomId === null || !JAM_ROOM_ID_RE.test(roomId)) {
    return 'invalid'
  }
  if (!hasSecureCapabilitySecret(env.BACKGROUND_CAPABILITY_SECRET)) {
    return 'unavailable'
  }
  return (await verifyBackgroundCapability(
    token,
    id,
    roomId,
    env.BACKGROUND_CAPABILITY_SECRET,
  ))
    ? 'valid'
    : 'invalid'
}

/**
 * Handle `/api/premium-backgrounds/:id?variant=...`, or return null when the
 * route belongs to another handler.
 */
export async function handlePremiumBackgroundRequest(
  request: Request,
  env: Env,
  url: URL,
  auth: AuthUser | null,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (
    url.pathname !== ROUTE_PREFIX &&
    !url.pathname.startsWith(`${ROUTE_PREFIX}/`)
  ) {
    return null
  }

  const relativePath = url.pathname.slice(`${ROUTE_PREFIX}/`.length)
  const capabilityMatch = relativePath.match(/^([^/]+)\/capability$/)
  if (capabilityMatch !== null) {
    const id = capabilityMatch[1]
    if (!isPremiumBackgroundId(id)) {
      return jsonResponse({ error: 'Background not found' }, 404, corsHeaders)
    }
    return handleCapabilityMint(request, env, id, auth, corsHeaders)
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders, {
      Allow: 'GET',
    })
  }

  const id = relativePath
  const variant = url.searchParams.get('variant') ?? DEFAULT_VARIANT
  if (!isPremiumBackgroundId(id) || !isPremiumBackgroundVariant(variant)) {
    return jsonResponse({ error: 'Background not found' }, 404, corsHeaders)
  }
  const objectKey = premiumBackgroundObjectKey(id, variant)

  const guestCapability = await verifyGuestCapability(request, env, id)
  let authorized = guestCapability === 'valid'
  if (!authorized && auth !== null) {
    authorized = await mayReadBackground(env, auth, id)
  }
  if (!authorized) {
    if (guestCapability === 'unavailable') {
      return jsonResponse(
        { error: 'Jam background sharing unavailable' },
        503,
        corsHeaders,
      )
    }
    if (auth === null && guestCapability === 'absent') {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)
    }
    return jsonResponse({ error: 'Forbidden' }, 403, corsHeaders)
  }

  const bucket = env.PREMIUM_BACKGROUNDS_BUCKET
  if (bucket === undefined) {
    return jsonResponse(
      { error: 'Premium background storage unavailable' },
      503,
      corsHeaders,
    )
  }

  const readRateLimit = await checkRateLimit(
    env.DB,
    rateLimitSubject(request, auth),
    'background-read',
  )
  if (!readRateLimit.allowed) {
    const retryAfter = readRateLimit.retryAfter ?? 60
    return jsonResponse(
      { error: `Too many requests. Retry after ${retryAfter} seconds.` },
      429,
      corsHeaders,
      { 'Retry-After': String(retryAfter) },
    )
  }

  const object = await bucket.get(objectKey)
  if (object === null) {
    return jsonResponse({ error: 'Background not found' }, 404, corsHeaders)
  }

  return new Response(object.body, {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'private, max-age=300, must-revalidate',
      'Content-Disposition': 'inline',
      'Content-Length': String(object.size),
      'Content-Type': 'image/webp',
      ETag: object.httpEtag,
      'Last-Modified': object.uploaded.toUTCString(),
      Vary: 'Authorization, Origin, X-Jam-Background-Capability, X-Jam-Room-Id',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
