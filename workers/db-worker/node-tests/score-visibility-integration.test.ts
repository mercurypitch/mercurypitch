// @vitest-environment node

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

const TARGET_ID = '00000000-0000-4000-8000-000000000201'
const CONTROL_ID = '00000000-0000-4000-8000-000000000202'
const WEEKLY_ID = 'weekly-score-visibility'
const NOW = '2026-08-09T12:00:00.000Z'
const ADMIN_KEY = 'score-visibility-test-admin'

let sqlite: DatabaseSync
let env: Env

function migrationFiles(): string[] {
  const directory = join(import.meta.dirname, '../migrations')
  return readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

function applyMigrations(target: DatabaseSync): void {
  const directory = join(import.meta.dirname, '../migrations')
  for (const file of migrationFiles()) {
    target.exec(readFileSync(join(directory, file), 'utf8'))
  }
}

function seedUser(id: string, displayName: string): void {
  sqlite
    .prepare(
      `INSERT INTO users
         (id, createdAt, updatedAt, authProvider, email, emailVerified,
          lastLoginAt, tokenVersion)
       VALUES (?, ?, ?, 'password', ?, 1, ?, 1)`,
    )
    .run(id, NOW, NOW, `${displayName.toLowerCase()}@example.com`, NOW)
  sqlite
    .prepare(
      `INSERT INTO userProfiles
         (id, createdAt, updatedAt, displayName, joinDate, currentStreak,
          longestStreak, leaderboardOptIn, leaderboardOptInAt)
       VALUES (?, ?, ?, ?, ?, 5, 5, 1, ?)`,
    )
    .run(id, NOW, NOW, displayName, NOW, NOW)
}

function seedWeeklyChallenge(): void {
  sqlite
    .prepare(
      `INSERT INTO weeklyChallenges
         (id, createdAt, updatedAt, slug, title, description, featType,
          difficulty, targetItems, targetScore, startsAt, endsAt, evergreen,
          status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', 70, ?, ?, 0, 'active')`,
    )
    .run(
      WEEKLY_ID,
      NOW,
      NOW,
      'score-visibility',
      'Score Visibility',
      'Reversible score publication controls',
      'range',
      'intermediate',
      '2026-08-03T00:00:00.000Z',
      '2026-08-10T00:00:00.000Z',
    )
}

function seedSession(
  id: string,
  userId: string,
  score: number,
  weeklyChallengeId: string | null = WEEKLY_ID,
): void {
  sqlite
    .prepare(
      `INSERT INTO sessionRecords
         (id, createdAt, updatedAt, userId, melodyName, startedAt, endedAt,
          score, accuracy, notesHit, notesTotal, streak, weeklyChallengeId,
          results, source)
       VALUES (?, ?, ?, ?, 'Legend: Visibility', ?, ?, ?, ?, 9, 10, 5, ?,
               '{}', 'weekly')`,
    )
    .run(id, NOW, NOW, userId, NOW, NOW, score, score, weeklyChallengeId)
}

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

function scoreRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = { 'X-Admin-Key': ADMIN_KEY },
): Promise<Response> {
  return workerRequest('/api/admin/score-visibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function leaderboardIds(): Promise<string[]> {
  const response = await workerRequest(
    '/api/leaderboard?category=overall&period=all-time&view=global',
  )
  expect(response.status).toBe(200)
  const body = (await response.json()) as {
    entries: Array<{ userId: string }>
  }
  return body.entries.map((entry) => entry.userId)
}

async function weeklyBoard(): Promise<{
  attemptedCount: number
  top: Array<{ displayName: string; best: number }>
}> {
  const response = await workerRequest(`/api/weekly/board?id=${WEEKLY_ID}`)
  expect(response.status).toBe(200)
  return response.json()
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  env = {
    DB: new SqliteD1Database(sqlite) as unknown as D1Database,
    JWT_SECRET: 'score-visibility-integration-secret',
    ADMIN_KEY,
  }
  seedUser(TARGET_ID, 'Target Singer')
  seedUser(CONTROL_ID, 'Control Singer')
  seedWeeklyChallenge()
  seedSession('target-best', TARGET_ID, 96)
  seedSession('target-second', TARGET_ID, 89)
  seedSession('control-session', CONTROL_ID, 82)
})

afterEach(() => {
  sqlite.close()
})

