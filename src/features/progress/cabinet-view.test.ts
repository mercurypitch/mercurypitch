// ============================================================
// The cabinet view — the whole catalogue, with where the singer stands
// ============================================================

import { describe, expect, it } from 'vitest'
import type { Achievement, BadgeDefinition, UserAchievement, UserBadge, } from '@/db/entities'
import { achievementCount, achievementPercent, buildCabinet, } from './cabinet-view'
import type { ProgressModelInput } from './model'
import { buildProgressModel } from './model'

const NOW = new Date('2026-08-11T12:00:00.000Z')
const AT = '2026-08-09T00:00:00.000Z'
/** The page's formatter is injected; the test only needs one that is visibly applied. */
const label = (value: string | null): string | null =>
  value === null ? null : `on ${value.slice(0, 10)}`

function input(
  overrides: Partial<ProgressModelInput> = {},
): ProgressModelInput {
  return {
    records: [],
    currentStreak: 0,
    voiceprints: [],
    badgeDefinitions: [],
    userBadges: [],
    achievementDefinitions: [],
    userAchievements: [],
    challengeDefinitions: [],
    activityRows: [],
    recentActivity: [],
    league: null,
    ...overrides,
  }
}

function badge(
  id: string,
  sortOrder: number,
  overrides: Partial<BadgeDefinition> = {},
): BadgeDefinition {
  return {
    id,
    createdAt: AT,
    updatedAt: AT,
    name: `Badge ${sortOrder}`,
    description: `About badge ${sortOrder}.`,
    icon: 'firstvoice',
    tier: 'gold',
    category: 'legend',
    unlockCondition: `Do the thing ${sortOrder}.`,
    sortOrder,
    ...overrides,
  }
}

function achievement(
  id: string,
  sortOrder: number,
  overrides: Partial<Achievement> = {},
): Achievement {
  return {
    id,
    createdAt: AT,
    updatedAt: AT,
    name: `Goal ${sortOrder}`,
    description: `About goal ${sortOrder}.`,
    icon: 'star',
    points: 25,
    condition: 'sessions',
    required: 10,
    sortOrder,
    category: 'beginnings',
    ...overrides,
  }
}

function userAchievement(
  achievementId: string,
  progress: number,
  unlocked = false,
): UserAchievement {
  return {
    id: `ua-${achievementId}`,
    createdAt: AT,
    updatedAt: AT,
    userId: 'user-1',
    achievementId,
    progress,
    unlocked,
    unlockedAt: unlocked ? AT : null,
  }
}

const earnedBadge: UserBadge = {
  id: 'ub-1',
  createdAt: AT,
  updatedAt: AT,
  userId: 'user-1',
  badgeId: 'b1',
  earnedAt: AT,
}

describe('the badge wall', () => {
  it('hangs every badge in catalogue order, earned or not, with its medallion', () => {
    const model = buildProgressModel(
      input({
        badgeDefinitions: [
          badge('b2', 2, { icon: 'nothing-drawn' }),
          badge('b1', 1),
        ],
        userBadges: [earnedBadge],
      }),
      { now: NOW },
    )
    const { badges, badgesLabel } = buildCabinet(model, label)

    expect(badges.map((b) => b.id)).toEqual(['b1', 'b2'])
    expect(badges[0]).toMatchObject({
      earned: true,
      artUrl: '/badges/firstvoice.webp',
      howToEarn: 'Do the thing 1.',
    })
    expect(badges[0]!.earnedAtLabel).toBe('Earned on 2026-08-09')
    // A locked badge is still on the wall, just without a date, and a badge
    // with no drawn medallion keeps its icon name for the glyph fallback.
    expect(badges[1]).toMatchObject({ earned: false, icon: 'nothing-drawn' })
    expect(badges[1]!.earnedAtLabel).toBeUndefined()
    expect(badges[1]!.artUrl).toBeUndefined()
    expect(badgesLabel).toBe('1 / 2')
  })

  it('falls back to the description when the seed has no unlock condition', () => {
    const model = buildProgressModel(
      input({ badgeDefinitions: [badge('b1', 1, { unlockCondition: '' })] }),
      { now: NOW },
    )
    expect(buildCabinet(model, label).badges[0]!.howToEarn).toBe(
      'About badge 1.',
    )
  })
})

describe('the achievement shelves', () => {
  it('groups by band, drops an empty band, and reads the count behind the percentage', () => {
    const model = buildProgressModel(
      input({
        achievementDefinitions: [
          achievement('a1', 1),
          achievement('a2', 2),
          achievement('a3', 3, { category: 'mastery', required: 50 }),
        ],
        // 30% of ten is three; the unlocked one is whole; the third is untouched.
        userAchievements: [
          userAchievement('a1', 30),
          userAchievement('a2', 100, true),
        ],
      }),
      { now: NOW },
    )
    const { shelves, achievementsLabel, summary } = buildCabinet(model, label)

    expect(shelves.map((s) => s.id)).toEqual(['beginnings', 'mastery'])
    expect(shelves[0]!.unlockedCount).toBe(1)
    expect(shelves[0]!.items.map((i) => [i.countLabel, i.percent])).toEqual([
      ['3 / 10', 30],
      ['10 / 10', 100],
    ])
    expect(shelves[0]!.items[1]).toMatchObject({
      unlocked: true,
      pointsLabel: '+25 pts',
    })
    expect(shelves[1]!.items[0]).toMatchObject({
      countLabel: '0 / 50',
      percent: 0,
      unlocked: false,
    })
    expect(achievementsLabel).toBe('1 / 3')
    expect(summary).toBe(
      '0 of 0 badges and 1 of 3 achievements earned, 1 under way.',
    )
  })

  it('passes an unavailable account through rather than showing zeros', () => {
    const model = buildProgressModel(
      input({ availability: { account: false } }),
      { now: NOW },
    )
    expect(buildCabinet(model, label).available).toBe(false)
  })
})

describe('the percentage arithmetic', () => {
  it('turns the stored percentage back into a count, capped at the target', () => {
    expect(achievementCount(30, 10)).toBe(3)
    expect(achievementCount(140, 10)).toBe(10)
    expect(achievementCount(-5, 10)).toBe(0)
    expect(achievementCount(50, 0)).toBe(0)
  })

  it('clamps the bar to 0-100 and rounds it', () => {
    expect(achievementPercent(30.4)).toBe(30)
    expect(achievementPercent(140)).toBe(100)
    expect(achievementPercent(-1)).toBe(0)
    expect(achievementPercent(Number.NaN)).toBe(0)
  })
})
