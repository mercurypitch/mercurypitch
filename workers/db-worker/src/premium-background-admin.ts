// ============================================================
// Premium Perks Studio — immutable assets and supporter groups
// ============================================================
//
// Admins upload bounded WebP bytes to a server-generated immutable R2 key,
// then explicitly publish a complete revision. Drafts never appear in the
// runtime catalog. Group changes and every other mutation share one audit
// ledger in the environment-local main database.

import { getBackgroundDefinition, isBackgroundPerkId, } from '../../../src/lib/backgrounds/background-catalog'
import type { SupporterFeaturePerkId } from '../../../src/lib/supporter-feature-catalog'
import { isSupporterFeaturePerkId } from '../../../src/lib/supporter-feature-catalog'
import type { Env } from './auth'
import type { PremiumBackgroundId, PremiumBackgroundVariant, } from './premium-background-catalog'
import { isPremiumBackgroundVariant, PREMIUM_BACKGROUND_VARIANTS, } from './premium-background-catalog'
import type { PremiumAdminAuditActor } from './premium-perk-audit'
import { premiumAuditAfterMutationStatement, premiumAuditStatement, } from './premium-perk-audit'

type JsonResponder = (body: object | null, init?: ResponseInit) => Response

export interface PremiumBackgroundAdminContext {
  admin: boolean
  auditActor: PremiumAdminAuditActor
  corsHeaders: Readonly<Record<string, string>>
  respond: JsonResponder
}

interface AssetRow {
  activeRevisionId: string | null
  createdAt: string
  description: string
  id: string
  retiredAt: string | null
  status: 'active' | 'retired'
  surface: 'karaoke' | 'jam'
  title: string
  updatedAt: string
}

interface RevisionRow {
  backgroundId: string
  createdAt: string
  id: string
  lifecycle: 'draft' | 'published' | 'superseded'
  publishedAt: string | null
  supersededAt: string | null
  updatedAt: string
  version: number
}

interface VariantRow {
  byteSize: number
  createdAt: string
  etag: string | null
  height: number
  id: string
  objectKey: string
  revisionId: string
  sha256: string
  updatedAt: string
  variant: PremiumBackgroundVariant
  width: number
}

interface GroupRow {
  active: number
  createdAt: string
  deletedAt: string | null
  description: string
  id: string
  kind: 'automatic' | 'manual'
  name: string
  slug: string
  updatedAt: string
}

interface MemberRow {
  email: string
  grantedAt: string
  groupId: string
  note: string | null
  revokedAt: string | null
}

interface GroupPerkRow {
  assignedAt: string
  backgroundId: string
  groupId: string
  revokedAt: string | null
}

interface GroupFeatureRow {
  assignedAt: string
  featureId: string
  groupId: string
  revokedAt: string | null
}

interface CapabilityRow {
  backgroundId: string
  expiresAt: string
  id: string
  issuedAt: string
  issuerUserId: string
  revokedAt: string | null
  roomId: string
  version: number
}

interface WebPMetadata {
  height: number
  width: number
}

const ADMIN_ASSET_PREFIX = '/api/admin/premium-backgrounds'
const ADMIN_GROUP_PREFIX = '/api/admin/supporter-groups'
const ADMIN_CAPABILITY_PREFIX = '/api/admin/premium-background-capabilities'
const MAX_WEBP_BYTES = 16 * 1024 * 1024
const MAX_IMAGE_DIMENSION = 8192
const MAX_TEXT_LENGTH = 240
const MAX_DESCRIPTION_LENGTH = 1200
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GROUP_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const workerCrypto = Reflect.get(globalThis, 'crypto') as Crypto

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await request.json()) as unknown
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function cleanText(
  value: unknown,
  maxLength: number,
  allowEmpty: boolean,
): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if ((!allowEmpty && text === '') || text.length > maxLength) return null
  return text
}

function normalizeEmail(value: unknown): string | null {
  const email = cleanText(value, 320, false)?.toLowerCase() ?? null
  return email !== null && EMAIL_RE.test(email) ? email : null
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function actorEvent(
  actor: PremiumAdminAuditActor,
  action: string,
  entityType: string,
  entityId: string,
  details: Readonly<Record<string, unknown>> = {},
) {
  return {
    ...actor,
    action,
    details,
    entityId,
    entityType,
  } as const
}

function publicVariant(row: VariantRow) {
  return {
    byteSize: row.byteSize,
    createdAt: row.createdAt,
    etag: row.etag,
    height: row.height,
    id: row.id,
    name: row.variant,
    sha256: row.sha256,
    updatedAt: row.updatedAt,
    width: row.width,
  }
}

async function listAdminAssets(
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const [assetsResult, revisionsResult, variantsResult] = await Promise.all([
    env.DB.prepare(
      'SELECT * FROM premiumBackgroundAssets ORDER BY surface, title, id',
    ).all<AssetRow>(),
    env.DB.prepare(
      `SELECT * FROM premiumBackgroundRevisions
        ORDER BY backgroundId, version DESC`,
    ).all<RevisionRow>(),
    env.DB.prepare(
      `SELECT * FROM premiumBackgroundVariants
        ORDER BY revisionId, variant`,
    ).all<VariantRow>(),
  ])
  const variantsByRevision = new Map<
    string,
    ReturnType<typeof publicVariant>[]
  >()
  for (const variant of variantsResult.results ?? []) {
    const variants = variantsByRevision.get(variant.revisionId) ?? []
    variants.push(publicVariant(variant))
    variantsByRevision.set(variant.revisionId, variants)
  }
  const revisionsByAsset = new Map<string, object[]>()
  for (const revision of revisionsResult.results ?? []) {
    const revisions = revisionsByAsset.get(revision.backgroundId) ?? []
    revisions.push({
      createdAt: revision.createdAt,
      id: revision.id,
      lifecycle: revision.lifecycle,
      publishedAt: revision.publishedAt,
      supersededAt: revision.supersededAt,
      updatedAt: revision.updatedAt,
      variants: variantsByRevision.get(revision.id) ?? [],
      version: revision.version,
    })
    revisionsByAsset.set(revision.backgroundId, revisions)
  }
  return respond({
    assets: (assetsResult.results ?? []).map((asset) => ({
      activeRevisionId: asset.activeRevisionId,
      createdAt: asset.createdAt,
      description: asset.description,
      id: asset.id,
      retiredAt: asset.retiredAt,
      revisions: revisionsByAsset.get(asset.id) ?? [],
      status: asset.status,
      surface: asset.surface,
      title: asset.title,
      updatedAt: asset.updatedAt,
    })),
  })
}

function littleEndian16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8)
}

function littleEndian24(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)
}

function littleEndian32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  )
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

/** Validate RIFF length/signature and read dimensions from VP8/VP8L/VP8X. */
export function inspectWebP(bytes: Uint8Array): WebPMetadata | null {
  if (
    bytes.byteLength < 30 ||
    ascii(bytes, 0, 4) !== 'RIFF' ||
    ascii(bytes, 8, 4) !== 'WEBP' ||
    littleEndian32(bytes, 4) + 8 !== bytes.byteLength
  ) {
    return null
  }
  const chunk = ascii(bytes, 12, 4)
  const chunkSize = littleEndian32(bytes, 16)
  if (chunkSize + 20 > bytes.byteLength) return null

  let width = 0
  let height = 0
  if (chunk === 'VP8X' && chunkSize >= 10) {
    width = littleEndian24(bytes, 24) + 1
    height = littleEndian24(bytes, 27) + 1
  } else if (chunk === 'VP8L' && chunkSize >= 5 && bytes[20] === 0x2f) {
    const b1 = bytes[21]!
    const b2 = bytes[22]!
    const b3 = bytes[23]!
    const b4 = bytes[24]!
    width = 1 + b1 + ((b2 & 0x3f) << 8)
    height = 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10)
  } else if (
    chunk === 'VP8 ' &&
    chunkSize >= 10 &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    width = littleEndian16(bytes, 26) & 0x3fff
    height = littleEndian16(bytes, 28) & 0x3fff
  } else {
    return null
  }
  if (
    width < 1 ||
    height < 1 ||
    width > MAX_IMAGE_DIMENSION ||
    height > MAX_IMAGE_DIMENSION
  ) {
    return null
  }
  return { height, width }
}

