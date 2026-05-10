// ============================================================
// Challenges Service — DB-backed challenge/badge/achievement ops
// ============================================================

import { getDb } from '@/db'
import type {
  ChallengeDefinition,
  ChallengeProgress,
  BadgeDefinition,
  UserBadge,
  Achievement,
  UserAchievement,
} from '@/db/entities'
import { getUserId } from '@/db/seed'

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

export async function loadChallengeDefinitions(): Promise<ChallengeDefinition[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<ChallengeDefinition>('challengeDefinitions')
    return repo.findAll({ where: { isActive: true } as Record<string, unknown>, orderBy: 'sortOrder' })
  } catch {
    return []
  }
}

export async function loadChallengeProgress(): Promise<ChallengeProgress[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<ChallengeProgress>('challengeProgress')
    return repo.findAll({ where: { userId: getUserId() } as Record<string, unknown> })
  } catch {
    return []
  }
}

export async function loadBadgeDefinitions(): Promise<BadgeDefinition[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<BadgeDefinition>('badgeDefinitions')
    return repo.findAll({ orderBy: 'sortOrder' })
  } catch {
    return []
  }
}

export async function loadUserBadges(): Promise<UserBadge[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserBadge>('userBadges')
    return repo.findAll({ where: { userId: getUserId() } as Record<string, unknown> })
  } catch {
    return []
  }
}

export async function loadAchievementDefinitions(): Promise<Achievement[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<Achievement>('achievements')
    return repo.findAll({ orderBy: 'sortOrder' })
  } catch {
    return []
  }
}

export async function loadUserAchievements(): Promise<UserAchievement[]> {
  try {
    const db = await getDb()
    const repo = db.getRepository<UserAchievement>('userAchievements')
    return repo.findAll({ where: { userId: getUserId() } as Record<string, unknown> })
  } catch {
    return []
  }
}

export async function saveChallengeProgress(progress: Omit<ChallengeProgress, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChallengeProgress | null> {
  try {
    const db = await getDb()
    const repo = db.getRepository<ChallengeProgress>('challengeProgress')
    // Upsert: check if exists for this userId + challengeId
    const existing = await repo.findAll({
      where: { userId: progress.userId, challengeId: progress.challengeId } as Record<string, unknown>,
    })
    if (existing.length > 0) {
      return repo.update(existing[0].id, progress)
    }
    return repo.create(progress)
  } catch {
    return null
  }
}

export function challengeIcon(icon: string): string {
  const map: Record<string, string> = {
    '🎤': 'mic',
    '🔥': 'fire',
    '🚀': 'rocket',
    '🎸': 'guitar',
    '🔊': 'volume',
    '⚡': 'bolt',
    '⏱️': 'stopwatch',
    '🦅': 'eagle',
    '🎯': 'target',
    '💎': 'diamond',
    '🎹': 'keyboard',
    '🌙': 'moon',
  }
  return map[icon] || 'target'
}
