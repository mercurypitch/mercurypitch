// ============================================================
// Experimental feature routes — the owner's switches for features still being built
// ============================================================
//
// Which experimental features (src/lib/experimental-features.ts) the owner
// has switched on or off for this environment. Kept in the featureFlags
// table (0001_baseline.sql), one row per switch under the key
// `experiment:<name>`, so the switch needs no migration:
//
//   GET /api/features               Public. The switches that are set, and
//                                   only those: {"studio": true}. A feature
//                                   with no row is absent, and a page uses
//                                   its build's default. Cached for 30 s.
//   GET /api/admin/features         Admin. Every feature on the list, set or
//                                   not: {features: [{name, enabled,
//                                   updatedAt}]}, in list order.
//   PUT /api/admin/features/:name   Admin. {"enabled": true} or false sets
//                                   the switch, {"enabled": null} clears it
//                                   and hands the feature back to the build.
//                                   Answers {row, changed}.
//
// A name that is not on the list is refused and never stored, so the table
// cannot fill with switches nothing reads, and a row someone wrote by hand
// under a name the list lacks is never served. Admin is X-Admin-Key, or
// Cloudflare Access where access.ts allows it, as on every admin route.
//
// featureFlags is also the generic CRUD table of that name (tables.ts:
// public reads, admin writes). The app's own flags in it never use the
// `experiment:` prefix, so the two cannot meet.

import type { ExperimentalFeature, FeatureOverrides, FeatureSwitches, FeatureSwitchRow, FeatureSwitchSave, } from '../../../src/lib/experimental-features'
import { ADMIN_FEATURES_PATH, EXPERIMENTAL_FEATURES, FEATURES_PATH, isExperimentalFeature, parseFeatureSwitch, } from '../../../src/lib/experimental-features'
import type { AdminResolution } from './access'
import type { Env } from './auth'

type Respond = (body: object | null, init?: ResponseInit) => Response

export interface ExperimentalFeatureContext {
  respond: Respond
  /** Asked only by the admin routes, so the public read never pays for an Access check. */
  admin: () => Promise<AdminResolution>
}

/** The featureFlags key a feature's switch is stored under. */
export const FEATURE_KEY_PREFIX = 'experiment:'

const ADMIN_ITEM_PREFIX = `${ADMIN_FEATURES_PATH}/`

/**
 * Any cache may keep the switches for 30 s: a page asks once, at startup,
 * and never waits on the answer, so a flip shows on the next load after that.
 */
const PUBLIC_CACHE = 'public, max-age=30'

/** Admin answers are the console's working state, so nothing may keep a copy. */
const NO_STORE = { 'Cache-Control': 'private, no-store' }

interface FlagRow {
  key: string
  /** BOOLEAN in the schema, which SQLite stores as 0 or 1. */
  value: number
  updatedAt: string
}

function keyOf(name: ExperimentalFeature): string {
  return `${FEATURE_KEY_PREFIX}${name}`
}

/** True for every path this module answers; index.ts routes on it. */
export function isExperimentalFeaturePath(pathname: string): boolean {
  return (
    pathname === FEATURES_PATH ||
    pathname === ADMIN_FEATURES_PATH ||
    pathname.startsWith(ADMIN_ITEM_PREFIX)
  )
}

export async function handleExperimentalFeatureRequest(
  request: Request,
  env: Env,
  url: URL,
  context: ExperimentalFeatureContext,
): Promise<Response> {
  if (url.pathname === FEATURES_PATH) {
    return getOverrides(request, env, context.respond)
  }
  if (url.pathname === ADMIN_FEATURES_PATH) {
    return getSwitches(request, env, context)
  }
  const segment = url.pathname.slice(ADMIN_ITEM_PREFIX.length)
  if (segment === '' || segment.includes('/')) {
    return context.respond({ error: 'Not found' }, { status: 404 })
  }
  return putSwitch(segment, request, env, context)
}

// ── Answers ──────────────────────────────────────────────────────────

function methodNotAllowed(respond: Respond, allow: string): Response {
  return respond(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: allow } },
  )
}

/** As every other admin route answers a missing or wrong credential. */
function forbidden(respond: Respond): Response {
  return respond(
    { error: 'Admin key required' },
    { status: 403, headers: NO_STORE },
  )
}

function badRequest(respond: Respond, error: string): Response {
  return respond({ error }, { status: 400, headers: NO_STORE })
}

// ── Reading the switches ─────────────────────────────────────────────

