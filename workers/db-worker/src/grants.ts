// ── Achievement grant support ────────────────────────────────────────
//
// Two endpoints that exist for one reason: a grant pass used to be twelve
// GETs and up to fifty PATCHes, one HTTPS round trip each. The round trip is
// ~85 ms; the D1 query behind it is 0.4-1.3 ms. The cost was never the
// database — it was asking sixty times.
//
//   GET  /api/me/grant-context      everything one pass reads, one request
//   POST /api/userAchievements/bulk every row one pass writes, one request
//
// Neither endpoint evaluates anything. The 59 achievement rules stay in one
// place, on the client (src/db/services/badge-grant-engine.ts) — these return
// the raw inputs and accept the decided outputs. That is deliberate: a second
// copy of the rules on the server would be two implementations to keep in
// step, and the measured saving over doing it this way was ~0.1 s.

import type { AuthUser, Env } from './auth'
import type { TableDef } from './tables'
import { fromSql, TABLES } from './tables'

type Respond = (body: object | null, init?: ResponseInit) => Response
type Row = Record<string, unknown>

/** Matches loadSessionRecords(200) in session-service.ts. */
const RECORD_LIMIT = 200

/**
 * A pass writes at most one row per achievement definition, and there are 59.
 * 200 leaves room for the catalogue to triple before anyone has to think
 * about it, and rejects a payload that could only be an attack or a bug.
 */
const MAX_BULK_ROWS = 200

function hydrate(table: string, rows: Row[] | undefined): Row[] {
  const def: TableDef | undefined = TABLES[table]
  if (!def || !rows) return rows ?? []
  return rows.map((r) => fromSql(def, { ...r }))
}

function countOf(rows: Row[] | undefined): number {
  const n = rows?.[0]?.n
  return typeof n === 'number' ? n : 0
}

/**
 * Every input one grant pass needs, from a single D1 batch.
 *
 * Note what this does NOT return: a streak number, activity counts, a list of
 * unlocked goals. Those are derived, and deriving them here would be the
 * start of the second rule implementation this file exists to avoid. The
 * client already owns `computeStreakState` and `countActivity`; it gets the
 * profile row and the activity rows and runs them itself.
 */
export async function handleGrantContext(
  auth: AuthUser,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const uid = auth.userId
  const results = await env.DB.batch<Row>([
    env.DB.prepare('SELECT * FROM badgeDefinitions'),
    env.DB.prepare('SELECT * FROM userBadges WHERE userId = ?').bind(uid),
    env.DB.prepare('SELECT * FROM achievements'),
    env.DB.prepare('SELECT * FROM userAchievements WHERE userId = ?').bind(uid),
    // The composite index (userId, endedAt DESC) is what keeps this from
    // reading every record the singer has ever made in order to sort them.
    env.DB.prepare(
      `SELECT * FROM sessionRecords WHERE userId = ?
       ORDER BY endedAt DESC LIMIT ${RECORD_LIMIT}`,
    ).bind(uid),
    env.DB.prepare('SELECT * FROM challengeDefinitions'),
    env.DB.prepare('SELECT * FROM challengeProgress WHERE userId = ?').bind(uid),
    // Only the two columns countActivity reads. metaJson is per-kind detail
    // nothing aggregates, and it is the widest column on the table.
    env.DB.prepare(
      'SELECT kind, refId FROM userActivity WHERE userId = ?',
    ).bind(uid),
    env.DB.prepare('SELECT * FROM userProfiles WHERE id = ?').bind(uid),
    env.DB.prepare(
      'SELECT COUNT(*) AS n FROM voiceprints WHERE userId = ?',
    ).bind(uid),
    env.DB.prepare('SELECT COUNT(*) AS n FROM follows WHERE userId = ?').bind(
      uid,
    ),
    // Counted per OWNER, which the client could not do for itself: its
    // sharedMelodies read is scoped to isPublic, so it was counting the whole
    // community board and handing every new singer the "share something"
    // achievement on day one.
    env.DB.prepare(
      'SELECT COUNT(*) AS n FROM sharedMelodies WHERE userId = ?',
    ).bind(uid),
    env.DB.prepare(
      'SELECT COUNT(*) AS n FROM sharedSessions WHERE userId = ?',
    ).bind(uid),
  ])

  const rows = results.map((r) => r.results)
  return respond({
    badgeDefinitions: hydrate('badgeDefinitions', rows[0]),
    userBadges: hydrate('userBadges', rows[1]),
    achievements: hydrate('achievements', rows[2]),
    userAchievements: hydrate('userAchievements', rows[3]),
    sessionRecords: hydrate('sessionRecords', rows[4]),
    challengeDefinitions: hydrate('challengeDefinitions', rows[5]),
    challengeProgress: hydrate('challengeProgress', rows[6]),
    userActivity: rows[7] ?? [],
    profile: hydrate('userProfiles', rows[8])[0] ?? null,
    voiceprintCount: countOf(rows[9]),
    followingCount: countOf(rows[10]),
    sharesPosted: countOf(rows[11]) + countOf(rows[12]),
  })
}

