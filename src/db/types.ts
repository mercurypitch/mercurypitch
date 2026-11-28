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
  where?: Partial<T> & { [key: string]: unknown }
  orderBy?: keyof T
  orderDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
  /** Opt out of repository empty-result fallbacks for audited reads. */
  throwOnError?: boolean
  /**
   * A person asked for this read just now (Try again). On the server it goes
   * even while the API is out of reach, as their press (api-fetch.ts); its
   * retries stay retries. Never set it on a read a screen makes by itself.
   */
  userAction?: boolean
}

/** How a write goes. */
export interface WriteOptions {
  /**
   * A person pressed for this write just now (Unpublish, the leaderboard
   * listing). On the server it goes even while the API is out of reach, as
   * their press (api-fetch.ts), and so does the identity it provisions; its
   * retries stay retries. Never set it on a write the app makes by itself:
   * a sync, a grant flush, a practice run's record.
   */
  userAction?: boolean
}

/** Generic CRUD repository for one entity type. */
export interface Repository<T extends DbEntity> {
  /** `opts.userAction`: as on QueryOptions. */
  findById(
    id: string,
    opts?: Pick<QueryOptions<T>, 'userAction'>,
  ): Promise<T | null>
  findAll(opts?: QueryOptions<T>): Promise<T[]>
  create(
    entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    opts?: WriteOptions,
  ): Promise<T>
  update(
    id: string,
    patch: Partial<Omit<T, 'id' | 'createdAt'>>,
    opts?: WriteOptions,
  ): Promise<T>
  delete(id: string, opts?: WriteOptions): Promise<void>
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

  /**
   * Close any open connection without deleting anything. deleteDatabase
   * blocks for as long as a connection is open, so a reset has to be able
   * to let go first. Optional: the server adapter holds nothing open.
   */
  close?(): void
}
