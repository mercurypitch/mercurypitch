// ============================================================
// Hybrid Adapter — cloud + local storage split
// ============================================================
//
// Routes cloud entities (challenges, leaderboard, profiles, session
// scores, …) to the ServerAdapter (Cloudflare D1 via db-worker) and
// everything else — karaoke/UVR sessions, audio blobs, derived
// analysis — to the local DexieAdapter. Audio data is huge and never
// syncs to the cloud by design.

import { hasValidToken, requireAuth } from '@/db/services/auth-service'
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
  // leaderboardEntries is intentionally NOT here: the worker's TABLES
  // allowlist no longer exposes it (the leaderboard is server-derived from
  // sessionRecords — see workers/db-worker/src/tables.ts), so routing it to
  // the cloud would silently 404 on every access. It stays a local-only
  // Dexie table (STORE_SCHEMAS in dexie-adapter.ts) for seed/dev data.
  'sharedMelodies',
  'sharedSessions',
  'featureFlags',
  'userSettings',
  'follows',
  'userSurveyResponses',
  // Omitted until 2026-08-02, which meant voiceprint-service's cloud calls
  // were routed to a Dexie store that does not exist — they threw, its
  // catch swallowed them, and dev D1 held zero rows while the gallery
  // rendered happily from localStorage. See the drift test below.
  'voiceprints',
  'userActivity',
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
  'follows',
  'userSurveyResponses',
  // access: 'user' in the worker — signed out it 401s, so reads must
  // resolve empty rather than round-trip. The device copy is what the
  // gallery shows when nobody is signed in.
  'voiceprints',
  'userActivity',
])

class SignedOutAwareRepository<T extends DbEntity> implements Repository<T> {
  constructor(
    private inner: Repository<T>,
    private isAuthed: () => boolean,
    private ensureAuthed: () => Promise<boolean>,
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
    await this.assertWritable()
    return this.inner.create(entity)
  }

  async update(
    id: string,
    patch: Partial<Omit<T, 'id' | 'createdAt'>>,
  ): Promise<T> {
    await this.assertWritable()
    return this.inner.update(id, patch)
  }

  async delete(id: string): Promise<void> {
    await this.assertWritable()
    return this.inner.delete(id)
  }

  /**
   * A write is the moment a visitor becomes a user, so "not signed in" is
   * not the same answer as "cannot write". Try to provision first.
   *
   * This used to be a bare `isAuthed()` throw, which was correct only for
   * somebody who had signed out of a real account and wrong for everybody
   * arriving for the first time. The identity is minted lazily by the
   * ServerAdapter's `beforeWrite: requireAuth` hook — but that hook lives on
   * `inner`, so throwing here meant it could never run, and a fresh
   * visitor's first practice session died in this method. Nothing else on
   * the practice path calls `requireAuth`, and `saveSessionRecord` swallows
   * the throw, so the loss was silent and permanent: no session, no streak,
   * no badges, ever. Startup provisioned eagerly until this release, which
   * is what had been hiding it.
   *
   * `requireAuth` still says no for the cases that must stay a refusal — an
   * upgraded account signed out, a suspended token, the window between
   * account erasure and its reload, no API configured — and it de-dupes
   * concurrent first writes, so a session save racing a settings push mints
   * one identity rather than two.
   *
   * Reads deliberately do NOT do this. Browsing must leave no server-side
   * row, so an unprovisioned read resolves empty instead of minting.
   */
  private async assertWritable(): Promise<void> {
    if (this.isAuthed()) return
    if (await this.ensureAuthed()) return
    throw new Error('Signed out — personal data is not being saved')
  }
}

export class HybridAdapter implements DatabaseAdapter {
  readonly schemaVersion = 1
  private guarded = new Map<string, Repository<DbEntity>>()

  constructor(
    private cloud: DatabaseAdapter,
    private local: DatabaseAdapter,
    private isAuthed: () => boolean = hasValidToken,
    private ensureAuthed: () => Promise<boolean> = requireAuth,
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
      this.ensureAuthed,
    )
    this.guarded.set(entityName, guarded as Repository<DbEntity>)
    return guarded
  }

  async transaction<R>(fn: (db: DatabaseAdapter) => Promise<R>): Promise<R> {
    // No cross-store transactions — each side is atomic per-call.
    return fn(this)
  }

  /** Run a transaction wholly against local storage. UVR/session-group data
   * never touches the cloud adapter, so multi-table destructive operations can
   * retain Dexie's all-or-nothing guarantees in hybrid deployments. */
  async transactionLocal<R>(
    fn: (db: DatabaseAdapter) => Promise<R>,
  ): Promise<R> {
    return this.local.transaction(fn)
  }

  async destroy(): Promise<void> {
    this.guarded.clear()
    await this.cloud.destroy()
    await this.local.destroy()
  }
}
