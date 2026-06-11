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
})
