// ============================================================
// Preview definition seed
// ============================================================
//
// PR previews bind to their own database, and it was seeded with nothing
// but the weekly-challenge fixture. The Challenges tab therefore came up
// empty on every preview — no cards, every counter at 0, no badges — a
// state indistinguishable from a broken feature, which is exactly how it
// hid a real badge-rendering fix from review.
//
// The generator is the thing standing between seed-data.json and a
// remote database, and it builds SQL by string concatenation. That makes
// quoting a correctness problem, not a style one: one apostrophe in a
// challenge title terminates the string early and the statement either
// fails or writes something else.

import { describe, expect, it } from 'vitest'
import seedData from '@/db/seed-data.json'
// @ts-expect-error — plain .mjs build script, no declaration file.
import { buildSql, buildStatements, seedId, sqlValue, } from '../../scripts/gen-preview-definitions-sql.mjs'

describe('sqlValue', () => {
  it('escapes apostrophes by doubling them', () => {
    // "Singer's Warm-up" would otherwise close the string mid-title.
    expect(sqlValue("Singer's Warm-up")).toBe("'Singer''s Warm-up'")
    expect(sqlValue("''")).toBe("''''''")
  })

  it('writes booleans as SQLite integers', () => {
    expect(sqlValue(true)).toBe('1')
    expect(sqlValue(false)).toBe('0')
  })

  it('writes absent values as NULL, not as the string "null"', () => {
    expect(sqlValue(null)).toBe('NULL')
    expect(sqlValue(undefined)).toBe('NULL')
  })

  it('leaves numbers unquoted', () => {
    expect(sqlValue(40)).toBe('40')
    expect(sqlValue(-1.5)).toBe('-1.5')
  })
})

describe('seedId', () => {
  it('is a stable slug of the natural key', () => {
    expect(seedId('challenge', 'Hold Your Note')).toBe(
      'seed-challenge-hold-your-note',
    )
    expect(seedId('badge', 'High & Mighty')).toBe('seed-badge-high-mighty')
  })

  it('gives the same id every run, so re-seeding updates instead of duplicating', () => {
    expect(seedId('badge', 'First Victory')).toBe(
      seedId('badge', 'First Victory'),
    )
  })

  it('does not collapse different names onto one id', () => {
    const names = seedData.badgeDefinitions.map((b) => seedId('badge', b.name))
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('the generated seed', () => {
  it('covers every definition in seed-data.json', () => {
    const statements = buildStatements()
    expect(statements).toHaveLength(
      seedData.challengeDefinitions.length +
        seedData.badgeDefinitions.length +
        seedData.achievementDefinitions.length,
    )
  })

  it('targets the three definition tables and nothing else', () => {
    const tables = new Set(
      buildStatements().map((s: string) => /INSERT INTO (\w+)/.exec(s)![1]),
    )
    expect([...tables].sort()).toEqual([
      'achievements',
      'badgeDefinitions',
      'challengeDefinitions',
    ])
  })

  it('upserts rather than inserting, since previews share one database', () => {
    // Concurrent PR builds hit the same preview DB. A bare INSERT would
    // fail the whole file on the second run and leave it half-seeded.
    for (const s of buildStatements()) {
      expect(s).toContain('ON CONFLICT(id) DO UPDATE SET')
    }
  })

  it('never overwrites createdAt on a row that already exists', () => {
    for (const s of buildStatements()) {
      expect(s).not.toContain('createdAt = excluded.createdAt')
    }
  })

  it('names one column list per table, so a dropped field gets cleared', () => {
    const byTable = new Map<string, Set<string>>()
    for (const s of buildStatements()) {
      const [, table, cols] = /INSERT INTO (\w+) \(([^)]+)\)/.exec(s)!
      byTable.set(table, (byTable.get(table) ?? new Set()).add(cols))
    }
    for (const [, shapes] of byTable) expect(shapes.size).toBe(1)
  })

  it('is byte-identical across runs', () => {
    // A moving timestamp would rewrite all 47 rows on every build.
    expect(buildSql()).toBe(buildSql())
  })

  it('quotes real seed content that contains an apostrophe', () => {
    const sql = buildSql({
      challengeDefinitions: [
        {
          category: 'basics',
          title: "Singer's Note",
          description: "Don't drift",
          difficulty: 'beginner',
          icon: 'leaf',
          targetScore: 40,
          isActive: true,
          sortOrder: 1,
        },
      ],
      badgeDefinitions: [],
      achievementDefinitions: [],
    })
    expect(sql).toContain("'Singer''s Note'")
    expect(sql).toContain("'Don''t drift'")
    // Balanced quotes: an odd count means a string ran off its statement.
    expect((sql.match(/'/g) ?? []).length % 2).toBe(0)
  })
})