async function readBoundedWebP(
  request: Request,
): Promise<{ bytes: Uint8Array; metadata: WebPMetadata } | Response> {
  const contentType =
    request.headers
      .get('Content-Type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase() ?? ''
  if (contentType !== 'image/webp') {
    return Response.json(
      { error: 'Content-Type must be image/webp' },
      { status: 415 },
    )
  }
  const declared = request.headers.get('Content-Length')
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) {
      return Response.json({ error: 'Invalid Content-Length' }, { status: 400 })
    }
    const size = Number(declared)
    if (!Number.isSafeInteger(size) || size < 1 || size > MAX_WEBP_BYTES) {
      try {
        await request.body?.cancel()
      } catch {
        // The size rejection remains authoritative.
      }
      return Response.json(
        { error: `WebP must be at most ${MAX_WEBP_BYTES} bytes` },
        { status: 413 },
      )
    }
  }
  const reader = request.body?.getReader()
  if (reader === undefined) {
    return Response.json({ error: 'WebP body required' }, { status: 400 })
  }
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      if (chunk.value.byteLength > MAX_WEBP_BYTES - total) {
        try {
          await reader.cancel()
        } catch {
          // The bounded reader still rejects the upload.
        }
        return Response.json(
          { error: `WebP must be at most ${MAX_WEBP_BYTES} bytes` },
          { status: 413 },
        )
      }
      chunks.push(chunk.value)
      total += chunk.value.byteLength
    }
  } catch {
    return Response.json({ error: 'Could not read WebP body' }, { status: 400 })
  } finally {
    reader.releaseLock()
  }
  if (total === 0) {
    return Response.json({ error: 'WebP body required' }, { status: 400 })
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const metadata = inspectWebP(bytes)
  if (metadata === null) {
    return Response.json({ error: 'Invalid WebP file' }, { status: 400 })
  }
  return { bytes, metadata }
}

function orientationMatches(
  variant: PremiumBackgroundVariant,
  metadata: WebPMetadata,
): boolean {
  return variant === 'portrait-2k'
    ? metadata.height >= metadata.width
    : metadata.width >= metadata.height
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(
    await workerCrypto.subtle.digest('SHA-256', bytes),
  )
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function updateAssetMetadata(
  backgroundId: PremiumBackgroundId,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const body = await readJsonObject(request)
  if (body === null)
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  const title =
    body.title === undefined
      ? undefined
      : cleanText(body.title, MAX_TEXT_LENGTH, false)
  const description =
    body.description === undefined
      ? undefined
      : cleanText(body.description, MAX_DESCRIPTION_LENGTH, true)
  if (
    (body.title !== undefined && title === null) ||
    (body.description !== undefined && description === null) ||
    (title === undefined && description === undefined)
  ) {
    return respond({ error: 'Invalid asset metadata' }, { status: 400 })
  }
  const current = await env.DB.prepare(
    'SELECT * FROM premiumBackgroundAssets WHERE id = ?1 LIMIT 1',
  )
    .bind(backgroundId)
    .first<AssetRow>()
  if (current === null)
    return respond({ error: 'Background not found' }, { status: 404 })
  const now = new Date().toISOString()
  const nextTitle = title ?? current.title
  const nextDescription = description ?? current.description
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE premiumBackgroundAssets
          SET title = ?1, description = ?2, updatedAt = ?3
        WHERE id = ?4`,
    ).bind(nextTitle, nextDescription, now, backgroundId),
    premiumAuditStatement(
      env,
      actorEvent(actor, 'asset.update', 'background', backgroundId, {
        descriptionChanged: nextDescription !== current.description,
        titleChanged: nextTitle !== current.title,
      }),
      now,
    ),
  ])
  return respond({
    asset: {
      ...current,
      description: nextDescription,
      title: nextTitle,
      updatedAt: now,
    },
  })
}

async function createDraftRevision(
  backgroundId: PremiumBackgroundId,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const asset = await env.DB.prepare(
    'SELECT id FROM premiumBackgroundAssets WHERE id = ?1 LIMIT 1',
  )
    .bind(backgroundId)
    .first<{ id: string }>()
  if (asset === null)
    return respond({ error: 'Background not found' }, { status: 404 })
  const existingDraft = await env.DB.prepare(
    `SELECT id, version FROM premiumBackgroundRevisions
      WHERE backgroundId = ?1 AND lifecycle = 'draft'
      LIMIT 1`,
  )
    .bind(backgroundId)
    .first<{ id: string; version: number }>()
  if (existingDraft !== null) {
    return respond(
      { error: 'A draft revision already exists', revision: existingDraft },
      { status: 409 },
    )
  }
  const latest = await env.DB.prepare(
    `SELECT COALESCE(MAX(version), 0) AS version
       FROM premiumBackgroundRevisions WHERE backgroundId = ?1`,
  )
    .bind(backgroundId)
    .first<{ version: number }>()
  const revision = {
    backgroundId,
    createdAt: new Date().toISOString(),
    id: workerCrypto.randomUUID(),
    lifecycle: 'draft' as const,
    publishedAt: null,
    supersededAt: null,
    updatedAt: new Date().toISOString(),
    version: (latest?.version ?? 0) + 1,
  }
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO premiumBackgroundRevisions
          (id, backgroundId, version, lifecycle, createdAt, updatedAt,
           publishedAt, supersededAt)
         VALUES (?1, ?2, ?3, 'draft', ?4, ?5, NULL, NULL)`,
      ).bind(
        revision.id,
        revision.backgroundId,
        revision.version,
        revision.createdAt,
        revision.updatedAt,
      ),
      premiumAuditAfterMutationStatement(
        env,
        actorEvent(
          actor,
          'revision.create',
          'background-revision',
          revision.id,
          { backgroundId, version: revision.version },
        ),
        revision.createdAt,
      ),
    ])
  } catch {
    return respond(
      { error: 'The draft changed; reload and try again' },
      { status: 409 },
    )
  }
  return respond({ revision }, { status: 201 })
}

async function findDraftVariantContext(
  env: Env,
  backgroundId: PremiumBackgroundId,
  revisionId: string,
): Promise<{
  asset: Pick<AssetRow, 'activeRevisionId' | 'surface'>
  revision: Pick<RevisionRow, 'id' | 'lifecycle' | 'version'>
} | null> {
  const row = await env.DB.prepare(
    `SELECT a.activeRevisionId, a.surface, r.id, r.lifecycle, r.version
       FROM premiumBackgroundAssets a
       JOIN premiumBackgroundRevisions r ON r.backgroundId = a.id
      WHERE a.id = ?1 AND r.id = ?2
      LIMIT 1`,
  )
    .bind(backgroundId, revisionId)
    .first<{
      activeRevisionId: string | null
      id: string
      lifecycle: RevisionRow['lifecycle']
      surface: AssetRow['surface']
      version: number
    }>()
  if (row === null) return null
  return {
    asset: {
      activeRevisionId: row.activeRevisionId,
      surface: row.surface,
    },
    revision: {
      id: row.id,
      lifecycle: row.lifecycle,
      version: row.version,
    },
  }
}

