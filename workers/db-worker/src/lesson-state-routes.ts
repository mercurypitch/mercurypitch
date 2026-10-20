// ============================================================
// Lesson state routes — runtime publish state for Find Your Pitch
// ============================================================
//
// The Content Studio's per-lesson overrides (src/lib/lesson-state.ts), kept
// in D1 by 0071_lesson_state.sql:
//
//   GET /api/lessons/state       Public. The LessonState the site worker and
//                                the lesson pages read: cached for 30 s,
//                                with a strong ETag; If-None-Match answers
//                                304.
//   PUT /api/admin/lessons/:n    Admin. A LessonOverride patch for lesson n.
//                                A value sets a field, null clears it, and a
//                                row left with nothing set is deleted.
//   GET /api/admin/lessons/log   Admin. The latest 50 changes, newest first;
//                                ?lesson=N keeps to one lesson.
//
// A save is one D1 batch, so one transaction. Each log row reads the old
// value inside it and is written only when the new one differs, so two saves
// that race cannot both log the same "before", and a save that changes
// nothing writes nothing, not even updated_at.

import type { LessonOverride, LessonSave, LessonState, LessonStateChange, LessonStateField, LessonStateLog, LessonStateRow, } from '../../../src/lib/lesson-state'
import { LESSON_STATE_FIELDS, LESSON_STATE_VERSION, parseLessonNumber, parseLessonPatch, } from '../../../src/lib/lesson-state'
import type { AdminResolution } from './access'
import type { Env } from './auth'

type Respond = (body: object | null, init?: ResponseInit) => Response

export interface LessonStateContext {
  respond: Respond
  /** Asked only by the admin routes, so the public read never pays for an Access check. */
  admin: () => Promise<AdminResolution>
}

const STATE_PATH = '/api/lessons/state'
const ADMIN_PREFIX = '/api/admin/lessons/'
const LOG_LIMIT = 50

/**
 * Any cache may keep the state for 30 s, then serve it stale for up to five
 * minutes while it fetches it again: a change shows within a minute, and a
 * lesson page never waits on this worker to learn it.
 */
const PUBLIC_CACHE = 'public, max-age=30, stale-while-revalidate=300'

/** Admin answers say who changed what, so nothing may keep a copy. */
const NO_STORE = { 'Cache-Control': 'private, no-store' }

const ROW_COLUMNS = 'lesson, published, hook, tease, updated_at, updated_by'
const LOG_COLUMNS =
  'id, lesson, field, old_value, new_value, changed_at, changed_by'

/** A log row's old value, as text, read from the row a save is changing. */
const OLD_TEXT: Record<LessonStateField, string> = {
  published: `CASE published WHEN 1 THEN 'true' WHEN 0 THEN 'false' END`,
  hook: 'hook',
  tease: 'tease',
}

interface StateRow {
  lesson: number
  published: number | null
  hook: string | null
  tease: string | null
  updated_at: string
  updated_by: string | null
}

interface LastChangeRow {
  changed_at: string
}

interface LogRow {
  id: number
  lesson: number
  field: string
  old_value: string | null
  new_value: string | null
  changed_at: string
  changed_by: string | null
}

type OverrideValue = LessonOverride[LessonStateField]

/** True for every path this module answers; index.ts routes on it. */
export function isLessonStatePath(pathname: string): boolean {
  return pathname === STATE_PATH || pathname.startsWith(ADMIN_PREFIX)
}

