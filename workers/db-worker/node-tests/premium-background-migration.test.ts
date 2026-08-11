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

const STUDIO_MIGRATION = join(
  import.meta.dirname,
  '../migrations/0018_premium_background_studio.sql',
)
const PIANO_MIGRATION = join(
  import.meta.dirname,
  '../migrations/0023_piano_background_surface.sql',
)
const PIANO_PACK_MIGRATION = join(
  import.meta.dirname,
  '../migrations/0024_piano_background_pack.sql',
)
const BACKGROUND_ID = 'golden-stage'
const NOW = '2026-08-06T00:00:00.000Z'
const PIANO_CORE_IDS = [
  'piano-aurora-loft',
  'piano-mercury-archive',
  'piano-midnight-rain',
  'piano-velvet-recital',
] as const
const PIANO_PACK_IDS = [
  'piano-alpine-observatory',
  'piano-cedar-listening-room',
  'piano-coastal-fog-pavilion',
  'piano-desert-modern-salon',
  'piano-moonlit-gallery',
  'piano-rain-glasshouse',
] as const
const PIANO_IDS = [...PIANO_CORE_IDS, ...PIANO_PACK_IDS].sort()

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

function applyPianoMigration(database: DatabaseSync): void {
  database.exec(readFileSync(PIANO_MIGRATION, 'utf8'))
  database.exec(readFileSync(PIANO_PACK_MIGRATION, 'utf8'))
}

function applyPianoPackMigration(database: DatabaseSync): void {
  database.exec(readFileSync(PIANO_PACK_MIGRATION, 'utf8'))
}

