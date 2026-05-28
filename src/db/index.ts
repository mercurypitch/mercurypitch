// ============================================================
// Database Layer — Factory & Singleton
// ============================================================

import { API_BASE_URL } from '@/lib/defaults'
import { DexieAdapter } from './adapters/dexie-adapter'
import { ServerAdapter } from './adapters/server-adapter'
import { seedAll } from './seed'
import type { DatabaseAdapter } from './types'

let dbPromise: Promise<DatabaseAdapter> | null = null

/**
 * Resolve which adapter to use.
 *
 *   VITE_API_BASE_URL=https://api.example.com pnpm dev   → ServerAdapter
 *   pnpm dev                                              → DexieAdapter (local)
 */
function resolveAdapter(): DatabaseAdapter {
  if (API_BASE_URL) {
    console.info('[db] using ServerAdapter →', API_BASE_URL)
    return new ServerAdapter({ baseUrl: API_BASE_URL })
  }

  console.info('[db] using DexieAdapter (local)')
  return new DexieAdapter()
}

/** Create a new database adapter instance. Called once at app init. */
export async function createDatabase(): Promise<DatabaseAdapter> {
  const adapter = resolveAdapter()

  // Seed sample data on first run (local adapter only — server seeds itself)
  if (adapter instanceof DexieAdapter) {
    await seedAll(adapter)
  }

  return adapter
}

/** Lazy singleton — returns the same adapter for the app lifetime. */
export async function getDb(): Promise<DatabaseAdapter> {
  if (!dbPromise) {
    dbPromise = createDatabase()
  }
  return dbPromise
}

/** Destroy the current database, reset the singleton, and create a fresh one. */
export async function resetDatabase(): Promise<DatabaseAdapter> {
  if (dbPromise) {
    const db = await dbPromise
    await db.destroy()
  }
  dbPromise = null
  return createDatabase()
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
  SessionGroupRecord,
  UvrSessionRecord,
  UvrStemBlob,
  UvrStemFingerprint,
  UvrSessionLyrics,
  WhisperTranscriptionRecord,
} from './entities'
