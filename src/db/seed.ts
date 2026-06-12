// ============================================================
// Database Seeding — Sample Data
// ============================================================
//
// Seeds IndexedDB with initial data for hidden features.
// Called once at app init. Idempotent — checks for seed flag.

import type { Achievement, BadgeDefinition, ChallengeDefinition, ChallengeProgress, LeaderboardCategory, LeaderboardEntry, LeaderboardPeriod, UserAchievement, UserBadge, UserProfile, } from './entities'
import seedData from './seed-data.json'
import { getUserId as getPersistedUserId } from './services/user-service'
import type { DatabaseAdapter } from './types'

const SEEDED_FLAG = 'db_seeded_v1'

// ── Helper ──────────────────────────────────────────────────────

async function isSeeded(db: DatabaseAdapter): Promise<boolean> {
  try {
    const repo = db.getRepository<
      { key: string; value: boolean } & {
        id: string
        createdAt: string
        updatedAt: string
      }
    >('featureFlags')
    const flags = await repo.findAll({
      where: { key: SEEDED_FLAG },
    })
    return flags.length > 0 && flags[0].value === true
  } catch {
    return false
  }
}

async function markSeeded(db: DatabaseAdapter): Promise<void> {
  const repo = db.getRepository<
    { key: string; value: boolean } & {
      id: string
      createdAt: string
      updatedAt: string
    }
  >('featureFlags')
  await repo.create({ key: SEEDED_FLAG, value: true })
}

// ── Definition data (shared with scripts/seed-remote-db.mjs) ────

const challengeDefinitions = seedData.challengeDefinitions as Omit<
  ChallengeDefinition,
  'id' | 'createdAt' | 'updatedAt'
>[]

const badgeDefinitions = seedData.badgeDefinitions as Omit<
  BadgeDefinition,
  'id' | 'createdAt' | 'updatedAt'
>[]

const achievementDefinitions = seedData.achievementDefinitions as Omit<
  Achievement,
  'id' | 'createdAt' | 'updatedAt'
>[]

// ── User Profile ────────────────────────────────────────────────

function getDefaultUserId(): string {
  // Persisted per-browser id (was a new UUID per page load before).
  return getPersistedUserId()
}

export function getUserId(): string {
  return getDefaultUserId()
}

// ── Seed functions ──────────────────────────────────────────────

async function seedChallengeDefinitions(
  db: DatabaseAdapter,
): Promise<Map<string, string>> {
  const repo = db.getRepository<ChallengeDefinition>('challengeDefinitions')
  const existing = await repo.count()
  if (existing > 0) return new Map()

  const idMap = new Map<string, string>() // title → DB id
  for (const def of challengeDefinitions) {
    const created = await repo.create(def)
    idMap.set(def.title, created.id)
  }
  return idMap
}

async function seedChallengeProgress(
  db: DatabaseAdapter,
  challengeIdMap: Map<string, string>,
): Promise<void> {
  const repo = db.getRepository<ChallengeProgress>('challengeProgress')
  const existing = await repo.count()
  if (existing > 0) return

  const userId = getDefaultUserId()
  const progressData: Array<{
    title: string
    progress: number
    currentScore: number
    bestScore: number
    status: ChallengeProgress['status']
    completed: boolean
    attempts: number
  }> = [
    {
      title: 'High Note Hero',
      progress: 75,
      currentScore: 75,
      bestScore: 82,
      status: 'active',
      completed: false,
      attempts: 5,
    },
    {
      title: 'Belting Master',
      progress: 65,
      currentScore: 65,
      bestScore: 70,
      status: 'active',
      completed: false,
      attempts: 3,
    },
    {
      title: 'Above It All',
      progress: 10,
      currentScore: 10,
      bestScore: 15,
      status: 'active',
      completed: false,
      attempts: 1,
    },
    {
      title: 'Deep Note King',
      progress: 88,
      currentScore: 88,
      bestScore: 92,
      status: 'active',
      completed: false,
      attempts: 4,
    },
    {
      title: 'Subwoofer Sound',
      progress: 20,
      currentScore: 20,
      bestScore: 20,
      status: 'active',
      completed: false,
      attempts: 1,
    },
    {
      title: 'Scale Speedster',
      progress: 30,
      currentScore: 30,
      bestScore: 40,
      status: 'active',
      completed: false,
      attempts: 3,
    },
    {
      title: 'Rapid Fire',
      progress: 45,
      currentScore: 45,
      bestScore: 55,
      status: 'active',
      completed: false,
      attempts: 4,
    },
    {
      title: 'Climbing Eagle',
      progress: 5,
      currentScore: 5,
      bestScore: 8,
      status: 'active',
      completed: false,
      attempts: 1,
    },
    {
      title: 'Perfect Pitch Pilot',
      progress: 85,
      currentScore: 85,
      bestScore: 90,
      status: 'active',
      completed: false,
      attempts: 6,
    },
    {
      title: 'Crystal Clear',
      progress: 60,
      currentScore: 60,
      bestScore: 65,
      status: 'active',
      completed: false,
      attempts: 2,
    },
    {
      title: 'Major Scale Master',
      progress: 42,
      currentScore: 5,
      bestScore: 5,
      status: 'active',
      completed: false,
      attempts: 3,
    },
    {
      title: 'Minor Scale Sage',
      progress: 38,
      currentScore: 3,
      bestScore: 3,
      status: 'active',
      completed: false,
      attempts: 2,
    },
  ]

  for (const p of progressData) {
    const challengeId = challengeIdMap.get(p.title)
    if (challengeId === undefined) continue
    await repo.create({
      userId,
      challengeId,
      progress: p.progress,
      currentScore: p.currentScore,
      bestScore: p.bestScore,
      status: p.status,
      completed: p.completed,
      attempts: p.attempts,
    })
  }
}

