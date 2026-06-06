// ============================================================
// Dexie (IndexedDB) Adapter
// ============================================================

import type { Table } from 'dexie'
import DexieDB from 'dexie'
import type { DatabaseAdapter, DbEntity, QueryOptions, Repository, } from '@/db/types'

// ── Schema definitions ──────────────────────────────────────────
// Store schema format: primaryKey, index1, index2, ...
// Primary key is always 'id' (string UUID, not auto-incremented).

const STORE_SCHEMAS: Record<string, string> = {
  userProfiles: 'id',
  sessionRecords: 'id, userId, endedAt',
  challengeDefinitions: 'id, category, isActive, sortOrder',
  challengeProgress: 'id, userId, challengeId',
  badgeDefinitions: 'id, category, tier, sortOrder',
  userBadges: 'id, userId, badgeId',
  achievements: 'id, sortOrder',
  userAchievements: 'id, userId, achievementId',
  leaderboardEntries: 'id, userId, category, period',
  sharedMelodies: 'id, userId, melodyId, isPublic',
  sharedSessions: 'id, userId, sessionId, isPublic',
  featureFlags: 'id, &key',
  userSettings: 'id, userId, key',
  uvrSessions: 'id, appSessionId, userId, status, fileHash, createdAt',
  uvrStemBlobs: 'id, sessionId, stemType, createdAt',
  uvrStemFingerprints: 'id, sessionId, createdAt',
  uvrSessionLyrics: 'id, sessionId',
  offlinePitchAnalysis: 'id, fileHash',
  whisperTranscriptions: 'id, sessionId',
  sessionGroups: 'id',
}

// ── DexieDatabase class ─────────────────────────────────────────

class DexieDatabase extends DexieDB {
  // Dynamic table access — tables are created via schema definition
  // and accessed through the base Dexie.table() method.

  constructor() {
    super('MercuryPitchDB')
    this.version(1).stores({
      userProfiles: 'id',
      sessionRecords: 'id, userId, endedAt',
      challengeDefinitions: 'id, category, isActive, sortOrder',
      challengeProgress: 'id, userId, challengeId',
      badgeDefinitions: 'id, category, tier, sortOrder',
      userBadges: 'id, userId, badgeId',
      achievements: 'id, sortOrder',
      userAchievements: 'id, userId, achievementId',
      leaderboardEntries: 'id, userId, category, period',
      sharedMelodies: 'id, userId, melodyId, isPublic',
      sharedSessions: 'id, userId, sessionId, isPublic',
      featureFlags: 'id, &key',
      userSettings: 'id, userId, key',
      uvrSessions: 'id, appSessionId, userId, status, fileHash, createdAt',
      uvrStemBlobs: 'id, sessionId, stemType, createdAt',
      uvrStemFingerprints: 'id, sessionId, createdAt',
    })
    this.version(2).stores(STORE_SCHEMAS)
    this.version(3).stores(STORE_SCHEMAS)
    this.version(4).stores(STORE_SCHEMAS)
    this.version(5).stores(STORE_SCHEMAS)
  }

  /** Add a new table at the next schema version. */
  addTable(name: string, schema: string): void {
    if (this.tables.some((t) => t.name === name)) return
    const currentVersion = this.verno
    this.close()
    const newStores: Record<string, string> = {}
    for (const t of this.tables) {
      newStores[t.name] = t.schema.primKey.name
    }
    newStores[name] = schema
    this.version(currentVersion + 1).stores(newStores)
  }
}

// ── DexieRepository implementation ──────────────────────────────

class DexieRepository<T extends DbEntity> implements Repository<T> {
  constructor(private table: Table<T, string>) {}

  async findById(id: string): Promise<T | null> {
    return (await this.table.get(id)) ?? null
  }

