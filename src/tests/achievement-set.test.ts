// ============================================================
// The seeded achievement set has to be reachable and readable
// ============================================================
//
// Two failures this guards, both of which shipped silently before:
//
//  1. An achievement whose name the grant engine cannot measure is not a
//     hard error — `evalAchievement` returns null and the row sits at 0%
//     forever. Four of the original thirteen were in that state. The set is
//     matched against the engine's measure table by name, both directions.
//
//  2. `userAchievements.progress` stores a PERCENTAGE, and the card used to
//     print it as a count: 3 sessions towards 10 rendered as "30 / 10".
//     `achievementCount` converts back, and is checked at the edges.

import { describe, expect, it } from 'vitest'
import { achievementCount } from '@/components/VocalChallenges'
import seedData from '@/db/seed-data.json'
import { measurableAchievements } from '@/db/services/badge-grant-engine'
import { countActivity } from '@/db/services/user-activity-service'

const CATEGORIES = ['beginnings', 'building', 'mastery'] as const

describe('every seeded achievement is measurable', () => {
  it('has a measure in the grant engine', () => {
    const known = new Set(measurableAchievements())
    const ungrantable = seedData.achievementDefinitions
      .map((a) => a.name)
      .filter((n) => !known.has(n))
    expect(ungrantable).toEqual([])
  })

  it('leaves no measure without an achievement behind it', () => {
    // The other direction: a measure nothing reads is dead code, and usually
    // means a rename landed on one side only.
    const seeded = new Set(seedData.achievementDefinitions.map((a) => a.name))
    const orphans = measurableAchievements().filter((n) => !seeded.has(n))
    expect(orphans).toEqual([])
  })
})

describe('the achievement bands', () => {
  const byCategory = (c: string): number =>
    seedData.achievementDefinitions.filter((a) => a.category === c).length

  it('puts every achievement in a known band', () => {
    const strays = seedData.achievementDefinitions
      .filter((a) => !CATEGORIES.includes(a.category as never))
      .map((a) => `${a.name}: ${a.category}`)
    expect(strays).toEqual([])
  })

  it('gives each band enough to show', () => {
    // The point of the expansion was a steady drip — a band with three
    // entries is a band the user clears in a week and never sees again.
    for (const c of CATEGORIES) {
      expect(byCategory(c)).toBeGreaterThanOrEqual(10)
    }
  })

  it('opens with targets a first session can move', () => {
    // "Beginnings" has to be reachable in the first week or the band is
    // decoration. Half of them should land on the very first attempt.
    const firstTry = seedData.achievementDefinitions.filter(
      (a) => a.category === 'beginnings' && a.required === 1,
    )
    expect(firstTry.length).toBeGreaterThanOrEqual(8)
  })
})

describe('achievementCount', () => {
  it('converts stored percentage back to a count', () => {
    expect(achievementCount(30, 10)).toBe(3)
    expect(achievementCount(0, 10)).toBe(0)
    expect(achievementCount(100, 10)).toBe(10)
  })

  it('never exceeds the target or goes negative', () => {
    // A stale row can hold >100 after a target is lowered.
    expect(achievementCount(140, 10)).toBe(10)
    expect(achievementCount(-5, 10)).toBe(0)
  })

  it('is safe on a broken target', () => {
    expect(achievementCount(50, 0)).toBe(0)
    expect(achievementCount(50, Number.NaN)).toBe(0)
  })
})

describe('activity counting', () => {
  it('counts a melody once however often it is refilled', () => {
    // The 0 -> non-zero note transition is the only "this became a real
    // melody" signal the store has, so clearing and rewriting one fires it
    // again. "Write 20 melodies of your own" must not accept that.
    expect(
      countActivity([
        { kind: 'melody_created', refId: 'm1' },
        { kind: 'melody_created', refId: 'm1' },
        { kind: 'melody_created', refId: 'm2' },
      ]).melody_created,
    ).toBe(2)
  })

  it('still counts every performance and every split', () => {
    // Repeating these IS the achievement — another sing is another
    // performance, another split is another paid job.
    const counts = countActivity([
      { kind: 'song_completed', refId: 's1' },
      { kind: 'song_completed', refId: 's1' },
      { kind: 'stems_separated', refId: 'u1' },
      { kind: 'stems_separated', refId: 'u1' },
    ])
    expect(counts.song_completed).toBe(2)
    expect(counts.stems_separated).toBe(2)
  })

  it('counts rows that carry no refId individually', () => {
    expect(
      countActivity([
        { kind: 'melody_created', refId: undefined },
        { kind: 'melody_created', refId: undefined },
      ]).melody_created,
    ).toBe(2)
  })
})
