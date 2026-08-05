// ============================================================
// Premium background delivery — dynamic catalog and revocable private bytes
// ============================================================
//
// D1 publish state is checked before every R2 read. Authenticated requests use
// current supporter/group evidence; Jam guests use a five-minute capability
// whose stored issuer, room, background and exact revision are rechecked on
// every request. A stale token therefore stops working immediately after a
// publish, retirement, group revocation or entitlement expiry.

import type { AuthUser, Env } from './auth'
import { checkRateLimit, rateLimitSubject } from './auth'
import { hasSecureCapabilitySecret, JAM_ROOM_ID_RE, mintBackgroundCapability, verifyBackgroundCapability, } from './background-capabilities'
import type { ShippedBackgroundRevision } from './premium-background-access'
import { findShippedBackground, findShippedBackgroundVariant, listRuntimePremiumBackgrounds, mayAccessPremiumBackground, resolvePremiumBackgroundAccess, } from './premium-background-access'
import type { PremiumBackgroundId } from './premium-background-catalog'
import { isJamPremiumBackgroundId, isPremiumBackgroundId, isPremiumBackgroundVariant, } from './premium-background-catalog'
import { premiumAuditStatement } from './premium-perk-audit'

const ROUTE_PREFIX = '/api/premium-backgrounds'
const CATALOG_PATH = `${ROUTE_PREFIX}/catalog`
const DEFAULT_VARIANT = 'landscape-2k'
const CAPABILITY_HEADER = 'X-Jam-Background-Capability'
const ROOM_HEADER = 'X-Jam-Room-Id'
const CAPABILITY_REQUEST_MAX_BYTES = 640
const OWNER_TOKEN_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const workerCrypto = Reflect.get(globalThis, 'crypto') as Crypto

interface CapabilityRow {
  backgroundId: string
  expiresAt: string
  id: string
  issuedAt: string
  issuerUserId: string
  revisionId: string
  revokedAt: string | null
  roomId: string
  version: number
}

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
): Promise<{ ownerToken: string; roomId: string; version?: number } | null> {
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
        // The malformed proof remains rejected.
      }
      return null
    }
  }

  const reader = request.body?.getReader()
  if (reader === undefined) return null
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false })
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
          // Reject even when cancellation itself fails.
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
      // The original stream/decode failure is sufficient.
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
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    return null
  const candidate = body as {
    ownerToken?: unknown
    roomId?: unknown
    version?: unknown
  }
  if (
    typeof candidate.roomId !== 'string' ||
    !JAM_ROOM_ID_RE.test(candidate.roomId) ||
    typeof candidate.ownerToken !== 'string' ||
    !OWNER_TOKEN_RE.test(candidate.ownerToken) ||
    (candidate.version !== undefined &&
      (!Number.isInteger(candidate.version) ||
        (candidate.version as number) < 1))
  ) {
    return null
  }
  return {
    ownerToken: candidate.ownerToken,
    roomId: candidate.roomId,
    ...(candidate.version === undefined
      ? {}
      : { version: candidate.version as number }),
  }
}

