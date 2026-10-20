// ============================================================
// Lesson site doubles — the site and the lesson-state API, at `fetch`
// ============================================================
//
// The Lessons page talks to two things: the site it is served from (each
// lesson's page, /sitemap.xml and /llms.txt) and the db-worker's lesson-state
// API. Both are stubbed at `fetch`, the true edge. The API double keeps
// state as the worker does: a save changes what the next read answers and
// logs each field it changed, and a body is checked with the contract's own
// parseLessonPatch, so a test cannot pass with a patch the worker refuses.

import { vi } from 'vitest'
import type { LessonOverride, LessonStateChange, LessonStateField, LessonStateRow, } from '@/lib/lesson-state'
import { LESSON_STATE_FIELDS, parseLessonPatch } from '@/lib/lesson-state'

/** The key the page is handed, and the only one the double accepts. */
export const ADMIN_KEY = 'test-admin-key'

/** Oct 20, 2:02 PM wherever the test runs, as the history prints it. */
export const AT = new Date(2026, 9, 20, 14, 2).toISOString()

/** How the stubbed site answers a path: a response, or a failed request. */
export type SiteAnswer =
  | { status: number; body?: string; type?: string }
  | 'offline'

export interface FakeLessonApi {
  /** Every lesson's override, keyed as the state keys it. */
  readonly lessons: Record<string, LessonOverride>
  /** Newest first, as the log endpoint answers. */
  readonly log: LessonStateChange[]
  /** Who a save is logged as: an Access identity, or null for the shared key. */
  actor: string | null
  /** When a save is logged: AT unless a test moves it. */
  now: string
  /** Answer the next save with this instead of storing it. */
  failNextSave: { status: number; body?: unknown } | 'offline' | null
  /** Answer the next read of the state with this instead. */
  failNextRead: { status: number; body?: unknown } | 'offline' | null
  /** Every save the page sent, in order, with the key it carried. */
  readonly saves: { n: number; body: unknown; key: string | null }[]
}

export function fakeLessonApi(
  seed: {
    lessons?: Record<string, LessonOverride>
    log?: LessonStateChange[]
  } = {},
): FakeLessonApi {
  return {
    lessons: { ...seed.lessons },
    log: [...(seed.log ?? [])],
    actor: 'owner@example',
    now: AT,
    failNextSave: null,
    failNextRead: null,
    saves: [],
  }
}

/** One logged change, by the owner at AT unless it says otherwise. */
export function logged(
  change: Pick<LessonStateChange, 'lesson' | 'field' | 'newValue'> &
    Partial<LessonStateChange>,
): LessonStateChange {
  return {
    id: 1,
    oldValue: null,
    changedAt: AT,
    changedBy: 'owner@example',
    ...change,
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** Hand back a planned failure once: a response, or a request that never lands. */
function failure(
  fail: { status: number; body?: unknown } | 'offline',
): Response {
  if (fail === 'offline') throw new TypeError('Failed to fetch')
  return json(fail.body ?? {}, fail.status)
}

function rowOf(api: FakeLessonApi, n: number): LessonStateRow | null {
  const override = api.lessons[String(n)]
  if (override === undefined) return null
  return {
    lesson: n,
    published: override.published ?? null,
    hook: override.hook ?? null,
    tease: override.tease ?? null,
    updatedAt: api.log[0]?.changedAt ?? AT,
    updatedBy: api.actor,
  }
}

/** Store a patch as the worker does, logging each field it changes. */
function store(
  api: FakeLessonApi,
  n: number,
  patch: LessonOverride,
): LessonStateField[] {
  const current: Record<string, boolean | string | null | undefined> = {
    ...api.lessons[String(n)],
  }
  const changed: LessonStateField[] = []
  for (const field of LESSON_STATE_FIELDS) {
    const next = patch[field]
    const old = current[field] ?? null
    if (next === undefined || next === old) continue
    changed.push(field)
    api.log.unshift({
      id: Math.max(0, ...api.log.map((c) => c.id)) + 1,
      lesson: n,
      field,
      oldValue: old,
      newValue: next,
      changedAt: api.now,
      changedBy: api.actor,
    })
    if (next === null) delete current[field]
    else current[field] = next
  }
  if (Object.keys(current).length === 0) delete api.lessons[String(n)]
  else api.lessons[String(n)] = current as LessonOverride
  return changed
}

function save(
  api: FakeLessonApi,
  n: number,
  init: RequestInit | undefined,
  key: string | null,
): Response {
  const body = JSON.parse(String(init?.body)) as unknown
  api.saves.push({ n, body, key })
  const fail = api.failNextSave
  api.failNextSave = null
  if (fail !== null) return failure(fail)
  const parsed = parseLessonPatch(body)
  if (!parsed.ok) return json({ error: parsed.error }, 400)
  const changed = store(api, n, parsed.patch)
  return json({ row: rowOf(api, n), changed })
}

function answerApi(
  api: FakeLessonApi,
  url: string,
  init: RequestInit | undefined,
): Response {
  const { pathname, searchParams } = new URL(url, 'https://site.test')
  if (pathname === '/api/lessons/state') {
    const fail = api.failNextRead
    api.failNextRead = null
    if (fail !== null) return failure(fail)
    return json({
      version: 1,
      updatedAt: api.log[0]?.changedAt ?? null,
      lessons: api.lessons,
    })
  }
  const key = new Headers(init?.headers).get('X-Admin-Key')
  if (key !== ADMIN_KEY) return json({ error: 'Admin key required' }, 403)
  if (pathname === '/api/admin/lessons/log') {
    const n = Number(searchParams.get('lesson'))
    return json({ changes: api.log.filter((change) => change.lesson === n) })
  }
  return save(api, Number(pathname.split('/').at(-1)), init, key)
}

/**
 * Stub the site the page is served from, and the lesson-state API behind
 * `/api/`. A site path it does not know is a 404.
 */
export function stubLessonSite(
  site: Record<string, SiteAnswer>,
  api: FakeLessonApi = fakeLessonApi(),
) {
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.startsWith('/api/')) return answerApi(api, url, init)
      const answer = site[url] ?? { status: 404 }
      if (answer === 'offline') throw new TypeError('Failed to fetch')
      return new Response(
        init?.method === 'HEAD' ? null : (answer.body ?? ''),
        {
          status: answer.status,
          headers: { 'content-type': answer.type ?? 'text/plain' },
        },
      )
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** The site paths the page asked for, each once, sorted: the API's left out. */
export function sitePathsAsked(fetchMock: ReturnType<typeof stubLessonSite>) {
  return [
    ...new Set(
      fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => !url.startsWith('/api/')),
    ),
  ].sort()
}
