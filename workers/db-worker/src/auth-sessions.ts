// ── Sessions: one row per signed-in device ───────────────────────────
//
// The `sid` claim in a JWT names a row in `authSessions`. Deleting the row
// ends exactly that device; `users.tokenVersion` remains the separate, blunt
// "sign out everywhere" lever (see migration 0038).
//
// Nothing here reads `env` beyond the D1 handle, so the whole module is
// testable against node:sqlite with the real migration applied.

export interface SessionOrigin {
  userAgent?: string | null
  ip?: string | null
}

export interface AuthSessionRow {
  id: string
  provider: string | null
  userAgent: string | null
  ip: string | null
  createdAt: string
  lastSeenAt: string
}

/** What the account UI shows for one device. */
export interface SessionSummary {
  id: string
  provider: string | null
  label: string
  ip: string | null
  createdAt: string
  lastSeenAt: string
  current: boolean
}

/**
 * How stale `lastSeenAt` may get. Writing it on every request would put a D1
 * write in front of every authenticated call for a column nobody reads more
 * precisely than "today".
 */
export const SESSION_TOUCH_SECONDS = 300

/**
 * Slack between a token expiring and its row being swept.
 *
 * A row removed early signs someone out a moment before their token was due to
 * die anyway, for no reason beyond two clocks disagreeing. A day is far more
 * than that gap and still bounds the table.
 */
const SWEEP_GRACE_SECONDS = 24 * 60 * 60

/** Record a new signed-in device and return the `sid` to put in its token. */
export async function createAuthSession(
  db: D1Database,
  userId: string,
  provider: string,
  origin: SessionOrigin = {},
): Promise<string> {
  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO authSessions (id, userId, provider, userAgent, ip)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, userId, provider, origin.userAgent ?? null, origin.ip ?? null)
    .run()
  return id
}

/** Whether this device is still signed in. False means it was signed out. */
export async function sessionAlive(
  db: D1Database,
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM authSessions WHERE id = ? AND userId = ?')
    .bind(sessionId, userId)
    .first<{ id: string }>()
  return row !== null
}

/**
 * Bump `lastSeenAt`, but only if it is already stale.
 *
 * Conditional in SQL rather than in a read-then-write, so an idle-ish session
 * costs one write per SESSION_TOUCH_SECONDS instead of one per request and
 * concurrent calls cannot both decide to write. Best-effort by contract: the
 * caller must not await this on the critical path, and a failure must never
 * fail the request it rode in on.
 */
export async function touchSession(
  db: D1Database,
  sessionId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE authSessions SET lastSeenAt = datetime('now')
        WHERE id = ? AND lastSeenAt <= datetime('now', ?)`,
    )
    .bind(sessionId, `-${SESSION_TOUCH_SECONDS} seconds`)
    .run()
}

/** End one device. False when the row was not this user's, or already gone. */
export async function endSession(
  db: D1Database,
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const res = await db
    .prepare('DELETE FROM authSessions WHERE id = ? AND userId = ?')
    .bind(sessionId, userId)
    .run()
  return (res.meta.changes ?? 0) > 0
}

/**
 * End every session except one — what enabling 2FA does.
 *
 * `keepSessionId` is null for a caller whose own token predates migration 0038
 * and therefore has no `sid` to keep. That signs the caller out too, which is
 * the safe direction: they can sign back in with the factor they just
 * enrolled, and the intruder the enrollment is aimed at cannot.
 */
export async function endOtherSessions(
  db: D1Database,
  userId: string,
  keepSessionId: string | null,
): Promise<void> {
  await (
    keepSessionId === null
      ? db.prepare('DELETE FROM authSessions WHERE userId = ?').bind(userId)
      : db
          .prepare('DELETE FROM authSessions WHERE userId = ? AND id != ?')
          .bind(userId, keepSessionId)
  ).run()
}

/** This account's devices, most recently seen first. */
export async function listSessions(
  db: D1Database,
  userId: string,
  currentSessionId: string | null,
): Promise<SessionSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT id, provider, userAgent, ip, createdAt, lastSeenAt
         FROM authSessions WHERE userId = ? ORDER BY lastSeenAt DESC`,
    )
    .bind(userId)
    .all<AuthSessionRow>()
  return results.map((row) => ({
    id: row.id,
    provider: row.provider,
    label: deviceLabel(row.userAgent),
    ip: row.ip,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    current: row.id === currentSessionId,
  }))
}

/**
 * Drop rows whose token has expired.
 *
 * The row is what "signed in on this device" means, and nothing else removes
 * one except an explicit sign-out. Without this the table grows by a row per
 * sign-in forever and — worse — the session list shows every one of them: a
 * browser signed into once a month appears a dozen times, each entry
 * indistinguishable from the live one, and "sign out this device" on any of
 * them revokes nothing, because there is nothing left to revoke.
 */
export async function sweepExpiredSessions(
  db: D1Database,
  tokenTtlSeconds: number,
): Promise<void> {
  await db
    .prepare(`DELETE FROM authSessions WHERE createdAt <= datetime('now', ?)`)
    .bind(`-${tokenTtlSeconds + SWEEP_GRACE_SECONDS} seconds`)
    .run()
}

/**
 * A user agent, as something a person recognises in a list of their devices.
 *
 * Deliberately coarse. The string is stored verbatim, so this can be improved
 * whenever without a backfill, and being wrong here costs a fuzzy label rather
 * than a failed sign-out. Order matters: Edge and Chrome both claim to be
 * Safari, and Chrome claims to be Edge's ancestor, so the most specific token
 * has to be tested first.
 */
export function deviceLabel(userAgent: string | null): string {
  if (userAgent === null || userAgent.trim() === '') return 'Unknown device'
  const platform = firstMatch(userAgent, PLATFORMS)
  const browser = firstMatch(userAgent, BROWSERS)
  if (platform !== null && browser !== null) return `${browser} on ${platform}`
  return platform ?? browser ?? 'Unknown device'
}

/**
 * Ordered, and the order is the algorithm.
 *
 * Every Android agent also says "Linux"; every Chrome and Edge agent also says
 * "Safari"; Edge and Opera also say "Chrome". So the most specific name has to
 * be tested first, and a plain object would give no guarantee of that.
 */
const PLATFORMS: [RegExp, string][] = [
  [/iPhone/i, 'iPhone'],
  [/iPad/i, 'iPad'],
  [/Android/i, 'Android'],
  [/Mac OS X|Macintosh/i, 'Mac'],
  [/Windows/i, 'Windows'],
  [/CrOS/i, 'ChromeOS'],
  [/Linux/i, 'Linux'],
]

const BROWSERS: [RegExp, string][] = [
  [/Edg\//i, 'Edge'],
  [/OPR\/|Opera/i, 'Opera'],
  [/Firefox\//i, 'Firefox'],
  [/Chrome\//i, 'Chrome'],
  [/Safari\//i, 'Safari'],
]

function firstMatch(ua: string, table: [RegExp, string][]): string | null {
  for (const [pattern, name] of table) if (pattern.test(ua)) return name
  return null
}
