// ============================================================
// All Star waits on the practice bronzes, never on a podium
// ============================================================
// "All Star" is the meta badge: every bronze badge earned. The Legend podium
// added "Third Voice" as a bronze badge that only the worker grants, to the
// singer who finishes exactly third when a challenge closes. Left in the
// roll-up it made All Star unreachable for anyone who never placed third —
// including every winner.

import { describe, expect, it } from 'vitest'
import type { BadgeDefinition } from '@/db/entities'
import seedData from '@/db/seed-data.json'
import { allStarEarned, allStarRequirements, } from '@/db/services/badge-grant-engine'

const AT = '2026-09-05T00:00:00.000Z'

/** The seed as the engine sees it: ids are minted on insert, so mint them here. */
const SEEDED: BadgeDefinition[] = seedData.badgeDefinitions.map((row, i) => ({
  id: `badge-${i}`,
  createdAt: AT,
  updatedAt: AT,
  ...(row as Omit<BadgeDefinition, 'id' | 'createdAt' | 'updatedAt'>),
}))

const byName = (name: string): BadgeDefinition => {
  const found = SEEDED.find((b) => b.name === name)
  if (found === undefined) throw new Error(`no seeded badge named ${name}`)
  return found
}

describe('All Star', () => {
  it('requires every practice bronze in the seed and no podium badge', () => {
    const names = allStarRequirements(SEEDED).map((b) => b.name)
    expect(names).toEqual([
      'First Victory',
      'First Steps',
      'On Fire',
      'Scale Scholar',
      'Bass Foundation',
    ])
    expect(names).not.toContain('Third Voice')
    // The seed still has the podium bronze; the rule, not the data, leaves it out.
    expect(byName('Third Voice')).toMatchObject({
      tier: 'bronze',
      category: 'legend',
    })
  })

  it('is earned with the five practice bronzes and nothing from a podium', () => {
    const earned = new Set(allStarRequirements(SEEDED).map((b) => b.id))
    expect(allStarEarned(SEEDED, earned)).toBe(true)
  })

  it('is not earned while a practice bronze is still missing', () => {
    const earned = new Set(allStarRequirements(SEEDED).map((b) => b.id))
    earned.delete(byName('On Fire').id)
    expect(allStarEarned(SEEDED, earned)).toBe(false)
    // A podium badge does not stand in for the missing one either.
    earned.add(byName('Third Voice').id)
    expect(allStarEarned(SEEDED, earned)).toBe(false)
  })

  it('is never earned against an empty catalogue', () => {
    expect(allStarEarned([], new Set())).toBe(false)
  })
})
