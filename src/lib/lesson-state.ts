// ============================================================
// Lesson state — the overrides the admin console sets on each lesson
// ============================================================
//
// The one contract every side of runtime lesson publishing imports. The
// db-worker stores and serves it (GET /api/lessons/state, PUT
// /api/admin/lessons/:n, GET /api/admin/lessons/log), the site worker gates
// /learn/NN and rewrites the hook from it, and the lesson pages and the
// Content Studio read it.
//
// An override only moves a lesson away from what its code says. A field that
// is absent or null is the code's default, so the empty state is the site as
// built, and a lesson with nothing overridden is left out of the map. A hook
// or tease override names one of the wordings the lesson's code already
// holds, by its variant id. The server cannot know which ids a lesson has, so
// a reader that meets an id its code lacks keeps the default wording.
//
// Two readers, on purpose:
// - parseLessonState is tolerant. The site and the lesson pages must keep
//   working when the API answers something newer or odder than they know, so
//   it keeps what it understands and drops the rest. Only a version it does
//   not know is refused outright, with null: its fields may no longer mean
//   what this code thinks they mean.
// - parseLessonPatch is strict. It guards the one write, where a misspelled
//   field dropped quietly would read as saved while changing nothing.
//
// Pure and import-free, because the db-worker compiles it in as well.
// deploy-db.yml lists this file, so a change here redeploys the dev worker.

/** The only version this code reads and writes. */
export const LESSON_STATE_VERSION = 1

/**
 * A wording's id: 1 to 32 lowercase letters, digits and hyphens, not
 * starting with a hyphen. Plain enough for a URL, a log line or an HTML
 * attribute without escaping.
 */
export const VARIANT_ID = /^[a-z0-9][a-z0-9-]{0,31}$/

/** The fields an override may set, in the order they are stored and logged. */
export const LESSON_STATE_FIELDS = ['published', 'hook', 'tease'] as const

export type LessonStateField = (typeof LESSON_STATE_FIELDS)[number]

/** What the admin console overrides on one lesson. Absent or null: the code's default. */
export interface LessonOverride {
  /** Listed and served (true) or held back (false), whatever the code says. */
  published?: boolean | null
  /** The variant id of the hook wording to show. */
  hook?: string | null
  /** The variant id of the tease wording to show. */
  tease?: string | null
}

/** The public state, as GET /api/lessons/state answers it. */
export interface LessonState {
  version: 1
  /** When an override last changed, clearing included; null if none ever has. */
  updatedAt: string | null
  /** Keyed by lesson number, "0" to "99"; only lessons with an override appear. */
  lessons: Record<string, LessonOverride>
}

/** One lesson's stored override, as the admin endpoints answer it. */
export interface LessonStateRow {
  lesson: number
  published: boolean | null
  hook: string | null
  tease: string | null
  /** When one of its fields last changed. */
  updatedAt: string
  /** The Cloudflare Access identity that changed it last; null when the shared admin key did. */
  updatedBy: string | null
}

/**
 * PUT /api/admin/lessons/:n: the lesson's row as it now stands, null once
 * nothing on it is overridden, and the fields this save changed.
 */
export interface LessonSave {
  row: LessonStateRow | null
  changed: LessonStateField[]
}

/** One field's change, as GET /api/admin/lessons/log lists it. */
export interface LessonStateChange {
  id: number
  lesson: number
  field: LessonStateField
  /** The value before and after the change; null is the code's default. */
  oldValue: boolean | string | null
  newValue: boolean | string | null
  changedAt: string
  /** The Cloudflare Access identity; null when the shared admin key made the change. */
  changedBy: string | null
}

/** GET /api/admin/lessons/log: the latest changes, newest first. */
export interface LessonStateLog {
  changes: LessonStateChange[]
}

export type LessonPatchResult =
  | { ok: true; patch: LessonOverride }
  | { ok: false; error: string }

/** A lesson number as the map keys it: "0" to "99", no leading zero. */
const LESSON_KEY = /^(?:0|[1-9][0-9]?)$/

const VARIANT_RULE =
  'a variant id: 1 to 32 lowercase letters, digits, or hyphens, not starting with a hyphen'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isVariant(value: unknown): value is string {
  return typeof value === 'string' && VARIANT_ID.test(value)
}

/**
 * The lesson a path segment or query value names, as a number from 0 to 99.
 * One or two digits, so "3" and "03" (as /learn/03 writes it) are both
 * Lesson 3. Null for anything else.
 */
export function parseLessonNumber(text: string): number | null {
  return /^[0-9]{1,2}$/.test(text) ? Number(text) : null
}

/** One lesson's override, as far as it is understood; null when none of it is. */
function readOverride(value: unknown): LessonOverride | null {
  if (!isRecord(value)) return null
  const override: LessonOverride = {}
  if (typeof value.published === 'boolean') override.published = value.published
  if (isVariant(value.hook)) override.hook = value.hook
  if (isVariant(value.tease)) override.tease = value.tease
  return Object.keys(override).length > 0 ? override : null
}

function readLessons(value: unknown): Record<string, LessonOverride> {
  const lessons: Record<string, LessonOverride> = {}
  if (!isRecord(value)) return lessons
  for (const [key, entry] of Object.entries(value)) {
    const override = LESSON_KEY.test(key) ? readOverride(entry) : null
    if (override !== null) lessons[key] = override
  }
  return lessons
}

/**
 * Read a lesson state the API answered (the parsed JSON), keeping what this
 * code understands. Lesson keys outside "0" to "99", fields it does not know,
 * values of the wrong type, nulls and lessons left with nothing are dropped,
 * so every override it returns sets at least one field. Null for anything
 * that is not a version 1 state: a reader must not guess at a version it
 * does not know.
 */
export function parseLessonState(json: unknown): LessonState | null {
  if (!isRecord(json) || json.version !== LESSON_STATE_VERSION) return null
  return {
    version: LESSON_STATE_VERSION,
    updatedAt: typeof json.updatedAt === 'string' ? json.updatedAt : null,
    lessons: readLessons(json.lessons),
  }
}

/** Why `value` cannot be what `field` holds; null when it can. */
function fieldError(field: LessonStateField, value: unknown): string | null {
  if (value === null) return null
  if (field === 'published') {
    return typeof value === 'boolean'
      ? null
      : 'published must be true, false, or null'
  }
  return isVariant(value) ? null : `${field} must be null or ${VARIANT_RULE}`
}

function isField(key: string): key is LessonStateField {
  return (LESSON_STATE_FIELDS as readonly string[]).includes(key)
}

/**
 * Validate the body of PUT /api/admin/lessons/:n (the parsed JSON). Each of
 * published, hook and tease may be given; a value sets the field and null
 * clears it back to the code's default. An unknown key, a value of the wrong
 * type and a body that names no field are all refused. A key whose value is
 * undefined counts as absent, as JSON.stringify would leave it out.
 */
export function parseLessonPatch(json: unknown): LessonPatchResult {
  if (!isRecord(json)) return { ok: false, error: 'Body must be a JSON object' }
  const patch: Partial<Record<LessonStateField, unknown>> = {}
  for (const [key, value] of Object.entries(json)) {
    if (value === undefined) continue
    if (!isField(key)) {
      return { ok: false, error: `Unknown field: ${key.slice(0, 40)}` }
    }
    const error = fieldError(key, value)
    if (error !== null) return { ok: false, error }
    patch[key] = value
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'Set at least one of published, hook, or tease' }
  }
  return { ok: true, patch: patch as LessonOverride }
}