async function seedBadgeDefinitions(
  db: DatabaseAdapter,
): Promise<Map<string, string>> {
  const repo = db.getRepository<BadgeDefinition>('badgeDefinitions')
  const existing = await repo.count()
  if (existing > 0) return new Map()

  const idMap = new Map<string, string>()
  for (const def of badgeDefinitions) {
    const created = await repo.create(def)
    idMap.set(def.name, created.id)
  }
  return idMap
}

async function seedUserBadges(
  db: DatabaseAdapter,
  badgeIdMap: Map<string, string>,
): Promise<void> {
  const repo = db.getRepository<UserBadge>('userBadges')
  const existing = await repo.count()
  if (existing > 0) return

  const userId = getDefaultUserId()
  const earnedBadges = [
    { name: 'First Steps', daysAgo: 10 },
    { name: 'On Fire', daysAgo: 7 },
    { name: 'High & Mighty', daysAgo: 5 },
    { name: 'Speed Demon', daysAgo: 3 },
    { name: 'Perfect Start', daysAgo: 2 },
    { name: 'Scale Scholar', daysAgo: 15 },
  ]

  for (const { name, daysAgo } of earnedBadges) {
    const badgeId = badgeIdMap.get(name)
    if (badgeId === undefined) continue
    await repo.create({
      userId,
      badgeId,
      earnedAt: new Date(
        Date.now() - 1000 * 60 * 60 * 24 * daysAgo,
      ).toISOString(),
    })
  }
}

async function seedAchievementDefinitions(
  db: DatabaseAdapter,
): Promise<Map<string, string>> {
  const repo = db.getRepository<Achievement>('achievements')
  const existing = await repo.count()
  if (existing > 0) return new Map()

  const idMap = new Map<string, string>()
  for (const def of achievementDefinitions) {
    const created = await repo.create(def)
    idMap.set(def.name, created.id)
  }
  return idMap
}

async function seedUserAchievements(
  db: DatabaseAdapter,
  achievementIdMap: Map<string, string>,
): Promise<void> {
  const repo = db.getRepository<UserAchievement>('userAchievements')
  const existing = await repo.count()
  if (existing > 0) return

  const userId = getDefaultUserId()
  const progress: Array<{
    name: string
    progress: number
    unlocked: boolean
  }> = [
    { name: '10 Notes', progress: 45, unlocked: true },
    { name: '50 Sessions', progress: 45, unlocked: true },
    { name: '3 Octaves', progress: 1, unlocked: false },
    { name: 'High Note Master', progress: 15, unlocked: false },
    { name: 'Perfect Run', progress: 0, unlocked: false },
    { name: 'Speed Demon', progress: 2, unlocked: false },
    { name: 'Scale Explorer', progress: 8, unlocked: false },
  ]

  for (const p of progress) {
    const achievementId = achievementIdMap.get(p.name)
    if (achievementId === undefined) continue
    await repo.create({
      userId,
      achievementId,
      progress: p.progress,
      unlocked: p.unlocked,
      unlockedAt: p.unlocked
        ? new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
        : undefined,
    })
  }
}