/** Each feature on the list that has a switch set, with its row. */
async function readRows(env: Env): Promise<Map<ExperimentalFeature, FlagRow>> {
  const rows = new Map<ExperimentalFeature, FlagRow>()
  const keys = EXPERIMENTAL_FEATURES.map(keyOf)
  if (keys.length === 0) return rows
  const { results } = await env.DB.prepare(
    `SELECT "key", value, updatedAt FROM featureFlags
      WHERE "key" IN (${keys.map(() => '?').join(', ')})`,
  )
    .bind(...keys)
    .all<FlagRow>()
  for (const row of results) {
    const name = row.key.slice(FEATURE_KEY_PREFIX.length)
    if (isExperimentalFeature(name)) rows.set(name, row)
  }
  return rows
}

function isOn(row: FlagRow): boolean {
  return Number(row.value) === 1
}

function publicRow(
  name: ExperimentalFeature,
  row: FlagRow | undefined,
): FeatureSwitchRow {
  return {
    name,
    enabled: row === undefined ? null : isOn(row),
    updatedAt: row?.updatedAt ?? null,
  }
}

// ── GET /api/features ────────────────────────────────────────────────

async function getOverrides(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return methodNotAllowed(respond, 'GET, HEAD')
  }
  const overrides: FeatureOverrides = {}
  for (const [name, row] of await readRows(env)) overrides[name] = isOn(row)
  const headers = { 'Cache-Control': PUBLIC_CACHE }
  if (request.method === 'HEAD') {
    return respond(null, {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
  return respond(overrides, { headers })
}

// ── GET /api/admin/features ──────────────────────────────────────────

async function getSwitches(
  request: Request,
  env: Env,
  context: ExperimentalFeatureContext,
): Promise<Response> {
  const { respond } = context
  if (request.method !== 'GET') return methodNotAllowed(respond, 'GET')
  if (!(await context.admin()).authorized) return forbidden(respond)
  const rows = await readRows(env)
  const body: FeatureSwitches = {
    features: EXPERIMENTAL_FEATURES.map((name) =>
      publicRow(name, rows.get(name)),
    ),
  }
  return respond(body, { headers: NO_STORE })
}

// ── PUT /api/admin/features/:name ────────────────────────────────────

/** The feature a path segment names, or null for any name not on the list. */
function featureOf(segment: string): ExperimentalFeature | null {
  let name: string
  try {
    name = decodeURIComponent(segment)
  } catch {
    return null
  }
  return isExperimentalFeature(name) ? name : null
}

/**
 * Set or clear one switch, and read it back, in one batch. An existing row
 * is rewritten only when its value differs, so its updatedAt stays the time
 * of its last real change and `changed` says whether this call moved it.
 */
async function save(
  env: Env,
  name: ExperimentalFeature,
  enabled: boolean | null,
): Promise<FeatureSwitchSave> {
  const key = keyOf(name)
  const write =
    enabled === null
      ? env.DB.prepare(`DELETE FROM featureFlags WHERE "key" = ?`).bind(key)
      : env.DB.prepare(
          `INSERT INTO featureFlags (id, createdAt, updatedAt, "key", value)
           VALUES (?1, ?2, ?2, ?1, ?3)
           ON CONFLICT ("key") DO UPDATE
             SET value = excluded.value, updatedAt = excluded.updatedAt
           WHERE featureFlags.value IS NOT excluded.value`,
        ).bind(key, new Date().toISOString(), enabled ? 1 : 0)
  const [result, read] = await env.DB.batch<FlagRow>([
    write,
    env.DB.prepare(
      `SELECT "key", value, updatedAt FROM featureFlags WHERE "key" = ?`,
    ).bind(key),
  ])
  return {
    row: publicRow(name, read?.results[0]),
    changed: (result?.meta.changes ?? 0) > 0,
  }
}

/** The body as JSON, or null when it is not JSON at all. */
async function readJson(request: Request): Promise<{ value: unknown } | null> {
  try {
    return { value: JSON.parse(await request.text()) as unknown }
  } catch {
    return null
  }
}

async function putSwitch(
  segment: string,
  request: Request,
  env: Env,
  context: ExperimentalFeatureContext,
): Promise<Response> {
  const { respond } = context
  if (request.method !== 'PUT') return methodNotAllowed(respond, 'PUT')
  if (!(await context.admin()).authorized) return forbidden(respond)
  const name = featureOf(segment)
  if (name === null) {
    return badRequest(
      respond,
      `Unknown feature: expected one of ${EXPERIMENTAL_FEATURES.join(', ')}`,
    )
  }
  const body = await readJson(request)
  if (body === null) return badRequest(respond, 'Invalid JSON body')
  const parsed = parseFeatureSwitch(body.value)
  if (!parsed.ok) return badRequest(respond, parsed.error)
  return respond(await save(env, name, parsed.enabled), { headers: NO_STORE })
}
