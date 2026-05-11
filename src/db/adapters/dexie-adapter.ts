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
}

// ── DexieDatabase class ─────────────────────────────────────────

class DexieDatabase extends DexieDB {
  // Dynamic table access — tables are created via schema definition
  // and accessed through the base Dexie.table() method.

  constructor() {
    super('PitchPerfectDB')
    this.version(1).stores(STORE_SCHEMAS)
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
    // Start with a collection
    let collection: DexieDB.Collection<T, string> = this.table.toCollection()

    // Apply where filters
    if (opts?.where) {
      for (const [key, value] of Object.entries(opts.where)) {
        if (value !== undefined) {
          collection = collection.filter(
            (item: T) => (item as Record<string, unknown>)[key] === value,
          )
        }
      }
    }

    // Apply ordering — use orderBy which works with indexes
    if (opts?.orderBy !== undefined) {
      const orderCol = this.table.orderBy(opts.orderBy as string)
      if (opts?.orderDir === 'desc') {
        collection = orderCol.reverse()
      } else {
        collection = orderCol
      }
      // Re-apply filters after ordering (orderBy resets filters)
      if (opts?.where) {
        for (const [key, value] of Object.entries(opts.where)) {
          if (value !== undefined) {
            collection = collection.filter(
              (item: T) => (item as Record<string, unknown>)[key] === value,
            )
          }
        }
      }
    }

    let result = await collection.toArray()

    // Apply offset and limit in-memory
    if (opts?.offset !== undefined) {
      result = result.slice(opts.offset)
    }
    if (opts?.limit !== undefined) {
      result = result.slice(0, opts.limit)
    }

    return result
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
}

// Type re-exports for convenience
export type { DexieDatabase, DexieRepository }
