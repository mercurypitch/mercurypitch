// ── The friend graph ─────────────────────────────────────────────────
//
// A `follows` row is not a subscription, it is a mutual agreement, because of
// what it buys: the Friends leaderboard reads streak and score aggregates for
// everyone in it, including people who never opted in to the public board.
// One row used to be enough. `POST /api/follows` forced `userId` to the
// caller but took `followedUserId` on trust, so anybody could add anybody and
// then read their numbers.
//
// So a row now carries a `status`:
//
//   pending   — asked, not answered. Grants nothing.
//   accepted  — both sides agreed. Both rows exist, both say accepted.
//
// Only this module writes them (`serverManaged` on the table def keeps the
// generic CRUD route read-only), and the only path to 'accepted' is the other
// side saying yes — or handing over a friend code, which is the same yes said
// in advance.
//
// And it is a REGISTERED-account feature, on both sides of every row. An
// anonymous identity is a device id in one browser's localStorage: it cannot
// be signed back into, so the singer holding it can never answer a request,
// take one back from a second device, or be found again once that browser is
// cleared. Friend codes were already gated this way; requests and accepts
// were not, which left an anonymous singer able to send an ask nobody could
// usefully answer and to hold a friendship that would evaporate. Removing and
// declining stay open, because getting OUT of a row must never need an
// account that getting in did not.

import type { AuthUser, Env } from './auth'

type Respond = (body: object | null, init?: ResponseInit) => Response

/** Nobody needs more than this on screen, and it bounds the query. */
const MAX_REQUESTS = 100

const ACCOUNT_REQUIRED = 'Create an account to add friends'
const TARGET_ACCOUNT_REQUIRED = 'That singer hasn’t created an account yet'

// Crockford base32 minus the ambiguous glyphs (I, L, O, U) — no confusing 0/O
// or 1/I when someone reads a code aloud, and no accidental English words.
const FRIEND_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const FRIEND_CODE_LENGTH = 8

function generateFriendCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(FRIEND_CODE_LENGTH))
  let out = ''
  for (const b of bytes)
    out += FRIEND_CODE_ALPHABET[b % FRIEND_CODE_ALPHABET.length]
  return out
}

/** Accept the pretty form (`K7QM-2X4B`), lower case, and stray spaces. */
export function normalizeFriendCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase()
}

/** The friend row shown in a request list. */
export interface FriendRequestRow {
  userId: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
}

async function readTargetId(
  request: Request,
): Promise<{ userId: string } | { error: string }> {
  let body: { userId?: unknown }
  try {
    body = await request.json<{ userId?: unknown }>()
  } catch {
    return { error: 'Invalid JSON body' }
  }
  const userId = body.userId
  // Bounded because it goes into a bind parameter that is compared against
  // `users.id`; anything longer than a UUID is a client bug or a probe.
  if (typeof userId !== 'string' || userId === '' || userId.length > 128) {
    return { error: 'A userId is required' }
  }
  return { userId }
}

/** True when this account is a real one, not a lazily provisioned device id. */
async function isRegistered(userId: string, env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT authProvider FROM users WHERE id = ?',
  )
    .bind(userId)
    .first<{ authProvider: string }>()
  return row != null && row.authProvider !== 'anonymous'
}

/**
 * The 403 that gates every friend route except removing: a refusal when the
 * caller is still anonymous, null when they may proceed.
 *
 * Returning the response rather than throwing keeps each handler's happy path
 * flat, and keeps the refusal worded identically everywhere — an anonymous
 * singer told one thing by the code endpoint and another by the request
 * endpoint would reasonably conclude one of them is broken.
 */
async function accountRequired(
  auth: AuthUser,
  env: Env,
  respond: Respond,
): Promise<Response | null> {
  if (await isRegistered(auth.userId, env)) return null
  return respond({ error: ACCOUNT_REQUIRED }, { status: 403 })
}

/**
 * The caller's friend code, minted on first request. Registered accounts
 * only: an anonymous identity disappears with a cleared browser, and a dead
 * entry in someone else's friend list is worse than no entry.
 */
export async function handleFriendCode(
  auth: AuthUser | null,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  const denied = await accountRequired(auth, env, respond)
  if (denied) return denied

  const existing = await env.DB.prepare(
    'SELECT friendCode FROM userProfiles WHERE id = ?',
  )
    .bind(auth.userId)
    .first<{ friendCode: string | null }>()
  if (existing?.friendCode) return respond({ code: existing.friendCode })

  // Retry on the (vanishingly unlikely) collision rather than trusting one draw.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateFriendCode()
    try {
      const res = await env.DB.prepare(
        'UPDATE userProfiles SET friendCode = ?, updatedAt = ? WHERE id = ? AND friendCode IS NULL',
      )
        .bind(code, new Date().toISOString(), auth.userId)
        .run()
      if (res.meta.changes > 0) return respond({ code })
      // Someone else minted ours concurrently — re-read and return that.
      const now = await env.DB.prepare(
        'SELECT friendCode FROM userProfiles WHERE id = ?',
      )
        .bind(auth.userId)
        .first<{ friendCode: string | null }>()
      if (now?.friendCode) return respond({ code: now.friendCode })
    } catch {
      // UNIQUE violation — the code was taken, draw another.
    }
  }
  return respond(
    { error: 'Could not allocate a code, try again' },
    { status: 503 },
  )
}

