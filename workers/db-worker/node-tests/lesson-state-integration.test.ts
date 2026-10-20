// @vitest-environment node
//
// ── Runtime lesson publishing ────────────────────────────────────────
//
// The Content Studio's per-lesson overrides, run against real SQLite with
// every migration applied and driven through the worker's own routes. What
// it guards:
//
// - **Only an admin writes.** No key, a wrong key, or the key once Access is
//   strict, and nothing is stored. A verified Access identity is recorded as
//   the author of the change.
// - **The defaults are the code's.** An empty table answers no overrides,
//   a field sent as null goes back to the code's default, and a lesson
//   cleared of everything loses its row.
// - **The log says what happened.** One row per field that really changed,
//   each against the value it replaced, even when two saves race.
// - **Caches can trust the ETag.** It changes when the state does, stays
//   when it does not, and If-None-Match answers 304 while it holds.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type { LessonSave, LessonState, LessonStateLog, } from '../../../src/lib/lesson-state'
import { parseLessonState } from '../../../src/lib/lesson-state'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, interleaved, SqliteD1Database } from './sqlite-d1'

const ADMIN_KEY = 'lesson-state-integration-admin-key'
const ADMIN = { 'X-Admin-Key': ADMIN_KEY }
const STATE = '/api/lessons/state'
const PUBLIC_CACHE = 'public, max-age=30, stale-while-revalidate=300'
const NOON = '2026-10-20T12:00:00.000Z'

let sqlite: DatabaseSync
let d1: SqliteD1Database
let env: Env

interface CallOptions {
  body?: unknown
  /** A body sent as written, for the ones that are not valid JSON. */
  raw?: string
  headers?: Record<string, string>
}

function call(
  method: string,
  path: string,
  options: CallOptions = {},
): Promise<Response> {
  const { body, raw, headers = {} } = options
  const text = raw ?? (body === undefined ? undefined : JSON.stringify(body))
  return worker.fetch(
    new Request(`https://api.test${path}`, {
      method,
      headers:
        text === undefined
          ? headers
          : { 'Content-Type': 'application/json', ...headers },
      body: text,
    }),
    env,
    {} as ExecutionContext,
  )
}

function put(
  lesson: string | number,
  body: unknown,
  headers: Record<string, string> = ADMIN,
): Promise<Response> {
  return call('PUT', `/api/admin/lessons/${lesson}`, { body, headers })
}

/** A save the admin makes, which has to succeed. */
async function save(lesson: number, body: unknown): Promise<LessonSave> {
  const response = await put(lesson, body)
  expect(response.status).toBe(200)
  return (await response.json()) as LessonSave
}

async function publicState(): Promise<LessonState> {
  const response = await call('GET', STATE)
  expect(response.status).toBe(200)
  return (await response.json()) as LessonState
}

async function etagNow(): Promise<string> {
  return (await call('GET', STATE)).headers.get('ETag') ?? ''
}

async function history(query = ''): Promise<LessonStateLog> {
  const response = await call('GET', `/api/admin/lessons/log${query}`, {
    headers: ADMIN,
  })
  expect(response.status).toBe(200)
  return (await response.json()) as LessonStateLog
}

function at(time: string): void {
  vi.setSystemTime(new Date(time))
}

function stored(): Record<string, unknown>[] {
  return sqlite
    .prepare('SELECT * FROM lesson_state ORDER BY lesson')
    .all() as Record<string, unknown>[]
}

interface LoggedRow {
  lesson: number
  field: string
  old_value: string | null
  new_value: string | null
  changed_at: string
  changed_by: string | null
}

function logged(): LoggedRow[] {
  return sqlite
    .prepare(
      `SELECT lesson, field, old_value, new_value, changed_at, changed_by
         FROM lesson_state_log ORDER BY id`,
    )
    .all() as unknown as LoggedRow[]
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  at(NOON)
  sqlite = new DatabaseSync(':memory:')
  applyMigrations(sqlite)
  d1 = new SqliteD1Database(sqlite)
  env = {
    DB: d1 as unknown as D1Database,
    ALLOWED_ORIGINS: 'localhost',
    ADMIN_KEY,
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  sqlite.close()
})

