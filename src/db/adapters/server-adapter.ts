// ============================================================
// Server / HTTP Adapter
// ============================================================
//
// Backs the DatabaseAdapter interface with a REST API.
// Swap in for production when a backend is available.
//
// Endpoint conventions:
//   GET    /api/<entity>          → findAll
//   GET    /api/<entity>/:id      → findById
//   POST   /api/<entity>          → create
//   PATCH  /api/<entity>/:id      → update
//   DELETE /api/<entity>/:id      → delete
//   GET    /api/<entity>/count    → count

import type { DatabaseAdapter, DbEntity, QueryOptions, Repository, } from '@/db/types'

// ── Config ──────────────────────────────────────────────────────

export interface ServerAdapterConfig {
  baseUrl: string
  /** Static headers, or a getter re-evaluated per request (e.g. auth token). */
  headers?: Record<string, string> | (() => Record<string, string>)
  /**
   * Awaited before every create/update/delete, after which `headers()` is
   * read. Lets the caller provision a cloud identity lazily — the first
   * write is what turns a visitor into a user. Reads deliberately skip it:
   * browsing must never create an account.
   */
  beforeWrite?: () => Promise<unknown>
  /**
   * Current owner of a state-changing request. Captured before `beforeWrite`
   * and checked again immediately before auth headers are read so an account
   * switch cannot send the old operation with the next account's token.
   */
  writeIdentity?: () => string
  /** Observe structured API failures before the adapter consumes their body. */
  onErrorResponse?: (status: number, body: string) => void | Promise<void>
}

// Cloud reads degrade to empty when the backend is unreachable so the app
// always loads (offline-tolerant); warn once instead of spamming the console.
let offlineWarned = false

function warnCloudUnreachable(err: unknown): void {
  if (err instanceof NoIdentityError) return // expected, not a failure
  if (offlineWarned) return
  offlineWarned = true
  console.warn(
    '[db] cloud backend unreachable — serving empty cloud reads so the app ' +
      'still loads. Start the dev worker (pnpm dev:db) or unset ' +
      'VITE_API_BASE_URL for full local mode.',
    err,
  )
}

/**
 * A read of a user-scoped table with no cloud identity yet. Routine since
 * identities are provisioned lazily: a visitor who hasn't written anything
 * simply has no rows. Reads resolve empty and stay silent — only writes
 * provision (see ServerAdapterConfig.beforeWrite).
 */
class NoIdentityError extends Error {
  constructor() {
    super('ServerAdapter: no cloud identity yet')
    this.name = 'NoIdentityError'
  }
}

// ── ServerRepository ────────────────────────────────────────────

class ServerRepository<T extends DbEntity> implements Repository<T> {
  private url: string

  constructor(
    entityName: string,
    private config: ServerAdapterConfig,
  ) {
    this.url = `${config.baseUrl}/api/${entityName}`
  }

  private headers(): Record<string, string> {
    const extra =
      typeof this.config.headers === 'function'
        ? this.config.headers()
        : this.config.headers
    return {
      'Content-Type': 'application/json',
      ...extra,
    }
  }

  private async request<R>(
    path: string,
    init?: RequestInit,
    retries = 2,
    fixedHeaders?: Record<string, string>,
    fixedIdentity?: string,
  ): Promise<R> {
    const url = `${this.url}${path}`
    const expectedIdentity = fixedIdentity ?? this.config.writeIdentity?.()
    const headers = { ...(fixedHeaders ?? this.headers()), ...init?.headers }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { ...init, headers })

        // Retry on 5xx server errors or 429 rate limits
        if ((res.status >= 500 || res.status === 429) && attempt < retries) {
          const delay = Math.pow(2, attempt) * 200 + Math.random() * 100
          await new Promise((r) => setTimeout(r, delay))
          continue
        }

        if (res.status === 401) throw new NoIdentityError()

        if (!res.ok) {
          const body = await res.text().catch(() => '')
          if (
            expectedIdentity === undefined ||
            this.config.writeIdentity?.() === expectedIdentity
          ) {
            await this.config.onErrorResponse?.(res.status, body)
          }
          throw new Error(
            `ServerAdapter: ${res.status} ${res.statusText} on ${url}${body ? ` — ${body}` : ''}`,
          )
        }

