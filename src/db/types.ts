// ============================================================
// Database Abstraction Layer — Core Types
// ============================================================

/** Every persisted entity carries these fields. */
export interface DbEntity {
  id: string
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

/** Query options for findAll and count. */
export interface QueryOptions<T> {
  where?: Partial<T>
  orderBy?: keyof T
  orderDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/** Generic CRUD repository for one entity type. */
export interface Repository<T extends DbEntity> {
  findById(id: string): Promise<T | null>
  findAll(opts?: QueryOptions<T>): Promise<T[]>
  create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>
  update(id: string, patch: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>
  delete(id: string): Promise<void>
  count(opts?: QueryOptions<T>): Promise<number>
}

/** Top-level database handle passed to app init. */
export interface DatabaseAdapter {
  /** Return a typed repository for the given entity. */
  getRepository<T extends DbEntity>(entityName: string): Repository<T>

  /** Bulk operations for sync/import scenarios. */
  transaction<R>(fn: (db: DatabaseAdapter) => Promise<R>): Promise<R>

  /** Schema version — adapters use this for migrations. */
  readonly schemaVersion: number

  /** Delete the entire database. Used for factory reset. */
  destroy(): Promise<void>
}
