// @vitest-environment node
//
// ── Experimental feature switches ────────────────────────────────────
//
// The owner's per-environment switches for features still being built
// (src/lib/experimental-features.ts), run against real SQLite with every
// migration applied and driven through the worker's own routes. What it
// guards:
//
// - **Only an admin reads the list or writes.** No key, a wrong key, or the
//   key once Access is strict, and nothing is stored.
// - **Only names on the list.** A switch for anything else is refused and
//   never stored, and a row under another name is never served.
// - **The public read is the set switches and nothing else**, cacheable
//   briefly and readable from an app origin: an unset feature is absent, so
//   a page keeps its build's default.
// - **A switch is a real on and off**, and clearing it hands the feature
//   back to the build. A save that changes nothing moves no timestamp.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeatureSwitches, FeatureSwitchSave, } from '../../../src/lib/experimental-features'
import { parseFeatureOverrides } from '../../../src/lib/experimental-features'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const ADMIN_KEY = 'experimental-features-integration-admin-key'
const ADMIN = { 'X-Admin-Key': ADMIN_KEY }
const FEATURES = '/api/features'
const ADMIN_FEATURES = '/api/admin/features'
const NOON = '2026-10-29T12:00:00.000Z'
const LATER = '2026-10-29T12:05:00.000Z'
const LATEST = '2026-10-29T12:10:00.000Z'

let sqlite: DatabaseSync
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
  name: string,
  body: unknown,
  headers: Record<string, string> = ADMIN,
): Promise<Response> {
  return call('PUT', `${ADMIN_FEATURES}/${name}`, { body, headers })
}

/** A switch the admin sets, which has to succeed. */
async function save(name: string, body: unknown): Promise<FeatureSwitchSave> {
  const response = await put(name, body)
  expect(response.status).toBe(200)
  return (await response.json()) as FeatureSwitchSave
}

async function publicOverrides(): Promise<unknown> {
  const response = await call('GET', FEATURES)
  expect(response.status).toBe(200)
  return response.json()
}

function at(time: string): void {
  vi.setSystemTime(new Date(time))
}

function stored(): Record<string, unknown>[] {
  return sqlite
    .prepare(
      `SELECT id, "key", value, createdAt, updatedAt FROM featureFlags
        ORDER BY "key"`,
    )
    .all() as Record<string, unknown>[]
}

