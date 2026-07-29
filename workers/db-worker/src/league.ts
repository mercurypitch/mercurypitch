// ── Weekly league runtime: points awards + the weekly cut ────────────
// D1 glue around the two pure modules:
//   league-points.ts — how many points an action earns (unit-tested)
//   league-cut.ts    — who promotes/relegates at week's end (unit-tested)
//
// Server-authoritative by construction: awards fire inside the worker's own
// write paths (sessionRecords insert, userProfiles streak bump), never from a
// client-callable "give me points" endpoint. Leagues are a REGISTERED-users
// surface — every award and the /api/league/me read check authProvider.
//
// Awards must never break the write they piggyback on: every entry point
// catches and logs instead of throwing.

import type { Env } from './auth'
import type { CutMember, CutRung } from './league-cut'
import { computeCohortCut } from './league-cut'
import type { LeaguePointsConfig, LeaguePointsSource } from './league-points'
import { DEFAULT_LEAGUE_POINTS_CONFIG, goalMetBonus, pointsForAction, streakMilestoneBonus, } from './league-points'

// ── Week math (Monday 00:00 UTC, mirrors index.ts weekStartIso) ─────

export function isoWeekStart(nowMs: number = Date.now()): string {
  const now = new Date(nowMs)
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  monday.setUTCDate(monday.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  return monday.toISOString()
}

// ── Config / eligibility ─────────────────────────────────────────────

/** The tunable weights row, falling back to the compiled defaults. */
async function loadPointsConfig(env: Env): Promise<LeaguePointsConfig> {
  try {
    const row = await env.DB.prepare(
      `SELECT exerciseBase, challengeBase, weeklyBase, scoreDivisor,
              dailyVarietyBonus, goalMetBonus, streakMilestoneBonus, milestoneEvery
       FROM leaguePointsConfig WHERE id = 'default'`,
    ).first<LeaguePointsConfig>()
    return row ?? DEFAULT_LEAGUE_POINTS_CONFIG
  } catch {
    return DEFAULT_LEAGUE_POINTS_CONFIG
  }
}

/** Leagues are registered-accounts-only; anonymous identities earn nothing. */
async function isRegistered(env: Env, userId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT authProvider FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<{ authProvider: string }>()
  return row != null && row.authProvider !== 'anonymous'
}

/** The rung a user sits on (their profile's currentLeagueId, 'l1' fallback). */
async function userLeagueId(env: Env, userId: string): Promise<string> {
  const row = await env.DB.prepare(
    'SELECT currentLeagueId FROM userProfiles WHERE id = ?',
  )
    .bind(userId)
    .first<{ currentLeagueId: string | null }>()
  return row?.currentLeagueId ?? 'l1'
}

// ── Membership plumbing ──────────────────────────────────────────────

/**
 * Get-or-create this week's cohort for a league and the user's membership in
 * it. Cohorts are minted lazily on first award (one global cohort per
 * league/week at launch); UNIQUE constraints make both inserts race-safe.
 */
async function ensureMembership(
  env: Env,
  userId: string,
  leagueId: string,
  weekStart: string,
): Promise<string> {
  const now = new Date().toISOString()
  await env.DB.prepare(
    `INSERT OR IGNORE INTO leagueCohorts (id, createdAt, leagueId, weekStart)
     VALUES (?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), now, leagueId, weekStart)
    .run()
  const cohort = (await env.DB.prepare(
    'SELECT id FROM leagueCohorts WHERE leagueId = ? AND weekStart = ?',
  )
    .bind(leagueId, weekStart)
    .first<{ id: string }>()) as { id: string }

  await env.DB.prepare(
    `INSERT OR IGNORE INTO leagueMembership (id, updatedAt, userId, cohortId, weekStart, points)
     VALUES (?, ?, ?, ?, ?, 0)`,
  )
    .bind(crypto.randomUUID(), now, userId, cohort.id, weekStart)
    .run()
  return cohort.id
}

/** Credit points to this week's membership and append the audit event. */
async function credit(
  env: Env,
  userId: string,
  source: string,
  points: number,
): Promise<void> {
  if (points <= 0) return
  const weekStart = isoWeekStart()
  const leagueId = await userLeagueId(env, userId)
  await ensureMembership(env, userId, leagueId, weekStart)
  const now = new Date().toISOString()
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE leagueMembership SET points = points + ?, updatedAt = ?
       WHERE userId = ? AND weekStart = ?`,
    ).bind(points, now, userId, weekStart),
    env.DB.prepare(
      `INSERT INTO leaguePointEvents (id, createdAt, userId, weekStart, source, points)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), now, userId, weekStart, source, points),
  ])
}

/** True when an award of `source` was already recorded today (UTC). */
async function awardedToday(
  env: Env,
  userId: string,
  source: string,
): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10)
  const row = await env.DB.prepare(
    `SELECT 1 AS x FROM leaguePointEvents
     WHERE userId = ? AND source = ? AND createdAt LIKE ? LIMIT 1`,
  )
    .bind(userId, source, `${day}%`)
    .first<{ x: number }>()
  return row != null
}

// ── Award entry points (called from the worker's write paths) ────────

/**
 * Points for a freshly inserted sessionRecords row. 'practice' earns 0 by
 * design; the daily-variety bonus goes to the first completion of a given
 * exercise (same melodyName) today, decided against rows the server itself
 * wrote — the just-inserted row is excluded by id.
 */
export async function awardForSessionRecord(
  env: Env,
  userId: string,
  record: {
    id: string
    source?: string | null
    score?: number | null
    melodyName?: string | null
  },
): Promise<void> {
  try {
    const source = (record.source ?? 'practice') as LeaguePointsSource
    if (source === 'practice') return
    if (!(await isRegistered(env, userId))) return

    let firstOfDayForExercise = false
    if (source === 'exercise' && record.melodyName) {
      const day = new Date().toISOString().slice(0, 10)
      const prior = await env.DB.prepare(
        `SELECT 1 AS x FROM sessionRecords
         WHERE userId = ? AND source = 'exercise' AND melodyName = ?
           AND createdAt LIKE ? AND id != ? LIMIT 1`,
      )
        .bind(userId, record.melodyName, `${day}%`, record.id)
        .first<{ x: number }>()
      firstOfDayForExercise = prior == null
    }

    const config = await loadPointsConfig(env)
    const points = pointsForAction(
      { source, score: record.score ?? 0, firstOfDayForExercise },
      config,
    )
    await credit(env, userId, source, points)
  } catch (err) {
    console.error('[league] session award failed (non-fatal):', err)
  }
}

/**
 * Streak bonuses, fired when a profile update raises currentStreak — the
 * "streaks drive the league" lever. The trigger is a client-initiated profile
 * write, so both bonuses are capped server-side at once per UTC day via the
 * append-only event log, which bounds what a scripted client could farm.
 */
export async function awardStreakBonuses(
  env: Env,
  userId: string,
  prevStreak: number,
  nextStreak: number,
): Promise<void> {
  try {
    if (!(nextStreak > prevStreak)) return
    if (!(await isRegistered(env, userId))) return
    const config = await loadPointsConfig(env)

    if (!(await awardedToday(env, userId, 'goal-met'))) {
      await credit(env, userId, 'goal-met', goalMetBonus(config))
    }

    const milestone = streakMilestoneBonus(nextStreak, config)
    if (milestone > 0 && !(await awardedToday(env, userId, 'streak-milestone'))) {
      await credit(env, userId, 'streak-milestone', milestone)
    }
  } catch (err) {
    console.error('[league] streak award failed (non-fatal):', err)
  }
}

// ── The weekly cut (cron) ────────────────────────────────────────────

interface LeagueRow {
  id: string
  rank: number
  isMystery: number
  promoteCount: number
  relegateCount: number
}

/**
 * Apply promotions/relegations for every finished week exactly once.
 *
 * The 6-hourly cron calls this on each tick; leagueMeta.lastCutWeekStart is
 * the idempotency marker — once it equals the current week, later ticks
 * no-op. Users move rungs via userProfiles.currentLeagueId; next week's
 * cohorts are minted lazily by the first award, already placed by the moved
 * rung. Members with zero points sort last, so they relegate first and can
 * never promote (enforced in computeCohortCut).
 */
export async function runWeeklyLeagueCut(env: Env): Promise<void> {
  try {
    const cur = isoWeekStart()
    const meta = await env.DB.prepare(
      "SELECT lastCutWeekStart FROM leagueMeta WHERE id = 'default'",
    ).first<{ lastCutWeekStart: string | null }>()
    const lastCut = meta?.lastCutWeekStart ?? null
    if (lastCut === cur) return

    const { results: leagueRows } = await env.DB.prepare(
      'SELECT id, rank, isMystery, promoteCount, relegateCount FROM leagues ORDER BY rank',
    ).all<LeagueRow>()
    const ladder = leagueRows ?? []
    const rungByLeague = new Map<string, CutRung>()
    for (let i = 0; i < ladder.length; i++) {
      const up = ladder[i + 1]
      const down = ladder[i - 1]
      rungByLeague.set(ladder[i].id, {
        promoteCount: ladder[i].promoteCount,
        relegateCount: ladder[i].relegateCount,
        // A locked (mystery) rung is not a promotion target.
        upLeagueId: up != null && !up.isMystery ? up.id : null,
        downLeagueId: down != null ? down.id : null,
      })
    }

    // Every finished week not yet cut (realistically just last week).
    const { results: weeks } = await env.DB.prepare(
      `SELECT DISTINCT weekStart FROM leagueMembership
       WHERE weekStart < ? ${lastCut != null ? 'AND weekStart > ?' : ''}
       ORDER BY weekStart`,
    )
      .bind(...(lastCut != null ? [cur, lastCut] : [cur]))
      .all<{ weekStart: string }>()

    const now = new Date().toISOString()
    for (const { weekStart } of weeks ?? []) {
      const { results: members } = await env.DB.prepare(
        `SELECT c.leagueId AS leagueId, m.userId AS userId, m.points AS points
         FROM leagueMembership m JOIN leagueCohorts c ON c.id = m.cohortId
         WHERE m.weekStart = ?`,
      )
        .bind(weekStart)
        .all<{ leagueId: string; userId: string; points: number }>()

      const byLeague = new Map<string, CutMember[]>()
      for (const r of members ?? []) {
        const list = byLeague.get(r.leagueId) ?? []
        list.push({ userId: r.userId, points: r.points })
        byLeague.set(r.leagueId, list)
      }

      const updates: D1PreparedStatement[] = []
      for (const [leagueId, cohortMembers] of byLeague) {
        const rung = rungByLeague.get(leagueId)
        if (!rung) continue
        for (const move of computeCohortCut(cohortMembers, rung)) {
          updates.push(
            env.DB.prepare(
              'UPDATE userProfiles SET currentLeagueId = ?, updatedAt = ? WHERE id = ?',
            ).bind(move.toLeagueId, now, move.userId),
          )
        }
      }
      if (updates.length > 0) await env.DB.batch(updates)
    }

    await env.DB.prepare(
      "UPDATE leagueMeta SET lastCutWeekStart = ?, updatedAt = ? WHERE id = 'default'",
    )
      .bind(cur, now)
      .run()
  } catch (err) {
    console.error('[league] weekly cut failed (non-fatal):', err)
  }
}

// ── /api/league/me ───────────────────────────────────────────────────

export interface LeagueMe {
  eligible: boolean
  /**
   * Why the caller is not playing, when they aren't:
   *  'anonymous'   — registered accounts only (the product rule)
   *  'unavailable' — the league tables aren't in this database yet (an
   *                  environment that predates migration 0005). Distinct so
   *                  the UI never tells a signed-in user to sign up.
   */
  reason?: 'anonymous' | 'unavailable'
  weekStart?: string
  league?: {
    id: string
    rank: number
    name: string
    trophyAsset: string | null
    isMystery: boolean
    promoteCount: number
    relegateCount: number
  }
  points?: number
  rank?: number | null
  cohortSize?: number
  standings?: Array<{
    userId: string
    displayName: string
    points: number
    rank: number
  }>
}

/**
 * Everything the League view needs.
 *
 * Never throws: an environment whose database predates migration 0005 has no
 * league tables, and a 500 there would make the client fall back to the
 * anonymous copy — telling a signed-in user to create an account. Report
 * {eligible:false, reason:'unavailable'} instead.
 */
export async function getLeagueMe(env: Env, userId: string): Promise<LeagueMe> {
  try {
    return await readLeagueMe(env, userId)
  } catch (err) {
    console.error('[league] /me unavailable (missing tables?):', err)
    return { eligible: false, reason: 'unavailable' }
  }
}

async function readLeagueMe(env: Env, userId: string): Promise<LeagueMe> {
  if (!(await isRegistered(env, userId))) {
    return { eligible: false, reason: 'anonymous' }
  }

  const weekStart = isoWeekStart()
  const leagueId = await userLeagueId(env, userId)
  const league = await env.DB.prepare(
    `SELECT id, rank, name, trophyAsset, isMystery, promoteCount, relegateCount
     FROM leagues WHERE id = ?`,
  )
    .bind(leagueId)
    .first<LeagueRow & { name: string; trophyAsset: string | null }>()

  const cohort = await env.DB.prepare(
    'SELECT id FROM leagueCohorts WHERE leagueId = ? AND weekStart = ?',
  )
    .bind(leagueId, weekStart)
    .first<{ id: string }>()

  let standings: LeagueMe['standings'] = []
  let myPoints = 0
  let myRank: number | null = null
  if (cohort) {
    const { results } = await env.DB.prepare(
      `SELECT m.userId AS userId, m.points AS points,
              COALESCE(p.displayName, 'Singer-' || substr(m.userId, 1, 6)) AS displayName
       FROM leagueMembership m LEFT JOIN userProfiles p ON p.id = m.userId
       WHERE m.cohortId = ?
       ORDER BY m.points DESC, m.userId ASC`,
    )
      .bind(cohort.id)
      .all<{ userId: string; points: number; displayName: string }>()
    const rows = results ?? []
    standings = rows.map((r, i) => ({
      userId: r.userId,
      displayName: r.displayName,
      points: r.points,
      rank: i + 1,
    }))
    const mine = standings.find((s) => s.userId === userId)
    myPoints = mine?.points ?? 0
    myRank = mine?.rank ?? null
  }

  return {
    eligible: true,
    weekStart,
    league: league
      ? {
          id: league.id,
          rank: league.rank,
          name: league.name,
          trophyAsset: league.trophyAsset,
          isMystery: !!league.isMystery,
          promoteCount: league.promoteCount,
          relegateCount: league.relegateCount,
        }
      : undefined,
    points: myPoints,
    rank: myRank,
    cohortSize: standings.length,
    standings: standings.slice(0, 50),
  }
}