async function uploadDraftVariant(
  backgroundId: PremiumBackgroundId,
  revisionId: string,
  variant: PremiumBackgroundVariant,
  request: Request,
  env: Env,
  context: PremiumBackgroundAdminContext,
): Promise<Response> {
  const draft = await findDraftVariantContext(env, backgroundId, revisionId)
  if (draft === null) {
    return context.respond(
      { error: 'Draft revision not found' },
      { status: 404 },
    )
  }
  if (
    draft.revision.lifecycle !== 'draft' ||
    draft.asset.activeRevisionId === revisionId
  ) {
    return context.respond(
      { error: 'Only an inactive draft revision can receive uploads' },
      { status: 409 },
    )
  }
  const existing = await env.DB.prepare(
    `SELECT id FROM premiumBackgroundVariants
      WHERE revisionId = ?1 AND variant = ?2 LIMIT 1`,
  )
    .bind(revisionId, variant)
    .first<{ id: string }>()
  if (existing !== null) {
    return context.respond(
      { error: 'Remove the existing draft variant before replacing it' },
      { status: 409 },
    )
  }
  const parsed = await readBoundedWebP(request)
  if (parsed instanceof Response) {
    return new Response(parsed.body, {
      headers: {
        ...context.corsHeaders,
        'Cache-Control': 'private, no-store',
        'Content-Type': 'application/json',
      },
      status: parsed.status,
    })
  }
  if (!orientationMatches(variant, parsed.metadata)) {
    return context.respond(
      { error: `Image orientation does not match ${variant}` },
      { status: 400 },
    )
  }
  const bucket = env.PREMIUM_BACKGROUNDS_BUCKET
  if (bucket === undefined) {
    return context.respond(
      { error: 'Premium background storage unavailable' },
      { status: 503 },
    )
  }
  const variantId = workerCrypto.randomUUID()
  const objectKey = `backgrounds/v2/${draft.asset.surface}/${backgroundId}/v${draft.revision.version}/${variant}/${variantId}.webp`
  const sha256 = await sha256Hex(parsed.bytes)
  const stored = await bucket.put(objectKey, parsed.bytes, {
    httpMetadata: { contentType: 'image/webp' },
    customMetadata: {
      backgroundId,
      revision: String(draft.revision.version),
      sha256,
      variant,
    },
  })
  if (stored === null) {
    return context.respond({ error: 'WebP upload failed' }, { status: 503 })
  }
  const now = new Date().toISOString()
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO premiumBackgroundVariants
          (id, revisionId, variant, objectKey, width, height, byteSize,
           sha256, etag, createdAt, updatedAt)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10
          WHERE EXISTS (
            SELECT 1 FROM premiumBackgroundRevisions
             WHERE id = ?2 AND backgroundId = ?11 AND lifecycle = 'draft'
          )`,
      ).bind(
        variantId,
        revisionId,
        variant,
        objectKey,
        parsed.metadata.width,
        parsed.metadata.height,
        parsed.bytes.byteLength,
        sha256,
        stored.httpEtag,
        now,
        backgroundId,
      ),
      premiumAuditAfterMutationStatement(
        env,
        actorEvent(
          context.auditActor,
          'variant.upload',
          'background-variant',
          variantId,
          {
            backgroundId,
            byteSize: parsed.bytes.byteLength,
            height: parsed.metadata.height,
            revisionId,
            sha256,
            variant,
            width: parsed.metadata.width,
          },
        ),
        now,
      ),
    ])
  } catch (error) {
    await bucket.delete(objectKey)
    const message = String(error)
    return context.respond(
      {
        error: message.includes('UNIQUE')
          ? 'That draft variant already exists'
          : 'The draft changed; upload rolled back',
      },
      { status: message.includes('UNIQUE') ? 409 : 500 },
    )
  }
  const saved = await env.DB.prepare(
    'SELECT * FROM premiumBackgroundVariants WHERE id = ?1 LIMIT 1',
  )
    .bind(variantId)
    .first<VariantRow>()
  if (saved === null) {
    await bucket.delete(objectKey)
    return context.respond(
      { error: 'The draft changed; upload rolled back' },
      { status: 409 },
    )
  }
  return context.respond({ variant: publicVariant(saved) }, { status: 201 })
}

async function getAdminVariant(
  backgroundId: PremiumBackgroundId,
  revisionId: string,
  variant: PremiumBackgroundVariant,
  request: Request,
  env: Env,
  context: PremiumBackgroundAdminContext,
): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT v.*
       FROM premiumBackgroundVariants v
       JOIN premiumBackgroundRevisions r ON r.id = v.revisionId
      WHERE r.backgroundId = ?1 AND r.id = ?2 AND v.variant = ?3
      LIMIT 1`,
  )
    .bind(backgroundId, revisionId, variant)
    .first<VariantRow>()
  if (row === null) {
    return context.respond({ error: 'Variant not found' }, { status: 404 })
  }
  const bucket = env.PREMIUM_BACKGROUNDS_BUCKET
  if (bucket === undefined) {
    return context.respond(
      { error: 'Premium background storage unavailable' },
      { status: 503 },
    )
  }
  const object = await bucket.get(row.objectKey)
  if (object === null) {
    return context.respond(
      { error: 'Variant bytes not found' },
      { status: 404 },
    )
  }
  return new Response(request.method === 'HEAD' ? null : object.body, {
    headers: {
      ...context.corsHeaders,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'Content-Length': String(object.size),
      'Content-Type': 'image/webp',
      ETag: object.httpEtag,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function deleteDraftVariant(
  backgroundId: PremiumBackgroundId,
  revisionId: string,
  variant: PremiumBackgroundVariant,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const draft = await findDraftVariantContext(env, backgroundId, revisionId)
  if (draft === null) {
    return respond({ error: 'Draft revision not found' }, { status: 404 })
  }
  if (
    draft.revision.lifecycle !== 'draft' ||
    draft.asset.activeRevisionId === revisionId
  ) {
    return respond(
      { error: 'Only an inactive draft variant can be removed' },
      { status: 409 },
    )
  }
  const row = await env.DB.prepare(
    `SELECT * FROM premiumBackgroundVariants
      WHERE revisionId = ?1 AND variant = ?2 LIMIT 1`,
  )
    .bind(revisionId, variant)
    .first<VariantRow>()
  if (row === null)
    return respond({ error: 'Variant not found' }, { status: 404 })
  const now = new Date().toISOString()
  const [deletion] = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM premiumBackgroundVariants
        WHERE id = ?1
          AND EXISTS (
            SELECT 1
              FROM premiumBackgroundRevisions r
              JOIN premiumBackgroundAssets a ON a.id = r.backgroundId
             WHERE r.id = ?2
               AND r.lifecycle = 'draft'
               AND (a.activeRevisionId IS NULL OR a.activeRevisionId != r.id)
          )`,
    ).bind(row.id, revisionId),
    premiumAuditAfterMutationStatement(
      env,
      actorEvent(actor, 'variant.remove', 'background-variant', row.id, {
        backgroundId,
        revisionId,
        sha256: row.sha256,
        variant,
      }),
      now,
    ),
  ])
  if ((deletion?.meta.changes ?? 0) !== 1) {
    return respond(
      { error: 'The draft changed; variant was not removed' },
      { status: 409 },
    )
  }
  if (env.PREMIUM_BACKGROUNDS_BUCKET !== undefined) {
    try {
      await env.PREMIUM_BACKGROUNDS_BUCKET.delete(row.objectKey)
    } catch (error) {
      console.error(
        JSON.stringify({
          action: 'premium-background.orphan-cleanup',
          error: error instanceof Error ? error.message : String(error),
          objectKey: row.objectKey,
        }),
      )
    }
  }
  return respond({ ok: true })
}

async function publishRevision(
  backgroundId: PremiumBackgroundId,
  revisionId: string,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const asset = await env.DB.prepare(
    `SELECT a.*, r.version, r.lifecycle
       FROM premiumBackgroundAssets a
       JOIN premiumBackgroundRevisions r ON r.backgroundId = a.id
      WHERE a.id = ?1 AND r.id = ?2 LIMIT 1`,
  )
    .bind(backgroundId, revisionId)
    .first<
      AssetRow & { lifecycle: RevisionRow['lifecycle']; version: number }
    >()
  if (asset === null)
    return respond({ error: 'Draft revision not found' }, { status: 404 })
  if (asset.status !== 'active') {
    return respond(
      { error: 'Restore the background before publishing a revision' },
      { status: 409 },
    )
  }
  if (asset.lifecycle !== 'draft') {
    return respond(
      { error: 'Only a draft revision can be published' },
      { status: 409 },
    )
  }
  const variants = await env.DB.prepare(
    `SELECT * FROM premiumBackgroundVariants
      WHERE revisionId = ?1 ORDER BY variant`,
  )
    .bind(revisionId)
    .all<VariantRow>()
  const present = new Set((variants.results ?? []).map((row) => row.variant))
  const missing = PREMIUM_BACKGROUND_VARIANTS.filter(
    (variant) => !present.has(variant),
  )
  if (missing.length > 0) {
    return respond(
      { error: 'Revision is incomplete', missingVariants: missing },
      { status: 409 },
    )
  }
  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = []
  if (asset.activeRevisionId !== null) {
    statements.push(
      env.DB.prepare(
        `UPDATE premiumBackgroundRevisions
            SET lifecycle = 'superseded', supersededAt = ?1, updatedAt = ?1
          WHERE id = ?2 AND backgroundId = ?3 AND lifecycle = 'published'
            AND EXISTS (
              SELECT 1 FROM premiumBackgroundAssets a
               WHERE a.id = ?3
                 AND a.status = 'active'
                 AND a.activeRevisionId = ?2
                 AND EXISTS (
                   SELECT 1 FROM premiumBackgroundRevisions next
                    WHERE next.id = ?4
                      AND next.backgroundId = ?3
                      AND next.lifecycle = 'draft'
                      AND (
                        SELECT COUNT(*) FROM premiumBackgroundVariants v
                         WHERE v.revisionId = next.id
                      ) = ?5
                 )
            )`,
      ).bind(
        now,
        asset.activeRevisionId,
        backgroundId,
        revisionId,
        PREMIUM_BACKGROUND_VARIANTS.length,
      ),
    )
  }
  statements.push(
    env.DB.prepare(
      `UPDATE premiumBackgroundRevisions
          SET lifecycle = 'published', publishedAt = ?1,
              supersededAt = NULL, updatedAt = ?1
        WHERE id = ?2 AND backgroundId = ?3 AND lifecycle = 'draft'
          AND (
            SELECT COUNT(*) FROM premiumBackgroundVariants v
             WHERE v.revisionId = ?2
          ) = ?5
          AND EXISTS (
            SELECT 1 FROM premiumBackgroundAssets a
             WHERE a.id = ?3
               AND a.status = 'active'
               AND (
                 (?4 IS NULL AND a.activeRevisionId IS NULL)
                 OR a.activeRevisionId = ?4
               )
          )`,
    ).bind(
      now,
      revisionId,
      backgroundId,
      asset.activeRevisionId,
      PREMIUM_BACKGROUND_VARIANTS.length,
    ),
    env.DB.prepare(
      `UPDATE premiumBackgroundAssets
          SET activeRevisionId = ?1, updatedAt = ?2
        WHERE id = ?3
          AND status = 'active'
          AND (
            (?4 IS NULL AND activeRevisionId IS NULL)
            OR activeRevisionId = ?4
          )
          AND EXISTS (
            SELECT 1 FROM premiumBackgroundRevisions r
             WHERE r.id = ?1
               AND r.backgroundId = ?3
               AND r.lifecycle = 'published'
          )`,
    ).bind(revisionId, now, backgroundId, asset.activeRevisionId),
    premiumAuditAfterMutationStatement(
      env,
      actorEvent(actor, 'revision.publish', 'background-revision', revisionId, {
        backgroundId,
        replacedRevisionId: asset.activeRevisionId,
        version: asset.version,
      }),
      now,
    ),
    env.DB.prepare(
      `UPDATE premiumBackgroundCapabilities
          SET revokedAt = COALESCE(revokedAt, ?1)
        WHERE backgroundId = ?2
          AND revokedAt IS NULL
          AND EXISTS (
            SELECT 1 FROM premiumBackgroundAssets a
            JOIN premiumBackgroundRevisions r
              ON r.id = a.activeRevisionId
             AND r.backgroundId = a.id
           WHERE a.id = ?2
             AND a.status = 'active'
             AND a.activeRevisionId = ?3
             AND r.lifecycle = 'published'
          )`,
    ).bind(now, backgroundId, revisionId),
  )
  try {
    await env.DB.batch(statements)
  } catch {
    return respond(
      { error: 'The publish state changed; reload and try again' },
      { status: 409 },
    )
  }
  const published = await env.DB.prepare(
    `SELECT r.*, a.status AS assetStatus,
            a.activeRevisionId AS selectedRevisionId
       FROM premiumBackgroundRevisions r
       JOIN premiumBackgroundAssets a ON a.id = r.backgroundId
      WHERE r.id = ?1 AND r.backgroundId = ?2
      LIMIT 1`,
  )
    .bind(revisionId, backgroundId)
    .first<
      RevisionRow & {
        assetStatus: AssetRow['status']
        selectedRevisionId: string | null
      }
    >()
  if (
    published?.lifecycle !== 'published' ||
    published.assetStatus !== 'active' ||
    published.selectedRevisionId !== revisionId
  ) {
    return respond(
      { error: 'The publish state changed; reload and try again' },
      { status: 409 },
    )
  }
  const revision: RevisionRow = {
    backgroundId: published.backgroundId,
    createdAt: published.createdAt,
    id: published.id,
    lifecycle: published.lifecycle,
    publishedAt: published.publishedAt,
    supersededAt: published.supersededAt,
    updatedAt: published.updatedAt,
    version: published.version,
  }
  return respond({
    revision: {
      ...revision,
      variants: (variants.results ?? []).map(publicVariant),
    },
  })
}

async function changeRetiredState(
  backgroundId: PremiumBackgroundId,
  retire: boolean,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const asset = await env.DB.prepare(
    'SELECT * FROM premiumBackgroundAssets WHERE id = ?1 LIMIT 1',
  )
    .bind(backgroundId)
    .first<AssetRow>()
  if (asset === null)
    return respond({ error: 'Background not found' }, { status: 404 })
  if (!retire && asset.activeRevisionId === null) {
    return respond(
      { error: 'Publish a complete revision before restoring this background' },
      { status: 409 },
    )
  }
  const nextStatus = retire ? 'retired' : 'active'
  if (asset.status === nextStatus) return respond({ asset })
  if (!retire) {
    const published = await env.DB.prepare(
      `SELECT id FROM premiumBackgroundRevisions
        WHERE id = ?1 AND backgroundId = ?2 AND lifecycle = 'published'
        LIMIT 1`,
    )
      .bind(asset.activeRevisionId, backgroundId)
      .first<{ id: string }>()
    if (published === null) {
      return respond(
        { error: 'The active revision is not publishable' },
        { status: 409 },
      )
    }
  }
  const now = new Date().toISOString()
  const statements = [
    env.DB.prepare(
      `UPDATE premiumBackgroundAssets
          SET status = ?1, retiredAt = ?2, updatedAt = ?3
        WHERE id = ?4`,
    ).bind(nextStatus, retire ? now : null, now, backgroundId),
  ]
  if (retire) {
    statements.push(
      env.DB.prepare(
        `UPDATE premiumBackgroundCapabilities
            SET revokedAt = COALESCE(revokedAt, ?1)
          WHERE backgroundId = ?2 AND revokedAt IS NULL`,
      ).bind(now, backgroundId),
    )
  }
  statements.push(
    premiumAuditStatement(
      env,
      actorEvent(
        actor,
        retire ? 'asset.retire' : 'asset.restore',
        'background',
        backgroundId,
      ),
      now,
    ),
  )
  await env.DB.batch(statements)
  return respond({
    asset: {
      ...asset,
      retiredAt: retire ? now : null,
      status: nextStatus,
      updatedAt: now,
    },
  })
}

async function listAdminGroups(
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const [groupsResult, membersResult, perksResult, featuresResult] =
    await Promise.all([
      env.DB.prepare(
        `SELECT * FROM premiumSupporterGroups
        ORDER BY deletedAt IS NOT NULL, kind, name, id`,
      ).all<GroupRow>(),
      env.DB.prepare(
        `SELECT * FROM premiumSupporterGroupMembers
        ORDER BY groupId, email`,
      ).all<MemberRow>(),
      env.DB.prepare(
        `SELECT * FROM premiumSupporterGroupPerks
        ORDER BY groupId, backgroundId`,
      ).all<GroupPerkRow>(),
      env.DB.prepare(
        `SELECT * FROM premiumSupporterGroupFeatures
        ORDER BY groupId, featureId`,
      ).all<GroupFeatureRow>(),
    ])
  const membersByGroup = new Map<string, MemberRow[]>()
  for (const member of membersResult.results ?? []) {
    const members = membersByGroup.get(member.groupId) ?? []
    members.push(member)
    membersByGroup.set(member.groupId, members)
  }
  const perksByGroup = new Map<string, GroupPerkRow[]>()
  for (const perk of perksResult.results ?? []) {
    const perks = perksByGroup.get(perk.groupId) ?? []
    perks.push(perk)
    perksByGroup.set(perk.groupId, perks)
  }
  const featuresByGroup = new Map<string, GroupFeatureRow[]>()
  for (const feature of featuresResult.results ?? []) {
    const features = featuresByGroup.get(feature.groupId) ?? []
    features.push(feature)
    featuresByGroup.set(feature.groupId, features)
  }
  return respond({
    groups: (groupsResult.results ?? []).map((group) => ({
      active: group.active === 1,
      createdAt: group.createdAt,
      deletedAt: group.deletedAt,
      description: group.description,
      id: group.id,
      kind: group.kind,
      features: (featuresByGroup.get(group.id) ?? []).map((feature) => ({
        assignedAt: feature.assignedAt,
        featureId: feature.featureId,
        revokedAt: feature.revokedAt,
      })),
      members: (membersByGroup.get(group.id) ?? []).map((member) => ({
        email: member.email,
        grantedAt: member.grantedAt,
        note: member.note,
        revokedAt: member.revokedAt,
      })),
      name: group.name,
      perks: (perksByGroup.get(group.id) ?? []).map((perk) => ({
        assignedAt: perk.assignedAt,
        backgroundId: perk.backgroundId,
        revokedAt: perk.revokedAt,
      })),
      slug: group.slug,
      updatedAt: group.updatedAt,
    })),
  })
}

async function createGroup(
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const body = await readJsonObject(request)
  if (body === null)
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  const name = cleanText(body.name, MAX_TEXT_LENGTH, false)
  const description = cleanText(
    body.description ?? '',
    MAX_DESCRIPTION_LENGTH,
    true,
  )
  const requestedSlug =
    body.slug === undefined
      ? name === null
        ? ''
        : slugify(name)
      : (cleanText(body.slug, 80, false)?.toLowerCase() ?? '')
  if (
    name === null ||
    description === null ||
    !GROUP_SLUG_RE.test(requestedSlug) ||
    requestedSlug === 'active-supporters'
  ) {
    return respond({ error: 'Invalid supporter group' }, { status: 400 })
  }
  const now = new Date().toISOString()
  const group: GroupRow = {
    active: 1,
    createdAt: now,
    deletedAt: null,
    description,
    id: workerCrypto.randomUUID(),
    kind: 'manual',
    name,
    slug: requestedSlug,
    updatedAt: now,
  }
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO premiumSupporterGroups
          (id, slug, name, description, kind, active, createdAt, updatedAt, deletedAt)
         VALUES (?1, ?2, ?3, ?4, 'manual', 1, ?5, ?5, NULL)`,
      ).bind(group.id, group.slug, group.name, group.description, now),
      premiumAuditStatement(
        env,
        actorEvent(actor, 'group.create', 'supporter-group', group.id, {
          slug: group.slug,
        }),
        now,
      ),
    ])
  } catch {
    return respond({ error: 'That group slug already exists' }, { status: 409 })
  }
  return respond(
    {
      group: {
        ...group,
        active: true,
        features: [],
        members: [],
        perks: [],
      },
    },
    { status: 201 },
  )
}

