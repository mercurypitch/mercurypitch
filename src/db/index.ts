// ============================================================
// Database Layer — Factory & Singleton
// ============================================================

import { DexieAdapter } from './adapters/dexie-adapter'
import { seedAll } from './seed'
import type { DatabaseAdapter } from './types'

let dbPromise: Promise<DatabaseAdapter> | null = null

/** Create a new database adapter instance. Called once at app init. */
export async function createDatabase(): Promise<DatabaseAdapter> {
  const adapter = new DexieAdapter()

  // Seed sample data on first run
  await seedAll(adapter)

  return adapter
}

/** Lazy singleton — returns the same adapter for the app lifetime. */
export async function getDb(): Promise<DatabaseAdapter> {
  if (!dbPromise) {
    dbPromise = createDatabase()
  }
  return dbPromise
}

/** Re-export types for convenience. */
export type {
  DatabaseAdapter,
  Repository,
  QueryOptions,
  DbEntity,
} from './types'
export type {
  UserProfile,
  SessionRecord,
  ChallengeDefinition,
  ChallengeProgress,
  BadgeDefinition,
  UserBadge,
  Achievement,
  UserAchievement,
  LeaderboardEntry,
  SharedMelody,
  SharedSession,
  FeatureFlag,
  UserSetting,
  MelodyRecord,
  SessionTemplate,
  PlaylistRecord,
  UvrSessionRecord,
  UvrStemBlob,
} from './entities'
