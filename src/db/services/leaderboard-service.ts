// ============================================================
// Leaderboard Service — DB-backed leaderboard operations
// ============================================================

import { getDb } from '@/db'
import type { LeaderboardEntry, LeaderboardCategory, LeaderboardPeriod } from '@/db/entities'
import { getUserId } from '@/db/seed'

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

export async function loadLeaderboard(
  category: LeaderboardCategory = 'overall',
  period: LeaderboardPeriod = 'all-time',
): Promise<LeaderboardUserView[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<LeaderboardEntry>('leaderboardEntries')
    const entries = await repo.findAll({
      where: { category, period } as Record<string, unknown>,
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
    return users.sort((a, b) => a.rank - b.rank)
  } catch {
    return []
  }
}

export async function loadCurrentUserEntry(
  category: LeaderboardCategory = 'overall',
  period: LeaderboardPeriod = 'all-time',
): Promise<LeaderboardUserView | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<LeaderboardEntry>('leaderboardEntries')
    const entries = await repo.findAll({
      where: { userId: getUserId(), category, period } as Record<string, unknown>,
    })
    if (entries.length === 0) return null
    const e = entries[0]
    return {
      userId: e.userId,
      displayName: e.displayName,
      score: e.score,
      rank: e.rank,
      streak: e.streak,
      totalSessions: e.totalSessions,
      bestScore: e.bestScore,
      accuracy: e.accuracy,
    }
  } catch {
    return null
  }
}
