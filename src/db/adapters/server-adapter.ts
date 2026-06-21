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
  ): Promise<R> {
    const url = `${this.url}${path}`
    const headers = { ...this.headers(), ...init?.headers }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { ...init, headers })

        // Retry on 5xx server errors or 429 rate limits
        if ((res.status >= 500 || res.status === 429) && attempt < retries) {
          const delay = Math.pow(2, attempt) * 200 + Math.random() * 100
          await new Promise((r) => setTimeout(r, delay))
          continue
        }

        if (!res.ok) {
          const body = await res.text().catch(() => '')
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

  async findById(id: string): Promise<T | null> {
    try {
      return await this.request<T>(`/${encodeURIComponent(id)}`)
    } catch {
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
    return this.request<T[]>(qs ? `?${qs}` : '')
  }

  async create(entity: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    return this.request<T>('', {
      method: 'POST',
      body: JSON.stringify(entity),
    })
  }

  async update(
    id: string,
    patch: Partial<Omit<T, 'id' | 'createdAt'>>,
  ): Promise<T> {
    return this.request<T>(`/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    })
  }

  async delete(id: string): Promise<void> {
    await this.request(`/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  }

  async count(opts?: QueryOptions<T>): Promise<number> {
    const params = new URLSearchParams()
    if (opts?.where) {
      for (const [k, v] of Object.entries(opts.where)) {
        if (v !== undefined) params.set(`where[${k}]`, String(v))
      }
    }
    const qs = params.toString()
    const result = await this.request<{ count: number }>(
      `/count${qs ? `?${qs}` : ''}`,
    )
    return result.count
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
