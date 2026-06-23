// ============================================================
// Community Services Tests — leaderboard, challenges, sharing
// ============================================================
//
// Exercises the user-facing flows behind the Leaderboard,
// Challenges and Community tabs against an in-memory database.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

import type { ChallengeDefinition, UserProfile } from '@/db/entities'
import { loadChallengeDefinitions, loadChallengeProgress, saveChallengeProgress, } from '@/db/services/challenges-service'
import { loadCurrentUserEntry, loadLeaderboard, } from '@/db/services/leaderboard-service'
import { loadSharedMelodies, loadSharedSessions, saveSharedMelody, saveSharedSession, } from '@/db/services/share-service'
import { getUserId } from '@/db/services/user-service'

beforeEach(async () => {
  await adapter.destroy()
})

const nowIso = (): string => new Date().toISOString()

/** Seed a sessionRecords row — the leaderboard is now derived from these. */
function seedSession(
  userId: string,
  score: number,
  accuracy: number,
  endedAt: string = nowIso(),
): Promise<unknown> {
  return adapter.getRepository('sessionRecords').create({
    userId,
    melodyName: 'm',
    startedAt: endedAt,
    endedAt,
    score,
    accuracy,
    notesHit: 0,
    notesTotal: 0,
    streak: 0,
    results: [],
  } as never)
}

// ── Leaderboard ─────────────────────────────────────────────────

describe('leaderboard flows', () => {
  it('derives an entry from a recorded session', async () => {
    await seedSession(getUserId(), 80, 90)

    const entry = await loadCurrentUserEntry()
    expect(entry).not.toBeNull()
    expect(entry?.userId).toBe(getUserId())
    expect(entry?.score).toBe(80)
    expect(entry?.totalSessions).toBe(1)
  })

  it('aggregates multiple sessions (avg score/accuracy, max best)', async () => {
    await seedSession(getUserId(), 80, 90)
    await seedSession(getUserId(), 90, 70)

    const entry = await loadCurrentUserEntry()
    expect(entry?.score).toBe(85) // avg(80, 90)
    expect(entry?.bestScore).toBe(90) // max
    expect(entry?.accuracy).toBe(80) // avg(90, 70)
    expect(entry?.totalSessions).toBe(2)
  })

  it('ranks users by their derived score', async () => {
    await seedSession('low', 10, 50)
    await seedSession('high', 99, 50)

    const users = await loadLeaderboard('overall', 'all-time')
    expect(users.map((u) => u.userId)).toEqual(['high', 'low'])
    expect(users.map((u) => u.rank)).toEqual([1, 2])
  })

  it('ranks by the category-specific metric', async () => {
    await seedSession('a', 99, 50)
    await seedSession('b', 10, 95)

    const users = await loadLeaderboard('accuracy', 'all-time')
    // 'b' wins on accuracy despite the lower score
    expect(users[0].userId).toBe('b')
    expect(users[0].rank).toBe(1)
  })
})

// ── Challenges ──────────────────────────────────────────────────

describe('challenge flows', () => {
  it('loads only active definitions, ordered by sortOrder', async () => {
    const repo = adapter.getRepository<ChallengeDefinition>(
      'challengeDefinitions',
    )
    const def = {
      category: 'scales' as const,
      description: 'd',
      difficulty: 'beginner' as const,
      icon: 'x',
      targetScore: 80,
    }
    await repo.create({ ...def, title: 'Second', isActive: true, sortOrder: 2 })
    await repo.create({
      ...def,
      title: 'Hidden',
      isActive: false,
      sortOrder: 0,
    })
    await repo.create({ ...def, title: 'First', isActive: true, sortOrder: 1 })

    const defs = await loadChallengeDefinitions()
    expect(defs.map((d) => d.title)).toEqual(['First', 'Second'])
  })

  it('upserts challenge progress (create then update)', async () => {
    const progress = {
      userId: getUserId(),
      challengeId: 'ch-1',
      progress: 40,
      currentScore: 40,
      bestScore: 40,
      status: 'active' as const,
      completed: false,
      attempts: 1,
    }
    const created = await saveChallengeProgress(progress)
    expect(created).not.toBeNull()

    const updated = await saveChallengeProgress({
      ...progress,
      progress: 100,
      currentScore: 95,
      bestScore: 95,
      status: 'completed',
      completed: true,
      attempts: 2,
    })
    expect(updated?.id).toBe(created?.id) // same row, not a duplicate

    const all = await loadChallengeProgress()
    expect(all).toHaveLength(1)
    expect(all[0].completed).toBe(true)
    expect(all[0].attempts).toBe(2)
  })

  it('only returns the current user progress', async () => {
    await saveChallengeProgress({
      userId: 'someone-else',
      challengeId: 'ch-1',
      progress: 10,
      currentScore: 10,
      bestScore: 10,
      status: 'active',
      completed: false,
      attempts: 1,
    })
    const mine = await loadChallengeProgress()
    expect(mine).toHaveLength(0)
  })
})

