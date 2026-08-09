// ============================================================
// Score Visibility — reversible leaderboard and weekly score controls
// ============================================================
//
// These controls change publication, not practice history. The account-wide
// override wins over a singer's own leaderboard preference; a weekly marker
// hides every attempt by one user for one active challenge. Both transitions
// are atomic, idempotent, and append an audit event only when state changes.

import type { Env } from './auth'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WEEKLY_CHALLENGE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/
const MIN_REASON_LENGTH = 8
const MAX_REASON_LENGTH = 280
const ASCII_CONTROL_RE = /[\x00-\x1f\x7f]/

type Respond = (body: object | null, init?: ResponseInit) => Response

interface ScoreVisibilityBody {
  userId?: unknown
  scope?: unknown
  weeklyChallengeId?: unknown
  excluded?: unknown
  reason?: unknown
}

interface LeaderboardStateRow {
  excludedAt: string | null
  currentReason: string | null
}

interface WeeklyStateRow {
  userExists: number
  challengeStatus: string | null
  excludedAt: string | null
  currentReason: string | null
}

interface ValidatedFields {
  userId: string
  excluded: boolean
  reason: string
}

type ValidatedBody =
  | (ValidatedFields & {
      scope: 'leaderboard'
      weeklyChallengeId: null
    })
  | (ValidatedFields & {
      scope: 'weekly-challenge'
      weeklyChallengeId: string
    })

async function readBody(request: Request): Promise<ScoreVisibilityBody | null> {
  try {
    return await request.json<ScoreVisibilityBody>()
  } catch {
    return null
  }
}