async function updateGroup(
  groupId: string,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const group = await env.DB.prepare(
    'SELECT * FROM premiumSupporterGroups WHERE id = ?1 LIMIT 1',
  )
    .bind(groupId)
    .first<GroupRow>()
  if (group === null || group.deletedAt !== null) {
    return respond({ error: 'Supporter group not found' }, { status: 404 })
  }
  const body = await readJsonObject(request)
  if (body === null)
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  const name =
    body.name === undefined
      ? group.name
      : cleanText(body.name, MAX_TEXT_LENGTH, false)
  const description =
    body.description === undefined
      ? group.description
      : cleanText(body.description, MAX_DESCRIPTION_LENGTH, true)
  const active =
    body.active === undefined
      ? group.active
      : typeof body.active === 'boolean'
        ? body.active
          ? 1
          : 0
        : null
  if (name === null || description === null || active === null) {
    return respond({ error: 'Invalid supporter group' }, { status: 400 })
  }
  const changed =
    name !== group.name ||
    description !== group.description ||
    active !== group.active
  if (!changed)
    return respond({ group: { ...group, active: group.active === 1 } })
  const now = new Date().toISOString()
  const statements = [
    env.DB.prepare(
      `UPDATE premiumSupporterGroups
          SET name = ?1, description = ?2, active = ?3, updatedAt = ?4
        WHERE id = ?5 AND deletedAt IS NULL`,
    ).bind(name, description, active, now, groupId),
    premiumAuditAfterMutationStatement(
      env,
      actorEvent(actor, 'group.update', 'supporter-group', groupId, {
        active: active === 1,
        descriptionChanged: description !== group.description,
        nameChanged: name !== group.name,
      }),
      now,
    ),
  ]
  if (group.active === 1 && active === 0) {
    statements.push(
      env.DB.prepare(
        `UPDATE premiumBackgroundCapabilities
            SET revokedAt = COALESCE(revokedAt, ?1)
          WHERE backgroundId IN (
            SELECT backgroundId FROM premiumSupporterGroupPerks
             WHERE groupId = ?2 AND revokedAt IS NULL
          ) AND revokedAt IS NULL`,
      ).bind(now, groupId),
    )
  }
  const [updated] = await env.DB.batch(statements)
  if ((updated?.meta.changes ?? 0) !== 1) {
    return respond(
      { error: 'The supporter group changed; reload and try again' },
      { status: 409 },
    )
  }
  return respond({
    group: {
      ...group,
      active: active === 1,
      description,
      name,
      updatedAt: now,
    },
  })
}