interface BulkRow {
  achievementId: string
  progress: number
  unlocked: boolean
  unlockedAt?: string
}

/** Reject anything that is not a well-formed row before it reaches SQL. */
function parseBulkRow(v: unknown): BulkRow | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  const { achievementId, progress, unlocked, unlockedAt } = r
  if (typeof achievementId !== 'string' || achievementId === '') return null
  if (typeof progress !== 'number' || !Number.isFinite(progress)) return null
  if (typeof unlocked !== 'boolean') return null
  if (unlockedAt !== undefined && typeof unlockedAt !== 'string') return null
  return {
    achievementId,
    // The client computes an integer percent; clamp rather than trust it, so
    // a bug up there cannot store a 4000% row that renders as a broken bar.
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    unlocked,
    unlockedAt,
  }
}

/**
 * Apply every changed achievement row for the calling user in one batch.
 *
 * Ownership is not checked — it is structural. The client never sends a row
 * id; it sends achievement DEFINITION ids, and this resolves them against
 * `WHERE userId = ?` from the token. There is no payload that reaches another
 * singer's row, forged or otherwise. An id matching no definition is dropped
 * rather than inserted, so a typo cannot leave junk rows behind.
 *
 * D1 runs a batch as one implicit transaction, so a failure part-way leaves
 * nothing half-written.
 *
 * Two properties this endpoint has to guarantee, because the client cannot:
 *
 * **One row per goal.** Every write is an upsert onto the unique index added
 * in migration 0015, so there is no read-then-write gap for two tabs to race
 * in. A second flush landing in the same instant updates the row the first one
 * inserted instead of inserting a rival.
 *
 * **Unlocks only ever go one way.** A grant pass evaluates from a context it
 * read a moment earlier, and that read can come back empty — every service
 * behind it answers a failure with `[]`. A pass on an empty context concludes,
 * correctly given what it was told, that nothing is unlocked, and queues
 * `unlocked: false` for goals the singer earned weeks ago. So the SQL refuses
 * to take an unlock back: `MAX(unlocked)` keeps a 1, and `COALESCE` keeps the
 * original `unlockedAt`. `progress` stays last-write-wins on purpose — a stale
 * percentage is a bar in the wrong place and the next pass corrects it, while
 * a monotonic percentage would freeze a broken streak at its historical best
 * and never come down.
 */