function rows(database: DatabaseSync, table: string, where = '1 = 1') {
  return database
    .prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY 1, 2`)
    .all()
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'mercurypitch-premium-migration-'))
  const databasePath = join(directory, 'premium.sqlite')
  primary = new DatabaseSync(databasePath)
  primary.exec('PRAGMA foreign_keys = ON')
  primary.exec('CREATE TABLE users (id TEXT PRIMARY KEY)')
  primary.exec(readFileSync(STUDIO_MIGRATION, 'utf8'))
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

    expect(() =>
      primary.exec(readFileSync(STUDIO_MIGRATION, 'utf8')),
    ).not.toThrow()
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

  it('adds the complete Piano pack without publishing protected revisions', () => {
    applyPianoMigration(primary)

    expect(
      primary
        .prepare(
          `SELECT id, surface, status, activeRevisionId
             FROM premiumBackgroundAssets
            WHERE surface = 'piano'
            ORDER BY id`,
        )
        .all(),
    ).toEqual(
      PIANO_IDS.map((id) => ({
        activeRevisionId: null,
        id,
        status: 'active',
        surface: 'piano',
      })),
    )
    expect(
      primary
        .prepare(
          `SELECT backgroundId, revokedAt
             FROM premiumSupporterGroupPerks
            WHERE backgroundId LIKE 'piano-%'
            ORDER BY backgroundId`,
        )
        .all(),
    ).toEqual(
      PIANO_IDS.map((backgroundId) => ({
        backgroundId,
        revokedAt: null,
      })),
    )
    expect(
      primary
        .prepare(
          `SELECT COUNT(*) AS count
             FROM premiumBackgroundRevisions r
             JOIN premiumBackgroundAssets a ON a.id = r.backgroundId
            WHERE a.surface = 'piano'`,
        )
        .get(),
    ).toEqual({ count: 0 })
    expect(primary.prepare('PRAGMA foreign_key_check').all()).toEqual([])

    expect(() =>
      primary
        .prepare(
          `INSERT INTO premiumBackgroundAssets
            (id, surface, title, description, status, activeRevisionId,
             createdAt, updatedAt, retiredAt)
           VALUES ('bad-surface', 'video', 'Bad', '', 'active', NULL,
                   ?, ?, NULL)`,
        )
        .run(NOW, NOW),
    ).toThrow(/CHECK constraint failed/)
  })

  it('preserves published revisions, immutable keys, grants and capabilities', () => {
    primary.prepare('INSERT INTO users (id) VALUES (?)').run('user-1')
    primary
      .prepare(
        `INSERT INTO premiumBackgroundRevisions
          (id, backgroundId, version, lifecycle, createdAt, updatedAt,
           publishedAt, supersededAt)
         VALUES ('published-1', ?, 1, 'published', ?, ?, ?, NULL)`,
      )
      .run(BACKGROUND_ID, NOW, NOW, NOW)
    for (const [id, variant, width, height] of [
      ['variant-2k', 'landscape-2k', 2048, 1152],
      ['variant-4k', 'landscape-4k', 3840, 2160],
      ['variant-portrait', 'portrait-2k', 1440, 2560],
    ] as const) {
      primary
        .prepare(
          `INSERT INTO premiumBackgroundVariants
            (id, revisionId, variant, objectKey, width, height, byteSize,
             sha256, etag, createdAt, updatedAt)
           VALUES (?, 'published-1', ?, ?, ?, ?, 123, 'sha256', 'etag', ?, ?)`,
        )
        .run(
          id,
          variant,
          `backgrounds/v2/jam/golden-stage/v1/${variant}/${id}.webp`,
          width,
          height,
          NOW,
          NOW,
        )
    }
    primary
      .prepare(
        `UPDATE premiumBackgroundAssets
            SET activeRevisionId = 'published-1'
          WHERE id = ?`,
      )
      .run(BACKGROUND_ID)
    primary
      .prepare(
        `UPDATE premiumSupporterGroupPerks
            SET revokedAt = ?
          WHERE groupId = 'group-active-supporters'
            AND backgroundId = 'aurora-stage'`,
      )
      .run(NOW)
    primary
      .prepare(
        `INSERT INTO premiumBackgroundCapabilities
          (id, backgroundId, revisionId, version, roomId, issuerUserId,
           issuedAt, expiresAt, revokedAt)
         VALUES ('capability-1', ?, 'published-1', 1, 'ABCDEFGH', 'user-1',
                 ?, '2099-01-01T00:00:00.000Z', NULL)`,
      )
      .run(BACKGROUND_ID, NOW)

    const before = {
      assets: rows(primary, 'premiumBackgroundAssets'),
      capabilities: rows(primary, 'premiumBackgroundCapabilities'),
      groupPerks: rows(primary, 'premiumSupporterGroupPerks'),
      revisions: rows(primary, 'premiumBackgroundRevisions'),
      variants: rows(primary, 'premiumBackgroundVariants'),
    }

    applyPianoMigration(primary)

    expect(
      rows(primary, 'premiumBackgroundAssets', "surface != 'piano'"),
    ).toEqual(before.assets)
    expect(rows(primary, 'premiumBackgroundRevisions')).toEqual(
      before.revisions,
    )
    expect(rows(primary, 'premiumBackgroundVariants')).toEqual(before.variants)
    expect(
      rows(
        primary,
        'premiumSupporterGroupPerks',
        "backgroundId NOT LIKE 'piano-%'",
      ),
    ).toEqual(before.groupPerks)
    expect(rows(primary, 'premiumBackgroundCapabilities')).toEqual(
      before.capabilities,
    )
    expect(primary.prepare('PRAGMA foreign_key_check').all()).toEqual([])

    expect(() =>
      primary
        .prepare(
          `INSERT INTO premiumBackgroundRevisions
            (id, backgroundId, version, lifecycle, createdAt, updatedAt,
             publishedAt, supersededAt)
           VALUES ('published-2', ?, 2, 'published', ?, ?, ?, NULL)`,
        )
        .run(BACKGROUND_ID, NOW, NOW, NOW),
    ).toThrow(/UNIQUE constraint failed/)
  })

  it('replays the additive pack without restoring an intentional revocation', () => {
    applyPianoMigration(primary)
    primary
      .prepare(
        `UPDATE premiumSupporterGroupPerks
            SET revokedAt = ?
          WHERE groupId = 'group-active-supporters'
            AND backgroundId = 'piano-rain-glasshouse'`,
      )
      .run(NOW)

    expect(() => applyPianoPackMigration(primary)).not.toThrow()
    expect(
      primary
        .prepare(
          `SELECT revokedAt FROM premiumSupporterGroupPerks
            WHERE groupId = 'group-active-supporters'
              AND backgroundId = 'piano-rain-glasshouse'`,
        )
        .get(),
    ).toEqual({ revokedAt: NOW })
    expect(primary.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
})
