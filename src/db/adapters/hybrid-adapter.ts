// ============================================================
// Hybrid Adapter — cloud + local storage split
// ============================================================
//
// Routes cloud entities (challenges, leaderboard, profiles, session
// scores, …) to the ServerAdapter (Cloudflare D1 via db-worker) and
// everything else — karaoke/UVR sessions, audio blobs, derived
// analysis — to the local DexieAdapter. Audio data is huge and never
// syncs to the cloud by design.

import type { DatabaseAdapter, DbEntity, Repository } from '@/db/types'

/**
 * Entities served by the db-worker. Must mirror the allowlist in
 * workers/db-worker/src/tables.ts.
 */
export const CLOUD_ENTITIES: ReadonlySet<string> = new Set([
  'userProfiles',
  'sessionRecords',
  'challengeDefinitions',
  'challengeProgress',
  'badgeDefinitions',
  'userBadges',
  'achievements',
  'userAchievements',
  'leaderboardEntries',
  'sharedMelodies',
  'sharedSessions',
  'featureFlags',
  'userSettings',
])

export class HybridAdapter implements DatabaseAdapter {
  readonly schemaVersion = 1

  constructor(
    private cloud: DatabaseAdapter,
    private local: DatabaseAdapter,
  ) {}

  getRepository<T extends DbEntity>(entityName: string): Repository<T> {
    return CLOUD_ENTITIES.has(entityName)
      ? this.cloud.getRepository<T>(entityName)
      : this.local.getRepository<T>(entityName)
  }

  async transaction<R>(fn: (db: DatabaseAdapter) => Promise<R>): Promise<R> {
    // No cross-store transactions — each side is atomic per-call.
    return fn(this)
  }

  async destroy(): Promise<void> {
    await this.cloud.destroy()
    await this.local.destroy()
  }
}
