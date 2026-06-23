// ============================================================
// Leaderboard Service — DB-backed leaderboard operations
// ============================================================

import { getDb } from '@/db'
import type { LeaderboardCategory, LeaderboardEntry, LeaderboardPeriod, SessionRecord, UserProfile, } from '@/db/entities'
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

/**
 * Local-mode leaderboard, DERIVED from sessionRecords (mirrors the worker's
 * server-side derivation). The leaderboardEntries table is no longer written
 * by the client — scores are aggregated from recorded sessions so they can't
 * be self-reported. Cloud mode uses the worker endpoint (loadLeaderboardPage).
 */
export async function loadLeaderboard(
  category: LeaderboardCategory = 'overall',
  period: LeaderboardPeriod = 'all-time',
): Promise<LeaderboardUserView[]> {
  try {
    const db = await getDb()
    const sessions = await db
      .getRepository<SessionRecord>('sessionRecords')
      .findAll({})
    const weekStart = weekStartIso()
    const rows =
      period === 'weekly'
        ? sessions.filter((s) => s.endedAt >= weekStart)
        : sessions

    // Aggregate per user (avg score/accuracy, max best, session count).
    const byUser = new Map<string, SessionRecord[]>()
    for (const s of rows) {
      const list = byUser.get(s.userId) ?? []
      list.push(s)
      byUser.set(s.userId, list)
    }

    const profileRepo = db.getRepository<UserProfile>('userProfiles')
    const selfId = getUserId()
    const selfStreak = await getCurrentStreak()
    const avg = (ns: number[]): number =>
      ns.length > 0 ? ns.reduce((a, b) => a + b, 0) / ns.length : 0

    const users: LeaderboardUserView[] = []
    for (const [userId, recs] of byUser) {
      const profile = await profileRepo.findById(userId)
      const name = profile?.displayName.trim() ?? ''
      users.push({
        userId,
        displayName: name !== '' ? name : `Singer-${userId.slice(0, 6)}`,
        score: Math.round(avg(recs.map((r) => r.score))),
        bestScore: Math.round(Math.max(...recs.map((r) => r.score))),
        accuracy: Math.round(avg(recs.map((r) => r.accuracy))),
        totalSessions: recs.length,
        // Local mode is effectively single-user; the signed-in user's streak
        // comes from their profile, others (seed rows) report 0.
        streak: userId === selfId ? selfStreak : 0,
        rank: 0,
      })
    }

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