async function deleteGroup(
  groupId: string,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const group = await env.DB.prepare(
    'SELECT * FROM premiumSupporterGroups WHERE id = ?1 LIMIT 1',
  )
    .bind(groupId)
    .first<GroupRow>()
  if (group === null || group.deletedAt !== null) {
    return respond({ error: 'Supporter group not found' }, { status: 404 })
  }
  if (group.kind === 'automatic') {
    return respond(
      { error: 'The automatic supporter group cannot be deleted' },
      { status: 409 },
    )
  }
  const references = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM premiumSupporterGroupMembers
         WHERE groupId = ?1 AND revokedAt IS NULL) AS activeMembers,
       (SELECT COUNT(*) FROM premiumSupporterGroupPerks
         WHERE groupId = ?1 AND revokedAt IS NULL) AS activePerks,
       (SELECT COUNT(*) FROM premiumSupporterGroupFeatures
         WHERE groupId = ?1 AND revokedAt IS NULL) AS activeFeatures`,
  )
    .bind(groupId)
    .first<{
      activeFeatures: number
      activeMembers: number
      activePerks: number
    }>()
  if (
    (references?.activeMembers ?? 0) > 0 ||
    (references?.activePerks ?? 0) > 0 ||
    (references?.activeFeatures ?? 0) > 0
  ) {
    return respond(
      { error: 'Revoke active members and perks before deleting this group' },
      { status: 409 },
    )
  }
  const now = new Date().toISOString()
  const [deleted] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE premiumSupporterGroups
          SET active = 0, deletedAt = ?1, updatedAt = ?1
        WHERE id = ?2
          AND kind = 'manual'
          AND deletedAt IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM premiumSupporterGroupMembers
             WHERE groupId = ?2 AND revokedAt IS NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM premiumSupporterGroupPerks
             WHERE groupId = ?2 AND revokedAt IS NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM premiumSupporterGroupFeatures
             WHERE groupId = ?2 AND revokedAt IS NULL
          )`,
    ).bind(now, groupId),
    premiumAuditAfterMutationStatement(
      env,
      actorEvent(actor, 'group.delete', 'supporter-group', groupId),
      now,
    ),
  ])
  if ((deleted?.meta.changes ?? 0) !== 1) {
    return respond(
      { error: 'Revoke active members and perks before deleting this group' },
      { status: 409 },
    )
  }
  return respond({ ok: true })
}

