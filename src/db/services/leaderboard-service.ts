// ============================================================
// Leaderboard Service — DB-backed leaderboard operations
// ============================================================

import { getDb } from '@/db'
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardPeriod, UserProfile, } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { getCurrentStreak } from '@/db/services/streak-service'

export interface LeaderboardUserView {
  userId: string
  displayName: string
  score: number
  rank: number
  streak: number
  totalSessions: number
  bestScore: number
  accuracy: number
}

export interface LeaderboardUpdateInput {
  score: number
  bestScore: number
  accuracy: number
}

export async function updateLeaderboardEntry(
  input: LeaderboardUpdateInput,
  category: LeaderboardCategory = 'overall',
  period: LeaderboardPeriod = 'all-time',
): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<LeaderboardEntry>('leaderboardEntries')
    const userId = getUserId()
    const streak = await getCurrentStreak()

    const existing = await repo.findAll({
      where: { userId, category, period },
    })

    if (existing.length > 0) {
      const entry = existing[0]
      entry.score = Math.round((entry.score + input.score) / 2)
      entry.bestScore = Math.max(entry.bestScore, input.bestScore)
      entry.accuracy = Math.round((entry.accuracy + input.accuracy) / 2)
      entry.totalSessions += 1
      entry.streak = streak
      await repo.update(entry.id!, entry)
    } else {
      // Prefer the profile display name (cloud row id == userId);
      // fall back to a generated handle.
      const profile = await db
        .getRepository<UserProfile>('userProfiles')
        .findById(userId)
      const profileName = profile?.displayName.trim() ?? ''
      const displayName =
        profileName !== '' ? profileName : `Singer-${userId.slice(0, 6)}`
      // Stored rank is only a seed value — loadLeaderboard() recomputes
      // ranks from current scores on every read.
      const rank = (await repo.count({ where: { category, period } })) + 1
      await repo.create({
        userId,
        displayName,
        category,
        period,
        rank,
        score: input.score,
        streak,
        totalSessions: 1,
        bestScore: input.bestScore,
        accuracy: input.accuracy,
      })
    }
  } catch {
    // Silently fail — leaderboard is non-critical
  }
}

export async function loadLeaderboard(
  category: LeaderboardCategory = 'overall',
  period: LeaderboardPeriod = 'all-time',
): Promise<LeaderboardUserView[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<LeaderboardEntry>('leaderboardEntries')
    const entries = await repo.findAll({
      where: { category, period },
      orderBy: 'rank',
    })

    // Group by userId (one entry per user per category)
    const seen = new Set<string>()
    const users: LeaderboardUserView[] = []
    for (const e of entries) {
      if (seen.has(e.userId)) continue
      seen.add(e.userId)
      users.push({
        userId: e.userId,
        displayName: e.displayName,
        score: e.score,
        rank: e.rank,
        streak: e.streak,
        totalSessions: e.totalSessions,
        bestScore: e.bestScore,
        accuracy: e.accuracy,
      })
    }
    // Stored ranks go stale as scores change — recompute from the
    // category's sort key so positions always reflect current data.
    const sortKey = (u: LeaderboardUserView): number => {
      switch (category) {
        case 'best-score':
          return u.bestScore
        case 'accuracy':
          return u.accuracy
        case 'streak':
          return u.streak
        case 'sessions':
          return u.totalSessions
        default:
          return u.score
      }
    }
    users.sort((a, b) => sortKey(b) - sortKey(a))
    users.forEach((u, i) => (u.rank = i + 1))
    return users
  } catch {
    return []
  }
}

export async function loadCurrentUserEntry(
  category: LeaderboardCategory = 'overall',
  period: LeaderboardPeriod = 'all-time',
): Promise<LeaderboardUserView | null> {
  // Derive from the recomputed board rather than the stored row — the
  // persisted rank goes stale as other users' scores change, and this
  // keeps "your rank" consistent with the rendered leaderboard.
  const users = await loadLeaderboard(category, period)
  const userId = getUserId()
  return users.find((u) => u.userId === userId) ?? null
}
