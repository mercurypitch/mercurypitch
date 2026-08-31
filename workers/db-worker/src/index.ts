// ── MercuryPitch DB Worker ───────────────────────────────────────────
// Generic CRUD REST API over Cloudflare D1, matching the contract of
// the frontend ServerAdapter (src/db/adapters/server-adapter.ts):
//
//   GET    /api/:entity            — findAll (where[k], orderBy, orderDir, limit, offset)
//   GET    /api/:entity/count      — count (where[k])
//   GET    /api/:entity/:id        — findById
//   POST   /api/:entity            — create
//   PATCH  /api/:entity/:id        — update
//   DELETE /api/:entity/:id        — delete
//
// Plus auth routes (see auth.ts): /api/auth/{anonymous,register,login,google,me}
//
// Entities are validated against the TABLES allowlist; per-table access
// rules force userId scoping from the JWT, never from the request body.

import { FUNNEL_EVENT_NAMES } from '../../../src/lib/funnel-event-catalog'
import { resolveAdmin, resolveAdminWithIdentity } from './access'
import type { AuthUser, Env } from './auth'
import { checkRateLimit, getAuth, handleAuth, rateLimitSubject, timingSafeEqual, TOKEN_TTL_SECONDS, } from './auth'
import { sweepExpiredSessions } from './auth-sessions'
import { handleBilling, reconcileBilling } from './billing'
import type { DemoSongRow } from './demo-song'
import { DEMO_SONG_FIELDS, demoSongValues, nextLyricsRevision, normalizeDemoSlug, publicDemoSong, } from './demo-song'
import { handleFriendAccept, handleFriendCode, handleFriendRedeem, handleFriendRemove, handleFriendRequest, handleFriendRequests, } from './friends'
import { handleAchievementBulk, handleBadgeBulk, handleGrantContext, } from './grants'
import { handleGuidedExerciseRequest } from './guided-exercises'
import { awardForSessionRecord, awardStreakBonuses, getLeagueMe, runWeeklyLeagueCut, } from './league'
import { AccountSuspendedError, accountSuspendedResponse, handleUserSuspension, } from './moderation'
import { getPerksForUser } from './perks'
import { handlePremiumBackgroundAdminRequest } from './premium-background-admin'
import { handlePremiumBackgroundRequest } from './premium-backgrounds'
import { handleScoreVisibility } from './score-visibility'
import { resolveSupporterFeatureAccess } from './supporter-feature-access'
import type { TableDef } from './tables'
import { blockedForAnonymous, fromSql, maskPublicRow, TABLES } from './tables'
import { ManagedTestAccountInactiveError, managedTestAccountErrorResponse, } from './testing-account-state'
import { handleTestingAccountRequest } from './testing-accounts'
import { validateWrite } from './validation'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods':
    'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
  // Spec quirk: a `*` wildcard does NOT cover the Authorization header
  // (Firefox already warns it will block it) — list everything we use.
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, If-None-Match, Range, X-Admin-Key, X-Jam-Background-Capability, X-Jam-Room-Id, X-Testing-Provision-Key',
  'Access-Control-Expose-Headers':
    'Accept-Ranges, Content-Length, Content-Range, ETag',
}

/**
 * Browser-origin allowlist (see Env.ALLOWED_ORIGINS). Requests without an
 * Origin header always pass — that covers curl/scripts, service-to-service
 * calls (billing X-Service-Key), Stripe webhooks, and top-level navigations
 * (Google OAuth callback). Browsers always attach Origin to cross-origin
 * fetch/XHR/sendBeacon, so a locally served build can never reach a
 * deployed environment that doesn't list localhost.
 *
 * Rule syntax (comma-separated):
 *   - an exact origin       → matches that origin verbatim
 *   - `localhost`           → matches http(s)://localhost | 127.0.0.1 (any port)
 *   - a `*.suffix` wildcard → matches any origin whose HOSTNAME ends with
 *     `.suffix`. Used on DEV to allow per-PR versioned preview Workers
 *     (`<version>-mercurypitch-preview.<subdomain>.workers.dev`), whose
 *     hostnames aren't known ahead of time. Never used on prod.
 */
function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin')
  if (origin === null) return true
  const allowed = env.ALLOWED_ORIGINS
  if (allowed === undefined || allowed === '') return true

  let host: string | null = null
  try {
    host = new URL(origin).hostname
  } catch {
    host = null
  }

  return allowed.split(',').some((entry) => {
    const rule = entry.trim()
    if (rule === '') return false
    if (rule === origin) return true
    if (rule === 'localhost') {
      return host === 'localhost' || host === '127.0.0.1'
    }
    // `*.workers.dev` → suffix-match the hostname (e.g. per-PR preview URLs).
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(1) // ".workers.dev"
      return host !== null && host.endsWith(suffix)
    }
    return false
  })
}

function respond(body: object | null, init?: ResponseInit): Response {
  const headers = {
    ...CORS,
    'Cache-Control': 'private, max-age=0, must-revalidate',
    ...(init?.headers as Record<string, string>),
  }
  const status = init?.status ?? 200
  if (body === null) return new Response(null, { ...init, headers, status })
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...headers },
    status,
  })
}

function respondNoStore(body: object | null, init?: ResponseInit): Response {
  return respond(body, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string>),
      'Cache-Control': 'private, no-store',
    },
  })
}

/** The 429 every rate-limited route returns, written once. */
function rateLimited(rl: { retryAfter?: number }): Response {
  const after = rl.retryAfter ?? 60
  return respond(
    { error: `Too many requests. Retry after ${after} seconds.` },
    { status: 429, headers: { 'Retry-After': String(after) } },
  )
}

/**
 * Ceiling on a generic CRUD write body.
 *
 * The request-count limiter bounds how OFTEN a caller writes but says nothing
 * about how BIG each write is, so 120 requests a minute could still be
 * hundreds of megabytes parsed into a Worker's memory and pushed at D1. The
 * largest legitimate payload here is a session's per-note `results` array —
 * tens of KB for a long song — so 256 KiB leaves an order of magnitude of
 * headroom while making the unbounded case impossible.
 */
const MAX_WRITE_BYTES = 256 * 1024

/**
 * Parse a CRUD write body with that ceiling enforced BEFORE the bytes are
 * buffered as JSON. Content-Length is checked first because it lets an
 * oversized request be refused without reading it at all; the actual byte
 * length is checked too, since chunked and HTTP/2 requests may omit the
 * header. Returns a Response to send on failure, or the parsed row.
 */
async function readWriteBody(
  request: Request,
): Promise<{ body: Row } | { error: Response }> {
  const declared = Number(request.headers.get('Content-Length') ?? '0')
  if (declared > MAX_WRITE_BYTES) {
    return { error: respond({ error: 'Payload too large' }, { status: 413 }) }
  }
  let raw: string
  try {
    raw = await request.text()
  } catch {
    return { error: respond({ error: 'Invalid JSON body' }, { status: 400 }) }
  }
  if (raw.length > MAX_WRITE_BYTES) {
    return { error: respond({ error: 'Payload too large' }, { status: 413 }) }
  }
  try {
    return { body: JSON.parse(raw) as Row }
  } catch {
    return { error: respond({ error: 'Invalid JSON body' }, { status: 400 }) }
  }
}

// ── Value & identifier handling ──────────────────────────────────────

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

type SqlValue = string | number | null

/** Coerce query-string values to SQLite-comparable types. */
function coerceQueryValue(v: string): SqlValue {
  if (v === 'true') return 1
  if (v === 'false') return 0
  if (v === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(v) && v.length < 16) return Number(v)
  return v
}

/** Convert a JSON body value to what D1 can bind. */
function toSql(v: unknown): SqlValue {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'number' || typeof v === 'string') return v
  return JSON.stringify(v)
}

type Row = Record<string, unknown>

// ── Query parsing ────────────────────────────────────────────────────

interface ListQuery {
  filters: Array<[string, SqlValue]>
  orderBy?: string
  orderDir: 'ASC' | 'DESC'
  limit: number
  offset?: number
}

/** Rows returned when no explicit limit is given — a missing `limit`
 *  must never mean "the whole table" (public tables, anonymous reads). */
const DEFAULT_LIST_LIMIT = 100
/** Hard ceiling for explicit limits. */
const MAX_LIST_LIMIT = 1000

function parseListQuery(url: URL): ListQuery | null {
  const filters: Array<[string, SqlValue]> = []
  for (const [k, v] of url.searchParams) {
    const m = k.match(/^where\[(\w+)\]$/)
    if (m) {
      if (!IDENT.test(m[1])) return null
      filters.push([m[1], coerceQueryValue(v)])
    }
  }
  const orderBy = url.searchParams.get('orderBy') ?? undefined
  if (orderBy !== undefined && !IDENT.test(orderBy)) return null
  const limitRaw = url.searchParams.get('limit')
  const offsetRaw = url.searchParams.get('offset')
  const requested = limitRaw ? Number(limitRaw) : NaN
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(requested, MAX_LIST_LIMIT)
      : DEFAULT_LIST_LIMIT
  return {
    filters,
    orderBy,
    orderDir: url.searchParams.get('orderDir') === 'desc' ? 'DESC' : 'ASC',
    limit,
    offset: offsetRaw ? Number(offsetRaw) : undefined,
  }
}

