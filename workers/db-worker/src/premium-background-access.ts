// ============================================================
// Premium background access — runtime catalog and server-held grants
// ============================================================
//
// Published D1 state is the authoritative premium catalog overlay. Static
// definitions still bound ids and surfaces, while supporter entitlements,
// environment-local groups and legacy verified-email grants are combined at
// request time so revocation never depends on a client refresh.

import type { BackgroundPerkId, BackgroundSurface, } from '../../../src/lib/backgrounds/background-catalog'
import { getBackgroundDefinition, isBackgroundPerkId, } from '../../../src/lib/backgrounds/background-catalog'
import type { Env } from './auth'
import { getPerksForUser } from './perks'
import type { PremiumBackgroundId, PremiumBackgroundVariant, } from './premium-background-catalog'
import { isPremiumBackgroundVariant, PREMIUM_BACKGROUND_VARIANTS, } from './premium-background-catalog'

interface UserIdentityRow {
  email: string | null
  emailVerified: number
}

interface SupporterEntitlementRow {
  expiresAt: string | null
}

interface GrantedBackgroundRow {
  backgroundId: string
}

interface ShippedAssetRow {
  activeRevisionId: string
  description: string
  id: string
  surface: string
  title: string
  version: number
}

interface ShippedVariantRow {
  backgroundId: string
  byteSize: number
  height: number
  objectKey: string
  revisionId: string
  sha256: string
  variant: string
  version: number
  width: number
}

export interface RuntimeBackgroundVariant {
  byteSize: number
  height: number
  name: PremiumBackgroundVariant
  sha256: string
  width: number
}

export interface RuntimePremiumBackground {
  activeVersion: number
  description: string
  id: PremiumBackgroundId
  surface: BackgroundSurface
  title: string
  variants: RuntimeBackgroundVariant[]
}

export interface PremiumBackgroundAccess {
  activeSupporter: boolean
  backgroundIds: PremiumBackgroundId[]
  expiresAt: string | null
}

export interface ShippedBackgroundRevision {
  backgroundId: PremiumBackgroundId
  description: string
  revisionId: string
  surface: BackgroundSurface
  title: string
  version: number
}

export interface ShippedBackgroundVariant
  extends ShippedBackgroundRevision, RuntimeBackgroundVariant {
  objectKey: string
}

function validCanonicalFutureExpiry(
  expiresAt: string | null,
  nowMs: number,
): { active: boolean; expiresAt: string | null } {
  if (expiresAt === null) return { active: true, expiresAt: null }
  const parsed = Date.parse(expiresAt)
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString() !== expiresAt ||
    parsed <= nowMs
  ) {
    return { active: false, expiresAt: null }
  }
  return { active: true, expiresAt }
}

function knownAssetRow(row: ShippedAssetRow): ShippedBackgroundRevision | null {
  if (!isBackgroundPerkId(row.id)) return null
  const definition = getBackgroundDefinition(row.id)
  if (
    definition === null ||
    definition.access.kind !== 'supporter' ||
    definition.surface !== row.surface ||
    !Number.isInteger(row.version) ||
    row.version < 1
  ) {
    return null
  }
  return {
    backgroundId: row.id,
    description: row.description,
    revisionId: row.activeRevisionId,
    surface: definition.surface,
    title: row.title,
    version: row.version,
  }
}

/** Resolve one current, published revision before authorization or R2. */
export async function findShippedBackground(
  env: Env,
  backgroundId: PremiumBackgroundId,
  requestedVersion?: number,
): Promise<ShippedBackgroundRevision | null> {
  const row = await env.DB.prepare(
    `SELECT a.id, a.surface, a.title, a.description,
            a.activeRevisionId, r.version
       FROM premiumBackgroundAssets a
       JOIN premiumBackgroundRevisions r
         ON r.id = a.activeRevisionId
        AND r.backgroundId = a.id
      WHERE a.id = ?1
        AND a.status = 'active'
        AND r.lifecycle = 'published'
        AND (?2 IS NULL OR r.version = ?2)
      LIMIT 1`,
  )
    .bind(backgroundId, requestedVersion ?? null)
    .first<ShippedAssetRow>()
  return row === null ? null : knownAssetRow(row)
}

