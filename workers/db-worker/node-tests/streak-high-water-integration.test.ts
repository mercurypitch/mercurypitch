// @vitest-environment node

// ============================================================
// The streak high-water invariant, enforced at the Worker
// ============================================================
//
// `userProfiles.longestStreak` is a record. Nothing made that true: the
// streak columns are not `serverCols` — the streak rules belong to the
// client and the server stores the result — so a profile PATCH could raise
// `currentStreak` and leave `longestStreak` behind, which is exactly what
// the client did before f2a5ccc. 0030_streak_high_water.sql repairs the rows
// that left behind; this is the door it came through.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from '../src/auth'
import worker from '../src/index'

class SqliteD1Statement {
  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
    private readonly values: SQLInputValue[] = [],
  ) {}

  bind(...values: SQLInputValue[]): SqliteD1Statement {
    return new SqliteD1Statement(this.database, this.sql, values)
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.database.prepare(this.sql).get(...this.values)
    if (row === undefined) return null
    return (column === undefined ? row : row[column]) as T
  }

  async all<T>(): Promise<{ success: true; results: T[] }> {
    return {
      success: true,
      results: this.database.prepare(this.sql).all(...this.values) as T[],
    }
  }

  execute(): { success: true; meta: { changes: number } } {
    const result = this.database.prepare(this.sql).run(...this.values)
    return { success: true, meta: { changes: Number(result.changes) } }
  }

  async run(): Promise<{ success: true; meta: { changes: number } }> {
    return this.execute()
  }
}

class SqliteD1Database {
  constructor(readonly native: DatabaseSync) {}

  prepare(sql: string): SqliteD1Statement {
    return new SqliteD1Statement(this.native, sql)
  }

  async batch(
    statements: SqliteD1Statement[],
  ): Promise<Array<{ success: true; meta: { changes: number } }>> {
    this.native.exec('BEGIN IMMEDIATE')
    try {
      const results = statements.map((statement) => statement.execute())
      this.native.exec('COMMIT')
      return results
    } catch (error) {
      this.native.exec('ROLLBACK')
      throw error
    }
  }
}

const ADMIN_KEY = 'streak-high-water-admin'

let sqlite: DatabaseSync
let env: Env
let userId: string
let token: string

function applyMigrations(target: DatabaseSync): void {
  const directory = join(import.meta.dirname, '../migrations')
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    target.exec(readFileSync(join(directory, file), 'utf8'))
  }
}

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