// ── Access control helpers ───────────────────────────────────────────

function hasAdminKey(request: Request, env: Env): boolean {
  const key = request.headers.get('X-Admin-Key')
  return !!key && !!env.ADMIN_KEY && timingSafeEqual(key, env.ADMIN_KEY)
}

/**
 * Who may write admin-owned rows. The policy itself lives in
 * `resolveAdmin` (access.ts), which is where the two-stage Access
 * rollout is explained and tested.
 *
 * Async because verification fetches (and caches) the team's signing
 * keys. Every caller is already in an async handler.
 */
async function isAdmin(request: Request, env: Env): Promise<boolean> {
  return resolveAdmin(request, env, hasAdminKey(request, env))
}

/**
 * Apply read scoping for list/count. Returns extra SQL or an error
 * response. Mutates q.filters for 'user' tables.
 */
function scopeRead(
  def: TableDef,
  q: ListQuery,
  auth: AuthUser | null,
): { clause?: string; binds?: SqlValue[] } | Response {
  switch (def.access) {
    case 'user': {
      if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
      q.filters = q.filters.filter(([col]) => col !== 'userId')
      q.filters.push(['userId', auth.userId])
      return {}
    }
    case 'shared': {
      if (auth)
        return {
          clause: '("isPublic" = 1 OR "userId" = ?)',
          binds: [auth.userId],
        }
      return { clause: '"isPublic" = 1', binds: [] }
    }
    default:
      return {} // admin / public-user / owner: public reads
  }
}

/** What a singer without an account is told when they try to publish. */
const ACCOUNT_REQUIRED =
  'Create an account to post to the Community — sharing a link works without one'

/** Check whether an existing row may be written by this requester. */
function canWriteRow(
  def: TableDef,
  row: Row,
  auth: AuthUser | null,
  admin: boolean,
): boolean {
  switch (def.access) {
    case 'admin':
      return admin
    case 'owner':
      return !!auth && row.id === auth.userId
    default:
      return !!auth && row.userId === auth.userId
  }
}

/**
 * The first column in `columns` this requester may not read, or null.
 *
 * Two policies, one question. `privateCols` names the few columns that must
 * not leave an otherwise-public table; `publicCols` names the only ones that
 * may, on a table where everything else is the subject's own business.
 * Filtering or ordering by any of them turns the mask into a query oracle:
 * `?where[id]=<victim>&where[leaderboardOptIn]=1` answers a consent question
 * the response was projected to hide, and `?where[friendCode]=<candidate>` is
 * a membership test against a linking credential.
 *
 * `access: 'user'` is exempt on purpose, and it has to be said out loud rather
 * than left to the fact that no such table declares publicCols today: those
 * reads are pinned to the caller's own rows by `scopeRead`, so a filter there
 * can only reveal something about the caller. Without this clause, the day one
 * of them gains a publicCols list is the day people stop being able to search
 * their own history.
 *
 * Admins see whole rows, so nothing is hidden from them to probe.
 */
function hiddenReadColumn(
  def: TableDef,
  admin: boolean,
  columns: readonly string[],
): string | null {
  if (admin || def.access === 'user') return null
  for (const col of columns) {
    if (def.privateCols?.includes(col) === true) return col
    if (def.publicCols !== undefined && !def.publicCols.includes(col)) {
      return col
    }
  }
  return null
}

// ── CRUD handlers ────────────────────────────────────────────────────

