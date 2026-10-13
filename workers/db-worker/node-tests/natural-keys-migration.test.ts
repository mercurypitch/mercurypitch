// @vitest-environment node
//
// ── 0070: one setting per key, one progress row per challenge ────────
//
// A UNIQUE index cannot be created over existing duplicates, and production
// has had both tables written read-then-create since the baseline. So this
// runs the migration against the duplicates it exists to remove: the schema
// as it stood before 0070, rows a released build could have written, then
// 0070 itself.

import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyMigration, applyMigrations } from './sqlite-d1'

const MIGRATION = '0070_natural_keys.sql'
const USER = 'user-a'
const OTHER = 'user-b'

let sqlite: DatabaseSync

function setting(
  id: string,
  userId: string,
  key: string,
  value: string,
  updatedAt: string,
  createdAt = '2026-01-01T00:00:00.000Z',
): void {
  sqlite
    .prepare(
      `INSERT INTO userSettings (id, createdAt, updatedAt, userId, "key", value)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, createdAt, updatedAt, userId, key, value)
}

function progress(
  id: string,
  createdAt: string,
  row: {
    bestScore: number
    completed: 0 | 1
    status: string
    attempts: number
    completedAt: string | null
    userId?: string
    challengeId?: string
    progress?: number
    currentScore?: number
  },
): void {
  sqlite
    .prepare(
      `INSERT INTO challengeProgress (id, createdAt, updatedAt, userId,
         challengeId, progress, currentScore, bestScore, status, completed,
         completedAt, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      createdAt,
      createdAt,
      row.userId ?? USER,
      row.challengeId ?? 'c1',
      row.progress ?? row.bestScore,
      row.currentScore ?? row.bestScore,
      row.bestScore,
      row.status,
      row.completed,
      row.completedAt,
      row.attempts,
    )
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  applyMigrations(sqlite, MIGRATION)
})

afterEach(() => {
  sqlite.close()
})

describe('0070 on settings written twice', () => {
  it('keeps the newest value of each key, per user', () => {
    setting('s1', USER, 'theme', '"dark"', '2026-01-01T00:00:00.000Z')
    setting('s2', USER, 'theme', '"light"', '2026-03-01T00:00:00.000Z')
    setting('s3', USER, 'theme', '"solarized"', '2026-02-01T00:00:00.000Z')
    setting('s4', OTHER, 'theme', '"dark"', '2026-01-01T00:00:00.000Z')
    setting('s5', USER, 'font', '"large"', '2026-01-01T00:00:00.000Z')

    applyMigration(sqlite, MIGRATION)

    expect(
      sqlite
        .prepare(
          'SELECT id, userId, "key", value FROM userSettings ORDER BY id',
        )
        .all(),
    ).toEqual([
      { id: 's2', userId: USER, key: 'theme', value: '"light"' },
      { id: 's4', userId: OTHER, key: 'theme', value: '"dark"' },
      { id: 's5', userId: USER, key: 'font', value: '"large"' },
    ])
  })

  it('breaks equal update times by creation time and then id regardless of insertion order', () => {
    const updated = '2026-03-01T00:00:00.000Z'
    setting(
      's-c',
      USER,
      'theme',
      '"older creation"',
      updated,
      '2026-01-01T00:00:00.000Z',
    )
    setting(
      's-b',
      USER,
      'theme',
      '"larger id"',
      updated,
      '2026-02-01T00:00:00.000Z',
    )
    setting(
      's-a',
      USER,
      'theme',
      '"survivor"',
      updated,
      '2026-02-01T00:00:00.000Z',
    )

    applyMigration(sqlite, MIGRATION)

    expect(
      sqlite
        .prepare('SELECT id, value, createdAt, updatedAt FROM userSettings')
        .all(),
    ).toEqual([
      {
        id: 's-a',
        value: '"survivor"',
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: updated,
      },
    ])
  })

  it('refuses a second row for the same key afterwards', () => {
    applyMigration(sqlite, MIGRATION)
    setting('s1', USER, 'theme', '"dark"', '2026-01-01T00:00:00.000Z')
    expect(() =>
      setting('s2', USER, 'theme', '"light"', '2026-01-02T00:00:00.000Z'),
    ).toThrow(/UNIQUE/)
  })
})

describe('0070 migration lookup cost', () => {
  it('looks up duplicate progress by both user and challenge before merging', () => {
    // Inspect SQLite's plan for the actual migration UPDATE, after executing
    // its real prefix. A challenge-only lookup scans every user on a popular
    // challenge even when none of them has duplicate progress.
    const statements = readFileSync(
      new URL('../migrations/0070_natural_keys.sql', import.meta.url),
      'utf8',
    ).split(';')
    const mergeIndex = statements.findIndex((statement) =>
      /\bUPDATE challengeProgress\b/.test(statement),
    )
    expect(mergeIndex).toBeGreaterThan(0)
    sqlite.exec(statements.slice(0, mergeIndex).join(';'))
    const plan = sqlite
      .prepare(`EXPLAIN QUERY PLAN ${statements[mergeIndex]}`)
      .all() as Array<{ detail: string }>
    const duplicateLookups = plan.filter((step) =>
      /SEARCH d /.test(step.detail),
    )

    expect(duplicateLookups).toHaveLength(7)
    for (const lookup of duplicateLookups) {
      expect(lookup.detail).toContain('(userId=? AND challengeId=?)')
    }
    sqlite.exec(statements.slice(mergeIndex).join(';'))
    const indexes = sqlite
      .prepare('PRAGMA index_list(challengeProgress)')
      .all() as Array<{ name: string; unique: number }>
    expect(
      indexes.find(
        (index) => index.name === 'uq_challengeProgress_user_challenge',
      )?.unique,
    ).toBe(1)
    expect(indexes.map((index) => index.name)).not.toContain(
      'idx_challengeProgress_natural_key_merge',
    )
  })
})

