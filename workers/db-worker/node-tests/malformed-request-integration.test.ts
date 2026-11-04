// @vitest-environment node
//
// ── A malformed request is the caller's mistake: 400, never 500 ──────
//
// Two shapes of client input reached the worker's last-resort handler or
// the database unchecked:
//
//   - an id in the path with a broken percent-escape (`%zz`, a truncated
//     `%E0%A4`): decodeURIComponent threw, and the generic CRUD router, the
//     guided-content router and the session revoke answered 500;
//   - a list `offset` that is not a whole number of rows: Number('abc') is
//     NaN, bound into `OFFSET ?` as it was.
//
// A 500 reads to a client as "try again", and a typo'd link or a paging bug
// never succeeds on a retry. Run against real SQL, so what the database does
// with a NaN is what the test sees.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const NOW = '2026-11-03T12:00:00.000Z'

let sqlite: DatabaseSync
let env: Env

function call(path: string, method = 'GET'): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, { method }),
    env,
    {} as ExecutionContext,
  )
}

function seedBadge(id: string, sortOrder: number): void {
  sqlite
    .prepare(
      `INSERT INTO badgeDefinitions
         (id, createdAt, updatedAt, name, description, icon, tier, category,
          unlockCondition, sortOrder)
       VALUES (?, ?, ?, ?, '', 'star', 'bronze', 'practice', '{}', ?)`,
    )
    .run(id, NOW, NOW, `Badge ${id}`, sortOrder)
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'malformed-request-integration-secret',
    ALLOWED_ORIGINS: 'http://localhost',
  }
  seedBadge('b1', 1)
  seedBadge('b2', 2)
  seedBadge('b3', 3)
})

afterEach(() => {
  sqlite.close()
})

describe('a path segment with a broken percent-escape', () => {
  it.each([
    ['the generic CRUD read', '/api/userProfiles/%zz', 'GET'],
    ['a guided exercise', '/api/guided-exercises/%e0%a4%a', 'GET'],
    ['guided media', '/api/guided-media/%zz', 'GET'],
    ['a guided path', '/api/guided-paths/%zz/assignments', 'GET'],
    ['a session revoke', '/api/auth/sessions/%zz', 'DELETE'],
  ])('is refused as malformed in %s', async (_where, path, method) => {
    const response = await call(path, method)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Malformed path' })
  })
})

describe('a list offset', () => {
  it.each(['abc', 'undefined', '-5', '1.5'])(
    'of %s is refused, never bound to the query',
    async (offset) => {
      const response = await call(
        `/api/badgeDefinitions?orderBy=sortOrder&limit=1&offset=${offset}`,
      )

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Invalid query' })
    },
  )

  it('of a whole number still pages', async () => {
    const response = await call(
      '/api/badgeDefinitions?orderBy=sortOrder&limit=1&offset=1',
    )

    expect(response.status).toBe(200)
    const rows = (await response.json()) as Array<{ id: string }>
    expect(rows.map((row) => row.id)).toEqual(['b2'])
  })
})
