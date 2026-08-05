// @vitest-environment node

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Env } from './auth'
import worker from './index'
import { awardForSessionRecord, getLeagueMe, isoWeekStart, runWeeklyLeagueCut, } from './league'

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

const ACTIVE_ID = '00000000-0000-4000-8000-000000000101'
const SUSPENDED_ID = '00000000-0000-4000-8000-000000000102'
const WEEKLY_ID = 'weekly-suspension-integration'
const NOW = '2026-08-05T12:00:00.000Z'

let sqlite: DatabaseSync
let database: SqliteD1Database
let env: Env

function applyMigrations(target: DatabaseSync): void {
  const directory = join(import.meta.dirname, '../migrations')
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    target.exec(readFileSync(join(directory, file), 'utf8'))
  }
}

function seedUser(
  id: string,
  displayName: string,
  suspendedAt: string | null,
): void {
  sqlite
    .prepare(
      `INSERT INTO users
         (id, createdAt, updatedAt, authProvider, email, emailVerified,
          lastLoginAt, tokenVersion, suspendedAt, suspensionReason)
       VALUES (?, ?, ?, 'password', ?, 1, ?, 1, ?, ?)`,
    )
    .run(
      id,
      NOW,
      NOW,
      `${displayName.toLowerCase()}@example.com`,
      NOW,
      suspendedAt,
      suspendedAt === null ? null : 'Automated abuse review',
    )
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
      'suspension-integration',
      'Suspension Integration',
      'Real SQL exclusion coverage',
      'range',
      'intermediate',
      '2026-08-03T00:00:00.000Z',
      '2026-08-10T00:00:00.000Z',
    )
}

function seedSession(id: string, userId: string, score: number): void {
  sqlite
    .prepare(
      `INSERT INTO sessionRecords
         (id, createdAt, updatedAt, userId, melodyName, startedAt, endedAt,
          score, accuracy, notesHit, notesTotal, streak, weeklyChallengeId,
          results, source)
       VALUES (?, ?, ?, ?, 'Legend: Integration', ?, ?, ?, ?, 9, 10, 5, ?,
               '{}', 'weekly')`,
    )
    .run(id, NOW, NOW, userId, NOW, NOW, score, score, WEEKLY_ID)
}

function workerRequest(path: string, init?: RequestInit): Promise<Response> {
  return worker.fetch(
    new Request(`https://api.test${path}`, init),
    env,
    {} as ExecutionContext,
  )
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite)
  database = new SqliteD1Database(sqlite)
  env = {
    DB: database as unknown as D1Database,
    JWT_SECRET: 'suspension-integration-secret',
    ADMIN_KEY: 'suspension-integration-admin',
  }
})

afterEach(() => {
  sqlite.close()
})

