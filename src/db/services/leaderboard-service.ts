// ============================================================
// Leaderboard Service — DB-backed leaderboard operations
// ============================================================

import { getDb } from '@/db'
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardPeriod, UserProfile, } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { getCurrentStreak } from '@/db/services/streak-service'
import { getAuthHeaders } from '@/db/services/user-service'
import { API_BASE_URL } from '@/lib/defaults'

/** ISO-week start (Monday 00:00 UTC) — mirrors the worker's weekly cut. */
function weekStartIso(): string {
  const now = new Date()
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  monday.setUTCDate(monday.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  return monday.toISOString()
}

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

/**
 * Record a result on the leaderboard: upserts BOTH the all-time and the
 * weekly row. A weekly row last touched before the current ISO week is
 * stale — its counters restart instead of averaging in old data (the
 * server filters stale weekly rows out of reads anyway).
 */
export async function updateLeaderboardEntry(
  input: LeaderboardUpdateInput,
  category: LeaderboardCategory = 'overall',
): Promise<void> {
  try {
    const db = await getDb()
    const repo = db.getRepository<LeaderboardEntry>('leaderboardEntries')
    const userId = getUserId()
    const streak = await getCurrentStreak()

    // Prefer the profile display name (cloud row id == userId);
    // fall back to a generated handle.
    const profile = await db
      .getRepository<UserProfile>('userProfiles')
      .findById(userId)
    const profileName = profile?.displayName.trim() ?? ''
    const displayName =
      profileName !== '' ? profileName : `Singer-${userId.slice(0, 6)}`

    const weekStart = weekStartIso()
    for (const period of ['all-time', 'weekly'] as LeaderboardPeriod[]) {
      const existing = await repo.findAll({
        where: { userId, category, period },
      })
      const entry = existing[0]
      const stale =
        period === 'weekly' && entry != null && entry.updatedAt < weekStart

      if (entry != null && !stale) {
        entry.score = Math.round((entry.score + input.score) / 2)
        entry.bestScore = Math.max(entry.bestScore, input.bestScore)
        entry.accuracy = Math.round((entry.accuracy + input.accuracy) / 2)
        entry.totalSessions += 1
        entry.streak = streak
        await repo.update(entry.id, entry)
      } else if (entry != null && stale) {
        await repo.update(entry.id, {
          displayName,
          score: input.score,
          bestScore: input.bestScore,
          accuracy: input.accuracy,
          totalSessions: 1,
          streak,
        })
      } else {
        // Stored rank is only a seed value — reads recompute ranks
        // from current scores.
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
    let entries = await repo.findAll({
      where: { category, period },
      orderBy: 'rank',
    })
    if (period === 'weekly') {
      // Weekly rows from previous weeks are stale (the server filters
      // them too) — only this ISO week counts.
      const weekStart = weekStartIso()
      entries = entries.filter((e) => e.updatedAt >= weekStart)
    }

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

export interface LeaderboardPage {
  users: LeaderboardUserView[]
  total: number
}

/**
 * Paged leaderboard. Cloud mode hits the worker's server-side ranking
 * endpoint (`GET /api/leaderboard` — supports the Friends view via the
 * follows table and weekly staleness filtering); local mode computes
 * the same view from Dexie.
 */
export async function loadLeaderboardPage(opts: {
  category?: LeaderboardCategory
  period?: LeaderboardPeriod
  view?: 'global' | 'friends'
  limit?: number
  offset?: number
}): Promise<LeaderboardPage> {
  const {
    category = 'overall',
    period = 'all-time',
    view = 'global',
    limit = 25,
    offset = 0,
  } = opts

  if (API_BASE_URL != null && API_BASE_URL !== '') {
    try {
      const params = new URLSearchParams({
        category,
        period,
        view,
        limit: String(limit),
        offset: String(offset),
      })
      const res = await fetch(`${API_BASE_URL}/api/leaderboard?${params}`, {
        headers: getAuthHeaders(),
      })
      if (!res.ok) throw new Error(`leaderboard failed: ${res.status}`)
      const data = (await res.json()) as {
        total: number
        entries: Array<LeaderboardEntry & { rank: number }>
      }
      return {
        total: data.total,
        users: data.entries.map((e) => ({
          userId: e.userId,
          displayName: e.displayName,
          score: e.score,
          rank: e.rank,
          streak: e.streak,
          totalSessions: e.totalSessions,
          bestScore: e.bestScore,
          accuracy: e.accuracy,
        })),
      }
    } catch {
      return { users: [], total: 0 }
    }
  }

  // Local mode: friends view has no local social graph — empty.
  if (view === 'friends') return { users: [], total: 0 }
  const users = await loadLeaderboard(category, period)
  return { users: users.slice(offset, offset + limit), total: users.length }
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