/**
 * Link two accounts, both directions, both accepted.
 *
 * Used by the redeem path and by an accept. `ON CONFLICT` rather than
 * `WHERE NOT EXISTS` because the row that is already there is usually the
 * pending request being answered, and leaving it pending would mean the
 * friendship half-existed.
 */
function linkStatements(
  env: Env,
  a: string,
  b: string,
  now: string,
): D1PreparedStatement[] {
  const upsert = (from: string, to: string): D1PreparedStatement =>
    env.DB.prepare(
      `INSERT INTO follows (id, createdAt, updatedAt, userId, followedUserId, status)
       VALUES (?, ?, ?, ?, ?, 'accepted')
       ON CONFLICT(userId, followedUserId)
       DO UPDATE SET status = 'accepted', updatedAt = excluded.updatedAt`,
    ).bind(crypto.randomUUID(), now, now, from, to)
  return [upsert(a, b), upsert(b, a)]
}

/**
 * Redeem someone's code. Sharing a code IS the consent, so this links both
 * directions immediately — asking the owner of the code to also approve a
 * request would be asking them to agree twice. Both parties must be
 * registered.
 */
export async function handleFriendRedeem(
  auth: AuthUser | null,
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })

  let body: { code?: string }
  try {
    body = await request.json<{ code?: string }>()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const code = normalizeFriendCode(body.code ?? '')
  if (code.length !== FRIEND_CODE_LENGTH) {
    return respond({ error: 'That code doesn’t look right' }, { status: 400 })
  }

  const denied = await accountRequired(auth, env, respond)
  if (denied) return denied

  // The owner of a code is registered by construction — minting one requires
  // an account, and no account ever goes back to anonymous — so the caller is
  // the only side this has to check.
  const target = await env.DB.prepare(
    'SELECT id, displayName FROM userProfiles WHERE friendCode = ?',
  )
    .bind(code)
    .first<{ id: string; displayName: string }>()
  // Same message for "no such code" and "that's you" would be confusing; but
  // an unknown code must not reveal whether it merely belongs to nobody yet.
  if (!target)
    return respond({ error: 'No one found for that code' }, { status: 404 })
  if (target.id === auth.userId) {
    return respond({ error: 'That’s your own code' }, { status: 400 })
  }

  const now = new Date().toISOString()
  await env.DB.batch(linkStatements(env, auth.userId, target.id, now))

  return respond({
    ok: true,
    userId: target.id,
    displayName: target.displayName,
    status: 'accepted',
  })
}

/**
 * Ask to be someone's friend.
 *
 * Creates one pending row and nothing else — a pending row is readable by its
 * author and grants no access to the other person's numbers. The one case
 * that resolves immediately is a crossed request: if they already asked you,
 * both of you have now said yes and there is nothing left to decide.
 *
 * Both sides must hold a real account. The target's is checked because an
 * anonymous singer has no way to answer: accepting is gated the same way, so
 * a request addressed to one would sit pending forever while telling the
 * asker it had been sent.
 */