/** PATCH the caller's own profile, as the owner unless told otherwise. */
function patchProfile(
  body: Record<string, unknown>,
  headers: Record<string, string> = { Authorization: `Bearer ${token}` },
): Promise<Response> {
  return workerRequest(`/api/userProfiles/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function storedStreak(id = userId): {
  currentStreak: number
  longestStreak: number
} {
  return sqlite
    .prepare(
      'SELECT currentStreak, longestStreak FROM userProfiles WHERE id = ?',
    )
    .get(id) as { currentStreak: number; longestStreak: number }
}

function setStoredStreak(current: number, longest: number): void {
  sqlite
    .prepare(
      'UPDATE userProfiles SET currentStreak = ?, longestStreak = ? WHERE id = ?',
    )
    .run(current, longest, userId)
}

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'streak-high-water-secret',
    // These harnesses register real accounts, and registration now passes
    // through the Turnstile gate. A local origin with no TURNSTILE_SECRET is
    // the one configuration the gate lets by, and it is what a developer
    // running the worker locally has — so it is what these simulate.
    ALLOWED_ORIGINS: 'http://localhost',
    ADMIN_KEY,
  }
  const registration = await workerRequest('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'high-water@example.com',
      password: 'secret123',
      displayName: 'High Water',
    }),
  })
  expect(registration.status).toBe(200)
  const auth = (await registration.json()) as { token: string; userId: string }
  userId = auth.userId
  token = auth.token
})

afterEach(() => {
  sqlite.close()
})

describe('the streak high-water invariant', () => {
  it('raises the record to match a run the client forgot to record', async () => {
    // The reproduction. This is the write the pre-f2a5ccc client made on
    // every practice, and before the clamp the row stored (5, 0) — a
    // five-day run with a lifetime best of zero.
    const response = await patchProfile({ currentStreak: 5, longestStreak: 0 })
    expect(response.status).toBe(200)
    expect(storedStreak()).toEqual({ currentStreak: 5, longestStreak: 5 })
  })

  it('raises the record when the write names only the current streak', async () => {
    setStoredStreak(1, 1)
    expect((await patchProfile({ currentStreak: 6 })).status).toBe(200)
    expect(storedStreak()).toEqual({ currentStreak: 6, longestStreak: 6 })
  })

  it('refuses to talk a stored record down', async () => {
    // A record survives its run ending, so a client reporting a smaller one —
    // an old bundle, a stale tab, a scripted caller — must not lower it.
    setStoredStreak(2, 9)
    expect((await patchProfile({ longestStreak: 0 })).status).toBe(200)
    expect(storedStreak()).toEqual({ currentStreak: 2, longestStreak: 9 })

    expect(
      (await patchProfile({ currentStreak: 3, longestStreak: 1 })).status,
    ).toBe(200)
    expect(storedStreak()).toEqual({ currentStreak: 3, longestStreak: 9 })
  })

  it('leaves the streak columns alone when the write does not mention them', async () => {
    // The clamp must not turn every profile edit into a streak write. A row
    // that is already violating stays that way until the migration or the
    // next streak write repairs it — silently rewriting a column the caller
    // never named is how an edit gets blamed for a number it never touched.
    setStoredStreak(4, 0)
    const response = await patchProfile({ displayName: 'Renamed' })
    expect(response.status).toBe(200)
    expect(storedStreak()).toEqual({ currentStreak: 4, longestStreak: 0 })
  })

  it('has no admin exemption, because the route has no admin write', async () => {
    // Worth pinning down, because "let admins correct a wrong-high record"
    // is the obvious exemption and it would be dead code: profiles are
    // `access: 'owner'`, so `canWriteRow` grants the row's own user and
    // nobody else. The admin key does not open this route, and correcting a
    // bogus record is an operator job done in SQL, outside the Worker.
    setStoredStreak(1, 900)
    const asAdmin = await patchProfile(
      { longestStreak: 2 },
      { 'X-Admin-Key': ADMIN_KEY },
    )
    expect(asAdmin.status).toBe(403)
    expect(storedStreak()).toEqual({ currentStreak: 1, longestStreak: 900 })

    // And the owner cannot talk their own record down either, key or no key.
    const asOwner = await patchProfile(
      { longestStreak: 2 },
      { Authorization: `Bearer ${token}`, 'X-Admin-Key': ADMIN_KEY },
    )
    expect(asOwner.status).toBe(200)
    expect(storedStreak()).toEqual({ currentStreak: 1, longestStreak: 900 })
  })

  it('holds when a profile is created carrying a streak', async () => {
    const second = await workerRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'created@example.com',
        password: 'secret123',
        displayName: 'Created Singer',
      }),
    })
    const created = (await second.json()) as { token: string; userId: string }
    // Registration already made the profile, so clear it and create one the
    // way the CRUD route would.
    sqlite.prepare('DELETE FROM userProfiles WHERE id = ?').run(created.userId)

    const response = await workerRequest('/api/userProfiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${created.token}`,
      },
      body: JSON.stringify({
        displayName: 'Created Singer',
        joinDate: '2026-08-15T00:00:00.000Z',
        currentStreak: 4,
      }),
    })
    expect(response.status).toBe(201)
    expect(storedStreak(created.userId)).toEqual({
      currentStreak: 4,
      longestStreak: 4,
    })
  })
})

describe('streak column validation', () => {
  // `Math.max(NaN, n)` is NaN, and a NaN bound to an INTEGER column is how an
  // invariant gets enforced into nonsense — so the clamp needs the values
  // bounded before it runs. Nothing checked them before: the leaderboard
  // ranked and gated on a column any client could write anything into.
  const rejected: Array<[string, unknown]> = [
    ['a string', 'seven'],
    ['a fraction', 1.5],
    ['a negative', -1],
    ['NaN', Number.NaN],
    ['past the ceiling', 36_501],
  ]

  for (const [label, value] of rejected) {
    it(`refuses ${label} for currentStreak, and writes nothing`, async () => {
      setStoredStreak(3, 3)
      const response = await patchProfile({ currentStreak: value })
      expect(response.status).toBe(400)
      expect(await response.text()).toContain('whole number of days')
      expect(storedStreak()).toEqual({ currentStreak: 3, longestStreak: 3 })
    })
  }

  it('applies the same bound to every streak counter', async () => {
    for (const column of ['longestStreak', 'previousStreak', 'streakFreezes']) {
      const response = await patchProfile({ [column]: -1 })
      expect(response.status).toBe(400)
      expect(await response.text()).toContain(column)
    }
  })

  it('accepts the values the client actually sends', async () => {
    const response = await patchProfile({
      currentStreak: 3,
      longestStreak: 3,
      previousStreak: 0,
      streakFreezes: 2,
    })
    expect(response.status).toBe(200)
    expect(storedStreak()).toEqual({ currentStreak: 3, longestStreak: 3 })
  })
})
