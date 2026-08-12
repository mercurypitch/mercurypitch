// ============================================================
// Challenges Service — DB-backed challenge/badge/achievement ops
// ============================================================

import { getDb } from '@/db'
import type { Achievement, BadgeDefinition, ChallengeDefinition, ChallengeProgress, UserAchievement, UserBadge, } from '@/db/entities'
import { getUserId } from '@/db/services/user-service'

export interface ChallengeView {
  id: string
  type: string
  name: string
  description: string
  icon: string
  targetScore: number
  currentScore: number
  progress: number
  status: 'not-started' | 'in-progress' | 'completed' | 'locked'
  difficulty: string
  sortOrder: number
}

export interface BadgeView {
  id: string
  name: string
  description: string
  icon: string
  tier: string
  earned: boolean
  earnedDate?: number
  category: string
}

export interface AchievementView {
  id: string
  name: string
  description: string
  icon: string
  points: number
  unlocked: boolean
  progress: number
  required: number
  condition: string
}

export async function loadChallengeDefinitions(): Promise<
  ChallengeDefinition[]
> {
  try {
    const db = await getDb()
    const repo = db.getRepository<ChallengeDefinition>('challengeDefinitions')
    return await repo.findAll({
      where: { isActive: true },
      orderBy: 'sortOrder',
    })
  } catch {
    return []
  }
}

export async function loadChallengeProgress(
  expectedUserId = getUserId(),
): Promise<ChallengeProgress[]> {
  try {
    if (getUserId() !== expectedUserId) return []
    const db = await getDb()
    if (getUserId() !== expectedUserId) return []
    const repo = db.getRepository<ChallengeProgress>('challengeProgress')
    return await repo.findAll({
      where: { userId: expectedUserId },
    })
  } catch {
    return []
  }
}

export async function loadBadgeDefinitions(): Promise<BadgeDefinition[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<BadgeDefinition>('badgeDefinitions')
    return await repo.findAll({ orderBy: 'sortOrder' })
  } catch {
    return []
  }
}

export async function loadUserBadges(): Promise<UserBadge[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserBadge>('userBadges')
    return await repo.findAll({
      where: { userId: getUserId() },
    })
  } catch {
    return []
  }
}

export async function loadAchievementDefinitions(): Promise<Achievement[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<Achievement>('achievements')
    return await repo.findAll({ orderBy: 'sortOrder' })
  } catch {
    return []
  }
}

export async function loadUserAchievements(): Promise<UserAchievement[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserAchievement>('userAchievements')
    return await repo.findAll({
      where: { userId: getUserId() },
    })
  } catch {
    return []
  }
}

export async function saveChallengeProgress(
  progress: Omit<ChallengeProgress, 'id' | 'createdAt' | 'updatedAt'>,
  expectedUserId = progress.userId,
): Promise<ChallengeProgress | null> {
  try {
    if (progress.userId !== expectedUserId || getUserId() !== expectedUserId) {
      return null
    }
    const db = await getDb()
    if (getUserId() !== expectedUserId) return null
    const repo = db.getRepository<ChallengeProgress>('challengeProgress')
    // Upsert: check if exists for this userId + challengeId
    const existing = await repo.findAll({
      where: {
        userId: progress.userId,
        challengeId: progress.challengeId,
      },
    })
    if (getUserId() !== expectedUserId) return null
    if (existing.length > 0) {
      return await repo.update(existing[0].id, progress)
    }
    return await repo.create(progress)
  } catch {
    return null
  }
}