export async function handleAchievementBulk(
  request: Request,
  auth: AuthUser,
  env: Env,
  respond: Respond,
): Promise<Response> {
  let body: { rows?: unknown }
  try {
    body = await request.json<{ rows?: unknown }>()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!Array.isArray(body.rows)) {
    return respond({ error: 'Expected { rows: [] }' }, { status: 400 })
  }
  if (body.rows.length > MAX_BULK_ROWS) {
    return respond(
      { error: `Too many rows (max ${MAX_BULK_ROWS})` },
      { status: 413 },
    )
  }

  const parsed: BulkRow[] = []
  for (const raw of body.rows) {
    const row = parseBulkRow(raw)
    if (!row) return respond({ error: 'Malformed row' }, { status: 400 })
    parsed.push(row)
  }
  if (parsed.length === 0) return respond({ written: 0, skipped: 0 })

  const uid = auth.userId
  // The singer's own rows are no longer read: the upsert below resolves them
  // by (userId, achievementId) inside SQLite. Only the definition list is
  // needed, and only to drop ids that name nothing.
  const defs = await env.DB.prepare('SELECT id FROM achievements').all<Row>()
  const known = new Set((defs.results ?? []).map((r) => String(r.id)))

  const now = new Date().toISOString()
  const stmts: D1PreparedStatement[] = []
  let skipped = 0
  for (const row of parsed) {
    if (!known.has(row.achievementId)) {
      skipped += 1
      continue
    }
    const unlockedAt = row.unlocked ? (row.unlockedAt ?? now) : null
    stmts.push(
      env.DB.prepare(
        `INSERT INTO userAchievements
           (id, createdAt, updatedAt, userId, achievementId, progress,
            unlocked, unlockedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(userId, achievementId) DO UPDATE SET
           progress   = excluded.progress,
           unlocked   = MAX(userAchievements.unlocked, excluded.unlocked),
           unlockedAt = COALESCE(userAchievements.unlockedAt,
                                 excluded.unlockedAt),
           updatedAt  = excluded.updatedAt`,
      ).bind(
        crypto.randomUUID(),
        now,
        now,
        uid,
        row.achievementId,
        row.progress,
        row.unlocked ? 1 : 0,
        unlockedAt,
      ),
    )
  }

  if (stmts.length > 0) await env.DB.batch(stmts)
  return respond({ written: stmts.length, skipped })
}

interface BulkBadge {
  badgeId: string
  earnedAt: string
}

function parseBulkBadge(v: unknown): BulkBadge | null {
  if (typeof v !== 'object' || v === null) return null
  const r = v as Record<string, unknown>
  if (typeof r.badgeId !== 'string' || r.badgeId === '') return null
  if (typeof r.earnedAt !== 'string' || r.earnedAt === '') return null
  return { badgeId: r.badgeId, earnedAt: r.earnedAt }
}

/**
 * Record every newly-earned badge for the calling user, idempotently.
 *
 * Badges used to go through the generic create route, one request each, and
 * the client did not read the responses — so a failed badge write was silent,
 * and because a failed flush re-queues its whole batch, the retry re-POSTed
 * the ones that had succeeded. With no constraint on the table that produced
 * duplicate rows for a badge you can only earn once.
 *
 * `ON CONFLICT DO NOTHING` against the unique index from migration 0015 makes
 * a retry free instead of dangerous: writing the same badge twice is a no-op,
 * so the client can re-send a batch it is unsure about without checking what
 * landed. `earnedAt` is deliberately not updated on conflict — the first time
 * they earned it is the true one.
 *
 * Ownership is structural, exactly as in {@link handleAchievementBulk}: the
 * caller sends definition ids, and the userId comes from the token.
 */
export async function handleBadgeBulk(
  request: Request,
  auth: AuthUser,
  env: Env,
  respond: Respond,
): Promise<Response> {
  let body: { rows?: unknown }
  try {
    body = await request.json<{ rows?: unknown }>()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!Array.isArray(body.rows)) {
    return respond({ error: 'Expected { rows: [] }' }, { status: 400 })
  }
  if (body.rows.length > MAX_BULK_ROWS) {
    return respond(
      { error: `Too many rows (max ${MAX_BULK_ROWS})` },
      { status: 413 },
    )
  }

  const parsed: BulkBadge[] = []
  for (const raw of body.rows) {
    const row = parseBulkBadge(raw)
    if (!row) return respond({ error: 'Malformed row' }, { status: 400 })
    parsed.push(row)
  }
  if (parsed.length === 0) return respond({ written: 0, skipped: 0 })

  const defs = await env.DB.prepare('SELECT id FROM badgeDefinitions').all<Row>()
  const known = new Set((defs.results ?? []).map((r) => String(r.id)))

  const now = new Date().toISOString()
  const stmts: D1PreparedStatement[] = []
  let skipped = 0
  for (const row of parsed) {
    if (!known.has(row.badgeId)) {
      skipped += 1
      continue
    }
    stmts.push(
      env.DB.prepare(
        `INSERT INTO userBadges
           (id, createdAt, updatedAt, userId, badgeId, earnedAt)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(userId, badgeId) DO NOTHING`,
      ).bind(crypto.randomUUID(), now, now, auth.userId, row.badgeId, row.earnedAt),
    )
  }

  if (stmts.length > 0) await env.DB.batch(stmts)
  return respond({ written: stmts.length, skipped })
}
