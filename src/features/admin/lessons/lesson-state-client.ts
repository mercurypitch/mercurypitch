// ============================================================
// Lesson state client — the Content Studio's reads and writes of lesson overrides
// ============================================================
//
// The three lesson-state endpoints (src/lib/lesson-state.ts holds their
// shapes; workers/db-worker/src/lesson-state-routes.ts answers them):
//
//   GET /api/lessons/state      Public. Every lesson's overrides.
//   PUT /api/admin/lessons/:n   Admin. Sets or clears one lesson's fields.
//   GET /api/admin/lessons/log  Admin. Who changed what, newest first.
//
// The admin credential travels as the studio's other services send it, in
// X-Admin-Key. Nothing here throws: each call answers a result the page can
// show, with the API's own error text, and a refused key is a kind of its
// own, because the page then offers to unlock the studio again. Every read
// skips the HTTP cache: the public state may be kept for 30 seconds, and the
// console has to show what a save just did.

import { API_BASE_URL } from '@/lib/defaults'
import type { LessonOverride, LessonSave, LessonState, LessonStateChange, LessonStateField, LessonStateRow, } from '@/lib/lesson-state'
import { LESSON_STATE_FIELDS, parseLessonState } from '@/lib/lesson-state'
import type { Fetcher } from './lesson-admin'

/** Why a call came back without what it asked for. */
export type LessonApiError =
  /** 403: the admin key is missing or wrong. */
  | { readonly kind: 'forbidden'; readonly message: string }
  /** Any other answer that is not a success, with the API's error text. */
  | {
      readonly kind: 'refused'
      readonly status: number
      readonly message: string
    }
  /** A success whose body this page cannot read. */
  | { readonly kind: 'unreadable'; readonly message: string }
  /** The request failed before the API answered. */
  | { readonly kind: 'offline'; readonly message: string }

export type LessonApiResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: LessonApiError }

// Read at call time, so a test that stubs the global is the one asked.
const fetchNow: Fetcher = (input, init) => fetch(input, init)

/** Same-origin when no API is configured, as in the e2e bundle. */
function url(path: string): string {
  return `${API_BASE_URL ?? ''}${path}`
}

const OFFLINE: LessonApiError = {
  kind: 'offline',
  message: 'The content API could not be reached.',
}

const UNREADABLE: LessonApiError = {
  kind: 'unreadable',
  message: 'The content API answered something this page cannot read.',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isField(value: unknown): value is LessonStateField {
  return (LESSON_STATE_FIELDS as readonly unknown[]).includes(value)
}

const isText = (value: unknown): value is string => typeof value === 'string'
const isTextOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

async function bodyOf(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    return undefined
  }
}

/** A refusal, in the API's words when it gave any. */
async function refusal(response: Response): Promise<LessonApiError> {
  const body = await bodyOf(response)
  const said = isRecord(body) && isText(body.error) ? body.error : null
  if (response.status === 403) {
    return { kind: 'forbidden', message: said ?? 'Admin key required' }
  }
  return {
    kind: 'refused',
    status: response.status,
    message: said ?? `The content API answered ${response.status}.`,
  }
}

/** One request, read by `read` on a success; null from `read` is an unreadable body. */
async function call<T>(
  fetcher: Fetcher,
  path: string,
  init: RequestInit,
  read: (body: unknown) => T | null,
): Promise<LessonApiResult<T>> {
  let response: Response
  try {
    response = await fetcher(url(path), init)
  } catch {
    return { ok: false, error: OFFLINE }
  }
  if (!response.ok) return { ok: false, error: await refusal(response) }
  const value = read(await bodyOf(response))
  return value === null ? { ok: false, error: UNREADABLE } : { ok: true, value }
}

function adminHeaders(adminKey: string): Record<string, string> {
  return { 'X-Admin-Key': adminKey }
}

/** Every lesson's overrides, as the site reads them. */
export function fetchLessonState(
  fetcher: Fetcher = fetchNow,
): Promise<LessonApiResult<LessonState>> {
  return call(
    fetcher,
    '/api/lessons/state',
    { cache: 'no-store' },
    parseLessonState,
  )
}

function readRow(value: unknown): LessonStateRow | null {
  if (!isRecord(value) || typeof value.lesson !== 'number') return null
  const { published, hook, tease, updatedAt, updatedBy } = value
  if (published !== null && typeof published !== 'boolean') return null
  if (!isTextOrNull(hook) || !isTextOrNull(tease) || !isText(updatedAt)) {
    return null
  }
  if (!isTextOrNull(updatedBy)) return null
  return {
    lesson: value.lesson,
    published,
    hook,
    tease,
    updatedAt,
    updatedBy,
  }
}

function readSave(body: unknown): LessonSave | null {
  if (!isRecord(body) || !Array.isArray(body.changed)) return null
  const row = body.row === null ? null : readRow(body.row)
  if (body.row !== null && row === null) return null
  return { row, changed: body.changed.filter(isField) }
}

/**
 * Set or clear fields of lesson `n`: a value sets one, null puts it back to
 * the code's default. Answers the lesson's row as it now stands (null once
 * nothing on it is overridden) and the fields the save changed.
 */
export function saveLesson(
  adminKey: string,
  n: number,
  patch: LessonOverride,
  fetcher: Fetcher = fetchNow,
): Promise<LessonApiResult<LessonSave>> {
  return call(
    fetcher,
    `/api/admin/lessons/${n}`,
    {
      method: 'PUT',
      headers: {
        ...adminHeaders(adminKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    },
    readSave,
  )
}

const isLogged = (value: unknown): value is boolean | string | null =>
  value === null || typeof value === 'boolean' || typeof value === 'string'

function readChange(value: unknown): LessonStateChange[] {
  if (!isRecord(value)) return []
  const { id, lesson, field, oldValue, newValue, changedAt, changedBy } = value
  if (typeof id !== 'number' || typeof lesson !== 'number') return []
  if (!isField(field) || !isLogged(oldValue) || !isLogged(newValue)) return []
  if (!isText(changedAt) || !isTextOrNull(changedBy)) return []
  return [{ id, lesson, field, oldValue, newValue, changedAt, changedBy }]
}

function readLog(body: unknown): LessonStateChange[] | null {
  if (!isRecord(body) || !Array.isArray(body.changes)) return null
  return body.changes.flatMap(readChange)
}

/** Lesson `n`'s latest changes, newest first: at most 50, as the API keeps them. */
export function fetchLessonLog(
  adminKey: string,
  n: number,
  fetcher: Fetcher = fetchNow,
): Promise<LessonApiResult<LessonStateChange[]>> {
  return call(
    fetcher,
    `/api/admin/lessons/log?lesson=${n}`,
    { headers: adminHeaders(adminKey), cache: 'no-store' },
    readLog,
  )
}