// ── Sharing ─────────────────────────────────────────────────────

describe('share flows', () => {
  const melodyItems = [
    { midi: 60, startBeat: 0, duration: 1, freq: 261.63 },
    { midi: 64, startBeat: 1, duration: 1, freq: 329.63 },
  ]

  it('round-trips a shared melody', async () => {
    const saved = await saveSharedMelody({
      name: 'My Tune',
      items: melodyItems,
      author: 'Tester',
      tags: ['practice'],
    })
    expect(saved).not.toBeNull()

    const loaded = await loadSharedMelodies()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('My Tune')
    expect(loaded[0].items).toHaveLength(2)
    expect(loaded[0].tags).toEqual(['practice'])
  })

  it('round-trips a shared session with computed score', async () => {
    const saved = await saveSharedSession({
      name: 'My Session',
      items: [],
      author: 'Tester',
      results: [80, 90, 100],
    })
    expect(saved).not.toBeNull()

    const loaded = await loadSharedSessions()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].results).toEqual([80, 90, 100])
  })

  it('attributes shares to the persisted user id', async () => {
    await saveSharedMelody({
      name: 'Mine',
      items: melodyItems,
      author: 'Tester',
    })
    const repo = adapter.getRepository('sharedMelodies')
    const rows = await repo.findAll()
    expect((rows[0] as unknown as { userId: string }).userId).toBe(getUserId())
  })
})

// ── Streak (profile-backed) ─────────────────────────────────────

describe('streak flow', () => {
  it('continues the streak when last practice was yesterday', async () => {
    const { updatePracticeStreak } =
      await import('@/db/services/streak-service')
    const repo = adapter.getRepository<UserProfile>('userProfiles')
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    await repo.create({
      displayName: 'Me',
      joinDate: new Date().toISOString(),
      lastPracticeDate: yesterday.toISOString().slice(0, 10),
      currentStreak: 3,
    })

    const streak = await updatePracticeStreak()
    expect(streak).toBe(4)
  })
})

// ── Weekly leaderboard window ───────────────────────────────────

describe('weekly leaderboard', () => {
  it('excludes sessions from before this ISO week; all-time keeps them', async () => {
    const tenDaysAgo = new Date(
      Date.now() - 10 * 24 * 60 * 60 * 1000,
    ).toISOString()
    await seedSession(getUserId(), 70, 70, tenDaysAgo)

    expect(await loadLeaderboard('overall', 'weekly')).toHaveLength(0)
    expect(await loadLeaderboard('overall', 'all-time')).toHaveLength(1)
  })

  it('includes a session recorded this week', async () => {
    await seedSession(getUserId(), 80, 80)

    const weekly = await loadLeaderboard('overall', 'weekly')
    expect(weekly).toHaveLength(1)
    expect(weekly[0].score).toBe(80)
  })
})

// ── Follows ─────────────────────────────────────────────────────

describe('follow flows', () => {
  it('follows and unfollows a player', async () => {
    const { follow, getFollowing, isFollowing, unfollow } =
      await import('@/db/services/follow-service')

    expect(await follow('player-1')).toBe(true)
    expect(await follow('player-1')).toBe(true) // idempotent
    expect(await getFollowing()).toEqual(['player-1'])
    expect(await isFollowing('player-1')).toBe(true)

    expect(await unfollow('player-1')).toBe(true)
    expect(await getFollowing()).toEqual([])
  })

  it('refuses to follow yourself', async () => {
    const { follow } = await import('@/db/services/follow-service')
    expect(await follow(getUserId())).toBe(false)
  })
})