        // 204 No Content for delete
        if (res.status === 204) return undefined as R
        return res.json() as Promise<R>
      } catch (err) {
        if (attempt < retries && err instanceof TypeError) {
          // Network error (offline, DNS failure) — retry
          const delay = Math.pow(2, attempt) * 200 + Math.random() * 100
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        throw err
      }
    }

    throw new Error(
      `ServerAdapter: request failed after ${retries + 1} attempts`,
    )
  }

  private async prepareWrite(): Promise<{
    headers: Record<string, string>
    identity?: string
  }> {
    const expectedIdentity = this.config.writeIdentity?.()
    await this.config.beforeWrite?.()
    if (
      expectedIdentity !== undefined &&
      this.config.writeIdentity?.() !== expectedIdentity
    ) {
      throw new Error('ServerAdapter: write identity changed before dispatch')
    }
    // Freeze the credential in the same continuation as the identity check.
    // A later account switch cannot replace it while the caller resumes or a
    // network retry waits; this operation remains owned by its initiator.
    return { headers: this.headers(), identity: expectedIdentity }
  }

  async findById(id: string): Promise<T | null> {
    try {
      return await this.request<T>(`/${encodeURIComponent(id)}`)
    } catch (err) {
      warnCloudUnreachable(err)
      return null
    }
  }

  async findAll(opts?: QueryOptions<T>): Promise<T[]> {
    const params = new URLSearchParams()
    if (opts?.where) {
      for (const [k, v] of Object.entries(opts.where)) {
        if (v !== undefined) params.set(`where[${k}]`, String(v))
      }
    }
    if (opts?.orderBy !== undefined) {
      params.set('orderBy', String(opts.orderBy))
      if (opts.orderDir) params.set('orderDir', opts.orderDir)
    }
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit))
    if (opts?.offset !== undefined) params.set('offset', String(opts.offset))
    const qs = params.toString()
    try {
      return await this.request<T[]>(qs ? `?${qs}` : '')
    } catch (err) {
      warnCloudUnreachable(err)
      if (opts?.throwOnError === true) throw err
      return []
    }
  }

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const prepared = await this.prepareWrite()
    return this.request<T>(
      '',
      {
        method: 'POST',
        body: JSON.stringify(entity),
      },
      2,
      prepared.headers,
      prepared.identity,
    )
  }

  async update(
    id: string,
    patch: Partial<Omit<T, 'id' | 'createdAt'>>,
  ): Promise<T> {
    const prepared = await this.prepareWrite()
    return this.request<T>(
      `/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
      2,
      prepared.headers,
      prepared.identity,
    )
  }

  async delete(id: string): Promise<void> {
    const prepared = await this.prepareWrite()
    await this.request(
      `/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
      2,
      prepared.headers,
      prepared.identity,
    )
  }

  async count(opts?: QueryOptions<T>): Promise<number> {
    const params = new URLSearchParams()
    if (opts?.where) {
      for (const [k, v] of Object.entries(opts.where)) {
        if (v !== undefined) params.set(`where[${k}]`, String(v))
      }
    }
    const qs = params.toString()
    try {
      const result = await this.request<{ count: number }>(
        `/count${qs ? `?${qs}` : ''}`,
      )
      return result.count
    } catch (err) {
      warnCloudUnreachable(err)
      if (opts?.throwOnError === true) throw err
      return 0
    }
  }
}

// ── ServerAdapter ───────────────────────────────────────────────

export class ServerAdapter implements DatabaseAdapter {
  readonly schemaVersion = 1
  private repositories = new Map<string, Repository<DbEntity>>()

  constructor(private config: ServerAdapterConfig) {}

  getRepository<T extends DbEntity>(entityName: string): Repository<T> {
    const existing = this.repositories.get(entityName)
    if (existing) return existing as Repository<T>

    const repo = new ServerRepository<T>(entityName, this.config)
    this.repositories.set(entityName, repo as Repository<DbEntity>)
    return repo
  }

  async transaction<R>(fn: (db: DatabaseAdapter) => Promise<R>): Promise<R> {
    // Server adapter has no true transaction support —
    // the server handles atomicity per-endpoint.
    return fn(this)
  }

  async destroy(): Promise<void> {
    this.repositories.clear()
  }
}
