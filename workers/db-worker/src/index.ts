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
import { handleBilling, reconcileBilling } from './billing'
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
  'cta_glass_click',
  // App funnel (src/lib/analytics.ts)
  'app_open',
  'signup',
  'session_complete',
  'challenge_attempt',
  'pricing_view',
  'checkout_start',
  // Karaoke Night funnel (src/features/karaoke-night/funnel.ts)
  'karaoke_view',
  'karaoke_demo_start',
  'karaoke_demo_complete',
  'karaoke_upload_start',
  'karaoke_upload_done',
  'karaoke_upload_error',
  'karaoke_song_staged',
  'karaoke_playlist_deeplink',
  'karaoke_playlist_start',
  'karaoke_cta_studio',
  // Glass funnel (src/features/glass/funnel.ts)
  'glass_view',
  'glass_mic_granted',
  'glass_mic_denied',
  'glass_calibrate_done',
  'glass_rep_done',
  'glass_playback_done',
  'glass_shatter',
  'glass_results_view',
  'glass_fx_change',
  'glass_monitor_on',
  'glass_monitor_off',
  'glass_card_generated',
  'glass_card_shared',
  'glass_cta_app_click',
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
        beatFounder:
          row.founderScore !== null && mine.best > row.founderScore,
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
  return { ...ev, id, slug, startsAt, endsAt, status: 'active', resultsJson: null }
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

async function handleWeekly(
  url: URL,
  request: Request,
  env: Env,
): Promise<Response> {
  const sub = url.pathname.replace(/^\/api\/weekly\/?/, '').split('/')[0]
  const method = request.method

  // ── Admin writes ──
  if (method === 'POST' && sub === '') {
    if (!isAdmin(request, env))
      return respond({ error: 'Admin key required' }, { status: 403 })
    return createWeekly(request, env)
  }
  if (method === 'PATCH' && sub !== '' && sub !== 'board' && sub !== 'archive') {
    if (!isAdmin(request, env))
      return respond({ error: 'Admin key required' }, { status: 403 })
    return updateWeekly(sub, request, env)
  }
  if (method === 'DELETE' && sub !== '') {
    if (!isAdmin(request, env))
      return respond({ error: 'Admin key required' }, { status: 403 })
    await env.DB.prepare(`DELETE FROM weeklyChallenges WHERE id = ?`)
      .bind(sub)
      .run()
    return respond({ ok: true })
  }

  // ── Admin: list ALL rows (incl. queued) for the authoring page ──
  if (method === 'GET' && sub === 'all') {
    if (!isAdmin(request, env))
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

  // Cron (wrangler.jsonc "triggers"): billing reconciliation — the safety
  // net for lost Stripe webhook deliveries (see reconcileBilling). Runs in
  // every deployed env; a no-op wherever Stripe isn't configured.
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await reconcileBilling(env)
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

  if (
    url.pathname === '/api/weekly' ||
    url.pathname.startsWith('/api/weekly/')
  ) {
    // /api/weekly writes are rate-limited like the generic CRUD path.
    if (request.method !== 'GET' && request.method !== 'OPTIONS') {
      const ip = request.headers.get('CF-Connecting-IP') ?? '127.0.0.1'
      const rl = await checkRateLimit(env.DB, ip, 'crud-write')
      if (!rl.allowed) {
        return respond(
          {
            error: `Too many requests. Retry after ${rl.retryAfter ?? 60} seconds.`,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(rl.retryAfter ?? 60) },
          },
        )
      }
    }
    return handleWeekly(url, request, env)
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
