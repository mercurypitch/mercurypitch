// @vitest-environment node

import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * Migration filenames are the schema's only ordering record.
 *
 * Wrangler tracks applied migrations by FILENAME, not by number, so two files
 * sharing a numeric prefix both apply and neither is skipped. That makes a
 * duplicate survivable — and therefore easy to create by accident, twice now:
 * `0016_demo_song`/`0016_user_suspension` are already on prod, and
 * `0025_sessionRecords_progress`/`0025_song_manifests` ship in v0.9.0.
 *
 * Both existing pairs are independent (each ALTERs or CREATEs something the
 * other never touches), so their apply order cannot matter. That is luck, not
 * design. The next duplicate might be `ALTER TABLE x` beside `CREATE TABLE x`,
 * where order decides whether the deploy works — and nothing today would say
 * so before it ran against a real database.
 *
 * This is that guard. The two known pairs are grandfathered by name because
 * renaming an APPLIED migration is worse than the duplicate: wrangler would
 * see a new filename and run it a second time. Everything after them has to be
 * unique.
 */

const MIGRATIONS_DIR = resolve(
  import.meta.dirname,
  '../../workers/db-worker/migrations',
)

/**
 * Duplicate prefixes that already exist and must stay as they are.
 *
 * Adding to this list is not a fix. It is a statement that the pair has been
 * checked and its two statements cannot depend on each other's order.
 */
const GRANDFATHERED_DUPLICATES = new Set(['0016', '0025'])

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

function numberOf(filename: string): string | null {
  const match = /^(\d{4})_/.exec(filename)
  return match === null ? null : match[1]
}

describe('migration numbering', () => {
  it('names every migration with a four-digit prefix', () => {
    const unnumbered = migrationFiles().filter(
      (name) => numberOf(name) === null,
    )
    expect(unnumbered).toEqual([])
  })

  it('gives every new migration a number no other migration uses', () => {
    const byNumber = new Map<string, string[]>()
    for (const name of migrationFiles()) {
      const number = numberOf(name)
      if (number === null) continue
      byNumber.set(number, [...(byNumber.get(number) ?? []), name])
    }

    const duplicates = [...byNumber.entries()]
      .filter(([, names]) => names.length > 1)
      .filter(([number]) => !GRANDFATHERED_DUPLICATES.has(number))
      .map(([number, names]) => `${number}: ${names.join(', ')}`)

    expect(duplicates).toEqual([])
  })

  // A grandfathered entry for a pair that no longer exists is a stale
  // exemption, and a stale exemption silently re-opens the hole it was
  // written to close.
  it('keeps no exemption for a duplicate that has been resolved', () => {
    const counts = new Map<string, number>()
    for (const name of migrationFiles()) {
      const number = numberOf(name)
      if (number === null) continue
      counts.set(number, (counts.get(number) ?? 0) + 1)
    }

    const stale = [...GRANDFATHERED_DUPLICATES].filter(
      (number) => (counts.get(number) ?? 0) < 2,
    )

    expect(stale).toEqual([])
  })
})
