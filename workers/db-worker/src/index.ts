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

import type { AuthUser, Env } from './auth'
import { checkRateLimit, getAuth, handleAuth, timingSafeEqual } from './auth'
import { handleBilling } from './billing'
import type { TableDef } from './tables'
import { TABLES } from './tables'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  // Spec quirk: a `*` wildcard does NOT cover the Authorization header
  // (Firefox already warns it will block it) — list everything we use.
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Key',
}

/**
 * Browser-origin allowlist (see Env.ALLOWED_ORIGINS). Requests without an
 * Origin header always pass — that covers curl/scripts, service-to-service
 * calls (billing X-Service-Key), Stripe webhooks, and top-level navigations
 * (Google OAuth callback). Browsers always attach Origin to cross-origin
 * fetch/XHR/sendBeacon, so a locally served build can never reach a
 * deployed environment that doesn't list localhost.
 */
function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin')
  if (origin === null) return true
  const allowed = env.ALLOWED_ORIGINS
  if (allowed === undefined || allowed === '') return true
  return allowed.split(',').some((entry) => {
    const rule = entry.trim()
    if (rule === origin) return true
    if (rule === 'localhost') {
      try {
        const host = new URL(origin).hostname
        return host === 'localhost' || host === '127.0.0.1'
      } catch {
        return false
      }
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

/** Restore booleans and JSON columns on rows read from D1. */
function fromSql(def: TableDef, row: Row): Row {
  for (const col of def.boolCols ?? []) {
    if (col in row) row[col] = !!row[col]
  }
  for (const col of def.jsonCols ?? []) {
    const v = row[col]
    if (typeof v === 'string') {
      try {
        row[col] = JSON.parse(v)
      } catch {
        /* leave as string */
      }
    }
  }
  return row
}

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

function isAdmin(request: Request, env: Env): boolean {
  const key = request.headers.get('X-Admin-Key')
  return !!key && !!env.ADMIN_KEY && timingSafeEqual(key, env.ADMIN_KEY)
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
      if (auth) return { clause: '("isPublic" = 1 OR "userId" = ?)', binds: [auth.userId] }
      return { clause: '"isPublic" = 1', binds: [] }
    }
    default:
      return {} // admin / public-user / owner: public reads
  }
}

/** Check whether an existing row may be written by this requester. */
function canWriteRow(def: TableDef, row: Row, auth: AuthUser | null, admin: boolean): boolean {
  switch (def.access) {
    case 'admin':
      return admin
    case 'owner':
      return !!auth && row.id === auth.userId
    default:
      return !!auth && row.userId === auth.userId
  }
}

// ── CRUD handlers ────────────────────────────────────────────────────

async function handleList(
  entity: string,
  def: TableDef,
  url: URL,
  auth: AuthUser | null,
  env: Env,
  countOnly: boolean,
): Promise<Response> {
  const q = parseListQuery(url)
  if (!q) return respond({ error: 'Invalid query' }, { status: 400 })

  const scope = scopeRead(def, q, auth)
  if (scope instanceof Response) return scope

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
    const result = await env.DB.prepare(`SELECT COUNT(*) AS count FROM "${entity}"${where}`)
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

  const { results } = await env.DB.prepare(sql).bind(...binds).all<Row>()
  return respond(results.map((r) => fromSql(def, r)) as unknown as object)
}

async function fetchRow(entity: string, id: string, env: Env): Promise<Row | null> {
  return env.DB.prepare(`SELECT * FROM "${entity}" WHERE id = ?`).bind(id).first<Row>()
}

async function handleGetById(
  entity: string,
  def: TableDef,
  id: string,
  auth: AuthUser | null,
  env: Env,
): Promise<Response> {
  const row = await fetchRow(entity, id, env)
  if (!row) return respond({ error: 'Not found' }, { status: 404 })

  if (def.access === 'user' && (!auth || row.userId !== auth.userId)) {
    return respond({ error: 'Not found' }, { status: 404 })
  }
  if (def.access === 'shared' && !row.isPublic && (!auth || row.userId !== auth.userId)) {
    return respond({ error: 'Not found' }, { status: 404 })
  }
  return respond(fromSql(def, row))
}

/**
 * Per-entity value validation for writes. Keeps the (server-derived)
 * leaderboard honest — a forged sessionRecords row can't carry impossible
 * numbers. Returns an error message, or null when the body is acceptable.
 */
function validateWrite(entity: string, body: Row): string | null {
  if (entity === 'sessionRecords') {
    const inRange = (v: unknown, lo: number, hi: number): boolean =>
      v === undefined || (typeof v === 'number' && v >= lo && v <= hi)
    if (!inRange(body.score, 0, 100)) return 'score must be between 0 and 100'
    if (!inRange(body.accuracy, 0, 100)) {
      return 'accuracy must be between 0 and 100'
    }
    const nh = body.notesHit
    const nt = body.notesTotal
    if (
      typeof nh === 'number' &&
      typeof nt === 'number' &&
      (nh < 0 || nt < 0 || nh > nt)
    ) {
      return 'notesHit must be between 0 and notesTotal'
    }
  }
  return null
}

async function handleCreate(
  entity: string,
  def: TableDef,
  request: Request,
  auth: AuthUser | null,
  env: Env,
): Promise<Response> {
  if (def.access === 'admin') {
    if (!isAdmin(request, env)) return respond({ error: 'Admin key required' }, { status: 403 })
  } else if (!auth) {
    return respond({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Row
  try {
    body = await request.json<Row>()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const createErr = validateWrite(entity, body)
  if (createErr) return respond({ error: createErr }, { status: 400 })

  const now = new Date().toISOString()
  delete body.id
  delete body.createdAt
  delete body.updatedAt
  if (auth && def.access !== 'admin' && def.access !== 'owner') {
    body.userId = auth.userId
  }

  // userProfiles: the row id IS the user id
  const id = def.access === 'owner' ? (auth as AuthUser).userId : crypto.randomUUID()
  if (def.access === 'owner' && (await fetchRow(entity, id, env))) {
    return respond({ error: 'Profile already exists' }, { status: 409 })
  }

  const cols: string[] = ['id', 'createdAt', 'updatedAt']
  const binds: SqlValue[] = [id, now, now]
  for (const [col, val] of Object.entries(body)) {
    if (val === undefined) continue
    if (!IDENT.test(col)) return respond({ error: `Invalid column: ${col}` }, { status: 400 })
    cols.push(col)
    binds.push(toSql(val))
  }

  const placeholders = cols.map(() => '?').join(', ')
  const quoted = cols.map((c) => `"${c}"`).join(', ')
  try {
    await env.DB.prepare(`INSERT INTO "${entity}" (${quoted}) VALUES (${placeholders})`)
      .bind(...binds)
      .run()
  } catch (err) {
    console.error('[create] insert failed', entity, err)
    return respond({ error: 'Could not create record' }, { status: 400 })
  }

  const row = (await fetchRow(entity, id, env)) as Row
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
  if (!canWriteRow(def, row, auth, isAdmin(request, env))) {
    return respond({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Row
  try {
    body = await request.json<Row>()
  } catch {
    return respond({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updateErr = validateWrite(entity, body)
  if (updateErr) return respond({ error: updateErr }, { status: 400 })

  delete body.id
  delete body.createdAt
  delete body.updatedAt
  delete body.userId // ownership is immutable

  const sets: string[] = ['"updatedAt" = ?']
  const binds: SqlValue[] = [new Date().toISOString()]
  for (const [col, val] of Object.entries(body)) {
    if (val === undefined) continue
    if (!IDENT.test(col)) return respond({ error: `Invalid column: ${col}` }, { status: 400 })
    sets.push(`"${col}" = ?`)
    binds.push(toSql(val))
  }
  binds.push(id)

  try {
    await env.DB.prepare(`UPDATE "${entity}" SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...binds)
      .run()
  } catch (err) {
    console.error('[update] update failed', entity, err)
    return respond({ error: 'Could not update record' }, { status: 400 })
  }

  const updated = (await fetchRow(entity, id, env)) as Row
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
  if (!canWriteRow(def, row, auth, isAdmin(request, env))) {
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

/** UTC YYYY-MM-DD, `offsetDays` from today. */
function utcDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

/** Current consecutive-day streak (ending today or yesterday) from a set of
 *  practice days — mirrors the client's streak semantics. */
function streakFromDays(days: Set<string>): number {
  let cursor = utcDay(0)
  if (!days.has(cursor)) {
    cursor = utcDay(-1)
    if (!days.has(cursor)) return 0
  }
  let streak = 0
  let t = new Date(`${cursor}T00:00:00.000Z`).getTime()
  while (days.has(new Date(t).toISOString().slice(0, 10))) {
    streak++
    t -= 86_400_000
  }
  return streak
}

interface AggRow {
  userId: string
  displayName: string
  avatarUrl: string | null
  score: number
  bestScore: number
  accuracy: number
  totalSessions: number
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
  if (period === 'weekly') {
    clauses.push('s."endedAt" >= ?')
    binds.push(weekStartIso())
  }
  if (view === 'friends') {
    clauses.push(
      '(s."userId" = ? OR s."userId" IN (SELECT "followedUserId" FROM "follows" WHERE "userId" = ?))',
    )
    binds.push((auth as AuthUser).userId, (auth as AuthUser).userId)
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''

  // Per-user aggregates; displayName/avatar from the public profile.
  const { results: aggRows } = await env.DB.prepare(
    `SELECT s."userId" AS userId,
            COALESCE(p."displayName", 'Singer-' || substr(s."userId", 1, 6)) AS displayName,
            p."avatarUrl" AS avatarUrl,
            AVG(s."score") AS score,
            MAX(s."score") AS bestScore,
            AVG(s."accuracy") AS accuracy,
            COUNT(*) AS totalSessions
     FROM "sessionRecords" s
     LEFT JOIN "userProfiles" p ON p."id" = s."userId"${where}
     GROUP BY s."userId"`,
  )
    .bind(...binds)
    .all<AggRow>()

  // Distinct practice days per user → consecutive-day streak (computed in JS).
  const { results: dayRows } = await env.DB.prepare(
    `SELECT s."userId" AS userId, substr(s."endedAt", 1, 10) AS day
     FROM "sessionRecords" s${where}
     GROUP BY s."userId", day`,
  )
    .bind(...binds)
    .all<{ userId: string; day: string }>()

  const daysByUser = new Map<string, Set<string>>()
  for (const r of dayRows) {
    const set = daysByUser.get(r.userId) ?? new Set<string>()
    set.add(r.day)
    daysByUser.set(r.userId, set)
  }

  const rankValue = (row: { score: number; bestScore: number; accuracy: number; totalSessions: number; streak: number }): number => {
    switch (category) {
      case 'best-score':
        return row.bestScore
      case 'accuracy':
        return row.accuracy
      case 'streak':
        return row.streak
      case 'sessions':
        return row.totalSessions
      default:
        return row.score
    }
  }

  // Load all users' aggregates, then rank + paginate in memory. Fine at the
  // current scale; revisit with a materialized table if the user base grows.
  const ranked = aggRows
    .map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      avatarUrl: r.avatarUrl,
      score: Math.round(r.score),
      bestScore: Math.round(r.bestScore),
      accuracy: Math.round(r.accuracy),
      totalSessions: r.totalSessions,
      streak: streakFromDays(daysByUser.get(r.userId) ?? new Set<string>()),
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
// there is no public reader. Keep the event list in sync with
// src/features/mirror/funnel.ts and src/lib/analytics.ts.

const FUNNEL_EVENTS = new Set([
  // Voice Mirror funnel (src/features/mirror/funnel.ts)
  'mirror_view',
  'howto_view',
  'howto_done',
  'mic_granted',
  'mic_denied',
  'task_intro_done',
  'task_glide_done',
  'task_hold_done',
  'task_match_done',
  'results_view',
  'card_generated',
  'card_shared',
  'cta_app_click',
  'free_sing_done',
  'cosmic_done',
  'twin_revealed',
  // App funnel (src/lib/analytics.ts)
  'app_open',
  'signup',
  'session_complete',
  'challenge_attempt',
  'pricing_view',
  'checkout_start',
  // Reserved for the weekly-challenge/email releases, so those client
  // rollouts need no worker redeploy.
  'weekly_join',
  'weekly_attempt',
  'email_click',
])

// Derived numbers only (range/accuracy/steadiness) — never audio.
const MIRROR_METRIC_KEYS = new Set([
  'lowMidi',
  'highMidi',
  'semitones',
  'accuracy',
  'steadiness',
])

async function handleMirrorEvent(
  request: Request,
  env: Env,
): Promise<Response> {
  const ip = request.headers.get('CF-Connecting-IP') ?? '127.0.0.1'
  const rl = await checkRateLimit(env.DB, ip, 'mirror-event')
  if (!rl.allowed) {
    return respond(
      { error: `Too many requests. Retry after ${rl.retryAfter ?? 60} seconds.` },
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
  const { clientId, event, metrics } = (body ?? {}) as {
    clientId?: unknown
    event?: unknown
    metrics?: unknown
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
  if (event === 'results_view' && typeof metrics === 'object' && metrics !== null) {
    const clean: Record<string, number | null> = {}
    for (const [key, value] of Object.entries(metrics as Record<string, unknown>)) {
      if (MIRROR_METRIC_KEYS.has(key) && (typeof value === 'number' || value === null)) {
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
  return respond({ ok: true }, { status: 201 })
}

// ── Router ───────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!originAllowed(request, env)) {
      return respond({ error: 'Origin not allowed' }, { status: 403 })
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }
    try {
      return await handleRequest(request, env)
    } catch (err) {
      // Without this boundary an unhandled throw returns Cloudflare's error
      // page with no CORS headers, which the browser surfaces to the app as
      // an opaque "Failed to fetch". Log it (visible via `wrangler tail`) and
      // return a CORS-bearing 500 so the client sees a real error instead.
      console.error('[db-worker] unhandled error:', err)
      return respond({ error: 'Internal server error' }, { status: 500 })
    }
  },
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)

  const authResponse = await handleAuth(request, env, url.pathname, respond)
  if (authResponse) return authResponse

  const billingResponse = await handleBilling(request, env, url.pathname, respond)
  if (billingResponse) return billingResponse

  if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
    return handleLeaderboard(url, await getAuth(request, env), env)
  }

  if (url.pathname === '/api/mirror/event' && request.method === 'POST') {
    return handleMirrorEvent(request, env)
  }

  const match = url.pathname.match(/^\/api\/([A-Za-z]+)(?:\/([^/]+))?$/)
  if (!match) return respond({ error: 'Not found' }, { status: 404 })

  const entity = match[1]
  const def = TABLES[entity]
  if (!def) return respond({ error: `Unknown entity: ${entity}` }, { status: 404 })

  const sub = match[2] ? decodeURIComponent(match[2]) : undefined
  const auth = await getAuth(request, env)

  // Per-IP write rate limit on mutations — bounds scripted spam / unbounded
  // row creation. (Volumetric DDoS is absorbed at the Cloudflare edge.)
  if (
    request.method === 'POST' ||
    request.method === 'PATCH' ||
    request.method === 'DELETE'
  ) {
    const ip = request.headers.get('CF-Connecting-IP') ?? '127.0.0.1'
    const rl = await checkRateLimit(env.DB, ip, 'crud-write')
    if (!rl.allowed) {
      return respond(
        {
          error: `Too many requests. Retry after ${rl.retryAfter ?? 60} seconds.`,
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } },
      )
    }
  }

  if (sub === 'count' && request.method === 'GET') {
    return handleList(entity, def, url, auth, env, true)
  }

  if (sub === undefined) {
    if (request.method === 'GET') return handleList(entity, def, url, auth, env, false)
    if (request.method === 'POST') return handleCreate(entity, def, request, auth, env)
    return respond({ error: 'Method not allowed' }, { status: 405 })
  }

  if (request.method === 'GET') return handleGetById(entity, def, sub, auth, env)
  if (request.method === 'PATCH') return handleUpdate(entity, def, sub, request, auth, env)
  if (request.method === 'DELETE') return handleDelete(entity, def, sub, request, auth, env)
  return respond({ error: 'Method not allowed' }, { status: 405 })
}
