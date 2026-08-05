// ============================================================
// Account Moderation — reversible suspension and audit logging
// ============================================================
//
// Suspending increments tokenVersion exactly once. Restoring never rewinds it,
// so no previously issued JWT can come back to life.

import type { Env } from './auth'

export const ACCOUNT_SUSPENDED_CODE = 'account_suspended'
export const ACCOUNT_SUSPENDED_MESSAGE = 'This account is suspended.'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIN_REASON_LENGTH = 8
const MAX_REASON_LENGTH = 280
const ASCII_CONTROL_RE = /[\x00-\x1f\x7f]/

type Respond = (body: object | null, init?: ResponseInit) => Response

interface SuspensionRow {
  suspendedAt: string | null
  suspensionReason: string | null
}

interface SuspensionBody {
  userId?: unknown
  suspended?: unknown
  reason?: unknown
}

export class AccountSuspendedError extends Error {
  readonly code = ACCOUNT_SUSPENDED_CODE

  constructor() {
    super(ACCOUNT_SUSPENDED_MESSAGE)
    this.name = 'AccountSuspendedError'
  }
}

export function assertAccountActive(row: {
  suspendedAt: string | null
}): void {
  if (row.suspendedAt !== null) throw new AccountSuspendedError()
}

export function accountSuspendedResponse(respond: Respond): Response {
  return respond(
    {
      error: ACCOUNT_SUSPENDED_MESSAGE,
      code: ACCOUNT_SUSPENDED_CODE,
    },
    { status: 403 },
  )
}

function publicState(
  userId: string,
  row: SuspensionRow,
  changed: boolean,
): object {
  return {
    ok: true,
    userId,
    suspended: row.suspendedAt !== null,
    suspendedAt: row.suspendedAt,
    suspensionReason: row.suspensionReason,
    changed,
  }
}

async function readBody(request: Request): Promise<SuspensionBody | null> {
  try {
    return await request.json<SuspensionBody>()
  } catch {
    return null
  }
}

async function readState(
  env: Env,
  userId: string,
): Promise<SuspensionRow | null> {
  return env.DB.prepare(
    'SELECT suspendedAt, suspensionReason FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<SuspensionRow>()
}

/** POST /api/admin/user-suspension — suspend or restore one account. */
export async function handleUserSuspension(
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
  if (typeof body.userId !== 'string' || !UUID_RE.test(body.userId)) {
    return respond({ error: 'Valid userId required' }, { status: 400 })
  }
  if (typeof body.suspended !== 'boolean') {
    return respond({ error: 'suspended must be a boolean' }, { status: 400 })
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

  const userId = body.userId
  const before = await readState(env, userId)
  if (before === null) {
    return respond({ error: 'User not found' }, { status: 404 })
  }
  if ((before.suspendedAt !== null) === body.suspended) {
    return respond(publicState(userId, before, false))
  }

  const now = new Date().toISOString()
  const action = body.suspended ? 'suspend' : 'restore'
  const statePredicate = body.suspended
    ? 'suspendedAt IS NULL'
    : 'suspendedAt IS NOT NULL'
  const audit = env.DB.prepare(
    `INSERT INTO userModerationEvents (id, createdAt, userId, action, reason)
     SELECT ?, ?, ?, ?, ? FROM users WHERE id = ? AND ${statePredicate}`,
  ).bind(crypto.randomUUID(), now, userId, action, reason, userId)
  const update = body.suspended
    ? env.DB.prepare(
        `UPDATE users
            SET suspendedAt = ?, suspensionReason = ?, updatedAt = ?,
                tokenVersion = tokenVersion + 1
          WHERE id = ? AND suspendedAt IS NULL`,
      ).bind(now, reason, now, userId)
    : env.DB.prepare(
        `UPDATE users
            SET suspendedAt = NULL, suspensionReason = NULL, updatedAt = ?
          WHERE id = ? AND suspendedAt IS NOT NULL`,
      ).bind(now, userId)

  const results = await env.DB.batch([audit, update])
  const after = await readState(env, userId)
  if (after === null) {
    return respond({ error: 'User not found' }, { status: 404 })
  }
  return respond(
    publicState(userId, after, (results[1]?.meta.changes ?? 0) === 1),
  )
}
