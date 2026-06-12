// ============================================================
// Hybrid Adapter — cloud + local storage split
// ============================================================
//
// Routes cloud entities (challenges, leaderboard, profiles, session
// scores, …) to the ServerAdapter (Cloudflare D1 via db-worker) and
// everything else — karaoke/UVR sessions, audio blobs, derived
// analysis — to the local DexieAdapter. Audio data is huge and never
// syncs to the cloud by design.

import { hasValidToken } from '@/db/services/auth-service'
import type { DatabaseAdapter, DbEntity, QueryOptions, Repository, } from '@/db/types'

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

/**
 * Cloud entities whose rows are private to the signed-in user (the
 * worker 401s unauthenticated access). Signed out, reads resolve
 * empty and writes fail fast — no doomed network round-trips. Public
 * content (definitions, leaderboard, shares, profiles) is unaffected.
 */
const USER_SCOPED_ENTITIES: ReadonlySet<string> = new Set([
  'sessionRecords',
  'challengeProgress',
  'userBadges',
  'userAchievements',
  'userSettings',
])

class SignedOutAwareRepository<T extends DbEntity> implements Repository<T> {
  constructor(
    private inner: Repository<T>,
    private isAuthed: () => boolean,
  ) {}

  async findById(id: string): Promise<T | null> {
    return this.isAuthed() ? this.inner.findById(id) : null
  }

  async findAll(opts?: QueryOptions<T>): Promise<T[]> {
    return this.isAuthed() ? this.inner.findAll(opts) : []
  }

  async count(opts?: QueryOptions<T>): Promise<number> {
    return this.isAuthed() ? this.inner.count(opts) : 0
  }

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    this.assertAuthed()
    return this.inner.create(entity)
  }

  async update(
    id: string,
    patch: Partial<Omit<T, 'id' | 'createdAt'>>,
  ): Promise<T> {
    this.assertAuthed()
    return this.inner.update(id, patch)
  }

  async delete(id: string): Promise<void> {
    this.assertAuthed()
    return this.inner.delete(id)
  }

  private assertAuthed(): void {
    if (!this.isAuthed()) {
      throw new Error('Signed out — personal data is not being saved')
    }
  }
}

export class HybridAdapter implements DatabaseAdapter {
  readonly schemaVersion = 1
  private guarded = new Map<string, Repository<DbEntity>>()

  constructor(
    private cloud: DatabaseAdapter,
    private local: DatabaseAdapter,
    private isAuthed: () => boolean = hasValidToken,
  ) {}

  getRepository<T extends DbEntity>(entityName: string): Repository<T> {
    if (!CLOUD_ENTITIES.has(entityName)) {
      return this.local.getRepository<T>(entityName)
    }
    if (!USER_SCOPED_ENTITIES.has(entityName)) {
      return this.cloud.getRepository<T>(entityName)
    }
    const existing = this.guarded.get(entityName)
    if (existing) return existing as Repository<T>
    const guarded = new SignedOutAwareRepository<T>(
      this.cloud.getRepository<T>(entityName),
      this.isAuthed,
    )
    this.guarded.set(entityName, guarded as Repository<DbEntity>)
    return guarded
  }

  async transaction<R>(fn: (db: DatabaseAdapter) => Promise<R>): Promise<R> {
    // No cross-store transactions — each side is atomic per-call.
    return fn(this)
  }

  async destroy(): Promise<void> {
    this.guarded.clear()
    await this.cloud.destroy()
    await this.local.destroy()
  }
}