describe('score visibility against the migrated schema', () => {
  it('fails closed before reading or changing score state', async () => {
    const body = {
      userId: TARGET_ID,
      scope: 'leaderboard',
      excluded: true,
      reason: 'Owner requested score removal',
    }
    const unauthorized = await scoreRequest(body, {})
    expect(unauthorized.status).toBe(403)

    env.ACCESS_TEAM_DOMAIN = 'example-team.cloudflareaccess.com'
    env.ACCESS_AUD = 'score-admin-audience'
    env.ACCESS_STRICT = '1'
    const keyOnly = await scoreRequest(body)
    expect(keyOnly.status).toBe(403)

    expect(
      sqlite
        .prepare('SELECT leaderboardExcludedAt FROM users WHERE id = ?')
        .get(TARGET_ID)?.leaderboardExcludedAt,
    ).toBeNull()
    expect(
      sqlite.prepare('SELECT COUNT(*) count FROM scoreVisibilityEvents').get()
        ?.count,
    ).toBe(0)
  })

  it('validates the exact scope, target, and audit reason', async () => {
    for (const body of [
      {
        userId: 'not-a-uuid',
        scope: 'leaderboard',
        excluded: true,
        reason: 'Owner requested score removal',
      },
      {
        userId: TARGET_ID,
        scope: 'everything',
        excluded: true,
        reason: 'Owner requested score removal',
      },
      {
        userId: TARGET_ID,
        scope: 'leaderboard',
        weeklyChallengeId: WEEKLY_ID,
        excluded: true,
        reason: 'Owner requested score removal',
      },
      {
        userId: TARGET_ID,
        scope: 'weekly-challenge',
        excluded: true,
        reason: 'Owner requested score removal',
      },
      {
        userId: TARGET_ID,
        scope: 'leaderboard',
        excluded: 'yes',
        reason: 'Owner requested score removal',
      },
      {
        userId: TARGET_ID,
        scope: 'leaderboard',
        excluded: true,
        reason: 'short',
      },
      {
        userId: TARGET_ID,
        scope: 'leaderboard',
        excluded: true,
        reason: 'valid reason\nforged',
      },
    ]) {
      const response = await scoreRequest(body)
      expect(response.status).toBe(400)
    }
    expect(
      sqlite.prepare('SELECT COUNT(*) count FROM scoreVisibilityEvents').get()
        ?.count,
    ).toBe(0)
  })

  it('rejects malformed requests and missing or immutable targets without side effects', async () => {
    const method = await workerRequest('/api/admin/score-visibility', {
      method: 'GET',
      headers: { 'X-Admin-Key': ADMIN_KEY },
    })
    expect(method.status).toBe(405)

    const malformed = await workerRequest('/api/admin/score-visibility', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY,
      },
      body: '{',
    })
    expect(malformed.status).toBe(400)

    const missingUser = await scoreRequest({
      userId: '00000000-0000-4000-8000-000000000299',
      scope: 'leaderboard',
      excluded: true,
      reason: 'Target account should not exist',
    })
    expect(missingUser.status).toBe(404)

    const missingWeeklyUser = await scoreRequest({
      userId: '00000000-0000-4000-8000-000000000299',
      scope: 'weekly-challenge',
      weeklyChallengeId: WEEKLY_ID,
      excluded: true,
      reason: 'Weekly target account should not exist',
    })
    expect(missingWeeklyUser.status).toBe(404)

    const missingChallenge = await scoreRequest({
      userId: TARGET_ID,
      scope: 'weekly-challenge',
      weeklyChallengeId: 'missing-weekly-challenge',
      excluded: true,
      reason: 'Target challenge should not exist',
    })
    expect(missingChallenge.status).toBe(404)

    sqlite
      .prepare("UPDATE weeklyChallenges SET status = 'queued' WHERE id = ?")
      .run(WEEKLY_ID)
    const queuedChallenge = await scoreRequest({
      userId: TARGET_ID,
      scope: 'weekly-challenge',
      weeklyChallengeId: WEEKLY_ID,
      excluded: true,
      reason: 'Queued standings must remain unchanged',
    })
    expect(queuedChallenge.status).toBe(409)

    expect(
      sqlite.prepare('SELECT COUNT(*) count FROM scoreVisibilityEvents').get()
        ?.count,
    ).toBe(0)
    expect(
      sqlite
        .prepare('SELECT COUNT(*) count FROM weeklyChallengeScoreRetractions')
        .get()?.count,
    ).toBe(0)
  })

  it('excludes and restores the main leaderboard without changing scores or opt-in', async () => {
    expect(await leaderboardIds()).toEqual([TARGET_ID, CONTROL_ID])

    const requestBody = {
      userId: TARGET_ID,
      scope: 'leaderboard',
      excluded: true,
      reason: 'Owner requested leaderboard removal',
    }
    const excluded = await scoreRequest(requestBody)
    expect(excluded.status).toBe(200)
    expect(excluded.headers.get('cache-control')).toContain('no-store')
    await expect(excluded.json()).resolves.toMatchObject({
      userId: TARGET_ID,
      scope: 'leaderboard',
      weeklyChallengeId: null,
      excluded: true,
      changed: true,
    })
    expect(await leaderboardIds()).toEqual([CONTROL_ID])
    expect((await weeklyBoard()).attemptedCount).toBe(2)
    expect(
      sqlite
        .prepare('SELECT COUNT(*) count FROM sessionRecords WHERE userId = ?')
        .get(TARGET_ID)?.count,
    ).toBe(2)
    expect(
      sqlite
        .prepare('SELECT leaderboardOptIn FROM userProfiles WHERE id = ?')
        .get(TARGET_ID)?.leaderboardOptIn,
    ).toBe(1)

    const repeated = await scoreRequest(requestBody)
    await expect(repeated.json()).resolves.toMatchObject({ changed: false })
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) count FROM scoreVisibilityEvents WHERE scope = 'leaderboard'",
        )
        .get()?.count,
    ).toBe(1)

    const restored = await scoreRequest({
      ...requestBody,
      excluded: false,
      reason: 'Owner approved leaderboard restoration',
    })
    await expect(restored.json()).resolves.toMatchObject({
      excluded: false,
      excludedAt: null,
      changed: true,
    })
    expect(await leaderboardIds()).toEqual([TARGET_ID, CONTROL_ID])
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) count FROM scoreVisibilityEvents WHERE scope = 'leaderboard'",
        )
        .get()?.count,
    ).toBe(2)
  })

  it('retracts every attempt for one active week and restores from source rows', async () => {
    const requestBody = {
      userId: TARGET_ID,
      scope: 'weekly-challenge',
      weeklyChallengeId: WEEKLY_ID,
      excluded: true,
      reason: 'Owner requested weekly score retraction',
    }
    const retracted = await scoreRequest(requestBody)
    expect(retracted.status).toBe(200)
    await expect(retracted.json()).resolves.toMatchObject({
      userId: TARGET_ID,
      scope: 'weekly-challenge',
      weeklyChallengeId: WEEKLY_ID,
      excluded: true,
      changed: true,
    })

    const hiddenBoard = await weeklyBoard()
    expect(hiddenBoard.attemptedCount).toBe(1)
    expect(hiddenBoard.top.map((entry) => entry.displayName)).toEqual([
      'Control Singer',
    ])
    expect(await leaderboardIds()).toEqual([TARGET_ID, CONTROL_ID])
    expect(
      sqlite
        .prepare('SELECT COUNT(*) count FROM sessionRecords WHERE userId = ?')
        .get(TARGET_ID)?.count,
    ).toBe(2)
    expect(
      sqlite
        .prepare(
          'SELECT reason FROM weeklyChallengeScoreRetractions WHERE weeklyChallengeId = ? AND userId = ?',
        )
        .get(WEEKLY_ID, TARGET_ID)?.reason,
    ).toBe(requestBody.reason)

    const repeated = await scoreRequest(requestBody)
    await expect(repeated.json()).resolves.toMatchObject({ changed: false })
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) count FROM scoreVisibilityEvents WHERE scope = 'weekly-challenge'",
        )
        .get()?.count,
    ).toBe(1)

    const restored = await scoreRequest({
      ...requestBody,
      excluded: false,
      reason: 'Owner approved weekly score restoration',
    })
    await expect(restored.json()).resolves.toMatchObject({
      excluded: false,
      excludedAt: null,
      changed: true,
    })
    const restoredBoard = await weeklyBoard()
    expect(restoredBoard.attemptedCount).toBe(2)
    expect(restoredBoard.top[0]).toMatchObject({
      displayName: 'Target Singer',
      best: 96,
    })

    sqlite
      .prepare("UPDATE weeklyChallenges SET status = 'closed' WHERE id = ?")
      .run(WEEKLY_ID)
    const archived = await scoreRequest(requestBody)
    expect(archived.status).toBe(409)
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) count FROM scoreVisibilityEvents WHERE scope = 'weekly-challenge'",
        )
        .get()?.count,
    ).toBe(2)
    expect(
      sqlite
        .prepare('SELECT COUNT(*) count FROM weeklyChallengeScoreRetractions')
        .get()?.count,
    ).toBe(0)
  })
})