async function handleRuntimeCatalog(
  request: Request,
  env: Env,
  auth: AuthUser | null,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders, {
      Allow: 'GET',
    })
  }
  const assets = await listRuntimePremiumBackgrounds(env)
  const shippedIds = new Set(assets.map((asset) => asset.id))
  const access =
    auth === null
      ? {
          activeSupporter: false,
          backgroundIds: [] as PremiumBackgroundId[],
          expiresAt: null,
        }
      : await resolvePremiumBackgroundAccess(env, auth.userId, shippedIds)
  return jsonResponse(
    {
      access: {
        authenticated: auth !== null,
        activeSupporter: access.activeSupporter,
        backgroundIds: access.backgroundIds,
        expiresAt: access.expiresAt,
      },
      assets,
      generatedAt: new Date().toISOString(),
    },
    200,
    corsHeaders,
  )
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
  const input = await parseCapabilityRequest(request)
  if (input === null) {
    return jsonResponse({ error: 'Invalid room proof' }, 400, corsHeaders)
  }
  const revision = await findShippedBackground(env, id, input.version)
  if (revision === null) {
    return jsonResponse({ error: 'Background not found' }, 404, corsHeaders)
  }
  if (!(await mayAccessPremiumBackground(env, auth.userId, id))) {
    return jsonResponse({ error: 'Forbidden' }, 403, corsHeaders)
  }
  if (!hasSecureCapabilitySecret(env.BACKGROUND_CAPABILITY_SECRET)) {
    return jsonResponse(
      { error: 'Jam background sharing unavailable' },
      503,
      corsHeaders,
    )
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

  const capabilityId = workerCrypto.randomUUID()
  const nowMs = Date.now()
  const capability = await mintBackgroundCapability(
    {
      backgroundId: id,
      capabilityId,
      roomId: input.roomId,
      version: revision.version,
    },
    env.BACKGROUND_CAPABILITY_SECRET,
    nowMs,
  )
  const issuedAt = new Date(Math.floor(nowMs / 1000) * 1000).toISOString()
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM premiumBackgroundCapabilities
        WHERE id IN (
          SELECT id FROM premiumBackgroundCapabilities
           WHERE expiresAt <= ?1
           ORDER BY expiresAt
           LIMIT 200
        )`,
    ).bind(issuedAt),
    env.DB.prepare(
      `INSERT INTO premiumBackgroundCapabilities
        (id, backgroundId, revisionId, version, roomId, issuerUserId,
         issuedAt, expiresAt, revokedAt)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL)`,
    ).bind(
      capabilityId,
      id,
      revision.revisionId,
      revision.version,
      input.roomId,
      auth.userId,
      issuedAt,
      capability.expiresAt,
    ),
    premiumAuditStatement(
      env,
      {
        action: 'capability.mint',
        actorId: auth.userId,
        actorType: 'user',
        details: {
          backgroundId: id,
          expiresAt: capability.expiresAt,
          roomId: input.roomId,
          version: revision.version,
        },
        entityId: capabilityId,
        entityType: 'background-capability',
      },
      issuedAt,
    ),
  ])
  return jsonResponse(
    {
      backgroundId: id,
      expiresAt: capability.expiresAt,
      roomId: input.roomId,
      token: capability.token,
      version: revision.version,
    },
    200,
    corsHeaders,
  )
}

type CapabilityVerification = 'absent' | 'valid' | 'invalid' | 'unavailable'

async function verifyGuestCapability(
  request: Request,
  env: Env,
  revision: ShippedBackgroundRevision,
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
  const verified = await verifyBackgroundCapability(
    token,
    revision.backgroundId,
    roomId,
    revision.version,
    env.BACKGROUND_CAPABILITY_SECRET,
  )
  if (verified === null) return 'invalid'
  const row = await env.DB.prepare(
    `SELECT id, backgroundId, revisionId, version, roomId, issuerUserId,
            issuedAt, expiresAt, revokedAt
       FROM premiumBackgroundCapabilities
      WHERE id = ?1 LIMIT 1`,
  )
    .bind(verified.capabilityId)
    .first<CapabilityRow>()
  if (
    row === null ||
    row.revokedAt !== null ||
    row.backgroundId !== revision.backgroundId ||
    row.revisionId !== revision.revisionId ||
    row.version !== revision.version ||
    row.roomId !== roomId ||
    row.issuedAt !== verified.issuedAt ||
    row.expiresAt !== verified.expiresAt ||
    Date.parse(row.expiresAt) <= Date.now()
  ) {
    return 'invalid'
  }
  return (await mayAccessPremiumBackground(
    env,
    row.issuerUserId,
    revision.backgroundId,
  ))
    ? 'valid'
    : 'invalid'
}

function requestedVersion(url: URL): number | undefined | null {
  const raw = url.searchParams.get('version')
  if (raw === null) return undefined
  if (!/^\d+$/.test(raw)) return null
  const version = Number(raw)
  return Number.isSafeInteger(version) && version >= 1 ? version : null
}

/**
 * Handle runtime catalog, protected bytes and Jam capabilities. Returns null
 * when another Worker feature owns the route.
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
  if (url.pathname === CATALOG_PATH) {
    return handleRuntimeCatalog(request, env, auth, corsHeaders)
  }

  const relativePath = url.pathname.slice(`${ROUTE_PREFIX}/`.length)
  const capabilityMatch = relativePath.match(/^([^/]+)\/capability$/)
  if (capabilityMatch !== null) {
    const id = capabilityMatch[1]!
    if (!isPremiumBackgroundId(id)) {
      return jsonResponse({ error: 'Background not found' }, 404, corsHeaders)
    }
    return handleCapabilityMint(request, env, id, auth, corsHeaders)
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders, {
      Allow: 'GET, HEAD',
    })
  }
  const id = relativePath
  const variant = url.searchParams.get('variant') ?? DEFAULT_VARIANT
  const version = requestedVersion(url)
  if (
    !isPremiumBackgroundId(id) ||
    !isPremiumBackgroundVariant(variant) ||
    version === null
  ) {
    return jsonResponse({ error: 'Background not found' }, 404, corsHeaders)
  }
  const capabilityHeader = request.headers.get(CAPABILITY_HEADER)
  const roomHeader = request.headers.get(ROOM_HEADER)
  if (auth === null) {
    if (capabilityHeader === null && roomHeader === null) {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)
    }
    if (
      capabilityHeader === null ||
      roomHeader === null ||
      version === undefined
    ) {
      return jsonResponse({ error: 'Forbidden' }, 403, corsHeaders)
    }
  }
  const asset = await findShippedBackgroundVariant(env, id, variant, version)
  if (asset === null) {
    return jsonResponse({ error: 'Background not found' }, 404, corsHeaders)
  }

  const guestCapability = await verifyGuestCapability(request, env, asset)
  let authorized = guestCapability === 'valid'
  if (!authorized && auth !== null) {
    authorized = await mayAccessPremiumBackground(env, auth.userId, id)
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
  const object = await bucket.get(asset.objectKey)
  if (object === null) {
    return jsonResponse({ error: 'Background not found' }, 404, corsHeaders)
  }
  if (object.size !== asset.byteSize) {
    return jsonResponse(
      { error: 'Premium background storage inconsistent' },
      503,
      corsHeaders,
    )
  }
  return new Response(request.method === 'HEAD' ? null : object.body, {
    headers: {
      ...corsHeaders,
      'Cache-Control': 'private, no-store',
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