async function requireManualGroup(
  env: Env,
  groupId: string,
): Promise<GroupRow | null> {
  return env.DB.prepare(
    `SELECT * FROM premiumSupporterGroups
      WHERE id = ?1 AND kind = 'manual' AND deletedAt IS NULL
      LIMIT 1`,
  )
    .bind(groupId)
    .first<GroupRow>()
}

async function addGroupMember(
  groupId: string,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const group = await requireManualGroup(env, groupId)
  if (group === null) {
    return respond(
      { error: 'Manual supporter group not found' },
      { status: 404 },
    )
  }
  const body = await readJsonObject(request)
  if (body === null)
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  const email = normalizeEmail(body.email)
  const note =
    body.note === undefined || body.note === null
      ? null
      : cleanText(body.note, MAX_DESCRIPTION_LENGTH, true)
  if (email === null || (body.note !== undefined && note === null)) {
    return respond({ error: 'Invalid verified email member' }, { status: 400 })
  }
  const verified = await env.DB.prepare(
    `SELECT id FROM users
      WHERE LOWER(email) = ?1 AND emailVerified = 1
      LIMIT 1`,
  )
    .bind(email)
    .first<{ id: string }>()
  if (verified === null) {
    return respond(
      { error: 'No verified account currently owns that email' },
      { status: 409 },
    )
  }
  const now = new Date().toISOString()
  const [granted] = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO premiumSupporterGroupMembers
        (groupId, email, note, grantedAt, revokedAt)
       SELECT ?1, ?2, ?3, ?4, NULL
        WHERE EXISTS (
          SELECT 1 FROM premiumSupporterGroups
           WHERE id = ?1 AND kind = 'manual' AND deletedAt IS NULL
        )
          AND EXISTS (
            SELECT 1 FROM users
             WHERE LOWER(email) = ?2 AND emailVerified = 1
          )
       ON CONFLICT(groupId, email) DO UPDATE SET
         note = excluded.note,
         grantedAt = excluded.grantedAt,
         revokedAt = NULL`,
    ).bind(groupId, email, note, now),
    premiumAuditAfterMutationStatement(
      env,
      actorEvent(
        actor,
        'member.grant',
        'supporter-group-member',
        `${groupId}:${email}`,
        { email, groupId },
      ),
      now,
    ),
  ])
  if ((granted?.meta.changes ?? 0) !== 1) {
    return respond(
      { error: 'The verified account or supporter group changed' },
      { status: 409 },
    )
  }
  return respond(
    { member: { email, grantedAt: now, note, revokedAt: null } },
    { status: 201 },
  )
}

async function revokeGroupMember(
  groupId: string,
  rawEmail: string,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const group = await requireManualGroup(env, groupId)
  if (group === null) {
    return respond(
      { error: 'Manual supporter group not found' },
      { status: 404 },
    )
  }
  const email = normalizeEmail(rawEmail)
  if (email === null)
    return respond({ error: 'Invalid email' }, { status: 400 })
  const member = await env.DB.prepare(
    `SELECT email FROM premiumSupporterGroupMembers
      WHERE groupId = ?1 AND email = ?2 COLLATE NOCASE AND revokedAt IS NULL
      LIMIT 1`,
  )
    .bind(groupId, email)
    .first<{ email: string }>()
  if (member === null)
    return respond({ error: 'Member not found' }, { status: 404 })
  const now = new Date().toISOString()
  const [revoked] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE premiumSupporterGroupMembers
          SET revokedAt = ?1
        WHERE groupId = ?2 AND email = ?3 COLLATE NOCASE
          AND revokedAt IS NULL`,
    ).bind(now, groupId, email),
    premiumAuditAfterMutationStatement(
      env,
      actorEvent(
        actor,
        'member.revoke',
        'supporter-group-member',
        `${groupId}:${email}`,
        { email, groupId },
      ),
      now,
    ),
    env.DB.prepare(
      `UPDATE premiumBackgroundCapabilities
          SET revokedAt = COALESCE(revokedAt, ?1)
        WHERE issuerUserId IN (
          SELECT id FROM users WHERE LOWER(email) = ?2
        ) AND backgroundId IN (
          SELECT backgroundId FROM premiumSupporterGroupPerks
           WHERE groupId = ?3 AND revokedAt IS NULL
        ) AND revokedAt IS NULL`,
    ).bind(now, email, groupId),
  ])
  if ((revoked?.meta.changes ?? 0) !== 1) {
    return respond(
      { error: 'The supporter group member changed; reload and try again' },
      { status: 409 },
    )
  }
  return respond({ ok: true, revokedAt: now })
}

