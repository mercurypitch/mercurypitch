// ============================================================
// Supporter feature access — server-held group grants for app surfaces
// ============================================================
//
// A feature unlock is never inferred from client storage. Active supporter
// status activates the reserved automatic group; verified email activates
// matching manual groups. Unknown database ids are discarded at the boundary.

import type { SupporterFeaturePerkId } from '../../../src/lib/supporter-feature-catalog'
import { isSupporterFeaturePerkId } from '../../../src/lib/supporter-feature-catalog'
import type { Env } from './auth'

interface UserIdentityRow {
  email: string | null
  emailVerified: number
}

interface SupporterEntitlementRow {
  expiresAt: string | null
}

interface FeatureGrantRow {
  featureId: string
}

function activeSupporterExpiry(
  expiresAt: string | null,
  nowMs: number,
): boolean {
  if (expiresAt === null) return true
  const parsed = Date.parse(expiresAt)
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString() === expiresAt &&
    parsed > nowMs
  )
}

async function groupFeatureGrants(
  env: Env,
  normalizedEmail: string | null,
  activeSupporter: boolean,
): Promise<string[]> {
  const statements: D1PreparedStatement[] = []
  if (activeSupporter) {
    statements.push(
      env.DB.prepare(
        `SELECT f.featureId
           FROM premiumSupporterGroups g
           JOIN premiumSupporterGroupFeatures f ON f.groupId = g.id
          WHERE g.slug = 'active-supporters'
            AND g.kind = 'automatic'
            AND g.active = 1
            AND g.deletedAt IS NULL
            AND f.revokedAt IS NULL`,
      ),
    )
  }
  if (normalizedEmail !== null) {
    statements.push(
      env.DB.prepare(
        `SELECT f.featureId
           FROM premiumSupporterGroupMembers m
           JOIN premiumSupporterGroups g ON g.id = m.groupId
           JOIN premiumSupporterGroupFeatures f ON f.groupId = g.id
          WHERE m.email = ?1 COLLATE NOCASE
            AND m.revokedAt IS NULL
            AND g.kind = 'manual'
            AND g.active = 1
            AND g.deletedAt IS NULL
            AND f.revokedAt IS NULL`,
      ).bind(normalizedEmail),
    )
  }
  if (statements.length === 0) return []
  const results = await env.DB.batch<FeatureGrantRow>(statements)
  return results.flatMap((result) =>
    (result.results ?? []).map((row) => row.featureId),
  )
}

/** Resolve current feature access from the environment-local authority. */
export async function resolveSupporterFeatureAccess(
  env: Env,
  userId: string,
  nowMs = Date.now(),
): Promise<SupporterFeaturePerkId[]> {
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
  if (identity === null) return []

  const activeSupporter =
    entitlement !== null && activeSupporterExpiry(entitlement.expiresAt, nowMs)
  const trimmedEmail = identity.email?.trim() ?? ''
  const normalizedEmail =
    identity.emailVerified === 1 && trimmedEmail !== ''
      ? trimmedEmail.toLowerCase()
      : null
  const grants = await groupFeatureGrants(env, normalizedEmail, activeSupporter)
  return [...new Set(grants.filter(isSupporterFeaturePerkId))].sort()
}
