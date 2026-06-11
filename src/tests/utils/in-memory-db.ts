// ============================================================
// In-Memory DatabaseAdapter — test double for db services
// ============================================================
//
// Implements the full Repository contract (where/orderBy/limit/
// offset) against plain Maps, so services can be tested without
// IndexedDB or a server.

import type { DatabaseAdapter, DbEntity, QueryOptions, Repository, } from '@/db/types'

let idCounter = 0

class InMemoryRepository<T extends DbEntity> implements Repository<T> {
  private rows = new Map<string, T>()

  private applyWhere(items: T[], opts?: QueryOptions<T>): T[] {
    const where = opts?.where
    if (where == null) return items
    return items.filter((item) =>
      Object.entries(where).every(
        ([k, v]) =>
          v === undefined || (item as Record<string, unknown>)[k] === v,
      ),
    )
  }

  async findById(id: string): Promise<T | null> {
    return this.rows.get(id) ?? null
  }

  async findAll(opts?: QueryOptions<T>): Promise<T[]> {
    let items = this.applyWhere([...this.rows.values()], opts)
    if (opts?.orderBy !== undefined) {
      const key = opts.orderBy
      const dir = opts.orderDir === 'desc' ? -1 : 1
      items = [...items].sort((a, b) => {
        const av = a[key]
        const bv = b[key]
        if (av === bv) return 0
        return (av as never) > (bv as never) ? dir : -dir
      })
    }
    const offset = opts?.offset ?? 0
    const limit = opts?.limit
    return limit !== undefined
      ? items.slice(offset, offset + limit)
      : items.slice(offset)
  }

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const now = new Date().toISOString()
    const row = {
      ...entity,
      id: `mem-${++idCounter}`,
      createdAt: now,
      updatedAt: now,
    } as T
    this.rows.set(row.id, row)
    return row
  }

  async update(
    id: string,
    patch: Partial<Omit<T, 'id' | 'createdAt'>>,
  ): Promise<T> {
    const existing = this.rows.get(id)
    if (existing == null) throw new Error(`Not found: ${id}`)
    const updated = {
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    } as T
    this.rows.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id)
  }

  async count(opts?: QueryOptions<T>): Promise<number> {
    return this.applyWhere([...this.rows.values()], opts).length
  }
}

export class InMemoryAdapter implements DatabaseAdapter {
  readonly schemaVersion = 1
  private repositories = new Map<string, Repository<DbEntity>>()

  getRepository<T extends DbEntity>(entityName: string): Repository<T> {
    let repo = this.repositories.get(entityName)
    if (repo == null) {
      repo = new InMemoryRepository<DbEntity>()
      this.repositories.set(entityName, repo)
    }
    return repo as Repository<T>
  }

  async transaction<R>(fn: (db: DatabaseAdapter) => Promise<R>): Promise<R> {
    return fn(this)
  }

  async destroy(): Promise<void> {
    this.repositories.clear()
  }
}
