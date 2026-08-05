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

import { BACKGROUND_PERK_IDS } from '../../../src/lib/backgrounds/background-catalog'
import type { Env } from './auth'

/** Catalog of grantable perk ids shared with the app background registry. */
export const PERK_IDS = BACKGROUND_PERK_IDS

export type PerkId = (typeof PERK_IDS)[number]

/**
 * Active perk ids for a signed-in user, resolved via their verified account
 * email. A working session is not proof of mailbox ownership: password
 * accounts are usable before email verification, so an unverified address
 * must never claim an email-keyed grant. Returns [] when no verified email or
 * grant exists, or when the shared perks binding is absent/unavailable.
 */
export async function getPerksForUser(
  env: Env,
  userId: string,
): Promise<string[]> {
  if (!env.PERKS_DB) return []
  const user = await env.DB.prepare(
    'SELECT email, emailVerified FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<{ email: string | null; emailVerified: number }>()
  if (!user?.email || user.emailVerified !== 1) return []
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

/** Account deletion: drop every shared grant before erasing the user row. */
export async function purgePerksByEmail(
  env: Env,
  email: string | null,
): Promise<void> {
  if (!email) return
  if (!env.PERKS_DB) throw new Error('Shared perks database unavailable')
  await env.PERKS_DB.prepare('DELETE FROM perkGrants WHERE email = ?1')
    .bind(email)
    .run()
}