export async function handleFriendRequest(
  auth: AuthUser | null,
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  const denied = await accountRequired(auth, env, respond)
  if (denied) return denied

  const parsed = await readTargetId(request)
  if ('error' in parsed)
    return respond({ error: parsed.error }, { status: 400 })
  const target = parsed.userId
  if (target === auth.userId) {
    return respond({ error: 'You can’t friend yourself' }, { status: 400 })
  }

  // One read answers both questions. `authProvider` rather than `id`: a
  // second query for the same row is a second chance for the two answers to
  // disagree if the target upgrades in between.
  const exists = await env.DB.prepare(
    'SELECT authProvider FROM users WHERE id = ?',
  )
    .bind(target)
    .first<{ authProvider: string }>()
  if (!exists) return respond({ error: 'No such singer' }, { status: 404 })
  if (exists.authProvider === 'anonymous') {
    return respond({ error: TARGET_ACCOUNT_REQUIRED }, { status: 403 })
  }

  const now = new Date().toISOString()

  // They asked first. Two yeses is a friendship, not a queue.
  const reverse = await env.DB.prepare(
    'SELECT status FROM follows WHERE userId = ? AND followedUserId = ?',
  )
    .bind(target, auth.userId)
    .first<{ status: string }>()
  if (reverse) {
    await env.DB.batch(linkStatements(env, auth.userId, target, now))
    return respond({ status: 'accepted' }, { status: 200 })
  }

  const mine = await env.DB.prepare(
    'SELECT status FROM follows WHERE userId = ? AND followedUserId = ?',
  )
    .bind(auth.userId, target)
    .first<{ status: string }>()
  // Asking twice is not an error — the answer is the state you are already in.
  if (mine) return respond({ status: mine.status }, { status: 200 })

  await env.DB.prepare(
    `INSERT INTO follows (id, createdAt, updatedAt, userId, followedUserId, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
  )
    .bind(crypto.randomUUID(), now, now, auth.userId, target)
    .run()

  return respond({ status: 'pending' }, { status: 201 })
}

/**
 * Say yes to a request.
 *
 * Only the person who was asked can call this, and only while a pending row
 * addressed to them exists — which is what makes 'accepted' unreachable by
 * anyone acting alone.
 *
 * The requester is re-checked here, not merely at ask time: rows predating
 * the account rule can still name an anonymous asker, and accepting one would
 * mint exactly the friendship this change exists to stop. Declining it works
 * as it always did — `remove` is deliberately not gated.
 */
export async function handleFriendAccept(
  auth: AuthUser | null,
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  const denied = await accountRequired(auth, env, respond)
  if (denied) return denied

  const parsed = await readTargetId(request)
  if ('error' in parsed)
    return respond({ error: parsed.error }, { status: 400 })
  const requester = parsed.userId

  const incoming = await env.DB.prepare(
    'SELECT status FROM follows WHERE userId = ? AND followedUserId = ?',
  )
    .bind(requester, auth.userId)
    .first<{ status: string }>()
  if (!incoming) {
    return respond({ error: 'No request from that singer' }, { status: 404 })
  }
  if (!(await isRegistered(requester, env))) {
    return respond({ error: TARGET_ACCOUNT_REQUIRED }, { status: 403 })
  }

  await env.DB.batch(
    linkStatements(env, auth.userId, requester, new Date().toISOString()),
  )
  return respond({ status: 'accepted' })
}

/**
 * Say no, or take back a yes.
 *
 * Both directions go, always. A friendship that survives on one side would
 * leave the person who ended it still visible to the person they removed,
 * which is the opposite of what pressing the button means.
 *
 * The one write with no account gate. Anything already in the table predates
 * the rule, and an anonymous singer holding such a row must be able to end it
 * — requiring an account to leave a friendship you did not need one to enter
 * would trap the very people the rule is meant to protect. Deleting a row
 * that was never there is a no-op, so this stays a 200 either way.
 */
export async function handleFriendRemove(
  auth: AuthUser | null,
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await readTargetId(request)
  if ('error' in parsed)
    return respond({ error: parsed.error }, { status: 400 })
  const other = parsed.userId

  await env.DB.prepare(
    `DELETE FROM follows
     WHERE (userId = ? AND followedUserId = ?)
        OR (userId = ? AND followedUserId = ?)`,
  )
    .bind(auth.userId, other, other, auth.userId)
    .run()

  return respond({ ok: true })
}

/**
 * Pending requests in both directions.
 *
 * Incoming rows are the point: they are addressed to the caller but owned by
 * somebody else, so the generic per-user list (which only ever returns rows
 * where `userId` is yours) cannot show them.
 *
 * Gated like the writes it feeds. An anonymous singer cannot answer anything
 * this would list, and rendering Accept next to a name only to refuse the
 * press is worse than not offering it.
 */
export async function handleFriendRequests(
  auth: AuthUser | null,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
  const denied = await accountRequired(auth, env, respond)
  if (denied) return denied

  const [incoming, outgoing] = await env.DB.batch<FriendRequestRow>([
    env.DB.prepare(
      `SELECT f."userId" AS userId, f."createdAt" AS createdAt,
              COALESCE(p."displayName", 'Singer-' || substr(f."userId", 1, 6)) AS displayName,
              p."avatarUrl" AS avatarUrl
       FROM follows f LEFT JOIN userProfiles p ON p."id" = f."userId"
       WHERE f."followedUserId" = ? AND f."status" = 'pending'
       ORDER BY f."createdAt" DESC LIMIT ${MAX_REQUESTS}`,
    ).bind(auth.userId),
    env.DB.prepare(
      `SELECT f."followedUserId" AS userId, f."createdAt" AS createdAt,
              COALESCE(p."displayName", 'Singer-' || substr(f."followedUserId", 1, 6)) AS displayName,
              p."avatarUrl" AS avatarUrl
       FROM follows f LEFT JOIN userProfiles p ON p."id" = f."followedUserId"
       WHERE f."userId" = ? AND f."status" = 'pending'
       ORDER BY f."createdAt" DESC LIMIT ${MAX_REQUESTS}`,
    ).bind(auth.userId),
  ])

  return respond({ incoming: incoming.results, outgoing: outgoing.results })
}
