// ============================================================
// Fresh confirm links: who one reaches, and the ledger that keeps it to one
// ============================================================
//
// The SQL behind confirm-reminders.ts. Every query that decides whether an
// account may have a fresh link lives here, so the count the console shows,
// the page a send reads and the claim a send writes cannot disagree about
// who that is. The rules, and what "signed up" means, are in the header of
// confirm-reminders.ts.

import { MANAGED_TEST_EMAIL_DOMAIN } from './testing-account-state'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const DEFAULT_WINDOW: SendWindow = { minAgeHours: 24, maxAgeDays: 90 }
const MIN_AGE_HOURS_RANGE: readonly [number, number] = [1, 365 * 24]
const MAX_AGE_DAYS_RANGE: readonly [number, number] = [1, 365]

/** How many campaigns the audience reports back, newest first. */
const HISTORY_MAX = 24

// ── Who it reaches ───────────────────────────────────────────────────

/** Managed testing accounts live at an address that does not exist. Mailing
 *  one is a bounce, and bounces are what this door must not collect. */
const TEST_ADDRESS_PATTERN = `%@${MANAGED_TEST_EMAIL_DOMAIN}`

/** An account this door may ever mail: a registered, unsuspended account
 *  with a real address nobody confirmed. Binds TEST_ADDRESS_PATTERN once. */
const UNCONFIRMED = `u.email IS NOT NULL
               AND u.emailVerified = 0
               AND u.authProvider <> 'anonymous'
               AND u.suspendedAt IS NULL
               AND lower(u.email) NOT LIKE ?`

/** When the account signed up, as near as D1 can say. See the header of
 *  confirm-reminders.ts. */
const SIGNED_UP_AT = `COALESCE((SELECT MAX(ev.createdAt) FROM emailVerifications ev
                                 WHERE ev.userId = u.id), u.createdAt)`

/** Had a fresh link under any campaign: the lifetime cap. */
const REMINDED = `EXISTS (SELECT 1 FROM confirmReminderSends r WHERE r.userId = u.id)`

export interface SendWindow {
  /** The floor: hours since the newest confirm link. */
  minAgeHours: number
  /** The ceiling: days since the account signed up. */
  maxAgeDays: number
}

function clamp(
  value: unknown,
  [low, high]: readonly [number, number],
  fallback: number,
): number {
  const number =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN
  if (!Number.isFinite(number)) return fallback
  return Math.min(high, Math.max(low, Math.round(number)))
}

/** The window from a query string or a body. Clamped to 1 hour .. 365
 *  days rather than refused; only a window with nothing in it is an error. */
export function readWindow(raw: {
  minAgeHours?: unknown
  maxAgeDays?: unknown
}): SendWindow | string {
  const minAgeHours = clamp(
    raw.minAgeHours,
    MIN_AGE_HOURS_RANGE,
    DEFAULT_WINDOW.minAgeHours,
  )
  const maxAgeDays = clamp(
    raw.maxAgeDays,
    MAX_AGE_DAYS_RANGE,
    DEFAULT_WINDOW.maxAgeDays,
  )
  if (minAgeHours > maxAgeDays * 24) {
    return 'the window is empty: the minimum age is longer than the maximum'
  }
  return { minAgeHours, maxAgeDays }
}

interface Cutoffs {
  /** Signed up at or before this: the newest link is old enough. */
  floor: string
  /** Signed up at or after this: the address is recent enough. */
  ceiling: string
}

function cutoffs(window: SendWindow, now: number): Cutoffs {
  return {
    floor: new Date(now - window.minAgeHours * HOUR_MS).toISOString(),
    ceiling: new Date(now - window.maxAgeDays * DAY_MS).toISOString(),
  }
}

export interface ReminderAudience {
  /** Registered, unsuspended accounts with a real address nobody confirmed.
   *  The four below add up to this. */
  unconfirmed: number
  eligible: number
  tooNew: number
  tooOld: number
  alreadyReminded: number
}

