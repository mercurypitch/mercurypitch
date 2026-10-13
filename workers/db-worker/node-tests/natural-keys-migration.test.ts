// @vitest-environment node
//
// ── 0070: one setting per key, one progress row per challenge ────────
//
// A UNIQUE index cannot be created over existing duplicates, and production
// has had both tables written read-then-create since the baseline. So this
// runs the migration against the duplicates it exists to remove: the schema
// as it stood before 0070, rows a released build could have written, then
// 0070 itself.

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
): void {
  sqlite
    .prepare(
      `INSERT INTO userSettings (id, createdAt, updatedAt, userId, "key", value)
       VALUES (?, '2026-01-01T00:00:00.000Z', ?, ?, ?, ?)`,
    )
    .run(id, updatedAt, userId, key, value)
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
  },
): void {
  sqlite
    .prepare(
      `INSERT INTO challengeProgress (id, createdAt, updatedAt, userId,
         challengeId, progress, currentScore, bestScore, status, completed,
         completedAt, attempts)
       VALUES (?, ?, ?, ?, 'c1', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      createdAt,
      createdAt,
      USER,
      row.bestScore,
      row.bestScore,
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

  it('refuses a second row for the same key afterwards', () => {
    applyMigration(sqlite, MIGRATION)
    setting('s1', USER, 'theme', '"dark"', '2026-01-01T00:00:00.000Z')
    expect(() =>
      setting('s2', USER, 'theme', '"light"', '2026-01-02T00:00:00.000Z'),
    ).toThrow(/UNIQUE/)
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
