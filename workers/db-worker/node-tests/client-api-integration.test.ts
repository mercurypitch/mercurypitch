// @vitest-environment node
// ============================================================
// Client API integration — real adapters cross the worker and SQLite boundary
// ============================================================

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { DatabaseAdapter, DbEntity } from '../../../src/db/types'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

// Load the real browser adapters through Vitest's module loader. Importing
// their implementation types into the worker-only TS program would also pull
// in the DOM app; the shared repository contract remains statically checked.
const { ServerAdapter } = await vi.importActual<{
  ServerAdapter: new (config: {
    baseUrl: string
    headers: () => Record<string, string>
    writeIdentity: () => string
  }) => DatabaseAdapter
}>('../../../src/db/adapters/server-adapter')
const { HybridAdapter } = await vi.importActual<{
  HybridAdapter: new (
    cloud: DatabaseAdapter,
    local: DatabaseAdapter,
    isAuthed: () => boolean,
    ensureAuthed: () => Promise<boolean>,
    currentIdentity: () => string,
  ) => DatabaseAdapter
}>('../../../src/db/adapters/hybrid-adapter')

const ORIGIN = 'https://api.test'
const NOW = '2026-10-13T12:00:00.000Z'
let sqlite: DatabaseSync
let env: Env
let account: { userId: string; token: string }
let cloud: DatabaseAdapter

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'client-api-integration-test-secret',
    ALLOWED_ORIGINS: 'http://localhost',
  }
  const response = await worker.fetch(
    new Request(`${ORIGIN}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'client-api@example.com',
        password: 'secret123',
        displayName: 'Client API',
      }),
    }),
    env,
    {} as ExecutionContext,
  )
  expect(response.status).toBe(200)
  account = (await response.json()) as typeof account
  cloud = new ServerAdapter({
    baseUrl: ORIGIN,
    headers: () => ({ Authorization: `Bearer ${account.token}` }),
    writeIdentity: () => account.userId,
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await cloud.destroy()
  sqlite.close()
})

function bridge(
  transport: (request: Request, response: Response) => Promise<Response>,
): void {
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      // This bridge must never send an auth token or request to a real server.
      expect(new URL(request.url).origin).toBe(ORIGIN)
      const observed = request.clone()
      const response = await worker.fetch(request, env, {} as ExecutionContext)
      return transport(observed, response)
    },
  )
}

it('retries a lost committed create through the real client with one row and one award', async () => {
  const attempts: Array<{ id: string; status: number }> = []
  bridge(async (request, response) => {
    expect(new URL(request.url).pathname).toBe('/api/sessionRecords')
    expect(request.method).toBe('POST')
    const body = (await request.json()) as { id: string }
    attempts.push({ id: body.id, status: response.status })
    if (attempts.length === 1) {
      expect(response.status).toBe(201)
      throw new TypeError(
        'Simulated connection loss after the worker committed',
      )
    }
    return response
  })

  const created = await cloud
    .getRepository<DbEntity & Record<string, unknown>>('sessionRecords')
    .create({
      melodyName: 'Client retry scale',
      source: 'exercise',
      startedAt: NOW,
      endedAt: NOW,
      score: 80,
      accuracy: 80,
      notesHit: 8,
      notesTotal: 10,
      streak: 1,
      results: [],
    })

  expect(attempts).toEqual([
    { id: created.id, status: 201 },
    { id: created.id, status: 200 },
  ])
  expect(created.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  )
  expect(
    sqlite.prepare('SELECT id, userId, melodyName FROM sessionRecords').all(),
  ).toEqual([
    {
      id: created.id,
      userId: account.userId,
      melodyName: 'Client retry scale',
    },
  ])
  expect(
    sqlite
      .prepare(
        'SELECT COUNT(*) AS count FROM leaguePointEvents WHERE userId = ?',
      )
      .get(account.userId),
  ).toEqual({ count: 1 })
})

it('reads beyond one thousand owned rows through both real adapters without leaking another user', async () => {
  const insert = sqlite.prepare(
    'INSERT INTO userSettings (id, createdAt, updatedAt, userId, "key", value) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const ids = Array.from(
    { length: 1017 },
    (_, index) => `owned-${String(index).padStart(4, '0')}`,
  )
  for (const id of ids) insert.run(id, NOW, NOW, account.userId, id, 'true')
  insert.run(
    'other-setting',
    NOW,
    NOW,
    'other-account',
    'private',
    '"not yours"',
  )
  const pages: Array<{
    limit: string | null
    offset: string | null
    size: number
  }> = []
  bridge(async (request, response) => {
    const url = new URL(request.url)
    expect(url.pathname).toBe('/api/userSettings')
    expect(request.method).toBe('GET')
    expect(response.status).toBe(200)
    const rows = (await response.clone().json()) as unknown[]
    pages.push({
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset'),
      size: rows.length,
    })
    return response
  })
  const local: DatabaseAdapter = {
    schemaVersion: 1,
    getRepository: () => {
      throw new Error(
        'Private cloud settings must not fall through to local storage',
      )
    },
    transaction: async () => {
      throw new Error('No local transaction should run')
    },
    destroy: async () => undefined,
  }
  const hybrid = new HybridAdapter(
    cloud,
    local,
    () => true,
    async () => true,
    () => account.userId,
  )

  const rows = await hybrid
    .getRepository<DbEntity & { userId: string }>('userSettings')
    .findAll()

  expect(rows.map((row) => row.id)).toEqual(ids)
  expect(new Set(rows.map((row) => row.userId))).toEqual(
    new Set([account.userId]),
  )
  expect(pages).toEqual([
    { limit: '1000', offset: '0', size: 1000 },
    { limit: '1000', offset: '1000', size: 17 },
  ])
})