function validateBody(
  body: ScoreVisibilityBody,
  respond: Respond,
): ValidatedBody | Response {
  if (typeof body.userId !== 'string' || !UUID_RE.test(body.userId)) {
    return respond({ error: 'Valid userId required' }, { status: 400 })
  }
  if (body.scope !== 'leaderboard' && body.scope !== 'weekly-challenge') {
    return respond(
      { error: 'scope must be leaderboard or weekly-challenge' },
      { status: 400 },
    )
  }
  if (typeof body.excluded !== 'boolean') {
    return respond({ error: 'excluded must be a boolean' }, { status: 400 })
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (
    reason.length < MIN_REASON_LENGTH ||
    reason.length > MAX_REASON_LENGTH ||
    ASCII_CONTROL_RE.test(reason)
  ) {
    return respond(
      {
        error:
          `reason must be ${MIN_REASON_LENGTH}-${MAX_REASON_LENGTH} characters ` +
          'without control characters',
      },
      { status: 400 },
    )
  }

  if (body.scope === 'weekly-challenge') {
    if (
      typeof body.weeklyChallengeId !== 'string' ||
      !WEEKLY_CHALLENGE_ID_RE.test(body.weeklyChallengeId)
    ) {
      return respond(
        { error: 'Valid weeklyChallengeId required' },
        { status: 400 },
      )
    }
    return {
      userId: body.userId,
      scope: body.scope,
      weeklyChallengeId: body.weeklyChallengeId,
      excluded: body.excluded,
      reason,
    }
  }
  if (
    body.weeklyChallengeId !== undefined &&
    body.weeklyChallengeId !== null &&
    body.weeklyChallengeId !== ''
  ) {
    return respond(
      { error: 'weeklyChallengeId is only valid for weekly-challenge scope' },
      { status: 400 },
    )
  }

  return {
    userId: body.userId,
    scope: 'leaderboard',
    weeklyChallengeId: null,
    excluded: body.excluded,
    reason,
  }
}

async function readLeaderboardState(
  env: Env,
  userId: string,
): Promise<LeaderboardStateRow | null> {
  return env.DB.prepare(
    `SELECT leaderboardExcludedAt AS excludedAt,
            leaderboardExclusionReason AS currentReason
       FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<LeaderboardStateRow>()
}

async function readWeeklyState(
  env: Env,
  userId: string,
  weeklyChallengeId: string,
): Promise<WeeklyStateRow> {
  return (
    (await env.DB.prepare(
      `SELECT EXISTS(SELECT 1 FROM users WHERE id = ?) AS userExists,
              (SELECT status FROM weeklyChallenges WHERE id = ?) AS challengeStatus,
              (SELECT retractedAt FROM weeklyChallengeScoreRetractions
                WHERE weeklyChallengeId = ? AND userId = ?) AS excludedAt,
              (SELECT reason FROM weeklyChallengeScoreRetractions
                WHERE weeklyChallengeId = ? AND userId = ?) AS currentReason`,
    )
      .bind(
        userId,
        weeklyChallengeId,
        weeklyChallengeId,
        userId,
        weeklyChallengeId,
        userId,
      )
      .first<WeeklyStateRow>()) ?? {
      userExists: 0,
      challengeStatus: null,
      excludedAt: null,
      currentReason: null,
    }
  )
}

function publicState(
  input: ValidatedBody,
  state: { excludedAt: string | null; currentReason: string | null },
  changed: boolean,
): object {
  return {
    ok: true,
    userId: input.userId,
    scope: input.scope,
    weeklyChallengeId: input.weeklyChallengeId,
    excluded: state.excludedAt !== null,
    excludedAt: state.excludedAt,
    currentReason: state.currentReason,
    changed,
  }
}

async function changeLeaderboardVisibility(
  input: Extract<ValidatedBody, { scope: 'leaderboard' }>,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const before = await readLeaderboardState(env, input.userId)
  if (before === null) {
    return respond({ error: 'User not found' }, { status: 404 })
  }
  if ((before.excludedAt !== null) === input.excluded) {
    return respond(publicState(input, before, false))
  }

  const now = new Date().toISOString()
  const action = input.excluded ? 'exclude' : 'restore'
  const statePredicate = input.excluded
    ? 'leaderboardExcludedAt IS NULL'
    : 'leaderboardExcludedAt IS NOT NULL'
  const audit = env.DB.prepare(
    `INSERT INTO scoreVisibilityEvents
       (id, createdAt, userId, scope, weeklyChallengeId, action, reason)
     SELECT ?, ?, ?, 'leaderboard', NULL, ?, ?
       FROM users WHERE id = ? AND ${statePredicate}`,
  ).bind(
    crypto.randomUUID(),
    now,
    input.userId,
    action,
    input.reason,
    input.userId,
  )
  const update = input.excluded
    ? env.DB.prepare(
        `UPDATE users
            SET leaderboardExcludedAt = ?, leaderboardExclusionReason = ?,
                updatedAt = ?
          WHERE id = ? AND leaderboardExcludedAt IS NULL`,
      ).bind(now, input.reason, now, input.userId)
    : env.DB.prepare(
        `UPDATE users
            SET leaderboardExcludedAt = NULL,
                leaderboardExclusionReason = NULL, updatedAt = ?
          WHERE id = ? AND leaderboardExcludedAt IS NOT NULL`,
      ).bind(now, input.userId)

  const results = await env.DB.batch([audit, update])
  const after = await readLeaderboardState(env, input.userId)
  if (after === null) {
    return respond({ error: 'User not found' }, { status: 404 })
  }
  return respond(
    publicState(input, after, (results[1]?.meta.changes ?? 0) === 1),
  )
}

function weeklyStateError(
  state: WeeklyStateRow,
  respond: Respond,
): Response | null {
  if (state.userExists !== 1) {
    return respond({ error: 'User not found' }, { status: 404 })
  }
  if (state.challengeStatus === null) {
    return respond({ error: 'Weekly challenge not found' }, { status: 404 })
  }
  if (state.challengeStatus !== 'active') {
    return respond(
      { error: 'Only an active weekly challenge can be changed' },
      { status: 409 },
    )
  }
  return null
}

async function changeWeeklyVisibility(
  input: Extract<ValidatedBody, { scope: 'weekly-challenge' }>,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const weeklyChallengeId = input.weeklyChallengeId
  const before = await readWeeklyState(env, input.userId, weeklyChallengeId)
  const beforeError = weeklyStateError(before, respond)
  if (beforeError !== null) return beforeError
  if ((before.excludedAt !== null) === input.excluded) {
    return respond(publicState(input, before, false))
  }

  const now = new Date().toISOString()
  const action = input.excluded ? 'retract' : 'restore'
  const audit = input.excluded
    ? env.DB.prepare(
        `INSERT INTO scoreVisibilityEvents
           (id, createdAt, userId, scope, weeklyChallengeId, action, reason)
         SELECT ?, ?, ?, 'weekly-challenge', ?, ?, ?
           FROM users u JOIN weeklyChallenges w ON w.id = ?
          WHERE u.id = ? AND w.status = 'active'
            AND NOT EXISTS (
              SELECT 1 FROM weeklyChallengeScoreRetractions r
               WHERE r.weeklyChallengeId = ? AND r.userId = ?
            )`,
      ).bind(
        crypto.randomUUID(),
        now,
        input.userId,
        weeklyChallengeId,
        action,
        input.reason,
        weeklyChallengeId,
        input.userId,
        weeklyChallengeId,
        input.userId,
      )
    : env.DB.prepare(
        `INSERT INTO scoreVisibilityEvents
           (id, createdAt, userId, scope, weeklyChallengeId, action, reason)
         SELECT ?, ?, ?, 'weekly-challenge', ?, ?, ?
           FROM weeklyChallengeScoreRetractions r
           JOIN weeklyChallenges w ON w.id = r.weeklyChallengeId
          WHERE r.weeklyChallengeId = ? AND r.userId = ?
            AND w.status = 'active'`,
      ).bind(
        crypto.randomUUID(),
        now,
        input.userId,
        weeklyChallengeId,
        action,
        input.reason,
        weeklyChallengeId,
        input.userId,
      )
  const update = input.excluded
    ? env.DB.prepare(
        `INSERT INTO weeklyChallengeScoreRetractions
           (weeklyChallengeId, userId, retractedAt, reason)
         SELECT w.id, u.id, ?, ?
           FROM weeklyChallenges w JOIN users u ON u.id = ?
          WHERE w.id = ? AND w.status = 'active'
            AND NOT EXISTS (
              SELECT 1 FROM weeklyChallengeScoreRetractions r
               WHERE r.weeklyChallengeId = w.id AND r.userId = u.id
            )`,
      ).bind(now, input.reason, input.userId, weeklyChallengeId)
    : env.DB.prepare(
        `DELETE FROM weeklyChallengeScoreRetractions
          WHERE weeklyChallengeId = ? AND userId = ?
            AND EXISTS (
              SELECT 1 FROM weeklyChallenges w
               WHERE w.id = ? AND w.status = 'active'
            )`,
      ).bind(weeklyChallengeId, input.userId, weeklyChallengeId)

  const results = await env.DB.batch([audit, update])
  const after = await readWeeklyState(env, input.userId, weeklyChallengeId)
  const afterError = weeklyStateError(after, respond)
  if (afterError !== null) return afterError
  return respond(
    publicState(input, after, (results[1]?.meta.changes ?? 0) === 1),
  )
}

/** POST /api/admin/score-visibility — publish, exclude, retract, or restore. */
export async function handleScoreVisibility(
  request: Request,
  env: Env,
  respond: Respond,
  admin: boolean,
): Promise<Response> {
  if (!admin) {
    return respond({ error: 'Admin key required' }, { status: 403 })
  }
  if (request.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }

  const body = await readBody(request)
  if (body === null) {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const validated = validateBody(body, respond)
  if (validated instanceof Response) return validated
  return validated.scope === 'leaderboard'
    ? changeLeaderboardVisibility(validated, env, respond)
    : changeWeeklyVisibility(validated, env, respond)
}
