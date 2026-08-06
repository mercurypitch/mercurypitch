// @vitest-environment node

// ============================================================
// Premium background migration — real SQLite lifecycle invariants
// ============================================================
//
// Separate connections model two Studio requests that both pass their
// application-level draft preflight before either insert reaches D1.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const MIGRATION = join(
  import.meta.dirname,
  '../migrations/0018_premium_background_studio.sql',
)
const BACKGROUND_ID = 'golden-stage'
const NOW = '2026-08-06T00:00:00.000Z'

let directory: string
let primary: DatabaseSync
let contender: DatabaseSync

function draftCount(database: DatabaseSync): number {
  const row = database
    .prepare(
      `SELECT COUNT(*) AS count
         FROM premiumBackgroundRevisions
        WHERE backgroundId = ? AND lifecycle = 'draft'`,
    )
    .get(BACKGROUND_ID) as { count: number }
  return row.count
}

function insertDraft(
  database: DatabaseSync,
  id: string,
  version: number,
): void {
  database
    .prepare(
      `INSERT INTO premiumBackgroundRevisions
         (id, backgroundId, version, lifecycle, createdAt, updatedAt,
          publishedAt, supersededAt)
       VALUES (?, ?, ?, 'draft', ?, ?, NULL, NULL)`,
    )
    .run(id, BACKGROUND_ID, version, NOW, NOW)
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'mercurypitch-premium-migration-'))
  const databasePath = join(directory, 'premium.sqlite')
  primary = new DatabaseSync(databasePath)
  primary.exec('PRAGMA foreign_keys = ON')
  primary.exec(readFileSync(MIGRATION, 'utf8'))
  contender = new DatabaseSync(databasePath)
  contender.exec('PRAGMA foreign_keys = ON')
})

afterEach(() => {
  contender.close()
  primary.close()
  rmSync(directory, { force: true, recursive: true })
})

describe('premium background revision migration', () => {
  it('replays safely and restores additive indexes for persistent previews', () => {
    primary.exec('DROP INDEX idx_premiumBackgroundRevisions_one_draft')

    expect(() => primary.exec(readFileSync(MIGRATION, 'utf8'))).not.toThrow()
    expect(
      primary
        .prepare(
          `SELECT name FROM sqlite_master
            WHERE type = 'index'
              AND name = 'idx_premiumBackgroundRevisions_one_draft'`,
        )
        .get(),
    ).toEqual({ name: 'idx_premiumBackgroundRevisions_one_draft' })

    insertDraft(primary, 'replayed-draft', 1)
    expect(() => insertDraft(contender, 'duplicate-draft', 2)).toThrow(
      /UNIQUE constraint failed/,
    )
  })

  it('allows only one draft when concurrent create preflights both see none', () => {
    expect(draftCount(primary)).toBe(0)
    expect(draftCount(contender)).toBe(0)

    insertDraft(primary, 'draft-winner', 1)

    expect(() => insertDraft(contender, 'draft-loser', 2)).toThrow(
      /UNIQUE constraint failed/,
    )
    expect(draftCount(primary)).toBe(1)
    expect(
      primary
        .prepare(
          `SELECT id FROM premiumBackgroundRevisions
            WHERE backgroundId = ? AND lifecycle = 'draft'`,
        )
        .get(BACKGROUND_ID),
    ).toEqual({ id: 'draft-winner' })
  })
})
