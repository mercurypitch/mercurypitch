// ============================================================
// Database Layer — Factory & Singleton
// ============================================================

import { API_BASE_URL } from '@/lib/defaults'
import { DexieAdapter } from './adapters/dexie-adapter'
import { HybridAdapter } from './adapters/hybrid-adapter'
import { ServerAdapter } from './adapters/server-adapter'
import { seedAll } from './seed'
import { ensureAuth } from './services/auth-service'
import { getAuthHeaders } from './services/user-service'
import type { DatabaseAdapter } from './types'

let dbPromise: Promise<DatabaseAdapter> | null = null

/**
 * Resolve which adapter to use.
 *
 *   VITE_API_BASE_URL=https://api.example.com pnpm dev   → HybridAdapter
 *     (cloud entities → db-worker/D1, karaoke/UVR data → Dexie)
 *   pnpm dev                                              → DexieAdapter (local)
 */
function resolveAdapter(): DatabaseAdapter {
  if (API_BASE_URL != null && API_BASE_URL !== '') {
    console.info('[db] using HybridAdapter →', API_BASE_URL)
    return new HybridAdapter(
      new ServerAdapter({ baseUrl: API_BASE_URL, headers: getAuthHeaders }),
      new DexieAdapter(),
    )
  }

  console.info('[db] using DexieAdapter (local)')
  return new DexieAdapter()
}

/**
 * Ask the browser to make our storage persistent, so IndexedDB (including large
 * UVR stem blobs) is exempt from best-effort eviction under storage pressure.
 * Best-effort: some browsers only grant it after user engagement, and a denial
 * is fine — storage just stays evictable. Never throws.
 */
async function requestPersistentStorage(): Promise<void> {
  try {
    if (
      typeof navigator === 'undefined' ||
      navigator.storage?.persist == null
    ) {
      return
    }
    if (await navigator.storage.persisted()) return
    const granted = await navigator.storage.persist()
    console.info('[db] persistent storage', granted ? 'granted' : 'denied')
  } catch {
    // Non-fatal — storage stays best-effort.
  }
}

/**
 * One-time removal of the orphaned pre-rename 'PitchPerfectDB' IndexedDB
 * database. Nothing references it (the app uses 'MercuryPitchDB'); it only
 * clutters the storage inspector and confuses users. Guarded so it runs once.
 */
function deleteLegacyDatabases(): void {
  try {
    if (typeof globalThis.indexedDB === 'undefined') return
    const FLAG = 'mercurypitch_legacy_db_cleaned'
    if (localStorage.getItem(FLAG) === '1') return
    globalThis.indexedDB.deleteDatabase('PitchPerfectDB')
    localStorage.setItem(FLAG, '1')
  } catch {
    // Non-fatal — the orphan DB just lingers.
  }
}

/** Create a new database adapter instance. Called once at app init. */
export async function createDatabase(): Promise<DatabaseAdapter> {
  void requestPersistentStorage()
  deleteLegacyDatabases()
  const adapter = resolveAdapter()

  if (adapter instanceof HybridAdapter) {
    // Get an anonymous JWT before the first repository call. Cloud
    // tables are seeded server-side; the local side only holds
    // unseeded UVR data. Failure is non-fatal (offline-tolerant).
    await ensureAuth()
  }

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
  Follow,
  MelodyRecord,
  SessionTemplate,
  PlaylistRecord,
  SessionGroupRecord,
  KaraokePlaylistRecord,
  KaraokePlaylistItem,
  UvrSessionRecord,
  UvrStemBlob,
  UvrStemFingerprint,
  UvrSessionLyrics,
  WhisperTranscriptionRecord,
  UserSurveyResponse,
} from './entities'
