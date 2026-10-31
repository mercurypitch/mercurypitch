// ============================================================
// Blocks — two singers who no longer see each other
// ============================================================
//
// One row, blocker to blocked, read both ways: a block hides each singer from
// the other on the shared lists and the boards, refuses a friend request in
// either direction, and ends any friendship between them. Only the blocker
// can lift it (the phone's Settings, Blocked singers).
//
// A block hides names and never moves a place. A board ranks everyone first
// and drops the hidden rows after, so the places either side of a gap stay
// true, and the cut, the podium and every other singer's standing are the
// same as they would be without it.
//
// A registered-account feature, as friends are: an anonymous identity has no
// name on a board to protect, and it reaches the contact form instead.

import type { AuthUser, Env } from './auth'
import { isRegistered } from './registered'
import { readTargetId } from './report-rules'

type Respond = (body: object | null, init?: ResponseInit) => Response

const ACCOUNT_REQUIRED = 'Create an account to block a singer'

/** Nobody blocks more than this many singers: it bounds the list, and a
 *  block the list could not show could not be lifted. */
export const MAX_BLOCKS = 500

/** The singers hidden from this one: whom they blocked, and who blocked them. */
export async function hiddenSingers(
  db: D1Database,
  userId: string,
): Promise<Set<string>> {
  const { results } = await db
    .prepare(
      `SELECT blockedId AS id FROM userBlocks WHERE blockerId = ?1
       UNION
       SELECT blockerId AS id FROM userBlocks WHERE blockedId = ?1`,
    )
    .bind(userId)
    .all<{ id: string }>()
  return new Set((results ?? []).map((row) => row.id))
}

/** A board's rows less the singers hidden from the viewer, places kept. */
export async function withoutHidden<T extends { userId: string | null }>(
  db: D1Database,
  viewer: AuthUser | null,
  rows: T[],
): Promise<T[]> {
  if (viewer === null || rows.length === 0) return rows
  const hidden = await hiddenSingers(db, viewer.userId)
  if (hidden.size === 0) return rows
  return rows.filter((row) => row.userId === null || !hidden.has(row.userId))
}

/** Which way a block stands between two singers, from the first one's side. */
export async function blockBetween(
  db: D1Database,
  userId: string,
  otherId: string,
): Promise<'blocked-them' | 'blocked-by-them' | null> {
  const row = await db
    .prepare(
      `SELECT blockerId FROM userBlocks
       WHERE (blockerId = ?1 AND blockedId = ?2)
          OR (blockerId = ?2 AND blockedId = ?1)
       ORDER BY blockerId = ?1 DESC
       LIMIT 1`,
    )
    .bind(userId, otherId)
    .first<{ blockerId: string }>()
  if (row === null) return null
  return row.blockerId === userId ? 'blocked-them' : 'blocked-by-them'
}

/**
 * SQL keeping the shares a viewer may see that are not their own: the owner
 * is not suspended, and no block stands between the two of them. `table` is
 * the share table as the query names it.
 */
export function visibleShareSql(
  table: string,
  viewerId: string | null,
): { clause: string; binds: string[] } {
  const owner = `"${table}"."userId"`
  const notSuspended = `NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = ${owner} AND u."suspendedAt" IS NOT NULL)`
  if (viewerId === null) return { clause: notSuspended, binds: [] }
  return {
    clause: `${notSuspended} AND NOT EXISTS (
      SELECT 1 FROM "userBlocks" b
      WHERE (b."blockerId" = ? AND b."blockedId" = ${owner})
         OR (b."blockerId" = ${owner} AND b."blockedId" = ?))`,
    binds: [viewerId, viewerId],
  }
}

/** visibleShareSql for one share read by its id. */
export async function shareVisible(
  db: D1Database,
  ownerId: string,
  viewerId: string | null,
): Promise<boolean> {
  if (ownerId === viewerId) return true
  const row = await db
    .prepare(
      `SELECT
         (SELECT suspendedAt FROM users WHERE id = ?1) AS suspendedAt,
         EXISTS (
           SELECT 1 FROM userBlocks
           WHERE (blockerId = ?1 AND blockedId = ?2)
              OR (blockerId = ?2 AND blockedId = ?1)
         ) AS blocked`,
    )
    .bind(ownerId, viewerId ?? '')
    .first<{ suspendedAt: string | null; blocked: number }>()
  return row !== null && row.suspendedAt === null && row.blocked === 0
}