export async function countReminderAudience(
  db: D1Database,
  window: SendWindow,
  now = Date.now(),
): Promise<ReminderAudience> {
  const { floor, ceiling } = cutoffs(window, now)
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS unconfirmed,
              COALESCE(SUM(reminded), 0) AS alreadyReminded,
              COALESCE(SUM(CASE WHEN reminded = 0 AND signedUpAt > ? THEN 1 ELSE 0 END), 0) AS tooNew,
              COALESCE(SUM(CASE WHEN reminded = 0 AND signedUpAt < ? THEN 1 ELSE 0 END), 0) AS tooOld,
              COALESCE(SUM(CASE WHEN reminded = 0 AND signedUpAt <= ? AND signedUpAt >= ? THEN 1 ELSE 0 END), 0) AS eligible
         FROM (SELECT ${SIGNED_UP_AT} AS signedUpAt, ${REMINDED} AS reminded
                 FROM users u
                WHERE ${UNCONFIRMED})`,
    )
    .bind(floor, ceiling, floor, ceiling, TEST_ADDRESS_PATTERN)
    .first<ReminderAudience>()
  return {
    unconfirmed: row?.unconfirmed ?? 0,
    eligible: row?.eligible ?? 0,
    tooNew: row?.tooNew ?? 0,
    tooOld: row?.tooOld ?? 0,
    alreadyReminded: row?.alreadyReminded ?? 0,
  }
}

export interface Target {
  userId: string
  email: string
  signedUpAt: string
}

export interface TargetScope {
  /** Account ids picked by hand, or null for everyone eligible. */
  selection: string[] | null
  window: SendWindow
  now: number
}

/** The accounts a send would reach, as one filter both the list and the
 *  count use. A selection skips the floor; nothing else changes. */
function targetFilter(scope: TargetScope): { sql: string; binds: unknown[] } {
  const { floor, ceiling } = cutoffs(scope.window, scope.now)
  const binds: unknown[] = [TEST_ADDRESS_PATTERN]
  let inner = `SELECT u.id AS userId, u.email AS email, ${SIGNED_UP_AT} AS signedUpAt
                 FROM users u
                WHERE ${UNCONFIRMED}
                  AND NOT ${REMINDED}`
  if (scope.selection !== null) {
    // One bound JSON array rather than a placeholder per id: D1 caps a
    // statement at 100 bound parameters, and a selection can be 100 ids.
    inner += ` AND u.id IN (SELECT value FROM json_each(?))`
    binds.push(JSON.stringify(scope.selection))
  }
  let sql = `FROM (${inner}) WHERE signedUpAt >= ?`
  binds.push(ceiling)
  if (scope.selection === null) {
    sql += ` AND signedUpAt <= ?`
    binds.push(floor)
  }
  return { sql, binds }
}

export async function listTargets(
  db: D1Database,
  scope: TargetScope,
  limit: number,
): Promise<Target[]> {
  const { sql, binds } = targetFilter(scope)
  // Oldest sign-up first: those links expired longest ago, and a mailing
  // stopped half way carries on from there.
  const rows = await db
    .prepare(
      `SELECT userId, email, signedUpAt ${sql} ORDER BY signedUpAt ASC, userId ASC LIMIT ?`,
    )
    .bind(...binds, limit)
    .all<Target>()
  return rows.results ?? []
}

export async function countTargets(
  db: D1Database,
  scope: TargetScope,
): Promise<number> {
  const { sql, binds } = targetFilter(scope)
  const row = await db
    .prepare(`SELECT COUNT(*) AS n ${sql}`)
    .bind(...binds)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/** Why a picked account would not get the link. Only one reason per
 *  account, the first that applies in this order. */
export type SkipReason =
  | 'notFound'
  | 'noAddress'
  | 'confirmed'
  | 'testAccount'
  | 'suspended'
  | 'alreadyReminded'
  | 'tooOld'

const SKIP_REASONS: readonly SkipReason[] = [
  'notFound',
  'noAddress',
  'confirmed',
  'testAccount',
  'suspended',
  'alreadyReminded',
  'tooOld',
]

/** The picked accounts that would be skipped, counted by reason. */
export async function skippedFromSelection(
  db: D1Database,
  selection: string[],
  window: SendWindow,
  now: number,
): Promise<Record<SkipReason, number>> {
  const { ceiling } = cutoffs(window, now)
  const rows = await db
    .prepare(
      `SELECT u.id AS id, u.email AS email, u.emailVerified AS emailVerified,
              u.authProvider AS authProvider, u.suspendedAt AS suspendedAt,
              ${SIGNED_UP_AT} AS signedUpAt, ${REMINDED} AS reminded
         FROM users u
        WHERE u.id IN (SELECT value FROM json_each(?))`,
    )
    .bind(JSON.stringify(selection))
    .all<{
      id: string
      email: string | null
      emailVerified: number
      authProvider: string
      suspendedAt: string | null
      signedUpAt: string
      reminded: number
    }>()
  const byId = new Map((rows.results ?? []).map((row) => [row.id, row]))
  const skipped = Object.fromEntries(
    SKIP_REASONS.map((reason) => [reason, 0]),
  ) as Record<SkipReason, number>
  const testSuffix = `@${MANAGED_TEST_EMAIL_DOMAIN}`.toLowerCase()
  for (const id of selection) {
    const row = byId.get(id)
    let reason: SkipReason | null = null
    if (row === undefined) reason = 'notFound'
    else if (row.authProvider === 'anonymous' || !row.email)
      reason = 'noAddress'
    else if (row.emailVerified) reason = 'confirmed'
    else if (row.email.toLowerCase().endsWith(testSuffix))
      reason = 'testAccount'
    else if (row.suspendedAt !== null) reason = 'suspended'
    else if (row.reminded) reason = 'alreadyReminded'
    else if (row.signedUpAt < ceiling) reason = 'tooOld'
    if (reason !== null) skipped[reason] += 1
  }
  return skipped
}

// ── The claim ────────────────────────────────────────────────────────

/** Takes the account out of the audience for good, before anything goes.
 *  One statement that re-checks the account as it writes: still
 *  unconfirmed, still at the address the page read, and never reminded
 *  under any campaign. False means somebody else got there first, or the
 *  account changed since the page was read. */
export async function claimAccount(
  db: D1Database,
  campaign: string,
  target: Target,
): Promise<boolean> {
  const claim = await db
    .prepare(
      `INSERT INTO confirmReminderSends (campaign, userId, sentAt)
       SELECT ?, u.id, ?
         FROM users u
        WHERE u.id = ?
          AND lower(u.email) = lower(?)
          AND ${UNCONFIRMED}
          AND NOT ${REMINDED}`,
    )
    .bind(
      campaign,
      new Date().toISOString(),
      target.userId,
      target.email,
      TEST_ADDRESS_PATTERN,
    )
    .run()
  return (claim.meta?.changes ?? 0) > 0
}

// ── What it said, and whether it worked ──────────────────────────────

export interface CampaignStats {
  campaign: string
  sent: number
  confirmedAfter: number
  firstSentAt: string | null
  lastSentAt: string | null
}

const STATS_COLUMNS = `campaign,
       COUNT(*) AS sent,
       COALESCE(SUM(CASE WHEN confirmedAt IS NOT NULL THEN 1 ELSE 0 END), 0) AS confirmedAfter,
       MIN(sentAt) AS firstSentAt,
       MAX(sentAt) AS lastSentAt`

export async function campaignStats(
  db: D1Database,
  campaign: string,
): Promise<CampaignStats> {
  const row = await db
    .prepare(
      `SELECT ${STATS_COLUMNS} FROM confirmReminderSends WHERE campaign = ? GROUP BY campaign`,
    )
    .bind(campaign)
    .first<CampaignStats>()
  return (
    row ?? {
      campaign,
      sent: 0,
      confirmedAfter: 0,
      firstSentAt: null,
      lastSentAt: null,
    }
  )
}

export async function campaignHistory(
  db: D1Database,
): Promise<CampaignStats[]> {
  const rows = await db
    .prepare(
      `SELECT ${STATS_COLUMNS} FROM confirmReminderSends
        GROUP BY campaign ORDER BY MAX(sentAt) DESC LIMIT ?`,
    )
    .bind(HISTORY_MAX)
    .all<CampaignStats>()
  return rows.results ?? []
}
