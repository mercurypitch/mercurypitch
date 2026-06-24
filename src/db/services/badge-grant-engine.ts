// ============================================================
// Badge / Achievement Grant Engine
// ============================================================
//
// Badges and achievements are defined + seeded but were never granted at
// runtime. This engine evaluates the user's real stats against the seeded
// definitions and creates the missing UserBadge / UserAchievement records
// (idempotently), notifying the user on each new unlock.
//
// userBadges / userAchievements are cloud entities, so grants only persist
// when signed in; every DB call is wrapped so a signed-out user (or any
// failure) silently no-ops — this must never throw into a completion path.

import { getDb } from '@/db'
import type { Achievement, BadgeDefinition, UserAchievement, UserBadge, } from '@/db/entities'
import { getUserId } from '@/db/seed'
import { loadAchievementDefinitions, loadBadgeDefinitions, loadChallengeDefinitions, loadChallengeProgress, loadUserAchievements, loadUserBadges, } from '@/db/services/challenges-service'
import { loadSessionRecords } from '@/db/services/session-service'
import { getCurrentStreak } from '@/db/services/streak-service'
import { showNotification } from '@/stores/notifications-store'

interface GrantStats {
  totalSessions: number
  bestScore: number
  hasPerfectSession: boolean
  currentStreak: number
  challengesCompleted: number
  /** Categories of the challenges the user has completed. */
  completedCategories: Set<string>
}

async function computeStats(): Promise<GrantStats> {
  const [records, streak, progress, challengeDefs] = await Promise.all([
    loadSessionRecords(200),
    getCurrentStreak(),
    loadChallengeProgress(),
    loadChallengeDefinitions(),
  ])

  const scores = records.map((r) => r.score ?? 0)
  const defById = new Map(challengeDefs.map((d) => [d.id, d]))
  const completed = progress.filter(
    (p) => p.completed || p.status === 'completed',
  )
  const completedCategories = new Set<string>()
  for (const p of completed) {
    const def = defById.get(p.challengeId)
    if (def) completedCategories.add(def.category)
  }

  return {
    totalSessions: records.length,
    bestScore: scores.length > 0 ? Math.max(...scores) : 0,
    hasPerfectSession: scores.some((s) => s >= 100),
    currentStreak: streak,
    challengesCompleted: completed.length,
    completedCategories,
  }
}

/** Whether a badge's unlock condition is met, given current stats. */
function isBadgeEarned(
  badge: BadgeDefinition,
  stats: GrantStats,
  earnedBadgeIds: Set<string>,
  allBadges: BadgeDefinition[],
): boolean {
  switch (badge.category) {
    case 'challenges':
      return stats.challengesCompleted >= 1
    case 'streak':
      // Bronze "On Fire" = 7-day, gold "Streak Master" = 14-day.
      return stats.currentStreak >= (badge.tier === 'gold' ? 14 : 7)
    case 'meta': {
      // "All Star" — every bronze badge earned.
      const bronze = allBadges.filter((b) => b.tier === 'bronze')
      return bronze.length > 0 && bronze.every((b) => earnedBadgeIds.has(b.id))
    }
    // Category badges map 1:1 to a completed challenge of that category.
    case 'high-notes':
    case 'low-notes':
    case 'speed':
    case 'perfect':
    case 'scales':
      return stats.completedCategories.has(badge.category)
    default:
      return false
  }
}

/**
 * Progress (0-100) + unlocked flag for an achievement, or null when the
 * achievement depends on a metric we don't track yet (left ungranted rather
 * than falsely awarded).
 */
function evalAchievement(
  ach: Achievement,
  stats: GrantStats,
): { unlocked: boolean; progress: number } | null {
  const pct = (value: number, target: number): number =>
    Math.min(100, Math.round((value / target) * 100))
  switch (ach.name) {
    case '10 Notes':
      return {
        unlocked: stats.totalSessions >= 10,
        progress: pct(stats.totalSessions, 10),
      }
    case '50 Sessions':
      return {
        unlocked: stats.totalSessions >= 50,
        progress: pct(stats.totalSessions, 50),
      }
    case 'Perfect Run':
      return {
        unlocked: stats.hasPerfectSession,
        progress: stats.hasPerfectSession ? 100 : 0,
      }
    default:
      // '3 Octaves', 'High Note Master', 'Speed Demon', 'Scale Explorer'
      // need per-note metrics we don't record yet — skip.
      return null
  }
}

/**
 * Evaluate all badges + achievements and grant any newly-earned ones.
 * Safe to call after any completion event; never throws.
 */
export async function checkAndGrantBadges(): Promise<void> {
  try {
    const [badges, userBadges, achievements, userAchievements, stats] =
      await Promise.all([
        loadBadgeDefinitions(),
        loadUserBadges(),
        loadAchievementDefinitions(),
        loadUserAchievements(),
        computeStats(),
      ])

    if (badges.length === 0 && achievements.length === 0) return

    const db = await getDb()
    const badgeRepo = db.getRepository<UserBadge>('userBadges')
    const achRepo = db.getRepository<UserAchievement>('userAchievements')
    const userId = getUserId()
    const now = new Date().toISOString()
    const earnedBadgeIds = new Set(userBadges.map((b) => b.badgeId))

    // Two passes so the meta "All Star" badge can see badges granted this
    // round (e.g. the bronze badge that completes the set).
    for (let pass = 0; pass < 2; pass++) {
      for (const badge of badges) {
        if (earnedBadgeIds.has(badge.id)) continue
        if (!isBadgeEarned(badge, stats, earnedBadgeIds, badges)) continue
        try {
          await badgeRepo.create({ userId, badgeId: badge.id, earnedAt: now })
          earnedBadgeIds.add(badge.id)
          showNotification(`Badge unlocked: ${badge.name}`, 'success')
        } catch {
          // Already granted (race) or signed out — ignore.
        }
      }
    }

    const achByDef = new Map(userAchievements.map((a) => [a.achievementId, a]))
    for (const ach of achievements) {
      const result = evalAchievement(ach, stats)
      if (!result) continue
      const existing = achByDef.get(ach.id)
      if (existing?.unlocked === true) continue

      const fields = {
        progress: result.progress,
        unlocked: result.unlocked,
        ...(result.unlocked ? { unlockedAt: now } : {}),
      }
      try {
        if (existing) {
          await achRepo.update(existing.id, fields)
        } else {
          await achRepo.create({ userId, achievementId: ach.id, ...fields })
        }
        if (result.unlocked) {
          showNotification(`Achievement unlocked: ${ach.name}`, 'success')
        }
      } catch {
        // Signed out or transient failure — ignore.
      }
    }
  } catch {
    // Grant checks must never disrupt the completion flow.
  }
}
