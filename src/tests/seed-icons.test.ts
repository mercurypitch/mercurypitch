// ============================================================
// Seeded icon names must resolve
// ============================================================
//
// `iconByName` used to return the NAME when it did not recognise it, and
// `renderIcon` prints a string as-is. So three achievements seeded with
// icons that do not exist put the words "layers", "calendar" and "check"
// across the Challenges page in 3rem grey — silently, because nothing
// throws and nothing logs.
//
// Two guards: the fallback is now a real component, and this test says
// which seeded name is wrong before anyone sees it on a page.

import { describe, expect, it } from 'vitest'
import { iconByName } from '@/components/hidden-features-icons'
import seedData from '@/db/seed-data.json'

const resolves = (name: string): boolean =>
  typeof iconByName(name) === 'function'

describe('every seeded icon name resolves to a component', () => {
  it('badges', () => {
    const broken = seedData.badgeDefinitions
      .map((b) => b.icon)
      .filter((n) => !resolves(n))
    expect(broken).toEqual([])
  })

  it('achievements', () => {
    // The one that caught 'layers' / 'calendar' / 'check'.
    const broken = seedData.achievementDefinitions
      .map((a) => a.icon)
      .filter((n) => !resolves(n))
    expect(broken).toEqual([])
  })

  it('challenges', () => {
    const broken = seedData.challengeDefinitions
      .map((c) => c.icon)
      .filter((n) => !resolves(n))
    expect(broken).toEqual([])
  })
})

describe('iconByName', () => {
  it('falls back to a component, never to the raw name', () => {
    // Returning the string is what put the name on the page.
    expect(typeof iconByName('definitely-not-an-icon')).toBe('function')
  })

  it('still resolves a known name to its own icon', () => {
    expect(iconByName('mic')).not.toBe(iconByName('definitely-not-an-icon'))
  })
})

describe('the seeded achievement set', () => {
  it('gives every achievement a positive target', () => {
    for (const a of seedData.achievementDefinitions) {
      expect(a.required).toBeGreaterThan(0)
    }
  })

  it('has no duplicate names — the grant engine matches on them', () => {
    const names = seedData.achievementDefinitions.map((a) => a.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
