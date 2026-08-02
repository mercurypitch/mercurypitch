// ============================================================
// Hybrid Adapter Tests — cloud/local entity routing
// ============================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { CLOUD_ENTITIES, HybridAdapter } from '@/db/adapters/hybrid-adapter'
import type { DatabaseAdapter, DbEntity, Repository } from '@/db/types'

function stubAdapter(): DatabaseAdapter & { seen: string[] } {
  const seen: string[] = []
  const adapter: DatabaseAdapter & { seen: string[] } = {
    seen,
    schemaVersion: 1,
    getRepository<T extends DbEntity>(entityName: string): Repository<T> {
      seen.push(entityName)
      return {} as Repository<T>
    },
    transaction: vi.fn(async (fn) => fn(adapter)),
    destroy: vi.fn(async () => undefined),
  }
  return adapter
}

describe('HybridAdapter', () => {
  it('routes cloud entities to the cloud adapter', () => {
    const cloud = stubAdapter()
    const local = stubAdapter()
    const hybrid = new HybridAdapter(cloud, local)

    for (const entity of CLOUD_ENTITIES) {
      hybrid.getRepository(entity)
    }
    expect(cloud.seen).toEqual([...CLOUD_ENTITIES])
    expect(local.seen).toEqual([])
  })

  it('routes karaoke/UVR and library entities to the local adapter', () => {
    const cloud = stubAdapter()
    const local = stubAdapter()
    const hybrid = new HybridAdapter(cloud, local)

    const localEntities = [
      'uvrSessions',
      'uvrStemBlobs',
      'uvrStemFingerprints',
      'uvrSessionLyrics',
      'offlinePitchAnalysis',
      'whisperTranscriptions',
      'sessionGroups',
      'melodyRecords',
      'sessionTemplates',
      'playlistRecords',
      // The worker's TABLES allowlist no longer exposes this entity (the
      // leaderboard is server-derived from sessionRecords) — it must stay
      // local-only or every access silently 404s against the cloud worker.
      'leaderboardEntries',
    ]
    for (const entity of localEntities) {
      hybrid.getRepository(entity)
    }
    expect(local.seen).toEqual(localEntities)
    expect(cloud.seen).toEqual([])
  })

  it('does not route leaderboardEntries to the cloud', () => {
    expect(CLOUD_ENTITIES.has('leaderboardEntries')).toBe(false)
  })

  it('delegates local-only transactions to the local adapter', async () => {
    const cloud = stubAdapter()
    const local = stubAdapter()
    const hybrid = new HybridAdapter(cloud, local)
    const operation = vi.fn(async () => 'saved')

    await expect(hybrid.transactionLocal(operation)).resolves.toBe('saved')
    expect(local.transaction).toHaveBeenCalledOnce()
    expect(cloud.transaction).not.toHaveBeenCalled()
    expect(operation).toHaveBeenCalledWith(local)
  })

  it('destroys both adapters', async () => {
    const cloud = stubAdapter()
    const local = stubAdapter()
    await new HybridAdapter(cloud, local).destroy()
    expect(cloud.destroy).toHaveBeenCalledOnce()
    expect(local.destroy).toHaveBeenCalledOnce()
  })

  describe('signed-out guard for user-scoped entities', () => {
    function trackingAdapter(): DatabaseAdapter & { calls: string[] } {
      const calls: string[] = []
      const repo: Repository<DbEntity> = {
        findById: async (id) => {
          calls.push(`findById:${id}`)
          return { id, createdAt: '', updatedAt: '' }
        },
        findAll: async () => {
          calls.push('findAll')
          return [{ id: 'r1', createdAt: '', updatedAt: '' }]
        },
        count: async () => {
          calls.push('count')
          return 1
        },
        create: async (e) => {
          calls.push('create')
          return { ...e, id: 'new', createdAt: '', updatedAt: '' } as DbEntity
        },
        update: async (id) => {
          calls.push('update')
          return { id, createdAt: '', updatedAt: '' }
        },
        delete: async () => {
          calls.push('delete')
        },
      }
      const adapter: DatabaseAdapter & { calls: string[] } = {
        calls,
        schemaVersion: 1,
        getRepository: <T extends DbEntity>() => repo as Repository<T>,
        transaction: vi.fn(async (fn) => fn(adapter)),
        destroy: vi.fn(async () => undefined),
      }
      return adapter
    }

    it('resolves reads empty without network when signed out', async () => {
      const cloud = trackingAdapter()
      const hybrid = new HybridAdapter(cloud, stubAdapter(), () => false)
      const repo = hybrid.getRepository('challengeProgress')

      expect(await repo.findAll()).toEqual([])
      expect(await repo.findById('x')).toBeNull()
      expect(await repo.count()).toBe(0)
      expect(cloud.calls).toEqual([])
    })

    it('rejects writes without network when signed out', async () => {
      const cloud = trackingAdapter()
      const hybrid = new HybridAdapter(cloud, stubAdapter(), () => false)
      const repo = hybrid.getRepository('sessionRecords')

      await expect(repo.create({})).rejects.toThrow(/Signed out/)
      await expect(repo.update('x', {})).rejects.toThrow(/Signed out/)
      await expect(repo.delete('x')).rejects.toThrow(/Signed out/)
      expect(cloud.calls).toEqual([])
    })

    it('passes through when signed in', async () => {
      const cloud = trackingAdapter()
      const hybrid = new HybridAdapter(cloud, stubAdapter(), () => true)
      const repo = hybrid.getRepository('challengeProgress')

      expect(await repo.findAll()).toHaveLength(1)
      await repo.create({})
      expect(cloud.calls).toEqual(['findAll', 'create'])
    })

    it('leaves public cloud entities unguarded when signed out', async () => {
      const cloud = trackingAdapter()
      const hybrid = new HybridAdapter(cloud, stubAdapter(), () => false)
      const repo = hybrid.getRepository('challengeDefinitions')

      expect(await repo.findAll()).toHaveLength(1)
      expect(cloud.calls).toEqual(['findAll'])
    })
  })
})