export async function handleLessonStateRequest(
  request: Request,
  env: Env,
  url: URL,
  context: LessonStateContext,
): Promise<Response> {
  if (url.pathname === STATE_PATH) {
    return getState(request, env, context.respond)
  }
  const segment = url.pathname.slice(ADMIN_PREFIX.length)
  if (segment === 'log') return getLog(request, env, url, context)
  if (segment === '' || segment.includes('/')) {
    return context.respond({ error: 'Not found' }, { status: 404 })
  }
  return putLesson(segment, request, env, context)
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

// ── GET /api/lessons/state ───────────────────────────────────────────

function overrideOf(row: StateRow): LessonOverride {
  const override: LessonOverride = {}
  if (row.published !== null) override.published = row.published === 1
  if (row.hook !== null) override.hook = row.hook
  if (row.tease !== null) override.tease = row.tease
  return override
}

/** The latest of some ISO times, or null when there are none. */
function latest(times: readonly (string | null)[]): string | null {
  let best: string | null = null
  for (const time of times) {
    if (time !== null && (best === null || time > best)) best = time
  }
  return best
}

/**
 * The state as it stands. updatedAt is the last change the log holds, so a
 * cleared lesson moves it on too; a row's own time counts as well, for a row
 * written by hand without a log entry.
 */
async function readState(env: Env): Promise<LessonState> {
  // One batch, so the overrides and their time are read at the same moment.
  const [overrides, lastChange] = await env.DB.batch<StateRow | LastChangeRow>([
    env.DB.prepare(
      `SELECT ${ROW_COLUMNS} FROM lesson_state ORDER BY lesson ASC`,
    ),
    env.DB.prepare(
      `SELECT changed_at FROM lesson_state_log ORDER BY id DESC LIMIT 1`,
    ),
  ])
  const rows = (overrides?.results ?? []) as StateRow[]
  const last = (lastChange?.results ?? []) as LastChangeRow[]
  const lessons: Record<string, LessonOverride> = {}
  for (const row of rows) {
    const override = overrideOf(row)
    if (Object.keys(override).length > 0) {
      lessons[String(row.lesson)] = override
    }
  }
  return {
    version: LESSON_STATE_VERSION,
    updatedAt: latest([
      last[0]?.changed_at ?? null,
      ...rows.map((row) => row.updated_at),
    ]),
    lessons,
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * If-None-Match, compared weakly, as RFC 9110 asks of it: a cache that
 * compressed the body may send back W/"<tag>", which is still this
 * representation. "*" matches whatever is current.
 */
function etagMatches(header: string | null, etag: string): boolean {
  if (header === null) return false
  return header.split(',').some((candidate) => {
    const tag = candidate.trim()
    return tag === '*' || tag === etag || tag === `W/${etag}`
  })
}

async function getState(
  request: Request,
  env: Env,
  respond: Respond,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return methodNotAllowed(respond, 'GET, HEAD')
  }
  const state = await readState(env)
  // Strong: the hash of the very bytes a 200 carries, since respond()
  // serializes the same object the same way.
  const etag = `"${await sha256Hex(JSON.stringify(state))}"`
  const headers = { 'Cache-Control': PUBLIC_CACHE, ETag: etag }
  if (etagMatches(request.headers.get('If-None-Match'), etag)) {
    return respond(null, { status: 304, headers })
  }
  if (request.method === 'HEAD') {
    return respond(null, {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
  return respond(state, { headers })
}

// ── PUT /api/admin/lessons/:n ────────────────────────────────────────

/** A value as its lesson_state column stores it. */
function columnValue(value: OverrideValue): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  return value
}

/** A value as a log row keeps it: 'true' or 'false', or the variant id. */
function logText(value: OverrideValue): string | null {
  if (value === null || value === undefined) return null
  return typeof value === 'boolean' ? String(value) : value
}

/** One log row for `field`, written only if the save changes it. */
function logStatement(
  env: Env,
  lesson: number,
  field: LessonStateField,
  value: string | null,
  now: string,
  actor: string | null,
): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO lesson_state_log
       (lesson, field, old_value, new_value, changed_at, changed_by)
     SELECT ?1, ?2, prior.old_value, ?3, ?4, ?5
       FROM (SELECT (SELECT ${OLD_TEXT[field]} FROM lesson_state
                      WHERE lesson = ?1) AS old_value) AS prior
      WHERE prior.old_value IS NOT ?3`,
  ).bind(lesson, field, value, now, actor)
}

/**
 * Create the row, or set the fields the patch names on the one there. An
 * existing row is updated only when one of those fields differs, so its
 * updated_at stays the time of its last real change.
 */
function upsertStatement(
  env: Env,
  lesson: number,
  patch: LessonOverride,
  fields: readonly LessonStateField[],
  now: string,
  actor: string | null,
): D1PreparedStatement {
  const sets = [
    ...fields.map((field) => `${field} = excluded.${field}`),
    'updated_at = excluded.updated_at',
    'updated_by = excluded.updated_by',
  ]
  const differs = fields.map(
    (field) => `lesson_state.${field} IS NOT excluded.${field}`,
  )
  return env.DB.prepare(
    `INSERT INTO lesson_state
       (lesson, published, hook, tease, updated_at, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (lesson) DO UPDATE SET ${sets.join(', ')}
      WHERE ${differs.length > 0 ? differs.join(' OR ') : '0'}`,
  ).bind(
    lesson,
    columnValue(patch.published),
    columnValue(patch.hook),
    columnValue(patch.tease),
    now,
    actor,
  )
}

function publicRow(row: StateRow): LessonStateRow {
  return {
    lesson: row.lesson,
    published: row.published === null ? null : row.published === 1,
    hook: row.hook,
    tease: row.tease,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

async function save(
  env: Env,
  lesson: number,
  patch: LessonOverride,
  actor: string | null,
): Promise<LessonSave> {
  const now = new Date().toISOString()
  const fields = LESSON_STATE_FIELDS.filter(
    (field) => patch[field] !== undefined,
  )
  // Order matters: the log rows read the row before the upsert changes it,
  // and the read at the end sees what the delete left.
  const results = await env.DB.batch<StateRow>([
    ...fields.map((field) =>
      logStatement(env, lesson, field, logText(patch[field]), now, actor),
    ),
    upsertStatement(env, lesson, patch, fields, now, actor),
    env.DB.prepare(
      `DELETE FROM lesson_state
        WHERE lesson = ? AND published IS NULL AND hook IS NULL
          AND tease IS NULL`,
    ).bind(lesson),
    env.DB.prepare(
      `SELECT ${ROW_COLUMNS} FROM lesson_state WHERE lesson = ?`,
    ).bind(lesson),
  ])
  const row = results.at(-1)?.results[0]
  return {
    row: row === undefined ? null : publicRow(row),
    changed: fields.filter((_, i) => (results[i]?.meta.changes ?? 0) > 0),
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

async function putLesson(
  segment: string,
  request: Request,
  env: Env,
  context: LessonStateContext,
): Promise<Response> {
  const { respond } = context
  if (request.method !== 'PUT') return methodNotAllowed(respond, 'PUT')
  const admin = await context.admin()
  if (!admin.authorized) return forbidden(respond)
  const lesson = parseLessonNumber(segment)
  if (lesson === null) {
    return badRequest(respond, 'Lesson must be a whole number from 0 to 99')
  }
  const body = await readJson(request)
  if (body === null) return badRequest(respond, 'Invalid JSON body')
  const parsed = parseLessonPatch(body.value)
  if (!parsed.ok) return badRequest(respond, parsed.error)
  const saved = await save(
    env,
    lesson,
    parsed.patch,
    admin.accessIdentity?.subject ?? null,
  )
  return respond(saved, { headers: NO_STORE })
}

// ── GET /api/admin/lessons/log ───────────────────────────────────────

/** A logged value as its field holds it: published back to a boolean. */
function loggedValue(
  field: LessonStateField,
  text: string | null,
): boolean | string | null {
  if (text === null || field !== 'published') return text
  if (text === 'true') return true
  return text === 'false' ? false : null
}

/** The change a log row records; none for a field this code does not know. */
function publicChange(row: LogRow): LessonStateChange[] {
  const field = LESSON_STATE_FIELDS.find((name) => name === row.field)
  if (field === undefined) return []
  return [
    {
      id: row.id,
      lesson: row.lesson,
      field,
      oldValue: loggedValue(field, row.old_value),
      newValue: loggedValue(field, row.new_value),
      changedAt: row.changed_at,
      changedBy: row.changed_by,
    },
  ]
}

async function getLog(
  request: Request,
  env: Env,
  url: URL,
  context: LessonStateContext,
): Promise<Response> {
  const { respond } = context
  if (request.method !== 'GET') return methodNotAllowed(respond, 'GET')
  if (!(await context.admin()).authorized) return forbidden(respond)
  const asked = url.searchParams.get('lesson')
  const lesson = asked === null ? null : parseLessonNumber(asked)
  if (asked !== null && lesson === null) {
    return badRequest(respond, 'Lesson must be a whole number from 0 to 99')
  }
  const statement =
    lesson === null
      ? env.DB.prepare(
          `SELECT ${LOG_COLUMNS} FROM lesson_state_log
            ORDER BY id DESC LIMIT ?`,
        ).bind(LOG_LIMIT)
      : env.DB.prepare(
          `SELECT ${LOG_COLUMNS} FROM lesson_state_log
            WHERE lesson = ? ORDER BY id DESC LIMIT ?`,
        ).bind(lesson, LOG_LIMIT)
  const { results } = await statement.all<LogRow>()
  const log: LessonStateLog = { changes: results.flatMap(publicChange) }
  return respond(log, { headers: NO_STORE })
}
