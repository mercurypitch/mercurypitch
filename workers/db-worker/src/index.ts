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
import { getAuth, handleAuth } from './auth'
import type { TableDef } from './tables'
import { TABLES } from './tables'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

function respond(body: object | null, init?: ResponseInit): Response {
  const headers = { ...CORS, ...(init?.headers as Record<string, string>) }
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
  return {
    filters,
    orderBy,
    orderDir: url.searchParams.get('orderDir') === 'desc' ? 'DESC' : 'ASC',
    limit: limitRaw ? Number(limitRaw) : -1, // SQLite: LIMIT -1 = unbounded
    offset: offsetRaw ? Number(offsetRaw) : undefined,
  }
}

// ── Access control helpers ───────────────────────────────────────────

function isAdmin(request: Request, env: Env): boolean {
  const key = request.headers.get('X-Admin-Key')
  return !!key && !!env.ADMIN_KEY && key === env.ADMIN_KEY
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
    return respond({ error: `Insert failed: ${String(err)}` }, { status: 400 })
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
    return respond({ error: `Update failed: ${String(err)}` }, { status: 400 })
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

// ── Router ───────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    const url = new URL(request.url)

    const authResponse = await handleAuth(request, env, url.pathname, respond)
    if (authResponse) return authResponse

    const match = url.pathname.match(/^\/api\/([A-Za-z]+)(?:\/([^/]+))?$/)
    if (!match) return respond({ error: 'Not found' }, { status: 404 })

    const entity = match[1]
    const def = TABLES[entity]
    if (!def) return respond({ error: `Unknown entity: ${entity}` }, { status: 404 })

    const sub = match[2] ? decodeURIComponent(match[2]) : undefined
    const auth = await getAuth(request, env)

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
  },
}