function insertFlag(key: string, value: number): void {
  sqlite
    .prepare(
      `INSERT INTO featureFlags (id, createdAt, updatedAt, "key", value)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(`row-${key}`, NOON, NOON, key, value)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  at(NOON)
  sqlite = new DatabaseSync(':memory:')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    ALLOWED_ORIGINS: 'localhost',
    ADMIN_KEY,
  }
})

afterEach(() => {
  vi.useRealTimers()
  sqlite.close()
})

describe('GET /api/features', () => {
  it('answers no switches on an empty table, to anyone, cacheable for 30 s', async () => {
    const response = await call('GET', FEATURES)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({})
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30')
    expect(response.headers.get('Content-Type')).toBe('application/json')
  })

  it('answers each set switch as a boolean, and the app reads it whole', async () => {
    await save('studio', { enabled: true })
    const on = await publicOverrides()
    await save('studio', { enabled: false })
    const off = await publicOverrides()

    expect(on).toEqual({ studio: true })
    expect(off).toEqual({ studio: false })
    expect(parseFeatureOverrides(off)).toEqual({ studio: false })
  })

  it('serves no row under a name the list lacks, and none of the app flags beside them', async () => {
    insertFlag('experiment:ghost', 1)
    insertFlag('pitchperfect_advanced_features', 1)
    insertFlag('studio', 1)

    expect(await publicOverrides()).toEqual({})
  })

  it('lets an app origin read it, and refuses an unlisted origin', async () => {
    const app = await call('GET', FEATURES, {
      headers: { Origin: 'http://localhost:4710' },
    })
    const stranger = await call('GET', FEATURES, {
      headers: { Origin: 'https://elsewhere.example' },
    })

    expect(app.status).toBe(200)
    expect(app.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(stranger.status).toBe(403)
  })

  it('answers HEAD without a body, and refuses a write', async () => {
    const head = await call('HEAD', FEATURES)
    const post = await call('POST', FEATURES, { body: { studio: true } })

    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
    expect(post.status).toBe(405)
    expect(post.headers.get('Allow')).toBe('GET, HEAD')
    expect(stored()).toEqual([])
  })
})

describe('GET /api/admin/features', () => {
  it('refuses the list without the admin key, or with a wrong one', async () => {
    const missing = await call('GET', ADMIN_FEATURES)
    const wrong = await call('GET', ADMIN_FEATURES, {
      headers: { 'X-Admin-Key': 'nope' },
    })

    expect([missing.status, wrong.status]).toEqual([403, 403])
    expect(await missing.json()).toEqual({ error: 'Admin key required' })
  })

  it('lists every feature on the list, set or not, and keeps no copy', async () => {
    const before = await call('GET', ADMIN_FEATURES, { headers: ADMIN })
    await save('studio', { enabled: true })
    const after = await call('GET', ADMIN_FEATURES, { headers: ADMIN })

    expect(before.status).toBe(200)
    expect(before.headers.get('Cache-Control')).toBe('private, no-store')
    expect((await before.json()) as FeatureSwitches).toEqual({
      features: [{ name: 'studio', enabled: null, updatedAt: null }],
    })
    expect((await after.json()) as FeatureSwitches).toEqual({
      features: [{ name: 'studio', enabled: true, updatedAt: NOON }],
    })
  })
})

describe('PUT /api/admin/features/:name', () => {
  it('refuses a switch without the admin key, or with a wrong one, and stores nothing', async () => {
    const missing = await put('studio', { enabled: true }, {})
    const wrong = await put('studio', { enabled: true }, { 'X-Admin-Key': 'x' })

    expect([missing.status, wrong.status]).toEqual([403, 403])
    expect(await wrong.json()).toEqual({ error: 'Admin key required' })
    expect(stored()).toEqual([])
  })

  it('refuses the shared key once ACCESS_STRICT retires it', async () => {
    // Strict applies where Access is configured (access.ts). With no
    // Access token on the request, nothing is fetched to verify one.
    env = {
      ...env,
      ACCESS_TEAM_DOMAIN: 'team.example.cloudflareaccess.com',
      ACCESS_AUD: 'experimental-features-aud',
      ACCESS_STRICT: '1',
    }

    const response = await put('studio', { enabled: true })

    expect(response.status).toBe(403)
    expect(stored()).toEqual([])
  })

  it('refuses a name that is not on the list, and stores nothing', async () => {
    const names = ['ghost', 'Studio', 'experiment%3Astudio', '%E0%A4%A', '%20']

    const responses = await Promise.all(
      names.map((name) => put(name, { enabled: true })),
    )

    expect(responses.map((response) => response.status)).toEqual(
      names.map(() => 400),
    )
    expect(await responses[0]!.json()).toEqual({
      error: 'Unknown feature: expected one of studio',
    })
    expect(stored()).toEqual([])
  })

  it('answers a deeper path as not found', async () => {
    const response = await put('studio/extra', { enabled: true })

    expect(response.status).toBe(404)
    expect(stored()).toEqual([])
  })

  it('refuses a body that is not exactly one switch', async () => {
    const bodies: [CallOptions, string][] = [
      [{ raw: '{not json' }, 'Invalid JSON body'],
      [{ body: [] }, 'Body must be a JSON object'],
      [{ body: {} }, 'enabled must be true, false or null'],
      [{ body: { enabled: 'yes' } }, 'enabled must be true, false or null'],
      [{ body: { enabled: 1 } }, 'enabled must be true, false or null'],
      [{ body: { enabled: true, note: 'x' } }, 'Unknown field: note'],
    ]

    for (const [options, error] of bodies) {
      const response = await call('PUT', `${ADMIN_FEATURES}/studio`, {
        ...options,
        headers: ADMIN,
      })
      expect(response.status, error).toBe(400)
      expect(await response.json()).toEqual({ error })
    }
    expect(stored()).toEqual([])
  })

  it('switches a feature on, then off, then hands it back to the build', async () => {
    const on = await save('studio', { enabled: true })
    const rowOn = stored()
    at(LATER)
    const off = await save('studio', { enabled: false })
    at(LATEST)
    const cleared = await save('studio', { enabled: null })

    expect(on).toEqual({
      row: { name: 'studio', enabled: true, updatedAt: NOON },
      changed: true,
    })
    expect(rowOn).toEqual([
      {
        id: 'experiment:studio',
        key: 'experiment:studio',
        value: 1,
        createdAt: NOON,
        updatedAt: NOON,
      },
    ])
    expect(off).toEqual({
      row: { name: 'studio', enabled: false, updatedAt: LATER },
      changed: true,
    })
    expect(cleared).toEqual({
      row: { name: 'studio', enabled: null, updatedAt: null },
      changed: true,
    })
    expect(stored()).toEqual([])
  })

  it('moves nothing, not even the time, for a save that changes nothing', async () => {
    await save('studio', { enabled: true })
    at(LATER)
    const again = await save('studio', { enabled: true })
    const clearedTwice = [
      await save('studio', { enabled: null }),
      await save('studio', { enabled: null }),
    ]

    expect(again).toEqual({
      row: { name: 'studio', enabled: true, updatedAt: NOON },
      changed: false,
    })
    expect(clearedTwice.map((result) => result.changed)).toEqual([true, false])
  })

  it('takes over a row the generic table route wrote under the same key', async () => {
    insertFlag('experiment:studio', 0)

    const saved = await save('studio', { enabled: true })

    expect(saved).toEqual({
      row: { name: 'studio', enabled: true, updatedAt: NOON },
      changed: true,
    })
    expect(stored()).toHaveLength(1)
    expect(await publicOverrides()).toEqual({ studio: true })
  })

  it('answers any other method on a feature as not allowed', async () => {
    const response = await call('GET', `${ADMIN_FEATURES}/studio`, {
      headers: ADMIN,
    })

    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('PUT')
  })
})
