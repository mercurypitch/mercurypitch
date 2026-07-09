// ============================================================
// Database Seeding — Sample Data
// ============================================================
//
// Seeds IndexedDB with initial data for hidden features.
// Called once at app init. Idempotent — checks for seed flag.

import type { Achievement, BadgeDefinition, ChallengeDefinition, LeaderboardCategory, LeaderboardEntry, LeaderboardPeriod, UserProfile, } from './entities'
import seedData from './seed-data.json'
import { getUserId as getPersistedUserId } from './services/user-service'
import type { DatabaseAdapter } from './types'

/** djb2 over a string, hex-encoded — tiny, deterministic, dependency-free. */
function contentHash(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

// The seed flag is derived from the seed-data content itself, so ANY edit to
// seed-data.json re-runs the definition upsert exactly once per DB — no
// manual version bumps to forget. Old flags (db_seeded_v1/v2/older hashes)
// simply linger unread. Definitions upsert by title/name with stable ids,
// so re-running never detaches per-user progress.
const SEEDED_FLAG = `db_seeded_${contentHash(JSON.stringify(seedData))}`

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

/**
 * Upsert definition rows keyed by a stable field (title/name): create the
 * missing ones, update rows whose seeded fields changed (content updates
 * like new targets or descriptions), leave everything else untouched.
 * Existing rows keep their ids, so per-user progress stays attached.
 */
async function upsertDefinitions<T extends { id: string }>(
  db: DatabaseAdapter,
  table: string,
  defs: ReadonlyArray<Record<string, unknown>>,
  key: string,
): Promise<void> {
  const repo = db.getRepository<T & { createdAt: string; updatedAt: string }>(
    table,
  )
  const existing = (await repo.findAll()) as Array<Record<string, unknown>>
  const byKey = new Map(existing.map((row) => [row[key], row]))
  for (const def of defs) {
    const found = byKey.get(def[key])
    if (found === undefined) {
      await repo.create(def as never)
      continue
    }
    const changed = Object.keys(def).some(
      (field) => def[field] !== found[field],
    )
    if (changed) {
      await repo.update(found.id as string, def as never)
    }
  }
}

async function seedChallengeDefinitions(db: DatabaseAdapter): Promise<void> {
  await upsertDefinitions(
    db,
    'challengeDefinitions',
    challengeDefinitions,
    'title',
  )
}

// Per-user challenge progress, badges and achievements are NOT seeded:
// they are earned through the real completion loop (see
// src/features/challenges/challenge-attempt.ts and the badge grant engine).
// The v1 seeder invented in-progress percentages and pre-earned badges,
// which made the challenges tab lie to fresh local users.

async function seedBadgeDefinitions(db: DatabaseAdapter): Promise<void> {
  await upsertDefinitions(db, 'badgeDefinitions', badgeDefinitions, 'name')
}

async function seedAchievementDefinitions(db: DatabaseAdapter): Promise<void> {
  await upsertDefinitions(db, 'achievements', achievementDefinitions, 'name')
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

  await seedChallengeDefinitions(db)
  await seedBadgeDefinitions(db)
  await seedAchievementDefinitions(db)

  await seedLeaderboardEntries(db)
  await seedUserProfile(db)

  await markSeeded(db)
}