/** Resolve a current variant and its private key. Never serialize this row. */
export async function findShippedBackgroundVariant(
  env: Env,
  backgroundId: PremiumBackgroundId,
  variant: PremiumBackgroundVariant,
  requestedVersion?: number,
): Promise<ShippedBackgroundVariant | null> {
  const revision = await findShippedBackground(
    env,
    backgroundId,
    requestedVersion,
  )
  if (revision === null) return null
  const row = await env.DB.prepare(
    `SELECT revisionId, variant, objectKey, width, height, byteSize, sha256
       FROM premiumBackgroundVariants
      WHERE revisionId = ?1 AND variant = ?2
      LIMIT 1`,
  )
    .bind(revision.revisionId, variant)
    .first<Omit<ShippedVariantRow, 'backgroundId' | 'version'>>()
  if (
    row === null ||
    !isPremiumBackgroundVariant(row.variant) ||
    !Number.isInteger(row.width) ||
    !Number.isInteger(row.height) ||
    !Number.isInteger(row.byteSize)
  ) {
    return null
  }
  return {
    ...revision,
    byteSize: row.byteSize,
    height: row.height,
    name: row.variant,
    objectKey: row.objectKey,
    sha256: row.sha256,
    width: row.width,
  }
}

/** Public-safe shipped metadata. Object keys are deliberately discarded. */
export async function listRuntimePremiumBackgrounds(
  env: Env,
): Promise<RuntimePremiumBackground[]> {
  const [assetsResult, variantsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT a.id, a.surface, a.title, a.description,
              a.activeRevisionId, r.version
         FROM premiumBackgroundAssets a
         JOIN premiumBackgroundRevisions r
           ON r.id = a.activeRevisionId
          AND r.backgroundId = a.id
        WHERE a.status = 'active'
          AND r.lifecycle = 'published'
        ORDER BY a.surface, a.title, a.id`,
    ).all<ShippedAssetRow>(),
    env.DB.prepare(
      `SELECT a.id AS backgroundId, a.activeRevisionId AS revisionId,
              r.version, v.variant, v.objectKey, v.width, v.height,
              v.byteSize, v.sha256
         FROM premiumBackgroundAssets a
         JOIN premiumBackgroundRevisions r
           ON r.id = a.activeRevisionId
          AND r.backgroundId = a.id
         JOIN premiumBackgroundVariants v ON v.revisionId = r.id
        WHERE a.status = 'active'
          AND r.lifecycle = 'published'
        ORDER BY a.id, v.variant`,
    ).all<ShippedVariantRow>(),
  ])

  const variantsByRevision = new Map<string, RuntimeBackgroundVariant[]>()
  for (const row of variantsResult.results ?? []) {
    if (
      !isBackgroundPerkId(row.backgroundId) ||
      !isPremiumBackgroundVariant(row.variant) ||
      !Number.isInteger(row.width) ||
      row.width < 1 ||
      !Number.isInteger(row.height) ||
      row.height < 1 ||
      !Number.isInteger(row.byteSize) ||
      row.byteSize < 1
    ) {
      continue
    }
    const variants = variantsByRevision.get(row.revisionId) ?? []
    variants.push({
      byteSize: row.byteSize,
      height: row.height,
      name: row.variant,
      sha256: row.sha256,
      width: row.width,
    })
    variantsByRevision.set(row.revisionId, variants)
  }

  const catalog: RuntimePremiumBackground[] = []
  for (const row of assetsResult.results ?? []) {
    const asset = knownAssetRow(row)
    if (asset === null) continue
    const variants = variantsByRevision.get(asset.revisionId) ?? []
    const variantNames = new Set(variants.map((variant) => variant.name))
    if (
      !PREMIUM_BACKGROUND_VARIANTS.every((variant) => variantNames.has(variant))
    ) {
      continue
    }
    catalog.push({
      activeVersion: asset.version,
      description: asset.description,
      id: asset.backgroundId,
      surface: asset.surface,
      title: asset.title,
      variants,
    })
  }
  return catalog
}

async function groupGrants(
  env: Env,
  normalizedEmail: string | null,
  activeSupporter: boolean,
): Promise<string[]> {
  const statements: D1PreparedStatement[] = []
  if (activeSupporter) {
    statements.push(
      env.DB.prepare(
        `SELECT p.backgroundId
           FROM premiumSupporterGroups g
           JOIN premiumSupporterGroupPerks p ON p.groupId = g.id
          WHERE g.slug = 'active-supporters'
            AND g.kind = 'automatic'
            AND g.active = 1
            AND g.deletedAt IS NULL
            AND p.revokedAt IS NULL`,
      ),
    )
  }
  if (normalizedEmail !== null) {
    statements.push(
      env.DB.prepare(
        `SELECT p.backgroundId
           FROM premiumSupporterGroupMembers m
           JOIN premiumSupporterGroups g ON g.id = m.groupId
           JOIN premiumSupporterGroupPerks p ON p.groupId = g.id
          WHERE m.email = ?1 COLLATE NOCASE
            AND m.revokedAt IS NULL
            AND g.kind = 'manual'
            AND g.active = 1
            AND g.deletedAt IS NULL
            AND p.revokedAt IS NULL`,
      ).bind(normalizedEmail),
    )
  }
  if (statements.length === 0) return []
  const results = await env.DB.batch<GrantedBackgroundRow>(statements)
  return results.flatMap((result) =>
    (result.results ?? []).map((row) => row.backgroundId),
  )
}

/** Current server-held access for one account, without trusting client state. */
export async function resolvePremiumBackgroundAccess(
  env: Env,
  userId: string,
  shippedIds?: ReadonlySet<string>,
  nowMs = Date.now(),
): Promise<PremiumBackgroundAccess> {
  const [identity, entitlement] = await Promise.all([
    env.DB.prepare(
      'SELECT email, emailVerified FROM users WHERE id = ?1 LIMIT 1',
    )
      .bind(userId)
      .first<UserIdentityRow>(),
    env.DB.prepare(
      `SELECT expiresAt
         FROM entitlements
        WHERE userId = ?1 AND feature = 'supporter'
        LIMIT 1`,
    )
      .bind(userId)
      .first<SupporterEntitlementRow>(),
  ])
  if (identity === null) {
    return { activeSupporter: false, backgroundIds: [], expiresAt: null }
  }

  const supporter =
    entitlement === null
      ? { active: false, expiresAt: null }
      : validCanonicalFutureExpiry(entitlement.expiresAt, nowMs)
  const normalizedEmail =
    identity.emailVerified === 1 && identity.email !== null
      ? identity.email.trim().toLowerCase()
      : null
  const [groups, legacy] = await Promise.all([
    groupGrants(env, normalizedEmail, supporter.active),
    getPerksForUser(env, userId),
  ])
  const combined = new Set<string>([...groups, ...legacy])
  const backgroundIds = [...combined]
    .filter(
      (id): id is BackgroundPerkId =>
        isBackgroundPerkId(id) &&
        (shippedIds === undefined || shippedIds.has(id)),
    )
    .sort()
  return {
    activeSupporter: supporter.active,
    backgroundIds,
    expiresAt: supporter.active ? supporter.expiresAt : null,
  }
}

export async function mayAccessPremiumBackground(
  env: Env,
  userId: string,
  backgroundId: PremiumBackgroundId,
): Promise<boolean> {
  const access = await resolvePremiumBackgroundAccess(env, userId)
  return access.backgroundIds.includes(backgroundId)
}