async function listBlocks(
  auth: AuthUser,
  env: Env,
  respond: Respond,
): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT b.blockedId AS userId,
            COALESCE(NULLIF(p.displayName, ''), 'Singer-' || substr(b.blockedId, 1, 6)) AS displayName,
            b.createdAt AS createdAt
     FROM userBlocks b
     LEFT JOIN userProfiles p ON p.id = b.blockedId
     WHERE b.blockerId = ?
     ORDER BY b.createdAt DESC
     LIMIT ?`,
  )
    .bind(auth.userId, MAX_BLOCKS)
    .all<{ userId: string; displayName: string; createdAt: string }>()
  return respond({ blocks: results ?? [] })
}

async function addBlock(
  auth: AuthUser,
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const target =
    typeof body === 'object' && body !== null
      ? readTargetId((body as { userId?: unknown }).userId)
      : null
  if (target === null) {
    return respond({ error: 'A userId is required' }, { status: 400 })
  }
  if (target === auth.userId) {
    return respond({ error: 'You can’t block yourself' }, { status: 400 })
  }
  const exists = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
    .bind(target)
    .first<{ id: string }>()
  if (exists === null) {
    return respond({ error: 'No such singer' }, { status: 404 })
  }
  const held = await env.DB.prepare(
    `SELECT COUNT(*) AS n,
            EXISTS (SELECT 1 FROM userBlocks WHERE blockerId = ?1 AND blockedId = ?2) AS already
     FROM userBlocks WHERE blockerId = ?1`,
  )
    .bind(auth.userId, target)
    .first<{ n: number; already: number }>()
  if (held !== null && held.already === 0 && held.n >= MAX_BLOCKS) {
    return respond(
      {
        error:
          'You have blocked as many singers as you can. Unblock someone first.',
      },
      { status: 409 },
    )
  }

  // The friendship goes with the block, both rows and any request between
  // them, in the same batch: a block that left a follow behind would leave
  // the Friends board showing each to the other.
  const [inserted] = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO userBlocks (blockerId, blockedId, createdAt)
       VALUES (?, ?, ?)`,
    ).bind(auth.userId, target, new Date().toISOString()),
    env.DB.prepare(
      `DELETE FROM follows
       WHERE (userId = ? AND followedUserId = ?)
          OR (userId = ? AND followedUserId = ?)`,
    ).bind(auth.userId, target, target, auth.userId),
  ])
  const added = (inserted?.meta.changes ?? 0) > 0
  return respond(
    { userId: target, blocked: true },
    { status: added ? 201 : 200 },
  )
}

async function removeBlock(
  auth: AuthUser,
  segment: string,
  env: Env,
  respond: Respond,
): Promise<Response> {
  let target: string | null
  try {
    target = readTargetId(decodeURIComponent(segment))
  } catch {
    target = null
  }
  if (target === null) {
    return respond({ error: 'A userId is required' }, { status: 400 })
  }
  // Lifting a block that is not there is a no-op, so this answers 200 either
  // way. A friendship it ended stays ended: asking again is the way back.
  await env.DB.prepare(
    'DELETE FROM userBlocks WHERE blockerId = ? AND blockedId = ?',
  )
    .bind(auth.userId, target)
    .run()
  return respond({ userId: target, blocked: false })
}

/**
 * `GET /api/blocks` lists whom the caller blocked, `POST /api/blocks` with
 * `{ userId }` blocks a singer, `DELETE /api/blocks/<userId>` lifts it. The
 * router applies the rate limit to the writes.
 */
export async function handleBlocks(
  request: Request,
  url: URL,
  auth: AuthUser | null,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  if (!(await isRegistered(auth.userId, env))) {
    return respond({ error: ACCOUNT_REQUIRED }, { status: 403 })
  }
  const segment = url.pathname.slice('/api/blocks'.length)
  if (segment === '' && request.method === 'GET') {
    return listBlocks(auth, env, respond)
  }
  if (segment === '' && request.method === 'POST') {
    return addBlock(auth, request, env, respond)
  }
  if (segment.startsWith('/') && request.method === 'DELETE') {
    return removeBlock(auth, segment.slice(1), env, respond)
  }
  return respond({ error: 'Method not allowed' }, { status: 405 })
}
