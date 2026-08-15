// @vitest-environment node

// ============================================================
// 0030_streak_high_water — repairing the record, and only the record
// ============================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const MIGRATION = join(
  import.meta.dirname,
  '../migrations/0030_streak_high_water.sql',
)

let database: DatabaseSync

/** Every shape a production row was found in, plus the one that must not move. */
const SEED: Array<[string, number, number]> = [
  // 59 of the 60 production violations, and 12 of the 13 on dev.
  ['ran-once', 1, 0],
  // The remaining production violation.
  ['ran-twice', 2, 0],
  // A record that outlives its run — the row this must NOT touch.
  ['record-holder', 1, 7],
  // Already consistent, in both the zero and the non-zero form.
  ['never-practised', 0, 0],
  ['consistent', 4, 4],
]

function streaks(): Array<{
  id: string
  currentStreak: number
  longestStreak: number
}> {
  return database
    .prepare(
      'SELECT id, currentStreak, longestStreak FROM userProfiles ORDER BY id',
    )
    .all() as Array<{
    id: string
    currentStreak: number
    longestStreak: number
  }>
}

beforeEach(() => {
  database = new DatabaseSync(':memory:')
  database.exec(`
    CREATE TABLE userProfiles (
      id TEXT PRIMARY KEY,
      currentStreak INTEGER NOT NULL DEFAULT 0,
      longestStreak INTEGER NOT NULL DEFAULT 0
    );
  `)
  const insert = database.prepare(
    'INSERT INTO userProfiles (id, currentStreak, longestStreak) VALUES (?, ?, ?)',
  )
  for (const [id, current, longest] of SEED) insert.run(id, current, longest)
})

afterEach(() => database.close())

describe('0030_streak_high_water', () => {
  it('raises a record to the run that beat it and leaves everything else', () => {
    database.exec(readFileSync(MIGRATION, 'utf8'))

    expect(streaks()).toEqual([
      { id: 'consistent', currentStreak: 4, longestStreak: 4 },
      { id: 'never-practised', currentStreak: 0, longestStreak: 0 },
      { id: 'ran-once', currentStreak: 1, longestStreak: 1 },
      { id: 'ran-twice', currentStreak: 2, longestStreak: 2 },
      { id: 'record-holder', currentStreak: 1, longestStreak: 7 },
    ])
  })

  it('never lowers a current streak', () => {
    // The audit's explicit warning: the invariant can be satisfied by pulling
    // `currentStreak` down to a wrong `longestStreak`, and that would delete
    // the run rather than record it.
    const before = streaks().map((row) => row.currentStreak)
    database.exec(readFileSync(MIGRATION, 'utf8'))
    expect(streaks().map((row) => row.currentStreak)).toEqual(before)
  })

  it('deletes no profile', () => {
    database.exec(readFileSync(MIGRATION, 'utf8'))
    expect(streaks()).toHaveLength(SEED.length)
  })

  it('replays without changing anything a second time', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    database.exec(sql)
    const once = streaks()
    database.exec(sql)
    expect(streaks()).toEqual(once)
  })

  it('leaves no row violating the invariant', () => {
    database.exec(readFileSync(MIGRATION, 'utf8'))
    expect(
      database
        .prepare(
          'SELECT COUNT(*) AS violations FROM userProfiles WHERE currentStreak > longestStreak',
        )
        .get(),
    ).toEqual({ violations: 0 })
  })
})