  async findAll(opts?: QueryOptions<T>): Promise<T[]> {
    try {
    // 1. Determine if we can use an index for the WHERE clause
    let collection: DexieDB.Collection<T, string> | null = null
    let usedWhereIndex = false
    const whereEntries = opts?.where
      ? Object.entries(opts.where).filter(
          ([_, v]) => v !== undefined && v !== null,
        )
      : []

    if (whereEntries.length > 0) {
      // Find an indexed key to use for the initial query
      const indexes = this.table.schema.indexes.map((idx) => idx.name)
      const primKey = this.table.schema.primKey.name
      const bestEntry = whereEntries.find(
        ([k]) => indexes.includes(k) || k === primKey,
      )

      if (bestEntry) {
        usedWhereIndex = true
        const [indexedKey, indexedValue] = bestEntry
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        collection = this.table.where(indexedKey).equals(indexedValue as any)

        // Apply remaining filters in-memory (JS filter)
        const remaining = whereEntries.filter(([k]) => k !== indexedKey)
        if (remaining.length > 0) {
          collection = collection.filter((item: T) => {
            return remaining.every(
              ([k, v]) => (item as Record<string, unknown>)[k] === v,
            )
          })
        }
      }
    }

    // 2. If no indexed WHERE clause, try to use orderBy index, or fallback to full table
    if (!collection) {
      if (opts?.orderBy !== undefined) {
        // Use orderBy index to avoid in-memory sorting later
        const orderCol = this.table.orderBy(opts.orderBy as string)
        collection = opts?.orderDir === 'desc' ? orderCol.reverse() : orderCol

        // Apply all filters in-memory (full table scan if no WHERE index used!)
        if (whereEntries.length > 0) {
          collection = collection.filter((item: T) => {
            return whereEntries.every(
              ([k, v]) => (item as Record<string, unknown>)[k] === v,
            )
          })
        }
      } else {
        // Complete full table scan fallback
        collection = this.table.toCollection()
        if (whereEntries.length > 0) {
          collection = collection.filter((item: T) => {
            return whereEntries.every(
              ([k, v]) => (item as Record<string, unknown>)[k] === v,
            )
          })
        }
      }
    }

    // 3. Fetch results
    let result = await collection.toArray()

    // 4. In-memory sorting (needed if we used an indexed WHERE clause but also requested orderBy)
    if (opts?.orderBy !== undefined && usedWhereIndex) {
      // We used a WHERE index, so the results are NOT ordered by opts.orderBy yet. Sort them manually.
      const orderCol = opts.orderBy as keyof T
      const dir = opts.orderDir === 'desc' ? -1 : 1
      result.sort((a, b) => {
        const valA = a[orderCol]
        const valB = b[orderCol]
        if (valA < valB) return -1 * dir
        if (valA > valB) return 1 * dir
        return 0
      })
    }

    // 5. Apply offset and limit in-memory
    if (opts?.offset !== undefined) {
      result = result.slice(opts.offset)
    }
    if (opts?.limit !== undefined) {
      result = result.slice(0, opts.limit)
    }

    return result
    } catch (err) {
      console.warn(
        `[DexieAdapter] findAll failed for "${this.table.name}":`,
        err,
      )
      return []
    }
  }

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString()
    const full = {
      ...entity,
      id: window.crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as unknown as T
    await this.table.add(full)
    return full
  }

  async update(
    id: string,
    patch: Partial<Omit<T, 'id' | 'createdAt'>>,
  ): Promise<T> {
    const existing = await this.table.get(id)
    if (!existing) {
      throw new Error(`Entity not found in ${this.table.name}: ${id}`)
    }
    const now = new Date().toISOString()
    const updated = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: now,
    } as T
    await this.table.put(updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id)
  }

  async count(opts?: QueryOptions<T>): Promise<number> {
    if (opts?.where) {
      const results = await this.findAll(opts)
      return results.length
    }
    return this.table.count()
  }
}

// ── DexieAdapter ────────────────────────────────────────────────

export class DexieAdapter implements DatabaseAdapter {
  readonly schemaVersion = 1
  private db: DexieDatabase
  private repositories = new Map<string, Repository<DbEntity>>()

  constructor() {
    this.db = new DexieDatabase()
    // Pre-warm all repositories
    for (const name of Object.keys(STORE_SCHEMAS)) {
      this.getRepository(name)
    }
  }

  getRepository<T extends DbEntity>(entityName: string): Repository<T> {
    const existing = this.repositories.get(entityName)
    if (existing) return existing as Repository<T>

    // Access the table dynamically — Dexie tables are available
    // on the instance by name after the schema is defined.
    const table = this.db.table<T, string>(entityName)
    const repo = new DexieRepository<T>(table)
    this.repositories.set(entityName, repo as Repository<DbEntity>)
    return repo
  }

  async transaction<R>(fn: (db: DatabaseAdapter) => Promise<R>): Promise<R> {
    return this.db.transaction('rw', this.db.tables, async () => {
      return fn(this)
    })
  }

  async destroy(): Promise<void> {
    this.repositories.clear()
    await this.db.delete()
  }
}

// Type re-exports for convenience
export type { DexieDatabase, DexieRepository }