async function changeGroupPerk(
  groupId: string,
  backgroundId: PremiumBackgroundId,
  assign: boolean,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const group = await env.DB.prepare(
    `SELECT * FROM premiumSupporterGroups
      WHERE id = ?1 AND deletedAt IS NULL LIMIT 1`,
  )
    .bind(groupId)
    .first<GroupRow>()
  if (group === null) {
    return respond({ error: 'Supporter group not found' }, { status: 404 })
  }
  const asset = await env.DB.prepare(
    'SELECT id FROM premiumBackgroundAssets WHERE id = ?1 LIMIT 1',
  )
    .bind(backgroundId)
    .first<{ id: string }>()
  if (asset === null)
    return respond({ error: 'Background not found' }, { status: 404 })
  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = []
  if (assign) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO premiumSupporterGroupPerks
          (groupId, backgroundId, assignedAt, revokedAt)
         SELECT ?1, ?2, ?3, NULL
          WHERE EXISTS (
            SELECT 1 FROM premiumSupporterGroups
             WHERE id = ?1 AND deletedAt IS NULL
          )
         ON CONFLICT(groupId, backgroundId) DO UPDATE SET
           assignedAt = excluded.assignedAt,
           revokedAt = NULL`,
      ).bind(groupId, backgroundId, now),
      premiumAuditAfterMutationStatement(
        env,
        actorEvent(
          actor,
          'perk.assign',
          'supporter-group-perk',
          `${groupId}:${backgroundId}`,
          { backgroundId, groupId },
        ),
        now,
      ),
    )
  } else {
    const current = await env.DB.prepare(
      `SELECT backgroundId FROM premiumSupporterGroupPerks
        WHERE groupId = ?1 AND backgroundId = ?2 AND revokedAt IS NULL
        LIMIT 1`,
    )
      .bind(groupId, backgroundId)
      .first<{ backgroundId: string }>()
    if (current === null) {
      return respond({ error: 'Group perk not found' }, { status: 404 })
    }
    statements.push(
      env.DB.prepare(
        `UPDATE premiumSupporterGroupPerks SET revokedAt = ?1
          WHERE groupId = ?2 AND backgroundId = ?3 AND revokedAt IS NULL`,
      ).bind(now, groupId, backgroundId),
      premiumAuditAfterMutationStatement(
        env,
        actorEvent(
          actor,
          'perk.revoke',
          'supporter-group-perk',
          `${groupId}:${backgroundId}`,
          { backgroundId, groupId },
        ),
        now,
      ),
      env.DB.prepare(
        `UPDATE premiumBackgroundCapabilities
            SET revokedAt = COALESCE(revokedAt, ?1)
          WHERE backgroundId = ?2 AND revokedAt IS NULL`,
      ).bind(now, backgroundId),
    )
  }
  const [changed] = await env.DB.batch(statements)
  if ((changed?.meta.changes ?? 0) !== 1) {
    return respond(
      { error: 'The supporter group changed; reload and try again' },
      { status: 409 },
    )
  }
  return respond({
    perk: {
      assignedAt: now,
      backgroundId,
      revokedAt: assign ? null : now,
    },
  })
}

async function changeGroupFeature(
  groupId: string,
  featureId: SupporterFeaturePerkId,
  assign: boolean,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const group = await env.DB.prepare(
    `SELECT id FROM premiumSupporterGroups
      WHERE id = ?1 AND deletedAt IS NULL LIMIT 1`,
  )
    .bind(groupId)
    .first<{ id: string }>()
  if (group === null) {
    return respond({ error: 'Supporter group not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = []
  if (assign) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO premiumSupporterGroupFeatures
          (groupId, featureId, assignedAt, revokedAt)
         SELECT ?1, ?2, ?3, NULL
          WHERE EXISTS (
            SELECT 1 FROM premiumSupporterGroups
             WHERE id = ?1 AND deletedAt IS NULL
          )
         ON CONFLICT(groupId, featureId) DO UPDATE SET
           assignedAt = excluded.assignedAt,
           revokedAt = NULL`,
      ).bind(groupId, featureId, now),
      premiumAuditAfterMutationStatement(
        env,
        actorEvent(
          actor,
          'feature.assign',
          'supporter-group-feature',
          `${groupId}:${featureId}`,
          { featureId, groupId },
        ),
        now,
      ),
    )
  } else {
    const current = await env.DB.prepare(
      `SELECT featureId FROM premiumSupporterGroupFeatures
        WHERE groupId = ?1 AND featureId = ?2 AND revokedAt IS NULL
        LIMIT 1`,
    )
      .bind(groupId, featureId)
      .first<{ featureId: string }>()
    if (current === null) {
      return respond({ error: 'Group feature not found' }, { status: 404 })
    }
    statements.push(
      env.DB.prepare(
        `UPDATE premiumSupporterGroupFeatures SET revokedAt = ?1
          WHERE groupId = ?2 AND featureId = ?3 AND revokedAt IS NULL`,
      ).bind(now, groupId, featureId),
      premiumAuditAfterMutationStatement(
        env,
        actorEvent(
          actor,
          'feature.revoke',
          'supporter-group-feature',
          `${groupId}:${featureId}`,
          { featureId, groupId },
        ),
        now,
      ),
    )
  }

  const [changed] = await env.DB.batch(statements)
  if ((changed?.meta.changes ?? 0) !== 1) {
    return respond(
      { error: 'The supporter group changed; reload and try again' },
      { status: 409 },
    )
  }
  return respond({
    feature: {
      assignedAt: now,
      featureId,
      revokedAt: assign ? null : now,
    },
  })
}

async function listCapabilities(
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, backgroundId, version, roomId, issuerUserId,
            issuedAt, expiresAt, revokedAt
       FROM premiumBackgroundCapabilities
      ORDER BY issuedAt DESC LIMIT 200`,
  ).all<CapabilityRow>()
  return respond({ capabilities: result.results ?? [] })
}

async function revokeCapability(
  capabilityId: string,
  request: Request,
  actor: PremiumAdminAuditActor,
  env: Env,
  respond: JsonResponder,
): Promise<Response> {
  const capability = await env.DB.prepare(
    `SELECT id, revokedAt FROM premiumBackgroundCapabilities
      WHERE id = ?1 LIMIT 1`,
  )
    .bind(capabilityId)
    .first<{ id: string; revokedAt: string | null }>()
  if (capability === null) {
    return respond({ error: 'Capability not found' }, { status: 404 })
  }
  if (capability.revokedAt !== null) {
    return respond({ ok: true, revokedAt: capability.revokedAt })
  }
  const now = new Date().toISOString()
  const [revoked] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE premiumBackgroundCapabilities
          SET revokedAt = ?1
        WHERE id = ?2 AND revokedAt IS NULL`,
    ).bind(now, capabilityId),
    premiumAuditAfterMutationStatement(
      env,
      actorEvent(
        actor,
        'capability.revoke',
        'background-capability',
        capabilityId,
      ),
      now,
    ),
  ])
  if ((revoked?.meta.changes ?? 0) !== 1) {
    const raced = await env.DB.prepare(
      `SELECT revokedAt FROM premiumBackgroundCapabilities
        WHERE id = ?1 LIMIT 1`,
    )
      .bind(capabilityId)
      .first<{ revokedAt: string | null }>()
    if (raced === null) {
      return respond({ error: 'Capability not found' }, { status: 404 })
    }
    if (raced.revokedAt !== null) {
      return respond({ ok: true, revokedAt: raced.revokedAt })
    }
    return respond(
      { error: 'The capability changed; reload and try again' },
      { status: 409 },
    )
  }
  return respond({ ok: true, revokedAt: now })
}