async function seedLeaderboardEntries(db: DatabaseAdapter): Promise<void> {
  const repo = db.getRepository<LeaderboardEntry>('leaderboardEntries')
  const existing = await repo.count()
  if (existing > 0) return

  const userId = getDefaultUserId()
  const categories: LeaderboardCategory[] = [
    'overall',
    'best-score',
    'accuracy',
    'streak',
    'sessions',
  ]
  const period: LeaderboardPeriod = 'all-time'

  const users = [
    {
      userId: 'lb-u1',
      displayName: 'MelodyMaven',
      score: 1543200,
      rank: 1,
      streak: 45,
      totalSessions: 324,
      bestScore: 98,
      accuracy: 92,
      daysAgo: 365,
    },
    {
      userId: 'lb-u2',
      displayName: 'VocalVirtuoso',
      score: 1498500,
      rank: 2,
      streak: 38,
      totalSessions: 289,
      bestScore: 97,
      accuracy: 91,
      daysAgo: 730,
    },
    {
      userId: 'lb-u3',
      displayName: 'MercuryPitchPro',
      score: 1421000,
      rank: 3,
      streak: 52,
      totalSessions: 356,
      bestScore: 96,
      accuracy: 90,
      daysAgo: 1095,
    },
    {
      userId: 'lb-u4',
      displayName: 'SingingStar',
      score: 1385000,
      rank: 4,
      streak: 28,
      totalSessions: 198,
      bestScore: 95,
      accuracy: 88,
      daysAgo: 730,
    },
    {
      userId: 'lb-u5',
      displayName: 'HarmonyKing',
      score: 1312000,
      rank: 5,
      streak: 31,
      totalSessions: 245,
      bestScore: 94,
      accuracy: 87,
      daysAgo: 365,
    },
    {
      userId: 'lb-u6',
      displayName: 'ToneMaster',
      score: 1248000,
      rank: 6,
      streak: 22,
      totalSessions: 187,
      bestScore: 93,
      accuracy: 86,
      daysAgo: 365,
    },
    {
      userId: 'lb-u7',
      displayName: 'VoiceWizard',
      score: 1183000,
      rank: 7,
      streak: 25,
      totalSessions: 156,
      bestScore: 92,
      accuracy: 85,
      daysAgo: 365,
    },
    {
      userId: 'lb-u8',
      displayName: 'SoundSaga',
      score: 1125000,
      rank: 8,
      streak: 19,
      totalSessions: 134,
      bestScore: 91,
      accuracy: 84,
      daysAgo: 365,
    },
    {
      userId,
      displayName: 'You',
      score: 875000,
      rank: 42,
      streak: 7,
      totalSessions: 45,
      bestScore: 85,
      accuracy: 78,
      daysAgo: 30,
    },
  ]

  for (const u of users) {
    for (const category of categories) {
      // Adjust score per category for variety
      let catScore = u.score
      if (category === 'best-score') catScore = u.bestScore * 10000
      if (category === 'accuracy') catScore = u.accuracy * 10000
      if (category === 'streak') catScore = u.streak * 10000
      if (category === 'sessions') catScore = u.totalSessions * 10000

      await repo.create({
        userId: u.userId,
        displayName: u.displayName,
        category,
        period,
        rank: u.rank,
        score: catScore,
        streak: u.streak,
        totalSessions: u.totalSessions,
        bestScore: u.bestScore,
        accuracy: u.accuracy,
      })
    }
  }
}

async function seedUserProfile(db: DatabaseAdapter): Promise<void> {
  const repo = db.getRepository<UserProfile>('userProfiles')
  const existing = await repo.count()
  if (existing > 0) return

  await repo.create({
    displayName: 'SingerPro',
    bio: 'Aspiring vocalist on a journey to perfect pitch.',
    joinDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    lastPracticeDate: null,
    currentStreak: 0,
  })
}

// ── Main seed entry point ───────────────────────────────────────

export async function seedAll(db: DatabaseAdapter): Promise<void> {
  if (await isSeeded(db)) return

  // Seed in dependency order
  const challengeIdMap = await seedChallengeDefinitions(db)
  await seedChallengeProgress(db, challengeIdMap)

  const badgeIdMap = await seedBadgeDefinitions(db)
  await seedUserBadges(db, badgeIdMap)

  const achievementIdMap = await seedAchievementDefinitions(db)
  await seedUserAchievements(db, achievementIdMap)

  await seedLeaderboardEntries(db)
  await seedUserProfile(db)

  await markSeeded(db)
}
