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
  const [defs, mine] = await env.DB.batch<Row>([
    env.DB.prepare('SELECT id FROM achievements'),
    env.DB.prepare(
      'SELECT id, achievementId FROM userAchievements WHERE userId = ?',
    ).bind(uid),
  ])
  const known = new Set((defs.results ?? []).map((r) => String(r.id)))
  const existing = new Map(
    (mine.results ?? []).map((r) => [String(r.achievementId), String(r.id)]),
  )

  const now = new Date().toISOString()
  const stmts: D1PreparedStatement[] = []
  let skipped = 0
  for (const row of parsed) {
    if (!known.has(row.achievementId)) {
      skipped += 1
      continue
    }
    const unlockedAt = row.unlocked ? (row.unlockedAt ?? now) : null
    const id = existing.get(row.achievementId)
    if (id !== undefined) {
      stmts.push(
        env.DB.prepare(
          `UPDATE userAchievements
             SET progress = ?, unlocked = ?, unlockedAt = ?, updatedAt = ?
           WHERE id = ? AND userId = ?`,
        ).bind(row.progress, row.unlocked ? 1 : 0, unlockedAt, now, id, uid),
      )
    } else {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO userAchievements
             (id, createdAt, updatedAt, userId, achievementId, progress,
              unlocked, unlockedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
  }

  if (stmts.length > 0) await env.DB.batch(stmts)
  return respond({ written: stmts.length, skipped })
}