// ── Allowlist drift ──────────────────────────────────────────────
// The bug this guards against shipped silently and stayed hidden for
// weeks: `voiceprints` was exposed by the worker but missing from
// CLOUD_ENTITIES, so every cloud call fell through to a Dexie store that
// does not exist, threw, and was swallowed by a catch meant for network
// failures. The gallery kept rendering from localStorage, so nothing
// looked wrong — while dev D1 held zero rows.
//
// Reading the worker's own source keeps this honest: a future entity
// added on one side only fails here instead of in production.

describe('client/worker allowlist agreement', () => {
  const workerTables = (): Set<string> => {
    // The registry is a plain object literal; parse the top-level keys
    // rather than importing worker code into a browser-env test.
    const src = readFileSync(
      resolve(__dirname, '../../workers/db-worker/src/tables.ts'),
      'utf8',
    )
    const body = src.slice(src.indexOf('export const TABLES'))
    return new Set(
      [...body.matchAll(/^ {2}([a-zA-Z]+): \{/gm)].map((m) => m[1]!),
    )
  }

  it('every cloud entity is actually served by the worker', () => {
    const served = workerTables()
    expect(served.size).toBeGreaterThan(10) // the parse itself still works
    const unserved = [...CLOUD_ENTITIES].filter((e) => !served.has(e))
    expect(unserved).toEqual([])
  })

  it('keeps voiceprints routed to the cloud', () => {
    // Named explicitly: this is the entity the drift actually hit, and a
    // silent removal would look like a passing suite again.
    expect(CLOUD_ENTITIES.has('voiceprints')).toBe(true)
    expect(workerTables().has('voiceprints')).toBe(true)
  })
})
