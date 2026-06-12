// ============================================================
// Hybrid Adapter Tests — cloud/local entity routing
// ============================================================

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
    ]
    for (const entity of localEntities) {
      hybrid.getRepository(entity)
    }
    expect(local.seen).toEqual(localEntities)
    expect(cloud.seen).toEqual([])
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
