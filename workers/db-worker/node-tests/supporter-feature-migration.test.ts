// @vitest-environment node

// ============================================================
// Supporter feature migration — replay-safe grants and pricing copy
// ============================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const MIGRATION = join(
  import.meta.dirname,
  '../migrations/0019_supporter_feature_perks.sql',
)
const LAB_COPY = 'MercuryPitch Lab: beta and development features'

let database: DatabaseSync

beforeEach(() => {
  database = new DatabaseSync(':memory:')
  database.exec('PRAGMA foreign_keys = ON')
  database.exec(`
    CREATE TABLE premiumSupporterGroups (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      deletedAt TEXT
    );
    CREATE TABLE pricingPlans (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      perks TEXT,
      updatedAt TEXT NOT NULL
    );
    INSERT INTO premiumSupporterGroups (id, slug, kind, deletedAt) VALUES
      ('group-active', 'active-supporters', 'automatic', NULL),
      ('group-founders', 'founders', 'manual', NULL);
    INSERT INTO pricingPlans (id, kind, perks, updatedAt) VALUES
      ('sup-fund', 'donation', '["Supporter badge","Operator note"]', 'operator-time'),
      ('sup-lab', 'donation', '["${LAB_COPY}"]', 'already-current'),
      ('credits', 'pack', '["Credits"]', 'pack-time');
  `)
})

afterEach(() => database.close())

describe('supporter feature migration', () => {
  it('seeds Lab for active supporters and preserves operator pricing bullets', () => {
    database.exec(readFileSync(MIGRATION, 'utf8'))

    expect(
      database
        .prepare(
          `SELECT groupId, featureId, revokedAt
             FROM premiumSupporterGroupFeatures
            ORDER BY groupId, featureId`,
        )
        .all(),
    ).toEqual([
      {
        featureId: 'lab-access',
        groupId: 'group-active',
        revokedAt: null,
      },
    ])

    const fund = database
      .prepare('SELECT perks FROM pricingPlans WHERE id = ?')
      .get('sup-fund') as { perks: string }
    expect(JSON.parse(fund.perks)).toEqual([
      'Supporter badge',
      'Operator note',
      LAB_COPY,
    ])
    expect(
      database
        .prepare('SELECT perks FROM pricingPlans WHERE id = ?')
        .get('credits'),
    ).toEqual({ perks: '["Credits"]' })
  })

  it('replays without duplicate copy or restoring an intentionally revoked grant', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    database.exec(sql)
    database.exec(
      `UPDATE premiumSupporterGroupFeatures
          SET revokedAt = '2026-08-06T12:00:00.000Z'
        WHERE groupId = 'group-active' AND featureId = 'lab-access'`,
    )
    database.exec(sql)

    const feature = database
      .prepare(
        `SELECT revokedAt FROM premiumSupporterGroupFeatures
          WHERE groupId = 'group-active' AND featureId = 'lab-access'`,
      )
      .get()
    expect(feature).toEqual({ revokedAt: '2026-08-06T12:00:00.000Z' })

    const fund = database
      .prepare('SELECT perks FROM pricingPlans WHERE id = ?')
      .get('sup-fund') as { perks: string }
    expect(
      (JSON.parse(fund.perks) as string[]).filter((perk) => perk === LAB_COPY),
    ).toHaveLength(1)
    expect(
      database
        .prepare('SELECT updatedAt FROM pricingPlans WHERE id = ?')
        .get('sup-lab'),
    ).toEqual({ updatedAt: 'already-current' })
  })
})