describe('0071_lesson_state', () => {
  it('holds a lesson to 0 to 99 and published to 0, 1 or NULL', () => {
    const insert = (lesson: number, published: number | null) => () =>
      sqlite
        .prepare(
          `INSERT INTO lesson_state (lesson, published, updated_at)
           VALUES (?, ?, ?)`,
        )
        .run(lesson, published, NOON)

    expect(insert(100, 1)).toThrow(/CHECK constraint failed/)
    expect(insert(-1, 1)).toThrow(/CHECK constraint failed/)
    expect(insert(3, 2)).toThrow(/CHECK constraint failed/)
    expect(insert(0, null)).not.toThrow()
    expect(insert(99, 0)).not.toThrow()
  })
})

describe('GET /api/lessons/state', () => {
  it('answers no overrides, never changed, on an empty table', async () => {
    const response = await call('GET', STATE)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      version: 1,
      updatedAt: null,
      lessons: {},
    })
    expect(response.headers.get('Cache-Control')).toBe(PUBLIC_CACHE)
    expect(response.headers.get('ETag')).toMatch(/^"[0-9a-f]{64}"$/)
  })

  it('lets an app origin read it and its ETag, and refuses an unlisted origin', async () => {
    const app = await call('GET', STATE, {
      headers: { Origin: 'http://localhost:3000' },
    })
    const preflight = await call('OPTIONS', STATE, {
      headers: { Origin: 'http://localhost:3000' },
    })
    const stranger = await call('GET', STATE, {
      headers: { Origin: 'https://elsewhere.example' },
    })

    expect(app.status).toBe(200)
    expect(app.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(app.headers.get('Access-Control-Expose-Headers')).toContain('ETag')
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain(
      'If-None-Match',
    )
    expect(stranger.status).toBe(403)
  })

  it('answers 304 and no body to a request that carries its ETag, strong or weak', async () => {
    const etag = await etagNow()

    const strong = await call('GET', STATE, {
      headers: { 'If-None-Match': etag },
    })
    const weak = await call('GET', STATE, {
      headers: { 'If-None-Match': `"stale", W/${etag}` },
    })

    expect([strong.status, weak.status]).toEqual([304, 304])
    expect(await strong.text()).toBe('')
    expect(strong.headers.get('ETag')).toBe(etag)
    expect(strong.headers.get('Cache-Control')).toBe(PUBLIC_CACHE)
    expect(strong.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('answers 200 with a new ETag once a lesson changes', async () => {
    const before = await etagNow()
    await save(3, { published: true })

    const after = await call('GET', STATE, {
      headers: { 'If-None-Match': before },
    })

    expect(after.status).toBe(200)
    expect(after.headers.get('ETag')).not.toBe(before)
    expect(((await after.json()) as LessonState).lessons).toEqual({
      '3': { published: true },
    })
  })

  it('keeps its ETag across a save that changes nothing', async () => {
    await save(3, { published: true })
    const before = await etagNow()
    at('2026-10-20T13:00:00.000Z')

    await save(3, { published: true })

    expect(await etagNow()).toBe(before)
  })

  it('answers HEAD with the same headers and no body', async () => {
    const etag = await etagNow()

    const head = await call('HEAD', STATE)

    expect(head.status).toBe(200)
    expect(head.headers.get('ETag')).toBe(etag)
    expect(head.headers.get('Content-Type')).toBe('application/json')
    expect(await head.text()).toBe('')
  })

  it('answers exactly what the tolerant reader keeps', async () => {
    await save(0, { hook: 'question' })
    await save(5, { published: false, hook: 'short', tease: 'stair' })

    const body = await publicState()

    expect(body.lessons).toEqual({
      '0': { hook: 'question' },
      '5': { published: false, hook: 'short', tease: 'stair' },
    })
    expect(parseLessonState(body)).toEqual(body)
  })

  it('refuses to be written to', async () => {
    const response = await call('POST', STATE, {
      body: { version: 1, lessons: {} },
      headers: ADMIN,
    })

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET, HEAD')
  })
})

describe('PUT /api/admin/lessons/:n', () => {
  it('refuses a save without the admin key, or with a wrong one, and stores nothing', async () => {
    const missing = await put(3, { published: true }, {})
    const wrong = await put(3, { published: true }, { 'X-Admin-Key': 'nope' })

    expect([missing.status, wrong.status]).toEqual([403, 403])
    expect(await missing.json()).toEqual({ error: 'Admin key required' })
    expect(stored()).toEqual([])
    expect(logged()).toEqual([])
  })

  it('refuses a lesson number outside 0 to 99', async () => {
    const segments = ['100', '-1', '3.5', 'abc', '%20', '003']

    const responses = await Promise.all(
      segments.map((segment) => put(segment, { published: true })),
    )

    expect(responses.map((response) => response.status)).toEqual(
      segments.map(() => 400),
    )
    expect(await responses[0]?.json()).toEqual({
      error: 'Lesson must be a whole number from 0 to 99',
    })
    expect(stored()).toEqual([])
  })

  it.each([
    ['not JSON', '{published: true'],
    ['an array', '[{"published": true}]'],
    ['an empty object', '{}'],
    ['a field it does not know', '{"published": true, "film": "live"}'],
    ['published as a string', '{"published": "true"}'],
    ['a hook that is not a variant id', '{"hook": "Short Hook"}'],
  ])('refuses a body that is %s, and stores nothing', async (_, raw) => {
    const response = await call('PUT', '/api/admin/lessons/3', {
      raw,
      headers: ADMIN,
    })

    expect(response.status).toBe(400)
    expect(stored()).toEqual([])
    expect(logged()).toEqual([])
  })

  it('answers only PUT on a lesson, and nothing below one', async () => {
    const get = await call('GET', '/api/admin/lessons/3', { headers: ADMIN })
    const deeper = await put('3/hook', { hook: 'short' })

    expect([get.status, get.headers.get('Allow'), deeper.status]).toEqual([
      405,
      'PUT',
      404,
    ])
  })

  it('stores a published lesson and answers its row', async () => {
    const saved = await save(3, { published: true })

    expect(saved).toEqual({
      row: {
        lesson: 3,
        published: true,
        hook: null,
        tease: null,
        updatedAt: NOON,
        updatedBy: null,
      },
      changed: ['published'],
    })
    expect(await publicState()).toEqual({
      version: 1,
      updatedAt: NOON,
      lessons: { '3': { published: true } },
    })
  })

  it('reads "03" as Lesson 3, the way /learn/03 writes it', async () => {
    const response = await put('03', { hook: 'short' })

    expect(response.status).toBe(200)
    expect(((await response.json()) as LessonSave).row?.lesson).toBe(3)
  })

  it('leaves the fields a body does not name as they were', async () => {
    await save(4, { hook: 'short' })
    at('2026-10-20T12:05:00.000Z')

    const saved = await save(4, { published: true })

    expect(saved).toEqual({
      row: {
        lesson: 4,
        published: true,
        hook: 'short',
        tease: null,
        updatedAt: '2026-10-20T12:05:00.000Z',
        updatedBy: null,
      },
      changed: ['published'],
    })
  })

  it('sets a field sent as null back to the code default', async () => {
    await save(4, { published: false, hook: 'short' })

    const saved = await save(4, { hook: null })

    expect(saved.row).toMatchObject({ published: false, hook: null })
    expect(saved.changed).toEqual(['hook'])
    expect((await publicState()).lessons).toEqual({ '4': { published: false } })
  })

  it('deletes the row when a body clears every field', async () => {
    await save(4, { published: true, tease: 'stair' })
    at('2026-10-20T12:30:00.000Z')

    const saved = await save(4, { published: null, hook: null, tease: null })

    expect(saved).toEqual({ row: null, changed: ['published', 'tease'] })
    expect(stored()).toEqual([])
    // The clear is a change too: updatedAt moves on, not back to null.
    expect(await publicState()).toEqual({
      version: 1,
      updatedAt: '2026-10-20T12:30:00.000Z',
      lessons: {},
    })
  })

  it('deletes the row when its last override is cleared, by whatever body', async () => {
    await save(4, { hook: 'short' })

    const saved = await save(4, { hook: null })

    expect(saved).toEqual({ row: null, changed: ['hook'] })
    expect(stored()).toEqual([])
  })

  it('writes nothing, not even updatedAt, for a save that changes nothing', async () => {
    await save(4, { published: true })
    at('2026-10-20T13:00:00.000Z')

    const saved = await save(4, { published: true })

    expect(saved.changed).toEqual([])
    expect(saved.row?.updatedAt).toBe(NOON)
    expect(logged()).toHaveLength(1)
  })

  it('stores nothing when it clears a lesson that has no row', async () => {
    const saved = await save(9, { hook: null, tease: null })

    expect(saved).toEqual({ row: null, changed: [] })
    expect(stored()).toEqual([])
    expect(logged()).toEqual([])
  })

  it('logs one row per field a save changed, against the value it replaced', async () => {
    await save(2, { published: true })
    at('2026-10-20T12:10:00.000Z')

    await save(2, { published: false, hook: 'short', tease: null })

    const later = '2026-10-20T12:10:00.000Z'
    expect(logged()).toEqual([
      {
        lesson: 2,
        field: 'published',
        old_value: null,
        new_value: 'true',
        changed_at: NOON,
        changed_by: null,
      },
      {
        lesson: 2,
        field: 'published',
        old_value: 'true',
        new_value: 'false',
        changed_at: later,
        changed_by: null,
      },
      {
        lesson: 2,
        field: 'hook',
        old_value: null,
        new_value: 'short',
        changed_at: later,
        changed_by: null,
      },
    ])
  })

  it('logs each change against the value it replaced, even when two saves race', async () => {
    env = { ...env, DB: interleaved(d1) }

    const saves = await Promise.all([
      save(6, { published: true }),
      save(6, { published: false }),
    ])

    const [first, second] = logged()
    expect(saves.map((saved) => saved.changed)).toEqual([
      ['published'],
      ['published'],
    ])
    expect(first?.old_value).toBeNull()
    expect(second?.old_value).toBe(first?.new_value)
    expect(stored()).toEqual([
      expect.objectContaining({
        published: second?.new_value === 'true' ? 1 : 0,
      }),
    ])
  })
})

describe('GET /api/admin/lessons/log', () => {
  it('refuses a read without the admin key', async () => {
    await save(3, { published: true })

    const response = await call('GET', '/api/admin/lessons/log?lesson=3')

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Admin key required' })
  })

  it("lists one lesson's changes newest first, with values as their fields hold them", async () => {
    await save(3, { published: true })
    at('2026-10-20T12:01:00.000Z')
    await save(4, { hook: 'short' })
    at('2026-10-20T12:02:00.000Z')
    await save(3, { published: false, tease: 'stair' })

    const { changes } = await history('?lesson=3')

    const later = '2026-10-20T12:02:00.000Z'
    expect(
      changes.map(({ lesson, field, oldValue, newValue, changedAt }) => ({
        lesson,
        field,
        oldValue,
        newValue,
        changedAt,
      })),
    ).toEqual([
      {
        lesson: 3,
        field: 'tease',
        oldValue: null,
        newValue: 'stair',
        changedAt: later,
      },
      {
        lesson: 3,
        field: 'published',
        oldValue: true,
        newValue: false,
        changedAt: later,
      },
      {
        lesson: 3,
        field: 'published',
        oldValue: null,
        newValue: true,
        changedAt: NOON,
      },
    ])
    expect(changes.map((change) => change.changedBy)).toEqual([
      null,
      null,
      null,
    ])
  })

  it('lists every lesson without ?lesson, at most the latest 50, never cached', async () => {
    const insert = sqlite.prepare(
      `INSERT INTO lesson_state_log
         (lesson, field, old_value, new_value, changed_at, changed_by)
       VALUES (?, 'hook', NULL, ?, ?, NULL)`,
    )
    for (let i = 0; i < 55; i++) insert.run(i % 3, `v${i}`, NOON)

    const response = await call('GET', '/api/admin/lessons/log', {
      headers: ADMIN,
    })
    const { changes } = (await response.json()) as LessonStateLog

    expect(changes).toHaveLength(50)
    expect(new Set(changes.map((change) => change.lesson))).toEqual(
      new Set([0, 1, 2]),
    )
    expect([changes[0]?.newValue, changes.at(-1)?.newValue]).toEqual([
      'v54',
      'v5',
    ])
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('refuses a lesson that is not a number from 0 to 99', async () => {
    const asked = ['abc', '100', '']

    const responses = await Promise.all(
      asked.map((lesson) =>
        call('GET', `/api/admin/lessons/log?lesson=${lesson}`, {
          headers: ADMIN,
        }),
      ),
    )

    expect(responses.map((response) => response.status)).toEqual([
      400, 400, 400,
    ])
  })
})

describe('behind Cloudflare Access', () => {
  const TEAM = 'lesson-state-team.cloudflareaccess.com'
  const AUD = 'lesson-state-admin-aud'
  const KID = 'lesson-state-key'
  let keys: CryptoKeyPair
  let token: string

  const part = (value: object): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url')

  /** An Access token for `email`, signed with the key the stub serves. */
  async function accessToken(email: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const head = part({ alg: 'RS256', kid: KID, typ: 'JWT' })
    const body = part({
      aud: [AUD],
      iss: `https://${TEAM}`,
      email,
      iat: now - 10,
      exp: now + 3600,
    })
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      keys.privateKey,
      new TextEncoder().encode(`${head}.${body}`),
    )
    return `${head}.${body}.${Buffer.from(signature).toString('base64url')}`
  }

  beforeAll(async () => {
    keys = (await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair
  })

  beforeEach(async () => {
    const jwk = await crypto.subtle.exportKey('jwk', keys.publicKey)
    const certs = JSON.stringify({ keys: [{ ...jwk, kid: KID, alg: 'RS256' }] })
    // Only the team's certificate URL answers: any other fetch is a bug.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input instanceof Request ? input.url : input)
        if (url !== `https://${TEAM}/cdn-cgi/access/certs`) {
          throw new Error(`unexpected fetch to ${url}`)
        }
        return new Response(certs, { status: 200 })
      }),
    )
    token = await accessToken('owner@example.com')
    env = { ...env, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }
  })

  it('records the verified identity as the author of the row and its log', async () => {
    const response = await put(
      3,
      { published: true },
      { 'Cf-Access-Jwt-Assertion': token },
    )

    expect(response.status).toBe(200)
    expect(((await response.json()) as LessonSave).row?.updatedBy).toBe(
      'owner@example.com',
    )
    expect(logged().map((row) => row.changed_by)).toEqual(['owner@example.com'])
    expect(
      (await history('?lesson=3')).changes.map((change) => change.changedBy),
    ).toEqual(['owner@example.com'])
  })

  it('refuses the shared key once ACCESS_STRICT retires it', async () => {
    env = { ...env, ACCESS_STRICT: '1' }

    const response = await put(3, { published: true })

    expect(response.status).toBe(403)
    expect(stored()).toEqual([])
  })
})
