// @vitest-environment node
// ============================================================
// Community publication counts across the public board's page boundary
// ============================================================
// Profile totals must use owner-filtered counts, not the newest public page.
// Exercise the real worker and SQL so the client contract cannot silently
// become another paginated list or include a singer's private rows.

import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import { signJwt } from '../src/auth'
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

async function tokenFor(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return signJwt(
    {
      sub: userId,
      provider: 'anonymous',
      iat: now,
      exp: now + 3600,
      v: 1,
      sid: await createAuthSession(env.DB, userId, 'anonymous'),
    },
    JWT_SECRET,
  )
}

function deleteResult(id: string, token: string): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost/api/sharedSessions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, Origin: 'http://localhost' },
    }),
    env,
    {} as ExecutionContext,
  )
}

describe('Community public result links', () => {
  it('reads exact public rows signed out, excludes even the owner’s private result and stops resolving after unpublish', async () => {
    const insert = sqlite.prepare(
      `INSERT INTO sharedSessions
       (id, createdAt, updatedAt, userId, sessionId, sessionName, author, score, accuracy, resultsJson, isPublic)
       VALUES (?, ?, ?, ?, 'source-run', ?, 'Singer', 72, 72, '[72]', ?)`,
    )
    insert.run('public-result', OLDEST, OLDEST, MINE, 'Shared result', 1)
    insert.run('private-result', OLDEST, OLDEST, MINE, 'Private result', 0)
    const ownerToken = await tokenFor(MINE)
    const otherToken = await tokenFor(OTHER)
    const lookup = (id: string) =>
      `/api/sharedSessions?where[id]=${id}&where[isPublic]=true&limit=1`

    for (const token of [undefined, ownerToken, otherToken]) {
      const publicResponse = await get(lookup('public-result'), token)
      expect(publicResponse.status).toBe(200)
      expect(await publicResponse.json()).toEqual([
        expect.objectContaining({
          id: 'public-result',
          userId: MINE,
          sessionId: 'source-run',
          isPublic: true,
          resultsJson: '[72]',
        }),
      ])
      const privateResponse = await get(lookup('private-result'), token)
      expect(privateResponse.status).toBe(200)
      expect(await privateResponse.json()).toEqual([])
    }

    // Prove that the explicit public filter is doing work: the authenticated
    // owner can read the private row through their ordinary owner route.
    const ownPrivate = await get(
      '/api/sharedSessions/private-result',
      ownerToken,
    )
    expect(ownPrivate.status).toBe(200)
    expect(await ownPrivate.json()).toMatchObject({
      id: 'private-result',
      isPublic: false,
    })

    expect((await deleteResult('public-result', otherToken)).status).toBe(403)
    expect((await deleteResult('public-result', ownerToken)).status).toBe(204)
    for (const token of [undefined, ownerToken, otherToken]) {
      const deletedResponse = await get(lookup('public-result'), token)
      expect(deletedResponse.status).toBe(200)
      expect(await deletedResponse.json()).toEqual([])
    }
    expect(sqlite.prepare('SELECT id FROM sharedSessions').all()).toEqual([
      { id: 'private-result' },
    ])
  })
})
