// @vitest-environment node
// ============================================================
// Community publication counts across the public board's page boundary
// ============================================================
// Profile totals must use owner-filtered counts, not the newest public page.
// Exercise the real worker and SQL so the client contract cannot silently
// become another paginated list or include a singer's private rows.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Env, signJwt } from '../src/auth'
import { createAuthSession } from '../src/auth-sessions'
import worker from '../src/index'
import { applyMigrations, SqliteD1Database } from './sqlite-d1'

const MINE = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const OLDEST = '2026-01-01T00:00:00.000Z'
const JWT_SECRET = 'community-publication-counts-test-jwt'

let sqlite: DatabaseSync
let env: Env

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    ALLOWED_ORIGINS: 'http://localhost',
    JWT_SECRET,
  }
  const insert = sqlite.prepare(
    `INSERT INTO users (id, createdAt, updatedAt, authProvider, emailVerified, tokenVersion)
     VALUES (?, ?, ?, 'anonymous', 0, 1)`,
  )
  for (const id of [MINE, OTHER]) insert.run(id, OLDEST, OLDEST)
})

afterEach(() => sqlite.close())

function get(path: string, token?: string): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
    }),
    env,
    {} as ExecutionContext,
  )
}

describe('Community owner counts', () => {
  it.each([
    { table: 'sharedMelodies', name: 'melodyName', sourceId: 'melodyId' },
    { table: 'sharedSessions', name: 'sessionName', sourceId: 'sessionId' },
  ])(
    'counts older publications beyond $table public page',
    async ({ table, name, sourceId }) => {
      const payloadColumns =
        table === 'sharedMelodies'
          ? 'tags, itemsJson'
          : 'score, accuracy, resultsJson'
      const payloadValues =
        table === 'sharedMelodies' ? "'[]', '[]'" : "0, 0, '[]'"
      const insert = sqlite.prepare(
        `INSERT INTO ${table} (id, createdAt, updatedAt, userId, ${sourceId}, ${name}, author, ${payloadColumns}, isPublic)
       VALUES (?, ?, ?, ?, '', ?, 'Singer', ${payloadValues}, ?)`,
      )
      insert.run('mine', OLDEST, OLDEST, MINE, 'My older publication', 1)
      insert.run('private', OLDEST, OLDEST, MINE, 'My private row', 0)
      for (let index = 0; index < 101; index++) {
        const newer = new Date(
          Date.parse(OLDEST) + (index + 1) * 1000,
        ).toISOString()
        insert.run(`other-${index}`, newer, newer, OTHER, 'Another singer', 1)
      }

      const pageResponse = await get(
        `/api/${table}?where[isPublic]=true&orderBy=createdAt&orderDir=desc`,
      )
      expect(pageResponse.status).toBe(200)
      const page = (await pageResponse.json()) as Array<{ userId: string }>
      expect(page).toHaveLength(100)
      expect(page.every((row) => row.userId === OTHER)).toBe(true)

      for (const [owner, count] of [
        [MINE, 1],
        [OTHER, 101],
      ] as const) {
        const response = await get(
          `/api/${table}/count?where[userId]=${owner}&where[isPublic]=true`,
        )
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ count })
      }

      const now = Math.floor(Date.now() / 1000)
      const token = await signJwt(
        {
          sub: MINE,
          provider: 'anonymous',
          iat: now,
          exp: now + 3600,
          v: 1,
          sid: await createAuthSession(env.DB, MINE, 'anonymous'),
        },
        JWT_SECRET,
      )

      // Owners can read their private rows. Only the explicit public filter
      // keeps their publication count from including those rows.
      const allOwned = await get(
        `/api/${table}/count?where[userId]=${MINE}`,
        token,
      )
      expect(allOwned.status).toBe(200)
      expect(await allOwned.json()).toEqual({ count: 2 })

      const publishedOwned = await get(
        `/api/${table}/count?where[userId]=${MINE}&where[isPublic]=true`,
        token,
      )
      expect(publishedOwned.status).toBe(200)
      expect(await publishedOwned.json()).toEqual({ count: 1 })
    },
  )
})