function decodePathComponent(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function knownBackgroundId(value: string): PremiumBackgroundId | null {
  if (!isBackgroundPerkId(value)) return null
  const definition = getBackgroundDefinition(value)
  return definition?.access.kind === 'supporter' ? value : null
}

/** Route Studio requests, or return null when another feature owns the path. */
export async function handlePremiumBackgroundAdminRequest(
  request: Request,
  env: Env,
  url: URL,
  context: PremiumBackgroundAdminContext,
): Promise<Response | null> {
  const ownsRoute =
    url.pathname === ADMIN_ASSET_PREFIX ||
    url.pathname.startsWith(`${ADMIN_ASSET_PREFIX}/`) ||
    url.pathname === ADMIN_GROUP_PREFIX ||
    url.pathname.startsWith(`${ADMIN_GROUP_PREFIX}/`) ||
    url.pathname === ADMIN_CAPABILITY_PREFIX ||
    url.pathname.startsWith(`${ADMIN_CAPABILITY_PREFIX}/`)
  if (!ownsRoute) return null
  if (!context.admin) {
    return context.respond({ error: 'Admin key required' }, { status: 403 })
  }

  if (url.pathname === ADMIN_ASSET_PREFIX) {
    if (request.method === 'GET') return listAdminAssets(env, context.respond)
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const variantContent = url.pathname.match(
    /^\/api\/admin\/premium-backgrounds\/([^/]+)\/revisions\/([^/]+)\/variants\/([^/]+)\/content$/,
  )
  if (variantContent !== null) {
    const rawId = decodePathComponent(variantContent[1]!)
    const backgroundId = rawId === null ? null : knownBackgroundId(rawId)
    const revisionId = decodePathComponent(variantContent[2]!)
    const rawVariant = decodePathComponent(variantContent[3]!)
    if (
      backgroundId === null ||
      revisionId === null ||
      rawVariant === null ||
      !isPremiumBackgroundVariant(rawVariant)
    ) {
      return context.respond({ error: 'Variant not found' }, { status: 404 })
    }
    if (request.method === 'PUT') {
      return uploadDraftVariant(
        backgroundId,
        revisionId,
        rawVariant,
        request,
        env,
        context,
      )
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      return getAdminVariant(
        backgroundId,
        revisionId,
        rawVariant,
        request,
        env,
        context,
      )
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const variantDelete = url.pathname.match(
    /^\/api\/admin\/premium-backgrounds\/([^/]+)\/revisions\/([^/]+)\/variants\/([^/]+)$/,
  )
  if (variantDelete !== null) {
    const rawId = decodePathComponent(variantDelete[1]!)
    const backgroundId = rawId === null ? null : knownBackgroundId(rawId)
    const revisionId = decodePathComponent(variantDelete[2]!)
    const rawVariant = decodePathComponent(variantDelete[3]!)
    if (
      backgroundId === null ||
      revisionId === null ||
      rawVariant === null ||
      !isPremiumBackgroundVariant(rawVariant)
    ) {
      return context.respond({ error: 'Variant not found' }, { status: 404 })
    }
    if (request.method === 'DELETE') {
      return deleteDraftVariant(
        backgroundId,
        revisionId,
        rawVariant,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const revisionAction = url.pathname.match(
    /^\/api\/admin\/premium-backgrounds\/([^/]+)\/revisions\/([^/]+)\/(publish)$/,
  )
  if (revisionAction !== null) {
    const rawId = decodePathComponent(revisionAction[1]!)
    const backgroundId = rawId === null ? null : knownBackgroundId(rawId)
    const revisionId = decodePathComponent(revisionAction[2]!)
    if (backgroundId === null || revisionId === null) {
      return context.respond({ error: 'Revision not found' }, { status: 404 })
    }
    if (request.method === 'POST') {
      return publishRevision(
        backgroundId,
        revisionId,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const revisionCreate = url.pathname.match(
    /^\/api\/admin\/premium-backgrounds\/([^/]+)\/revisions$/,
  )
  if (revisionCreate !== null) {
    const rawId = decodePathComponent(revisionCreate[1]!)
    const backgroundId = rawId === null ? null : knownBackgroundId(rawId)
    if (backgroundId === null) {
      return context.respond({ error: 'Background not found' }, { status: 404 })
    }
    if (request.method === 'POST') {
      return createDraftRevision(
        backgroundId,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const assetAction = url.pathname.match(
    /^\/api\/admin\/premium-backgrounds\/([^/]+)(?:\/(retire|restore))?$/,
  )
  if (assetAction !== null) {
    const rawId = decodePathComponent(assetAction[1]!)
    const backgroundId = rawId === null ? null : knownBackgroundId(rawId)
    if (backgroundId === null) {
      return context.respond({ error: 'Background not found' }, { status: 404 })
    }
    const action = assetAction[2]
    if (action === undefined && request.method === 'PATCH') {
      return updateAssetMetadata(
        backgroundId,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    if (action === 'retire' && request.method === 'POST') {
      return changeRetiredState(
        backgroundId,
        true,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    if (action === 'restore' && request.method === 'POST') {
      return changeRetiredState(
        backgroundId,
        false,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  if (url.pathname === ADMIN_GROUP_PREFIX) {
    if (request.method === 'GET') return listAdminGroups(env, context.respond)
    if (request.method === 'POST') {
      return createGroup(request, context.auditActor, env, context.respond)
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const groupMember = url.pathname.match(
    /^\/api\/admin\/supporter-groups\/([^/]+)\/members(?:\/([^/]+))?$/,
  )
  if (groupMember !== null) {
    const groupId = decodePathComponent(groupMember[1]!)
    const encodedEmail = groupMember[2]
    if (groupId === null) {
      return context.respond(
        { error: 'Supporter group not found' },
        { status: 404 },
      )
    }
    if (encodedEmail === undefined && request.method === 'POST') {
      return addGroupMember(
        groupId,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    if (request.method === 'DELETE') {
      let email =
        encodedEmail === undefined ? null : decodePathComponent(encodedEmail)
      if (email === null && encodedEmail === undefined) {
        const body = await readJsonObject(request)
        email = body === null ? null : normalizeEmail(body.email)
      }
      if (email === null) {
        return context.respond({ error: 'Invalid email' }, { status: 400 })
      }
      return revokeGroupMember(
        groupId,
        email,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const groupPerk = url.pathname.match(
    /^\/api\/admin\/supporter-groups\/([^/]+)\/perks\/([^/]+)$/,
  )
  if (groupPerk !== null) {
    const groupId = decodePathComponent(groupPerk[1]!)
    const rawId = decodePathComponent(groupPerk[2]!)
    const backgroundId = rawId === null ? null : knownBackgroundId(rawId)
    if (groupId === null || backgroundId === null) {
      return context.respond({ error: 'Group perk not found' }, { status: 404 })
    }
    if (request.method === 'POST' || request.method === 'DELETE') {
      return changeGroupPerk(
        groupId,
        backgroundId,
        request.method === 'POST',
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const groupFeature = url.pathname.match(
    /^\/api\/admin\/supporter-groups\/([^/]+)\/features\/([^/]+)$/,
  )
  if (groupFeature !== null) {
    const groupId = decodePathComponent(groupFeature[1]!)
    const rawId = decodePathComponent(groupFeature[2]!)
    const featureId =
      rawId !== null && isSupporterFeaturePerkId(rawId) ? rawId : null
    if (groupId === null || featureId === null) {
      return context.respond(
        { error: 'Group feature not found' },
        { status: 404 },
      )
    }
    if (request.method === 'POST' || request.method === 'DELETE') {
      return changeGroupFeature(
        groupId,
        featureId,
        request.method === 'POST',
        context.auditActor,
        env,
        context.respond,
      )
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const groupRoute = url.pathname.match(
    /^\/api\/admin\/supporter-groups\/([^/]+)$/,
  )
  if (groupRoute !== null) {
    const groupId = decodePathComponent(groupRoute[1]!)
    if (groupId === null) {
      return context.respond(
        { error: 'Supporter group not found' },
        { status: 404 },
      )
    }
    if (request.method === 'PATCH') {
      return updateGroup(
        groupId,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    if (request.method === 'DELETE') {
      return deleteGroup(
        groupId,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  if (url.pathname === ADMIN_CAPABILITY_PREFIX) {
    if (request.method === 'GET') return listCapabilities(env, context.respond)
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }
  const capabilityRevoke = url.pathname.match(
    /^\/api\/admin\/premium-background-capabilities\/([^/]+)\/revoke$/,
  )
  if (capabilityRevoke !== null) {
    const capabilityId = decodePathComponent(capabilityRevoke[1]!)
    if (capabilityId === null) {
      return context.respond({ error: 'Capability not found' }, { status: 404 })
    }
    if (request.method === 'POST') {
      return revokeCapability(
        capabilityId,
        request,
        context.auditActor,
        env,
        context.respond,
      )
    }
    return context.respond({ error: 'Method not allowed' }, { status: 405 })
  }

  return context.respond({ error: 'Not found' }, { status: 404 })
}