async function handleList(
  entity: string,
  def: TableDef,
  url: URL,
  auth: AuthUser | null,
  env: Env,
  countOnly: boolean,
  admin = false,
): Promise<Response> {
  const q = parseListQuery(url)
  if (!q) return respond({ error: 'Invalid query' }, { status: 400 })

  const scope = scopeRead(def, q, auth)
  if (scope instanceof Response) return scope

  // A filter is a read, and so is a sort. `maskPublicRow` keeps hidden columns
  // out of the response, but nothing stopped a caller filtering or ordering ON
  // one — and a filter that changes whether a row comes back answers the same
  // question the mask refused, one bit at a time. An `orderBy` is the same
  // oracle with a binary search attached: paginate a sort on a hidden column
  // and you recover its value without ever reading it.
  //
  // Rejecting rather than ignoring. Silently dropping a filter would widen the
  // result set and still look like the query succeeded, which is worse than an
  // error — the caller acts on rows it did not ask for.
  //
  // Asked twice so the refusal names what the caller actually did: a client
  // debugging `Cannot filter on "currentStreak"` against a request carrying no
  // filter at all has been sent looking in the wrong place.
  const hiddenFilter = hiddenReadColumn(
    def,
    admin,
    q.filters.map(([col]) => col),
  )
  if (hiddenFilter !== null) {
    return respond(
      { error: `Cannot filter on "${hiddenFilter}"` },
      { status: 400 },
    )
  }
  const hiddenSort =
    q.orderBy === undefined ? null : hiddenReadColumn(def, admin, [q.orderBy])
  if (hiddenSort !== null) {
    return respond({ error: `Cannot sort by "${hiddenSort}"` }, { status: 400 })
  }

  const clauses: string[] = []
  const binds: SqlValue[] = []
  if (scope.clause) {
    clauses.push(scope.clause)
    binds.push(...(scope.binds ?? []))
  }
  for (const [col, val] of q.filters) {
    if (val === null) {
      clauses.push(`"${col}" IS NULL`)
    } else {
      clauses.push(`"${col}" = ?`)
      binds.push(val)
    }
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''

  if (countOnly) {
    const result = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM "${entity}"${where}`,
    )
      .bind(...binds)
      .first<{ count: number }>()
    return respond({ count: result?.count ?? 0 })
  }

  let sql = `SELECT * FROM "${entity}"${where}`
  if (q.orderBy) sql += ` ORDER BY "${q.orderBy}" ${q.orderDir}`
  sql += ' LIMIT ?'
  binds.push(q.limit)
  if (q.offset !== undefined) {
    sql += ' OFFSET ?'
    binds.push(q.offset)
  }

  const { results } = await env.DB.prepare(sql)
    .bind(...binds)
    .all<Row>()
  return respond(
    results.map((r) =>
      maskPublicRow(def, fromSql(def, r), auth?.userId ?? null, admin),
    ) as unknown as object,
  )
}

async function fetchRow(
  entity: string,
  id: string,
  env: Env,
): Promise<Row | null> {
  return env.DB.prepare(`SELECT * FROM "${entity}" WHERE id = ?`)
    .bind(id)
    .first<Row>()
}

async function handleGetById(
  entity: string,
  def: TableDef,
  id: string,
  auth: AuthUser | null,
  env: Env,
  admin = false,
): Promise<Response> {
  const row = await fetchRow(entity, id, env)
  if (!row) return respond({ error: 'Not found' }, { status: 404 })

  if (def.access === 'user' && (!auth || row.userId !== auth.userId)) {
    return respond({ error: 'Not found' }, { status: 404 })
  }
  if (
    def.access === 'shared' &&
    !row.isPublic &&
    (!auth || row.userId !== auth.userId)
  ) {
    return respond({ error: 'Not found' }, { status: 404 })
  }
  return respond(
    maskPublicRow(def, fromSql(def, row), auth?.userId ?? null, admin),
  )
}

/**
 * `longestStreak` is a high-water mark. Make that true here, because here is
 * the one place every client write to a profile passes through.
 *
 * It was never true before. The streak columns are not `serverCols` — the
 * streak rules (freezes, repairs, local midnights) belong to the client and
 * the server stores the result — so a profile PATCH could raise
 * `currentStreak` and leave `longestStreak` behind. That is precisely what
 * the client did before f2a5ccc, and 0030_streak_high_water.sql repairs the
 * 60 production rows it left. Repairing them is pointless while the door
 * that let them through is still open, so: this closes the door, and it
 * ships BEFORE the migration runs.
 *
 * Only ever raises, and never from a stored value that is already higher —
 * a client sending a smaller record cannot talk one down.
 *
 * No admin exemption, and the reason is worth writing down because the
 * obvious one does not survive contact with `canWriteRow`: profiles are
 * `access: 'owner'`, which grants writes to the row's own user and to
 * nobody else, admin key or not. So an exemption here could only ever fire
 * for somebody editing their own profile while also holding the admin key —
 * a combination nothing does. Correcting a wrong-high record is an operator
 * job, and the operator path is direct SQL through `wrangler d1 execute`,
 * which does not come through this function at all. That keeps the rule
 * absolute for every route that exists.
 */
function clampStreakHighWater(body: Row, stored: Row | null): void {
  if (body.currentStreak === undefined && body.longestStreak === undefined) {
    return
  }
  // `validateWrite` has already refused anything that is not a whole
  // non-negative number, so anything unusable here is an absent column.
  const days = (v: unknown): number => (typeof v === 'number' ? v : 0)
  body.longestStreak = Math.max(
    body.currentStreak === undefined
      ? days(stored?.currentStreak)
      : days(body.currentStreak),
    days(body.longestStreak),
    days(stored?.longestStreak),
  )
}

async function handleCreate(
  entity: string,
  def: TableDef,
  request: Request,
  auth: AuthUser | null,
  env: Env,
): Promise<Response> {
  if (def.access === 'admin') {
    if (!(await isAdmin(request, env)))
      return respond({ error: 'Admin key required' }, { status: 403 })
  } else if (!auth) {
    return respond({ error: 'Unauthorized' }, { status: 401 })
  }
  if (blockedForAnonymous(def, auth)) {
    return respond({ error: ACCOUNT_REQUIRED }, { status: 403 })
  }

  const parsed = await readWriteBody(request)
  if ('error' in parsed) return parsed.error
  const body = parsed.body

  const createErr = validateWrite(entity, body)
  if (createErr) return respond({ error: createErr }, { status: 400 })

  const now = new Date().toISOString()
  delete body.id
  delete body.createdAt
  delete body.updatedAt
  for (const col of def.serverCols ?? []) delete body[col]
  // No stored row yet, so this is only "a profile may not be born violating
  // the invariant" — but a create carrying a streak is a real write, and
  // leaving it out would be a hole the size of one POST.
  if (entity === 'userProfiles') clampStreakHighWater(body, null)
  if (auth && def.access !== 'admin' && def.access !== 'owner') {
    body.userId = auth.userId
  }

  // userProfiles: the row id IS the user id
  const id =
    def.access === 'owner' ? (auth as AuthUser).userId : crypto.randomUUID()
  if (def.access === 'owner' && (await fetchRow(entity, id, env))) {
    return respond({ error: 'Profile already exists' }, { status: 409 })
  }

  const cols: string[] = ['id', 'createdAt', 'updatedAt']
  const binds: SqlValue[] = [id, now, now]
  for (const [col, val] of Object.entries(body)) {
    if (val === undefined) continue
    if (!IDENT.test(col))
      return respond({ error: `Invalid column: ${col}` }, { status: 400 })
    cols.push(col)
    binds.push(toSql(val))
  }

  const placeholders = cols.map(() => '?').join(', ')
  const quoted = cols.map((c) => `"${c}"`).join(', ')
  try {
    await env.DB.prepare(
      `INSERT INTO "${entity}" (${quoted}) VALUES (${placeholders})`,
    )
      .bind(...binds)
      .run()
  } catch (err) {
    console.error('[create] insert failed', entity, err)
    return respond({ error: 'Could not create record' }, { status: 400 })
  }

  const row = (await fetchRow(entity, id, env)) as Row

  // A saved practice attempt is the league's points source (server-side, so
  // the award can't be called directly by a client). Never blocks the save.
  if (entity === 'sessionRecords' && auth) {
    await awardForSessionRecord(env, auth.userId, {
      id,
      source: row.source as string | null,
      score: row.score as number | null,
      melodyName: row.melodyName as string | null,
    })
  }

  return respond(fromSql(def, row), { status: 201 })
}

async function handleUpdate(
  entity: string,
  def: TableDef,
  id: string,
  request: Request,
  auth: AuthUser | null,
  env: Env,
): Promise<Response> {
  const row = await fetchRow(entity, id, env)
  if (!row) return respond({ error: 'Not found' }, { status: 404 })
  if (!canWriteRow(def, row, auth, await isAdmin(request, env))) {
    return respond({ error: 'Forbidden' }, { status: 403 })
  }
  // Rows that predate the rule stay editable by their owner in every way
  // except this one: an anonymous singer can delete an old post, not
  // re-word one that is still listed.
  if (blockedForAnonymous(def, auth)) {
    return respond({ error: ACCOUNT_REQUIRED }, { status: 403 })
  }

  const parsed = await readWriteBody(request)
  if ('error' in parsed) return parsed.error
  const body = parsed.body

  const updateErr = validateWrite(entity, body)
  if (updateErr) return respond({ error: updateErr }, { status: 400 })

  delete body.id
  delete body.createdAt
  delete body.updatedAt
  delete body.userId // ownership is immutable
  for (const col of def.serverCols ?? []) delete body[col]
  if (entity === 'userProfiles') clampStreakHighWater(body, row)

  const sets: string[] = ['"updatedAt" = ?']
  const binds: SqlValue[] = [new Date().toISOString()]
  for (const [col, val] of Object.entries(body)) {
    if (val === undefined) continue
    if (!IDENT.test(col))
      return respond({ error: `Invalid column: ${col}` }, { status: 400 })
    sets.push(`"${col}" = ?`)
    binds.push(toSql(val))
  }
  binds.push(id)

  try {
    await env.DB.prepare(
      `UPDATE "${entity}" SET ${sets.join(', ')} WHERE id = ?`,
    )
      .bind(...binds)
      .run()
  } catch (err) {
    console.error('[update] update failed', entity, err)
    return respond({ error: 'Could not update record' }, { status: 400 })
  }

  const updated = (await fetchRow(entity, id, env)) as Row

  // The streak lives on the profile; a raise is the league's "showed up
  // today" signal. Both bonuses are deduped server-side to once per UTC day
  // (see awardStreakBonuses), which bounds a scripted client.
  if (entity === 'userProfiles' && auth) {
    const prev = Number(row.currentStreak ?? 0)
    const next = Number(updated.currentStreak ?? 0)
    if (next > prev) await awardStreakBonuses(env, auth.userId, prev, next)
  }

  return respond(fromSql(def, updated))
}

async function handleDelete(
  entity: string,
  def: TableDef,
  id: string,
  request: Request,
  auth: AuthUser | null,
  env: Env,
): Promise<Response> {
  const row = await fetchRow(entity, id, env)
  if (!row) return respond({ error: 'Not found' }, { status: 404 })
  if (!canWriteRow(def, row, auth, await isAdmin(request, env))) {
    return respond({ error: 'Forbidden' }, { status: 403 })
  }
  await env.DB.prepare(`DELETE FROM "${entity}" WHERE id = ?`).bind(id).run()
  return respond(null, { status: 204 })
}

// ── Leaderboard view (server-DERIVED ranking) ────────────────────────
//
// GET /api/leaderboard?category=&period=&view=&limit=&offset=
//   category: overall | best-score | accuracy | streak | sessions
//   period:   all-time | weekly   (weekly = sessions ended this ISO week)
//   view:     global | friends    (friends needs auth: follows + self)
//
// The leaderboard is DERIVED from sessionRecords (singing practice) and is no
// longer a client-writable table, so scores/streaks cannot be forged: the
// worker aggregates per user (avg/max/count) and computes the consecutive-day
// streak in JS from distinct practice days. Returns { entries, total }.

const LEADERBOARD_CATEGORIES = new Set([
  'overall',
  'best-score',
  'accuracy',
  'streak',
  'sessions',
])

/** ISO-week start (Monday 00:00 UTC) for "weekly" filtering. */
function weekStartIso(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sunday
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7))
  return monday.toISOString()
}

// The streak shown here is userProfiles.currentStreak — the same number the
// app shows its owner. It used to be re-derived from distinct sessionRecords
// days, which already disagreed with the profile (the real streak counts days
// that met the ~5-minute practice goal, and forgives gaps via freezes), and
// restricting the board to eligible sources would have widened the gap: a
// friend's board entry could read "3 day streak" while their own app said 11.

interface AggRow {
  userId: string
  displayName: string
  avatarUrl: string | null
  score: number
  bestScore: number
  accuracy: number
  totalSessions: number
  /** Profile's live streak — the same number its owner sees on Home. */
  streak: number
  /** Profile's best-ever streak — the sticky half of the publication gate. */
  longestStreak: number
}

// ── Leaderboard configuration ────────────────────────────────────────
//
// Read from the DB so sources and thresholds are tunable against real numbers
// without a deploy (same reasoning as pricingPlans). The defaults below are
// what a fresh/absent row means, and they are the conservative choice: fixed
// tasks only, opt-in required.

interface LeaderboardConfig {
  eligibleSources: string[]
  minStreakDays: number
  minSessions: number
  requireOptIn: boolean
}

const DEFAULT_LEADERBOARD_CONFIG: LeaderboardConfig = {
  eligibleSources: ['challenge', 'weekly', 'exercise'],
  minStreakDays: 3,
  minSessions: 1,
  requireOptIn: true,
}

async function loadLeaderboardConfig(env: Env): Promise<LeaderboardConfig> {
  try {
    const row = await env.DB.prepare(
      'SELECT eligibleSources, minStreakDays, minSessions, requireOptIn FROM leaderboardConfig WHERE id = ?',
    )
      .bind('default')
      .first<{
        eligibleSources: string
        minStreakDays: number
        minSessions: number
        requireOptIn: number
      }>()
    if (!row) return DEFAULT_LEADERBOARD_CONFIG

    // A malformed or empty source list would silently rank everything or
    // nothing; fall back rather than let bad config change who is published.
    let sources: unknown = null
    try {
      sources = JSON.parse(row.eligibleSources)
    } catch {
      sources = null
    }
    const eligibleSources =
      Array.isArray(sources) &&
      sources.every((s) => typeof s === 'string') &&
      sources.length > 0
        ? (sources as string[])
        : DEFAULT_LEADERBOARD_CONFIG.eligibleSources

    return {
      eligibleSources,
      minStreakDays: Number(row.minStreakDays) || 0,
      minSessions: Number(row.minSessions) || 0,
      requireOptIn: !!row.requireOptIn,
    }
  } catch {
    // Table missing (pre-migration) — the defaults are the intended policy.
    return DEFAULT_LEADERBOARD_CONFIG
  }
}

async function handleLeaderboard(
  url: URL,
  auth: AuthUser | null,
  env: Env,
): Promise<Response> {
  const category = url.searchParams.get('category') ?? 'overall'
  if (!LEADERBOARD_CATEGORIES.has(category)) {
    return respond({ error: 'Unknown category' }, { status: 400 })
  }
  const period = url.searchParams.get('period') ?? 'all-time'
  if (period !== 'all-time' && period !== 'weekly') {
    return respond({ error: 'Unknown period' }, { status: 400 })
  }
  const view = url.searchParams.get('view') ?? 'global'
  if (view !== 'global' && view !== 'friends') {
    return respond({ error: 'Unknown view' }, { status: 400 })
  }
  if (view === 'friends' && !auth) {
    return respond({ error: 'Unauthorized' }, { status: 401 })
  }
  // Streak measures showing up, not skill, and it is derived from every
  // practice day. Among friends that's a fine thing to compare; on a public
  // board it publishes a behavioural record nobody asked to share.
  if (category === 'streak' && view !== 'friends') {
    return respond(
      { error: 'Streaks rank among friends only' },
      { status: 400 },
    )
  }

  const config = await loadLeaderboardConfig(env)
  const limitRaw = Number(url.searchParams.get('limit'))
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, MAX_LIST_LIMIT)
      : 25
  const offsetRaw = Number(url.searchParams.get('offset'))
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0

  // Shared filters on sessionRecords.
  const clauses: string[] = []
  const binds: SqlValue[] = []
  // Only fixed tasks rank. Averaging scores over self-chosen melodies of
  // self-chosen difficulty compares nothing — someone repeating one easy
  // melody would outrank someone working through hard material.
  clauses.push(
    `s."source" IN (${config.eligibleSources.map(() => '?').join(', ')})`,
  )
  binds.push(...config.eligibleSources)
  if (period === 'weekly') {
    clauses.push('s."endedAt" >= ?')
    binds.push(weekStartIso())
  }
  if (view === 'friends') {
    // `status = 'accepted'` is the consent check. Without it a lone follow row
    // — which anyone could once create for anyone — was enough to read a
    // singer's streak and score aggregates, including a singer who had never
    // opted in to the public board. See friends.ts.
    clauses.push(
      `(s."userId" = ? OR s."userId" IN (
         SELECT "followedUserId" FROM "follows"
         WHERE "userId" = ? AND "status" = 'accepted'))`,
    )
    binds.push((auth as AuthUser).userId, (auth as AuthUser).userId)
  } else if (config.requireOptIn) {
    // The public board carries only people who qualified AND said yes. Your
    // own row is exempt so you can always see where you'd stand.
    clauses.push(
      '(s."userId" = ? OR s."userId" IN (SELECT "id" FROM "userProfiles" WHERE "leaderboardOptIn" = 1))',
    )
    binds.push(auth?.userId ?? '')
  }
  clauses.push(
    's."userId" IN (SELECT "id" FROM "users" WHERE "suspendedAt" IS NULL AND "leaderboardExcludedAt" IS NULL)',
  )
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''

  // Per-user aggregates; displayName/avatar from the public profile.
  const { results: aggRows } = await env.DB.prepare(
    `SELECT s."userId" AS userId,
            COALESCE(p."displayName", 'Singer-' || substr(s."userId", 1, 6)) AS displayName,
            p."avatarUrl" AS avatarUrl,
            AVG(s."score") AS score,
            MAX(s."score") AS bestScore,
            AVG(s."accuracy") AS accuracy,
            COUNT(*) AS totalSessions,
            COALESCE(p."currentStreak", 0) AS streak,
            COALESCE(p."longestStreak", 0) AS longestStreak
     FROM "sessionRecords" s
     LEFT JOIN "userProfiles" p ON p."id" = s."userId"${where}
     GROUP BY s."userId"`,
  )
    .bind(...binds)
    .all<AggRow>()

  // The 'streak' category is labelled "Longest Streak" in the app, and it
  // ranks on longestStreak to match — ranking on the CURRENT streak made the
  // board look mis-sorted the moment anyone's record outlived their run.
  // Safe for privacy: this handler already 400s on streak + global view, and
  // the projection below zeroes strangers' streaks on the global board.
  const rankValue = (row: {
    score: number
    bestScore: number
    accuracy: number
    totalSessions: number
    longestStreak: number
  }): number => {
    switch (category) {
      case 'best-score':
        return row.bestScore
      case 'accuracy':
        return row.accuracy
      case 'streak':
        return row.longestStreak
      case 'sessions':
        return row.totalSessions
      default:
        return row.score
    }
  }

  // Load all users' aggregates, then rank + paginate in memory. Fine at the
  // current scale; revisit with a materialized table if the user base grows.
  const selfId = auth?.userId ?? ''
  const ranked = aggRows
    // Thresholds apply to the public board only: among friends you asked to
    // see each other, and a brand-new friend showing 0 is the point. Your own
    // row always survives so you can see your standing before you qualify.
    //
    // The streak gate reads longestStreak, not the current one: qualifying is
    // something you earn once. Gating on the current streak would drop a
    // strong player off the board the week they take a break, and re-publish
    // them without asking when they came back. It runs on the raw aggregate,
    // before the payload projection below hides streaks from strangers.
    .filter(
      (r) =>
        view === 'friends' ||
        r.userId === selfId ||
        (r.totalSessions >= config.minSessions &&
          r.longestStreak >= config.minStreakDays),
    )
    .map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      score: Math.round(r.score),
      bestScore: Math.round(r.bestScore),
      accuracy: Math.round(r.accuracy),
      totalSessions: r.totalSessions,
      // Streaks are a behavioural record. The handler already refuses to
      // RANK on them outside the friends view; the payload must follow the
      // same rule, or the public board publishes what the sort key hides.
      // Your own row keeps them so your standing card can show your streak.
      ...(view === 'friends' || r.userId === selfId
        ? { streak: r.streak, longestStreak: r.longestStreak }
        : { streak: 0, longestStreak: 0 }),
    }))
    .sort((a, b) => rankValue(b) - rankValue(a))

  const page = ranked
    .slice(offset, offset + limit)
    .map((row, i) => ({ ...row, rank: offset + i + 1 }))

  return respond({ total: ranked.length, entries: page })
}

// ── Funnel events (Voice Mirror + app) ───────────────────────────────
// Anonymous, rate-limited event sink shared by the Voice Mirror funnel
// and the app's product funnel. The mirrorEvents table is deliberately
// NOT in the TABLES allowlist — this endpoint is its only writer, and
// there is no public reader.
//
// The names come from src/lib/funnel-event-catalog.ts, which every client
// surface also derives its event union from. It used to be a Set here and a
// TypeScript union there, "kept in sync" by a comment — they drifted, and five
// events the client emitted were answered 400 and dropped in silence.
export const FUNNEL_EVENTS: ReadonlySet<string> = new Set(FUNNEL_EVENT_NAMES)

// Derived numbers only (range/accuracy/steadiness) — never audio.
const MIRROR_METRIC_KEYS = new Set([
  'lowMidi',
  'highMidi',
  'semitones',
  'accuracy',
  'steadiness',
])

// ── First-touch acquisition (src/lib/acquisition.ts) ─────────────────
// One row per clientId in funnelAcquisition, so the funnel can finally be
// read per campaign — "do Campaign E's visitors finish an upload more often
// than organic ones?" had no answer before this, because the events carried
// no source and GA4 carries none of the events.
//
// Anonymous like the rest of the funnel: a click id and campaign labels,
// no account, no profile, and referrers arrive already stripped of their
// query string by the client.

const ACQUISITION_FIELDS = [
  'gclid',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
  'referrer',
] as const

export type FunnelAcquisitionInput = Partial<
  Record<(typeof ACQUISITION_FIELDS)[number], string>
>

/**
 * Keep the known string fields, bounded; drop everything else, including a
 * client that invents a field. Returns null when there is nothing worth a
 * row. Exported for the ingest contract tests.
 */
export function sanitizeAcquisition(
  input: unknown,
): FunnelAcquisitionInput | null {
  if (typeof input !== 'object' || input === null) return null
  const source = input as Record<string, unknown>
  const clean: FunnelAcquisitionInput = {}
  for (const field of ACQUISITION_FIELDS) {
    const value = source[field]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed === '') continue
    clean[field] = trimmed.slice(0, field === 'referrer' ? 256 : 128)
  }
  return Object.keys(clean).length > 0 ? clean : null
}

async function handleMirrorEvent(
  request: Request,
  env: Env,
): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? '127.0.0.1'
  const rl = await checkRateLimit(env.DB, ip, 'mirror-event')
  if (!rl.allowed) {
    return respond(
      {
        error: `Too many requests. Retry after ${rl.retryAfter ?? 60} seconds.`,
      },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
    )
  }

  // Funnel payloads are tiny (a UUID + an event name + 5 numbers) — reject
  // anything bigger before parsing it into memory.
  const contentLength = Number(request.headers.get('Content-Length') ?? '0')
  if (contentLength > 4096) {
    return respond({ error: 'Payload too large' }, { status: 413 })
  }

  // Chunked/HTTP2 requests may omit Content-Length — enforce the cap on the
  // actual bytes too, before JSON.parse buffers something huge.
  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return respond({ error: 'Invalid body' }, { status: 400 })
  }
  if (rawBody.length > 4096) {
    return respond({ error: 'Payload too large' }, { status: 413 })
  }
  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return respond({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { clientId, event, metrics, acq } = (body ?? {}) as {
    clientId?: unknown
    event?: unknown
    metrics?: unknown
    acq?: unknown
  }
  // The client always sends a UUID (or the literal 'no-storage') — enforce
  // the shape so the clientId index stays clean for grouping/dedup.
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(clientId)) {
    return respond({ error: 'Invalid clientId' }, { status: 400 })
  }
  if (typeof event !== 'string' || !FUNNEL_EVENTS.has(event)) {
    return respond({ error: 'Invalid event' }, { status: 400 })
  }

  // Metrics ride along only on results_view, filtered to known numeric keys.
  let metricsJson: string | null = null
  if (
    event === 'results_view' &&
    typeof metrics === 'object' &&
    metrics !== null
  ) {
    const clean: Record<string, number | null> = {}
    for (const [key, value] of Object.entries(
      metrics as Record<string, unknown>,
    )) {
      if (
        MIRROR_METRIC_KEYS.has(key) &&
        (typeof value === 'number' || value === null)
      ) {
        clean[key] = value
      }
    }
    metricsJson = JSON.stringify(clean)
  }

  await env.DB.prepare(
    'INSERT INTO mirrorEvents (id, createdAt, clientId, event, metricsJson) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(
      crypto.randomUUID(),
      new Date().toISOString(),
      clientId,
      event,
      metricsJson,
    )
    .run()

  // Acquisition rides along on every event, so this runs constantly and must
  // stay cheap and harmless. ON CONFLICT keeps the first row per client, and
  // the whole thing is non-fatal on purpose: the Worker can deploy ahead of
  // the migration that creates the table, and a funnel that 500s over a
  // reporting nicety would cost more than the reporting is worth.
  // 'no-storage' is the literal id every storage-disabled browser shares.
  // With first-wins semantics, one such visitor's source would become the
  // recorded acquisition for all of them — a row that looks precise and
  // means nothing. Better no row than that row.
  const acquisition =
    clientId === 'no-storage' ? null : sanitizeAcquisition(acq)
  if (acquisition !== null) {
    try {
      await env.DB.prepare(
        `INSERT INTO funnelAcquisition
           (clientId, createdAt, gclid, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, referrer)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(clientId) DO NOTHING`,
      )
        .bind(
          clientId,
          new Date().toISOString(),
          acquisition.gclid ?? null,
          acquisition.utmSource ?? null,
          acquisition.utmMedium ?? null,
          acquisition.utmCampaign ?? null,
          acquisition.utmContent ?? null,
          acquisition.utmTerm ?? null,
          acquisition.referrer ?? null,
        )
        .run()
    } catch {
      // Reporting must never break ingest.
    }
  }

  return respond({ ok: true }, { status: 201 })
}

// ── Weekly "Sing the Legend" challenges ──────────────────────────────
// The weeklyChallenges table is NOT in the generic TABLES allowlist: these
// custom handlers are its only reader, so queued/future rows never leak.
// active/board/archive are public reads; create/update/delete are X-Admin-Key
// gated. The board derives from sessionRecords tagged with weeklyChallengeId.

const WEEKLY_GRACE_MS = 48 * 60 * 60 * 1000 // late attempts still count 48h

interface WeeklyRow {
  id: string
  createdAt: string
  updatedAt: string
  slug: string
  title: string
  description: string
  featType: string
  voiceTypeSplit: string | null
  difficulty: string
  targetItems: string
  targetScore: number
  hearItUrl: string | null
  startsAt: string
  endsAt: string
  rewardBadgeId: string | null
  founderScore: number | null
  founderTrace: string | null
  evergreen: number
  status: string
  resultsJson: string | null
}

/** Public view of a weekly row (drops internal bookkeeping). */
function publicWeekly(row: WeeklyRow): Record<string, unknown> {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    featType: row.featType,
    voiceTypeSplit: row.voiceTypeSplit ? safeJson(row.voiceTypeSplit) : null,
    difficulty: row.difficulty,
    targetItems: safeJson(row.targetItems) ?? [],
    targetScore: row.targetScore,
    hearItUrl: row.hearItUrl,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    rewardBadgeId: row.rewardBadgeId,
    founderScore: row.founderScore,
    founderTrace: row.founderTrace ? safeJson(row.founderTrace) : null,
    status: row.status,
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/** Monday 00:00 UTC of the week containing `nowMs` (ISO). */
function startOfWeekUtcIso(nowMs: number): string {
  const d = new Date(nowMs)
  const day = d.getUTCDay() // 0=Sun..6=Sat
  const diff = (day + 6) % 7 // days since Monday
  const monday = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - diff,
  )
  return new Date(monday).toISOString()
}

interface BoardUser {
  userId: string
  displayName: string
  best: number
}

async function computeWeeklyBoard(
  row: WeeklyRow,
  env: Env,
): Promise<{
  perUser: BoardUser[]
  attemptedCount: number
  completedCount: number
}> {
  const { results } = await env.DB.prepare(
    `SELECT s."userId" AS userId,
            COALESCE(p."displayName", 'Singer-' || substr(s."userId", 1, 6)) AS displayName,
            MAX(s."score") AS best
     FROM "sessionRecords" s
     LEFT JOIN "userProfiles" p ON p."id" = s."userId"
     WHERE s."weeklyChallengeId" = ?
       AND s."userId" IN (
         SELECT "id" FROM "users" WHERE "suspendedAt" IS NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM weeklyChallengeScoreRetractions r
          WHERE r.weeklyChallengeId = s."weeklyChallengeId"
            AND r.userId = s."userId"
       )
     GROUP BY s."userId"
     ORDER BY best DESC`,
  )
    .bind(row.id)
    .all<BoardUser>()
  const perUser = results ?? []
  const completedCount = perUser.filter((u) => u.best >= row.targetScore).length
  return { perUser, attemptedCount: perUser.length, completedCount }
}

/** Top-N (founder merged in), participation counts, and the caller's standing. */
async function handleWeeklyBoard(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response> {
  const id = url.searchParams.get('id')
  if (id === null || id === '') {
    return respond({ error: 'id required' }, { status: 400 })
  }
  const row = await env.DB.prepare(
    `SELECT * FROM weeklyChallenges WHERE id = ?`,
  )
    .bind(id)
    .first<WeeklyRow>()
  if (!row) return respond({ error: 'Not found' }, { status: 404 })

  const { perUser, attemptedCount, completedCount } = await computeWeeklyBoard(
    row,
    env,
  )

  // Merge the founder's seed score in as a labelled entry.
  type Entry = { displayName: string; best: number; isFounder: boolean }
  const entries: Entry[] = perUser.map((u) => ({
    displayName: u.displayName,
    best: Math.round(u.best),
    isFounder: false,
  }))
  if (row.founderScore !== null) {
    entries.push({
      displayName: 'The Founder',
      best: Math.round(row.founderScore),
      isFounder: true,
    })
  }
  entries.sort((a, b) => b.best - a.best)
  const top = entries.slice(0, 10).map((e, i) => ({ rank: i + 1, ...e }))

  // Caller's standing (ranked among real singers only).
  const auth = await getAuth(request, env)
  let you: {
    best: number
    rank: number
    percentile: number
    beatFounder: boolean
    completed: boolean
  } | null = null
  if (auth) {
    const mine = perUser.find((u) => u.userId === auth.userId)
    if (mine) {
      const better = perUser.filter((u) => u.best > mine.best).length
      const rank = better + 1
      you = {
        best: Math.round(mine.best),
        rank,
        percentile:
          attemptedCount > 0 ? Math.round((100 * rank) / attemptedCount) : 100,
        beatFounder: row.founderScore !== null && mine.best > row.founderScore,
        completed: mine.best >= row.targetScore,
      }
    }
  }

  return respond({
    top,
    attemptedCount,
    completedCount,
    targetScore: row.targetScore,
    founderScore: row.founderScore,
    frozen: row.status === 'closed',
    you,
  })
}

/** Close a past-window active challenge: snapshot the board, mark closed. */
async function closeWeekly(row: WeeklyRow, env: Env): Promise<void> {
  const { perUser, attemptedCount, completedCount } = await computeWeeklyBoard(
    row,
    env,
  )
  const top3 = perUser
    .slice(0, 3)
    .map((u) => ({ displayName: u.displayName, best: Math.round(u.best) }))
  const results = {
    top3,
    attemptedCount,
    completedCount,
    closedAt: new Date().toISOString(),
  }
  await env.DB.prepare(
    `UPDATE weeklyChallenges SET status = 'closed', resultsJson = ?, updatedAt = ? WHERE id = ?`,
  )
    .bind(JSON.stringify(results), new Date().toISOString(), row.id)
    .run()
}

/** Encore: clone a random evergreen closed row as this week's active challenge. */
async function encoreWeekly(
  env: Env,
  nowMs: number,
): Promise<WeeklyRow | null> {
  const ev = await env.DB.prepare(
    `SELECT * FROM weeklyChallenges WHERE evergreen = 1 AND status = 'closed' ORDER BY RANDOM() LIMIT 1`,
  ).first<WeeklyRow>()
  if (!ev) return null
  const startsAt = startOfWeekUtcIso(nowMs)
  const endsAt = new Date(Date.parse(startsAt) + 7 * 86_400_000).toISOString()
  const now = new Date(nowMs).toISOString()
  const id = crypto.randomUUID()
  const slug = `${ev.slug}-encore-${Math.floor(nowMs / 86_400_000)}`
  await env.DB.prepare(
    `INSERT INTO weeklyChallenges
      (id, createdAt, updatedAt, slug, title, description, featType, voiceTypeSplit,
       difficulty, targetItems, targetScore, hearItUrl, startsAt, endsAt,
       rewardBadgeId, founderScore, founderTrace, evergreen, status, resultsJson)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'active',NULL)`,
  )
    .bind(
      id,
      now,
      now,
      slug,
      ev.title,
      ev.description,
      ev.featType,
      ev.voiceTypeSplit,
      ev.difficulty,
      ev.targetItems,
      ev.targetScore,
      ev.hearItUrl,
      startsAt,
      endsAt,
      ev.rewardBadgeId,
      ev.founderScore,
      ev.founderTrace,
      ev.evergreen,
    )
    .run()
  return {
    ...ev,
    id,
    slug,
    startsAt,
    endsAt,
    status: 'active',
    resultsJson: null,
  }
}

/** Resolve the current challenge; lazily activate/close/encore (no cron). */
async function handleWeeklyActive(env: Env): Promise<Response> {
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  let active = await env.DB.prepare(
    `SELECT * FROM weeklyChallenges WHERE status = 'active' ORDER BY startsAt DESC LIMIT 1`,
  ).first<WeeklyRow>()

  // Past its window (+grace)? Close it and look for the next.
  if (active && Date.parse(active.endsAt) + WEEKLY_GRACE_MS < nowMs) {
    await closeWeekly(active, env)
    active = null
  }

  // Promote a queued row whose window contains now.
  if (!active) {
    const queued = await env.DB.prepare(
      `SELECT * FROM weeklyChallenges WHERE status = 'queued' AND startsAt <= ? AND endsAt > ? ORDER BY startsAt ASC LIMIT 1`,
    )
      .bind(nowIso, nowIso)
      .first<WeeklyRow>()
    if (queued) {
      await env.DB.prepare(
        `UPDATE weeklyChallenges SET status = 'active', updatedAt = ? WHERE id = ?`,
      )
        .bind(nowIso, queued.id)
        .run()
      active = { ...queued, status: 'active' }
    }
  }

  // Nothing scheduled — re-run an evergreen as an Encore week.
  if (!active) {
    active = await encoreWeekly(env, nowMs)
  }

  return respond({ challenge: active ? publicWeekly(active) : null })
}

const WEEKLY_WRITE_COLS = new Set([
  'slug',
  'title',
  'description',
  'featType',
  'voiceTypeSplit',
  'difficulty',
  'targetItems',
  'targetScore',
  'hearItUrl',
  'startsAt',
  'endsAt',
  'rewardBadgeId',
  'founderScore',
  'founderTrace',
  'evergreen',
  'status',
])

/** Admin: create a queued challenge. */
async function createWeekly(request: Request, env: Env): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return respond({ error: 'Invalid JSON' }, { status: 400 })
  }
  // description is optional (the hero renders fine without a blurb).
  const required = [
    'slug',
    'title',
    'featType',
    'difficulty',
    'targetItems',
    'startsAt',
    'endsAt',
  ]
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || body[key] === '') {
      return respond({ error: `Missing field: ${key}` }, { status: 400 })
    }
  }
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const j = (v: unknown): string =>
    typeof v === 'string' ? v : JSON.stringify(v)
  try {
    await env.DB.prepare(
      `INSERT INTO weeklyChallenges
        (id, createdAt, updatedAt, slug, title, description, featType, voiceTypeSplit,
         difficulty, targetItems, targetScore, hearItUrl, startsAt, endsAt,
         rewardBadgeId, founderScore, founderTrace, evergreen, status, resultsJson)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
    )
      .bind(
        id,
        now,
        now,
        String(body.slug),
        String(body.title),
        body.description != null ? String(body.description) : '',
        String(body.featType),
        body.voiceTypeSplit != null ? j(body.voiceTypeSplit) : null,
        String(body.difficulty),
        j(body.targetItems),
        typeof body.targetScore === 'number' ? body.targetScore : 70,
        body.hearItUrl != null ? String(body.hearItUrl) : null,
        String(body.startsAt),
        String(body.endsAt),
        body.rewardBadgeId != null ? String(body.rewardBadgeId) : null,
        typeof body.founderScore === 'number' ? body.founderScore : null,
        body.founderTrace != null ? j(body.founderTrace) : null,
        body.evergreen === true || body.evergreen === 1 ? 1 : 0,
        typeof body.status === 'string' ? body.status : 'queued',
      )
      .run()
  } catch (err) {
    console.error('[weekly] create failed', err)
    return respond({ error: 'Could not create (slug taken?)' }, { status: 400 })
  }
  return respond({ id }, { status: 201 })
}