describe('account suspension against the migrated schema', () => {
  it('excludes suspended users from the live and weekly leaderboards', async () => {
    seedUser(ACTIVE_ID, 'Active Singer', null)
    seedUser(SUSPENDED_ID, 'Suspended Singer', NOW)
    seedWeeklyChallenge()
    seedSession('active-session', ACTIVE_ID, 91)
    seedSession('suspended-session', SUSPENDED_ID, 99)

    const leaderboard = await workerRequest(
      '/api/leaderboard?category=overall&period=all-time&view=global',
    )
    expect(leaderboard.status).toBe(200)
    await expect(leaderboard.json()).resolves.toMatchObject({
      total: 1,
      entries: [{ userId: ACTIVE_ID, displayName: 'Active Singer' }],
    })

    const weekly = await workerRequest(`/api/weekly/board?id=${WEEKLY_ID}`)
    expect(weekly.status).toBe(200)
    await expect(weekly.json()).resolves.toMatchObject({
      attemptedCount: 1,
      completedCount: 1,
      top: [{ displayName: 'Active Singer', best: 91 }],
    })
  })

  it('excludes suspended users from league awards, standings, and cuts', async () => {
    seedUser(ACTIVE_ID, 'Active Singer', null)
    seedUser(SUSPENDED_ID, 'Suspended Singer', NOW)
    const currentWeek = isoWeekStart()
    const previousWeek = new Date(
      Date.parse(currentWeek) - 7 * 24 * 60 * 60 * 1000,
    ).toISOString()

    sqlite
      .prepare(
        `INSERT INTO leagueCohorts (id, createdAt, leagueId, weekStart)
         VALUES ('current-l1', ?, 'l1', ?), ('previous-l1', ?, 'l1', ?)`,
      )
      .run(NOW, currentWeek, NOW, previousWeek)
    const membership = sqlite.prepare(
      `INSERT INTO leagueMembership
         (id, updatedAt, userId, cohortId, weekStart, points)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    membership.run('active-current', NOW, ACTIVE_ID, 'current-l1', currentWeek, 40)
    membership.run(
      'suspended-current',
      NOW,
      SUSPENDED_ID,
      'current-l1',
      currentWeek,
      100,
    )
    membership.run('active-previous', NOW, ACTIVE_ID, 'previous-l1', previousWeek, 40)
    membership.run(
      'suspended-previous',
      NOW,
      SUSPENDED_ID,
      'previous-l1',
      previousWeek,
      100,
    )

    await awardForSessionRecord(env, ACTIVE_ID, {
      id: 'active-league-award',
      source: 'weekly',
      score: 90,
    })
    await awardForSessionRecord(env, SUSPENDED_ID, {
      id: 'suspended-league-award',
      source: 'weekly',
      score: 100,
    })

    const events = sqlite
      .prepare('SELECT userId FROM leaguePointEvents ORDER BY userId')
      .all()
    expect(events).toEqual([{ userId: ACTIVE_ID }])

    const league = await getLeagueMe(env, ACTIVE_ID)
    expect(league.standings).toEqual([
      expect.objectContaining({ userId: ACTIVE_ID, rank: 1 }),
    ])
    expect(league.cohortSize).toBe(1)

    await runWeeklyLeagueCut(env)
    const profiles = sqlite
      .prepare(
        `SELECT id, currentLeagueId FROM userProfiles
         WHERE id IN (?, ?) ORDER BY id`,
      )
      .all(ACTIVE_ID, SUSPENDED_ID)
    expect(profiles).toEqual([
      { id: ACTIVE_ID, currentLeagueId: 'l2' },
      { id: SUSPENDED_ID, currentLeagueId: 'l1' },
    ])
  })

  it('revokes sessions once, audits once, restores safely, and preserves CORS errors', async () => {
    const registration = await workerRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'moderated@example.com',
        password: 'secret123',
        displayName: 'Moderated Singer',
      }),
    })
    expect(registration.status).toBe(200)
    const auth = (await registration.json()) as {
      token: string
      userId: string
    }
    const moderationBody = JSON.stringify({
      userId: auth.userId,
      suspended: true,
      reason: 'Automated abuse review',
    })
    const suspend = (): Promise<Response> =>
      workerRequest('/api/admin/user-suspension', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': 'suspension-integration-admin',
        },
        body: moderationBody,
      })

    const suspensionResponses = await Promise.all([suspend(), suspend()])
    const suspensionStates = await Promise.all(
      suspensionResponses.map(
        async (response) =>
          (await response.json()) as { changed: boolean; suspended: boolean },
      ),
    )
    expect(suspensionStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ changed: true, suspended: true }),
        expect.objectContaining({ changed: false, suspended: true }),
      ]),
    )
    expect(
      sqlite
        .prepare(
          'SELECT action, reason FROM userModerationEvents WHERE userId = ?',
        )
        .all(auth.userId),
    ).toEqual([{ action: 'suspend', reason: 'Automated abuse review' }])
    expect(
      sqlite
        .prepare('SELECT tokenVersion FROM users WHERE id = ?')
        .get(auth.userId),
    ).toEqual({ tokenVersion: 2 })

    const blocked = await workerRequest('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${auth.token}`,
        Origin: 'https://app.test',
      },
    })
    expect(blocked.status).toBe(403)
    expect(blocked.headers.get('Access-Control-Allow-Origin')).toBe('*')
    await expect(blocked.json()).resolves.toEqual({
      error: 'This account is suspended.',
      code: 'account_suspended',
    })

    const restored = await workerRequest('/api/admin/user-suspension', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': 'suspension-integration-admin',
      },
      body: JSON.stringify({
        userId: auth.userId,
        suspended: false,
        reason: 'Manual appeal accepted',
      }),
    })
    expect(restored.status).toBe(200)
    await expect(restored.json()).resolves.toMatchObject({
      changed: true,
      suspended: false,
      suspendedAt: null,
    })

    const stale = await workerRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    expect(stale.status).toBe(401)

    const login = await workerRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'moderated@example.com',
        password: 'secret123',
      }),
    })
    expect(login.status).toBe(200)
    const freshAuth = (await login.json()) as { token: string }
    expect(freshAuth.token).not.toBe(auth.token)
    const activeAgain = await workerRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${freshAuth.token}` },
    })
    expect(activeAgain.status).toBe(200)
  })
})