describe('0070 on challenge progress saved twice', () => {
  it('keeps one row that holds the best of both', () => {
    // The oldest row is the one a client most likely cached, and it holds
    // the worse half: no completion, a lower score.
    progress('p1', '2026-01-01T00:00:00.000Z', {
      bestScore: 40,
      completed: 0,
      status: 'active',
      attempts: 4,
      completedAt: null,
    })
    progress('p2', '2026-01-02T00:00:00.000Z', {
      bestScore: 95,
      completed: 1,
      status: 'completed',
      attempts: 3,
      completedAt: '2026-01-02T10:00:00.000Z',
    })

    applyMigration(sqlite, MIGRATION)

    expect(
      sqlite
        .prepare(
          `SELECT id, bestScore, completed, status, attempts, completedAt
             FROM challengeProgress`,
        )
        .all(),
    ).toEqual([
      {
        id: 'p1',
        bestScore: 95,
        completed: 1,
        status: 'completed',
        attempts: 4,
        completedAt: '2026-01-02T10:00:00.000Z',
      },
    ])
  })

  it('combines independent maxima and earliest completion without crossing users or challenges', () => {
    const completed = {
      bestScore: 70,
      completed: 1 as const,
      status: 'completed',
      attempts: 3,
      completedAt: '2026-02-01T00:00:00.000Z',
    }
    progress('p-b', '2026-01-01T00:00:00.000Z', {
      ...completed,
      bestScore: 99,
      progress: 75,
      completedAt: '2026-02-02T00:00:00.000Z',
    })
    progress('p-c', '2026-01-02T00:00:00.000Z', {
      ...completed,
      progress: 100,
      attempts: 10,
    })
    progress('p-a', '2026-01-01T00:00:00.000Z', {
      ...completed,
      bestScore: 40,
      progress: 40,
      currentScore: 35,
      completed: 0,
      status: 'in-progress',
      attempts: 4,
      completedAt: null,
    })
    progress('other-user', '2026-01-01T00:00:00.000Z', {
      ...completed,
      userId: OTHER,
      bestScore: 11,
      progress: 11,
    })
    progress('other-challenge', '2026-01-01T00:00:00.000Z', {
      ...completed,
      challengeId: 'c2',
      bestScore: 22,
      progress: 22,
    })
    const independent = sqlite
      .prepare(
        "SELECT * FROM challengeProgress WHERE id LIKE 'other-%' ORDER BY id",
      )
      .all()

    applyMigration(sqlite, MIGRATION)

    expect(
      sqlite
        .prepare(
          'SELECT id, progress, currentScore, bestScore, completed, status, attempts, completedAt FROM challengeProgress WHERE userId = ? AND challengeId = ?',
        )
        .get(USER, 'c1'),
    ).toEqual({
      id: 'p-a',
      progress: 100,
      currentScore: 35,
      bestScore: 99,
      completed: 1,
      status: 'completed',
      attempts: 10,
      completedAt: '2026-02-01T00:00:00.000Z',
    })
    expect(
      sqlite
        .prepare(
          "SELECT * FROM challengeProgress WHERE id LIKE 'other-%' ORDER BY id",
        )
        .all(),
    ).toEqual(independent)
    expect(
      sqlite.prepare('SELECT COUNT(*) AS count FROM challengeProgress').get(),
    ).toEqual({ count: 3 })
    expect(() =>
      progress('duplicate', '2026-04-01T00:00:00.000Z', completed),
    ).toThrow(/UNIQUE/)
  })

  it('retains null completion and the oldest status when every duplicate is unfinished', () => {
    const unfinished = {
      bestScore: 20,
      completed: 0 as const,
      status: 'in-progress',
      attempts: 1,
      completedAt: null,
    }
    progress('oldest', '2026-01-01T00:00:00.000Z', unfinished)
    progress('newest', '2026-01-02T00:00:00.000Z', {
      ...unfinished,
      bestScore: 65,
      attempts: 2,
    })

    applyMigration(sqlite, MIGRATION)

    expect(
      sqlite
        .prepare(
          'SELECT id, bestScore, completed, status, attempts, completedAt FROM challengeProgress',
        )
        .all(),
    ).toEqual([
      {
        id: 'oldest',
        bestScore: 65,
        completed: 0,
        status: 'in-progress',
        attempts: 2,
        completedAt: null,
      },
    ])
    const migrated = sqlite.prepare('SELECT * FROM challengeProgress').all()
    applyMigration(sqlite, MIGRATION)
    expect(sqlite.prepare('SELECT * FROM challengeProgress').all()).toEqual(
      migrated,
    )
  })

  it('leaves a challenge that was saved once exactly as it was', () => {
    progress('p1', '2026-01-01T00:00:00.000Z', {
      bestScore: 40,
      completed: 0,
      status: 'active',
      attempts: 2,
      completedAt: null,
    })

    applyMigration(sqlite, MIGRATION)

    expect(
      sqlite
        .prepare(
          'SELECT bestScore, completed, status, attempts FROM challengeProgress',
        )
        .all(),
    ).toEqual([{ bestScore: 40, completed: 0, status: 'active', attempts: 2 }])
  })
})