/** Admin: patch a challenge (incl. seeding founderScore/Trace). */
async function updateWeekly(
  id: string,
  request: Request,
  env: Env,
): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return respond({ error: 'Invalid JSON' }, { status: 400 })
  }
  const sets: string[] = []
  const binds: SqlValue[] = []
  for (const [key, value] of Object.entries(body)) {
    if (!WEEKLY_WRITE_COLS.has(key)) continue
    sets.push(`"${key}" = ?`)
    if (key === 'evergreen') binds.push(value === true || value === 1 ? 1 : 0)
    else if (
      key === 'voiceTypeSplit' ||
      key === 'targetItems' ||
      key === 'founderTrace'
    )
      binds.push(typeof value === 'string' ? value : JSON.stringify(value))
    else binds.push(value as SqlValue)
  }
  if (sets.length === 0) return respond({ error: 'No fields' }, { status: 400 })
  sets.push(`"updatedAt" = ?`)
  binds.push(new Date().toISOString())
  binds.push(id)
  await env.DB.prepare(
    `UPDATE weeklyChallenges SET ${sets.join(', ')} WHERE id = ?`,
  )
    .bind(...binds)
    .run()
  return respond({ ok: true })
}

// ── Demo song (Karaoke Night) ────────────────────────────────────────
//
// Not a generic CRUD entity: reads are public and unauthenticated (the
// Karaoke page fetches this before anyone signs in) while writes are
// admin-only, which the TABLES allowlist has no way to express. The
// shipped `public/karaoke-demo-song.json` stays the fallback, so an
// absent row, a parked row or an unreachable API all degrade to the demo
// that ships with the build rather than to a broken page.

