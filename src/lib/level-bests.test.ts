// ============================================================
// Level bests: one best per level, two tables as one, and the old key
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { EXERCISE_LEVELS } from '@/stores/exercise-level'
import type { BestRules, LevelBestTable } from './level-bests'
import { adoptDeviceBests, BEST_LEVELS, isLevelBestTable, levelBestsOnPull, mergeLevelBestTables, } from './level-bests'

/** A room whose best is points scored, the more the better. */
interface Points {
  readonly points: number
  readonly at: number
}

const RULES: BestRules<Points> = {
  isBest: (value): value is Points =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Points).points === 'number' &&
    typeof (value as Points).at === 'number',
  beats: (run, previous) => previous === null || run.points > previous.points,
}

const p = (points: number, at: number): Points => ({ points, at })

describe('level bests', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it("holds the levels the singer's level store has, in its order", () => {
    expect([...BEST_LEVELS]).toEqual([...EXERCISE_LEVELS])
  })

  it('reads a table keyed by level, and nothing else', () => {
    expect(isLevelBestTable({}, RULES)).toBe(true)
    expect(isLevelBestTable({ singer: p(3, 1) }, RULES)).toBe(true)
    expect(isLevelBestTable({ choir: p(3, 1) }, RULES)).toBe(false)
    expect(isLevelBestTable({ singer: { points: 'three' } }, RULES)).toBe(false)
    expect(isLevelBestTable([], RULES)).toBe(false)
    expect(isLevelBestTable(null, RULES)).toBe(false)
  })

  it('keeps every level from either table, each with the better best', () => {
    const merged = mergeLevelBestTables(
      { singer: p(5, 1), learning: p(2, 2) },
      { singer: p(7, 3), professional: p(1, 4) },
      RULES,
    )
    expect(merged).toEqual({
      learning: p(2, 2),
      singer: p(7, 3),
      professional: p(1, 4),
    })
  })

  it('keeps the earlier of two equal bests, whichever side it is on', () => {
    const a: LevelBestTable<Points> = { singer: p(5, 9) }
    const b: LevelBestTable<Points> = { singer: p(5, 2) }
    expect(mergeLevelBestTables(a, b, RULES)).toEqual({ singer: p(5, 2) })
    expect(mergeLevelBestTables(b, a, RULES)).toEqual({ singer: p(5, 2) })
  })

  it("resolves a pull: the merged table, or a side's own string where it stands", () => {
    const pull = levelBestsOnPull(RULES)
    const local = JSON.stringify({ singer: p(5, 1) })
    const better = JSON.stringify({ singer: p(8, 2) })
    const other = JSON.stringify({ learning: p(3, 3) })
    // The account's better best stands as its own string.
    expect(pull(local, better)).toBe(better)
    // The device's better best stands as its own string.
    expect(pull(better, local)).toBe(better)
    // Each side brings a level: both, merged.
    expect(JSON.parse(pull(local, other))).toEqual({
      singer: p(5, 1),
      learning: p(3, 3),
    })
    // A side that does not read gives way to the other.
    expect(pull(null, other)).toBe(other)
    expect(pull('not json', other)).toBe(other)
    expect(pull(local, 'not json')).toBe(local)
  })

  it("adopts a device's old table into the synced one once, and lets the old key go", () => {
    localStorage.setItem(
      'old_bests',
      JSON.stringify({ singer: p(9, 1), learning: p(2, 1) }),
    )
    let table: LevelBestTable<Points> = { singer: p(4, 2) }
    let writes = 0
    const keep = (
      update: (t: LevelBestTable<Points>) => LevelBestTable<Points>,
    ) => {
      writes += 1
      table = update(table)
    }
    adoptDeviceBests('old_bests', RULES, keep)
    expect(table).toEqual({ singer: p(9, 1), learning: p(2, 1) })
    expect(localStorage.getItem('old_bests')).toBeNull()
    // Once: nothing is left to adopt.
    adoptDeviceBests('old_bests', RULES, keep)
    expect(writes).toBe(1)
  })

  it('lets an old key go without a write when it holds nothing that reads', () => {
    let writes = 0
    const keep = (): void => {
      writes += 1
    }
    localStorage.setItem('old_bests', '{}')
    adoptDeviceBests('old_bests', RULES, keep)
    localStorage.setItem('old_bests', 'not json')
    adoptDeviceBests('old_bests', RULES, keep)
    expect(writes).toBe(0)
    expect(localStorage.getItem('old_bests')).toBeNull()
  })
})
