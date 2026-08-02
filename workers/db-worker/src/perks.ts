// ── Supporter perks ──────────────────────────────────────────────────
// Cosmetic unlocks granted to donors (Mercury Rooms editions, etc.).
//
// Grants live in the SHARED perks database (Env.PERKS_DB): one D1 bound
// to both dev and prod so a perk is published once per person. Rows are
// keyed by email because the two environments have separate user-id
// spaces — see migrations-perks/0001_perkGrants.sql for the full
// rationale. Granting/revoking is operator-side only for now
// (dotfiles grant-perks.sh + companyReportViewer); the worker exposes
// just the read path plus the account-deletion purge.

import type { Env } from './auth'

/** Catalog of grantable perk ids — keep in sync with grant-perks.sh. */
export const PERK_IDS = [
  'golden-stage',
  'golden-singer',
  'aurora-loft',
] as const

export type PerkId = (typeof PERK_IDS)[number]

/**
 * Active perk ids for a signed-in user, resolved via their account
 * email. Returns [] when the user has no email (anonymous), when no
 * grants exist, or when the perks binding is absent (local dev without
 * the shared DB) — perks are cosmetic, so absence must never error.
 */
export async function getPerksForUser(
  env: Env,
  userId: string,
): Promise<string[]> {
  if (!env.PERKS_DB) return []
  const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
    .bind(userId)
    .first<{ email: string | null }>()
  if (!user?.email) return []
  try {
    const rows = await env.PERKS_DB.prepare(
      'SELECT perkId FROM perkGrants WHERE email = ?1 AND revokedAt IS NULL',
    )
      .bind(user.email)
      .all<{ perkId: string }>()
    // Filter to the catalog rather than returning whatever is in the
    // row. Granting is a shell script typing a string by hand, so a typo
    // would otherwise publish a perk id nothing can render — and the
    // client would have no way to tell that from a real one.
    const known = new Set<string>(PERK_IDS)
    return (rows.results ?? [])
      .map((r) => r.perkId)
      .filter((id) => known.has(id))
  } catch {
    // Shared DB unreachable — cosmetic feature, degrade to none.
    return []
  }
}

/**
 * Account deletion: drop every grant for the email. Best-effort — the
 * main-DB deletion batch must never fail because the perks DB hiccuped.
 */
export async function purgePerksByEmail(
  env: Env,
  email: string | null,
): Promise<void> {
  if (!env.PERKS_DB || !email) return
  try {
    await env.PERKS_DB.prepare('DELETE FROM perkGrants WHERE email = ?1')
      .bind(email)
      .run()
  } catch {
    // Swallow: deletion of the account itself already succeeded.
  }
}
