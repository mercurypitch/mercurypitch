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
import { loadCurrentUserEntry, loadLeaderboard, updateLeaderboardEntry, } from '@/db/services/leaderboard-service'
import { loadSharedMelodies, loadSharedSessions, saveSharedMelody, saveSharedSession, } from '@/db/services/share-service'
import { getUserId } from '@/db/services/user-service'

beforeEach(async () => {
  await adapter.destroy()
})

// ── Leaderboard ─────────────────────────────────────────────────

describe('leaderboard flows', () => {
  it('creates an entry on first practice result', async () => {
    await updateLeaderboardEntry({ score: 80, bestScore: 80, accuracy: 90 })

    const entry = await loadCurrentUserEntry()
    expect(entry).not.toBeNull()
    expect(entry?.userId).toBe(getUserId())
    expect(entry?.score).toBe(80)
    expect(entry?.totalSessions).toBe(1)
  })

  it('merges subsequent results into the existing entry', async () => {
    await updateLeaderboardEntry({ score: 80, bestScore: 80, accuracy: 90 })
    await updateLeaderboardEntry({ score: 90, bestScore: 90, accuracy: 70 })

    const entry = await loadCurrentUserEntry()
    expect(entry?.score).toBe(85) // running average
    expect(entry?.bestScore).toBe(90) // max
    expect(entry?.accuracy).toBe(80) // running average
    expect(entry?.totalSessions).toBe(2)
  })

  it('recomputes ranks from current scores on load', async () => {
    const repo = adapter.getRepository('leaderboardEntries')
    const base = {
      category: 'overall',
      period: 'all-time',
      streak: 0,
      totalSessions: 1,
      accuracy: 50,
    }
    // Stored ranks are intentionally stale/wrong
    await repo.create({
      ...base,
      userId: 'low',
      displayName: 'Low',
      rank: 1,
      score: 10,
      bestScore: 10,
    } as never)
    await repo.create({
      ...base,
      userId: 'high',
      displayName: 'High',
      rank: 2,
      score: 99,
      bestScore: 99,
    } as never)

    const users = await loadLeaderboard('overall', 'all-time')
    expect(users.map((u) => u.userId)).toEqual(['high', 'low'])
    expect(users.map((u) => u.rank)).toEqual([1, 2])
  })

  it('ranks by the category-specific metric', async () => {
    const repo = adapter.getRepository('leaderboardEntries')
    const base = { category: 'accuracy', period: 'all-time', streak: 0 }
    await repo.create({
      ...base,
      userId: 'a',
      displayName: 'A',
      rank: 1,
      score: 99,
      bestScore: 99,
      accuracy: 50,
      totalSessions: 1,
    } as never)
    await repo.create({
      ...base,
      userId: 'b',
      displayName: 'B',
      rank: 2,
      score: 10,
      bestScore: 10,
      accuracy: 95,
      totalSessions: 1,
    } as never)

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