/**
 * Every demo the Karaoke page should offer.
 *
 * Public reads see live rows only, so parking one takes it off the page
 * without deleting anything. The studio sees all of them, because a list
 * that hides what you parked is a list you cannot un-park from.
 *
 * `createdAt` order, not alphabetical: the original demo stays first, so
 * adding a song never moves the one a first-time visitor is meant to sing.
 */
async function handleDemoSongList(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'GET') {
    return respond({ error: 'Not found' }, { status: 404 })
  }
  const admin = await isAdmin(request, env)
  const { results } = await env.DB.prepare(
    admin
      ? `SELECT * FROM demoSongs ORDER BY createdAt ASC`
      : `SELECT * FROM demoSongs WHERE active = 1 ORDER BY createdAt ASC`,
  ).all<DemoSongRow>()
  return respond({ songs: (results ?? []).map(publicDemoSong) })
}

async function handleDemoSong(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response> {
  const slug = normalizeDemoSlug(url.searchParams.get('slug'))
  if (slug === null) {
    return respond({ error: 'Invalid slug' }, { status: 400 })
  }

  if (request.method === 'GET') {
    // `active = 1` only for the public read: a parked row must look exactly
    // like no row, so the client falls through to the shipped manifest.
    const admin = await isAdmin(request, env)
    const row = await env.DB.prepare(
      admin
        ? `SELECT * FROM demoSongs WHERE slug = ?`
        : `SELECT * FROM demoSongs WHERE slug = ? AND active = 1`,
    )
      .bind(slug)
      .first<DemoSongRow>()
    return respond({ song: row ? publicDemoSong(row) : null })
  }

  if (request.method !== 'PUT') {
    return respond({ error: 'Not found' }, { status: 404 })
  }
  if (!(await isAdmin(request, env))) {
    return respond({ error: 'Admin key required' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return respond({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.title !== 'string' || body.title.trim() === '') {
    return respond({ error: 'Missing field: title' }, { status: 400 })
  }
  if (typeof body.artist !== 'string' || body.artist.trim() === '') {
    return respond({ error: 'Missing field: artist' }, { status: 400 })
  }

  const existing = await env.DB.prepare(
    `SELECT * FROM demoSongs WHERE slug = ?`,
  )
    .bind(slug)
    .first<DemoSongRow>()

  const now = new Date().toISOString()
  const values = demoSongValues(body)
  const revision = nextLyricsRevision(
    existing,
    values.lyricsUrl as string | null,
    values.lyricsText as string | null,
  )

  if (existing === null) {
    await env.DB.prepare(
      `INSERT INTO demoSongs
        (id, createdAt, updatedAt, slug, ${DEMO_SONG_FIELDS.join(', ')}, lyricsRevision)
       VALUES (?,?,?,?,${DEMO_SONG_FIELDS.map(() => '?').join(',')},?)`,
    )
      .bind(
        crypto.randomUUID(),
        now,
        now,
        slug,
        ...DEMO_SONG_FIELDS.map((f) => values[f]),
        revision,
      )
      .run()
  } else {
    await env.DB.prepare(
      `UPDATE demoSongs SET ${DEMO_SONG_FIELDS.map((f) => `"${f}" = ?`).join(', ')},
        lyricsRevision = ?, updatedAt = ? WHERE slug = ?`,
    )
      .bind(...DEMO_SONG_FIELDS.map((f) => values[f]), revision, now, slug)
      .run()
  }

  const saved = await env.DB.prepare(`SELECT * FROM demoSongs WHERE slug = ?`)
    .bind(slug)
    .first<DemoSongRow>()
  return respond({ song: saved ? publicDemoSong(saved) : null })
}

async function handleWeekly(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response> {
  const sub = url.pathname.replace(/^\/api\/weekly\/?/, '').split('/')[0]
  const method = request.method

  // ── Admin writes ──
  if (method === 'POST' && sub === '') {
    if (!(await isAdmin(request, env)))
      return respond({ error: 'Admin key required' }, { status: 403 })
    return createWeekly(request, env)
  }
  if (
    method === 'PATCH' &&
    sub !== '' &&
    sub !== 'board' &&
    sub !== 'archive'
  ) {
    if (!(await isAdmin(request, env)))
      return respond({ error: 'Admin key required' }, { status: 403 })
    return updateWeekly(sub, request, env)
  }
  if (method === 'DELETE' && sub !== '') {
    if (!(await isAdmin(request, env)))
      return respond({ error: 'Admin key required' }, { status: 403 })
    await env.DB.prepare(`DELETE FROM weeklyChallenges WHERE id = ?`)
      .bind(sub)
      .run()
    return respond({ ok: true })
  }

  // ── Admin: list ALL rows (incl. queued) for the authoring page ──
  if (method === 'GET' && sub === 'all') {
    if (!(await isAdmin(request, env)))
      return respond({ error: 'Admin key required' }, { status: 403 })
    const { results } = await env.DB.prepare(
      `SELECT * FROM weeklyChallenges ORDER BY startsAt DESC LIMIT 200`,
    ).all<WeeklyRow>()
    return respond({ challenges: results ?? [] })
  }

  // ── Public reads ──
  if (method === 'GET' && (sub === '' || sub === 'active')) {
    return handleWeeklyActive(env)
  }
  if (method === 'GET' && sub === 'board') {
    return handleWeeklyBoard(url, request, env)
  }
  if (method === 'GET' && sub === 'archive') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM weeklyChallenges WHERE status = 'closed' ORDER BY endsAt DESC LIMIT 20`,
    ).all<WeeklyRow>()
    const archive = (results ?? []).map((r) => ({
      ...publicWeekly(r),
      results: r.resultsJson ? safeJson(r.resultsJson) : null,
    }))
    return respond({ archive })
  }

  return respond({ error: 'Not found' }, { status: 404 })
}

// ── Router ───────────────────────────────────────────────────────────

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (!originAllowed(request, env)) {
      return respond({ error: 'Origin not allowed' }, { status: 403 })
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }
    try {
      return await handleRequest(request, env, ctx)
    } catch (err) {
      if (err instanceof AccountSuspendedError) {
        return accountSuspendedResponse(respond)
      }
      if (err instanceof ManagedTestAccountInactiveError) {
        return managedTestAccountErrorResponse(respond, err)
      }
      // Without this boundary an unhandled throw returns Cloudflare's error
      // page with no CORS headers, which the browser surfaces to the app as
      // an opaque "Failed to fetch". Log it (visible via `wrangler tail`) and
      // return a CORS-bearing 500 so the client sees a real error instead.
      console.error('[db-worker] unhandled error:', err)
      return respond({ error: 'Internal server error' }, { status: 500 })
    }
  },

  // Cron (wrangler.jsonc "triggers"), every 6 hours:
  //  - billing reconciliation — the safety net for lost Stripe webhook
  //    deliveries (see reconcileBilling); a no-op wherever Stripe isn't
  //    configured.
  //  - the weekly league cut — applies promotions/relegations exactly once
  //    per ISO week (leagueMeta.lastCutWeekStart is the idempotency marker;
  //    the other ~27 ticks a week no-op). Each swallows its own errors so
  //    one can never starve the other.
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await reconcileBilling(env)
    await runWeeklyLeagueCut(env)
    // Nothing removes an authSessions row except an explicit sign-out, so
    // without this the table grows by a row per sign-in forever and the
    // account's device list fills with dead entries that "sign out this
    // device" cannot remove — there is nothing left to revoke. Swallows its
    // own errors, like the two above, so one sweep can never starve another.
    try {
      await sweepExpiredSessions(env.DB, TOKEN_TTL_SECONDS)
    } catch (error) {
      console.error('[cron] session sweep failed:', error)
    }
  },
}

async function handleRequest(
  request: Request,
  env: Env,
  ctx?: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url)

  const testingAccountResponse = await handleTestingAccountRequest(
    request,
    env,
    url,
    respondNoStore,
  )
  if (testingAccountResponse !== null) return testingAccountResponse

  if (url.pathname === '/api/admin/user-suspension') {
    return handleUserSuspension(
      request,
      env,
      respond,
      await isAdmin(request, env),
    )
  }

  if (url.pathname === '/api/admin/score-visibility') {
    return handleScoreVisibility(
      request,
      env,
      respondNoStore,
      await isAdmin(request, env),
    )
  }

  const authResponse = await handleAuth(
    request,
    env,
    url.pathname,
    respond,
    ctx,
  )
  if (authResponse) return authResponse

  const billingResponse = await handleBilling(
    request,
    env,
    url.pathname,
    respond,
  )
  if (billingResponse) return billingResponse

  // Resolved once for the whole request: several routes below want the
  // identity twice over, for the rate-limit bucket and again for the query
  // scope. getAuth returns null without touching D1 when there is no Bearer
  // header, so the anonymous paths (the Mirror funnel beacon especially) pay
  // nothing for it.
  const auth = await getAuth(request, env)

  const isPremiumAdminRoute =
    url.pathname.startsWith('/api/admin/premium-backgrounds') ||
    url.pathname.startsWith('/api/admin/supporter-groups') ||
    url.pathname.startsWith('/api/admin/premium-background-capabilities')
  if (isPremiumAdminRoute) {
    const adminResolution = await resolveAdminWithIdentity(
      request,
      env,
      hasAdminKey(request, env),
    )
    if (
      adminResolution.authorized &&
      request.method !== 'GET' &&
      request.method !== 'HEAD' &&
      request.method !== 'OPTIONS'
    ) {
      const rl = await checkRateLimit(
        env.DB,
        rateLimitSubject(request, auth),
        'crud-write',
      )
      if (!rl.allowed) return rateLimited(rl)
    }
    const premiumAdminResponse = await handlePremiumBackgroundAdminRequest(
      request,
      env,
      url,
      {
        admin: adminResolution.authorized,
        auditActor:
          adminResolution.accessIdentity === null
            ? { actorId: null, actorType: 'admin-key' }
            : {
                actorId: adminResolution.accessIdentity.subject,
                actorType: 'access',
              },
        corsHeaders: CORS,
        respond: respondNoStore,
      },
    )
    if (premiumAdminResponse !== null) return premiumAdminResponse
  }

  const premiumBackgroundResponse = await handlePremiumBackgroundRequest(
    request,
    env,
    url,
    auth,
    CORS,
  )
  if (premiumBackgroundResponse !== null) return premiumBackgroundResponse

  const isGuidedRoute =
    url.pathname.startsWith('/api/guided-exercises') ||
    url.pathname.startsWith('/api/guided-media') ||
    url.pathname.startsWith('/api/guided-paths') ||
    url.pathname.startsWith('/api/admin/guided-')
  if (isGuidedRoute) {
    if (
      request.method !== 'GET' &&
      request.method !== 'HEAD' &&
      request.method !== 'OPTIONS'
    ) {
      const rl = await checkRateLimit(
        env.DB,
        rateLimitSubject(request, auth),
        'crud-write',
      )
      if (!rl.allowed) return rateLimited(rl)
    }
    const guidedResponse = await handleGuidedExerciseRequest(
      request,
      env,
      url,
      {
        admin: await isAdmin(request, env),
        corsHeaders: CORS,
        respond,
      },
    )
    if (guidedResponse !== null) return guidedResponse
  }

  if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
    const rl = await checkRateLimit(
      env.DB,
      rateLimitSubject(request, auth),
      'leaderboard',
    )
    if (!rl.allowed) return rateLimited(rl)
    return handleLeaderboard(url, auth, env)
  }

  if (url.pathname === '/api/mirror/event' && request.method === 'POST') {
    return handleMirrorEvent(request, env)
  }

  if (url.pathname === '/api/league/me' && request.method === 'GET') {
    if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
    return respond(await getLeagueMe(env, auth.userId))
  }

  // Supporter perks. Legacy cosmetic grants remain shared/email-keyed; app
  // feature access is environment-local and resolved from supporter groups.
  if (url.pathname === '/api/perks/me' && request.method === 'GET') {
    if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
    const [perks, features] = await Promise.all([
      getPerksForUser(env, auth.userId),
      resolveSupporterFeatureAccess(env, auth.userId),
    ])
    return respond({ features, perks })
  }

  // Everything one grant pass reads, in one request. See handleGrantContext.
  if (url.pathname === '/api/me/grant-context' && request.method === 'GET') {
    if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
    return handleGrantContext(auth, env, respond)
  }

  // Every changed achievement row in one request. Must be matched before the
  // generic /api/<entity>/<id> route below, which would read "bulk" as an id.
  if (
    url.pathname === '/api/userAchievements/bulk' &&
    request.method === 'POST'
  ) {
    if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(
      env.DB,
      rateLimitSubject(request, auth),
      'achievement-write',
    )
    if (!rl.allowed) return rateLimited(rl)
    return handleAchievementBulk(request, auth, env, respond)
  }

  // Same shape, same reason, same ordering constraint: "bulk" must not reach
  // the generic /api/<entity>/<id> route below.
  if (url.pathname === '/api/userBadges/bulk' && request.method === 'POST') {
    if (!auth) return respond({ error: 'Unauthorized' }, { status: 401 })
    const rl = await checkRateLimit(
      env.DB,
      rateLimitSubject(request, auth),
      'achievement-write',
    )
    if (!rl.allowed) return rateLimited(rl)
    return handleBadgeBulk(request, auth, env, respond)
  }

  // Both friend routes require a token, so bucket them by the user like every
  // other authenticated write (rateLimitSubject). Keying by IP made a choir
  // rehearsal or a school music lab share one budget: ten code fetches for the
  // whole building, and the 429 lands on whoever swaps codes last.
  if (url.pathname === '/api/friends/code' && request.method === 'GET') {
    const rl = await checkRateLimit(
      env.DB,
      rateLimitSubject(request, auth),
      'friend-code',
    )
    if (!rl.allowed) return rateLimited(rl)
    return handleFriendCode(auth, env, respond)
  }

  if (url.pathname === '/api/friends/redeem' && request.method === 'POST') {
    // Codes are 8 chars from a 32-symbol alphabet, so guessing is hopeless —
    // but a cap stops anyone trying, and stops a redeem loop spamming follows.
    const rl = await checkRateLimit(
      env.DB,
      rateLimitSubject(request, auth),
      'friend-redeem',
    )
    if (!rl.allowed) return rateLimited(rl)
    return handleFriendRedeem(auth, request, env, respond)
  }

  // The rest of the friend graph. Reading your own pending requests is a
  // plain read; the three writes share the redeem bucket, since they are the
  // same kind of action against the same table and a caller who is being
  // told to slow down should not be able to switch verbs and continue.
  if (url.pathname === '/api/friends/requests' && request.method === 'GET') {
    return handleFriendRequests(auth, env, respond)
  }

  if (
    url.pathname === '/api/friends/request' ||
    url.pathname === '/api/friends/accept' ||
    url.pathname === '/api/friends/remove'
  ) {
    if (request.method !== 'POST') {
      return respond({ error: 'Method not allowed' }, { status: 405 })
    }
    const rl = await checkRateLimit(
      env.DB,
      rateLimitSubject(request, auth),
      'friend-redeem',
    )
    if (!rl.allowed) return rateLimited(rl)
    if (url.pathname === '/api/friends/request') {
      return handleFriendRequest(auth, request, env, respond)
    }
    if (url.pathname === '/api/friends/accept') {
      return handleFriendAccept(auth, request, env, respond)
    }
    return handleFriendRemove(auth, request, env, respond)
  }

  if (url.pathname === '/api/demo-songs') {
    return handleDemoSongList(request, env)
  }

  if (url.pathname === '/api/demo-song') {
    if (request.method !== 'GET' && request.method !== 'OPTIONS') {
      const rl = await checkRateLimit(
        env.DB,
        rateLimitSubject(request, auth),
        'crud-write',
      )
      if (!rl.allowed) return rateLimited(rl)
    }
    return handleDemoSong(url, request, env)
  }

  if (
    url.pathname === '/api/weekly' ||
    url.pathname.startsWith('/api/weekly/')
  ) {
    // /api/weekly writes are rate-limited like the generic CRUD path.
    if (request.method !== 'GET' && request.method !== 'OPTIONS') {
      const rl = await checkRateLimit(
        env.DB,
        rateLimitSubject(request, auth),
        'crud-write',
      )
      if (!rl.allowed) return rateLimited(rl)
    }
    return handleWeekly(url, request, env)
  }

  const match = url.pathname.match(/^\/api\/([A-Za-z]+)(?:\/([^/]+))?$/)
  if (!match) return respond({ error: 'Not found' }, { status: 404 })

  const entity = match[1]
  const def = TABLES[entity]
  if (!def)
    return respond({ error: `Unknown entity: ${entity}` }, { status: 404 })

  const sub = match[2] ? decodeURIComponent(match[2]) : undefined

  // A table whose rows only make sense in sets the generic handlers cannot
  // see. Answer before the rate limiter so the refusal is cheap and constant.
  if (def.writeRoute !== undefined && request.method !== 'GET') {
    return respond(
      { error: `Use ${def.writeRoute} to change ${entity}` },
      { status: 405 },
    )
  }

  // Per-user (per-IP when anonymous) write rate limit on mutations — bounds
  // scripted spam / unbounded row creation. (Volumetric DDoS is absorbed at
  // the Cloudflare edge.)
  if (
    request.method === 'POST' ||
    request.method === 'PATCH' ||
    request.method === 'DELETE'
  ) {
    const rl = await checkRateLimit(
      env.DB,
      rateLimitSubject(request, auth),
      'crud-write',
    )
    if (!rl.allowed) return rateLimited(rl)
  }

  if (sub === 'count' && request.method === 'GET') {
    return handleList(
      entity,
      def,
      url,
      auth,
      env,
      true,
      await isAdmin(request, env),
    )
  }

  if (sub === undefined) {
    if (request.method === 'GET')
      return handleList(
        entity,
        def,
        url,
        auth,
        env,
        false,
        await isAdmin(request, env),
      )
    if (request.method === 'POST')
      return handleCreate(entity, def, request, auth, env)
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }

  if (request.method === 'GET')
    return handleGetById(
      entity,
      def,
      sub,
      auth,
      env,
      await isAdmin(request, env),
    )
  if (request.method === 'PATCH')
    return handleUpdate(entity, def, sub, request, auth, env)
  if (request.method === 'DELETE')
    return handleDelete(entity, def, sub, request, auth, env)
  return respond({ error: 'Method not allowed' }, { status: 405 })
}
