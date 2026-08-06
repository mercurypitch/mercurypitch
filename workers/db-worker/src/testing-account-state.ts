// ── Managed testing-account state ──────────────────────────────────
// Shared lifecycle checks for auth, billing, perks, and the provisioning API.
// A reserved email is only a routing hint; the D1 row remains authoritative.

export const MANAGED_TEST_EMAIL_DOMAIN = 'testing.mercurypitch.com'

export interface ManagedTestAccountState {
  userId: string
  campaignId: string
  testerId: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  revokedAt: string | null
  creditAllowance: number
  supporterEnabled: number
  perksJson: string
  grantRevision: number
}

export type ManagedTestAccountInactiveReason = 'expired' | 'revoked'

export class ManagedTestAccountInactiveError extends Error {
  readonly reason: ManagedTestAccountInactiveReason

  constructor(reason: ManagedTestAccountInactiveReason) {
    super(`Managed testing account is ${reason}`)
    this.name = 'ManagedTestAccountInactiveError'
    this.reason = reason
  }
}

export function isManagedTestEmail(email: string | null | undefined): boolean {
  if (email == null) return false
  const normalized = email.trim().toLowerCase()
  return normalized.endsWith(`@${MANAGED_TEST_EMAIL_DOMAIN}`)
}

export async function getManagedTestAccountState(
  db: D1Database,
  userId: string,
): Promise<ManagedTestAccountState | null> {
  return db
    .prepare('SELECT * FROM managedTestAccounts WHERE userId = ?1 LIMIT 1')
    .bind(userId)
    .first<ManagedTestAccountState>()
}

export function assertManagedTestAccountActive(
  state: ManagedTestAccountState | null,
  nowMs = Date.now(),
): void {
  if (state === null) return
  if (state.revokedAt !== null) {
    throw new ManagedTestAccountInactiveError('revoked')
  }
  const expiryMs = Date.parse(state.expiresAt)
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) {
    throw new ManagedTestAccountInactiveError('expired')
  }
}

/** Resolve only reserved synthetic identities; normal accounts do no extra IO. */
export async function managedStateForIdentity(
  db: D1Database,
  userId: string,
  email: string | null | undefined,
): Promise<ManagedTestAccountState | null> {
  if (!isManagedTestEmail(email)) return null
  const state = await getManagedTestAccountState(db, userId)
  // A synthetic address without its authority row is invalid, not a normal
  // account. Treat it as revoked so partial/manual rows fail closed.
  if (state === null) throw new ManagedTestAccountInactiveError('revoked')
  return state
}

export function managedTestAccountErrorResponse(
  respond: (body: object | null, init?: ResponseInit) => Response,
  error: ManagedTestAccountInactiveError,
): Response {
  return respond(
    {
      code: 'test_account_inactive',
      error: `Testing account ${error.reason}`,
      reason: error.reason,
    },
    { status: 403 },
  )
}
