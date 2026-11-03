// Studio backup tests for lane lines — a restored song keeps each lane's volume and pan lines on that lane.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { studioArrangementFixture, studioAssetFixture, } from '@/db/services/studio.fixture'
import { createStudioService } from '@/db/services/studio-service'
import { releaseStudioResource, studioReservedMemoryBytes, } from '@/lib/studio/memory-budget'
import { withStudioAutomation } from '@/lib/studio/model/automation'
import { createStudioBackup, restoreStudioBackup } from './studio-backup'

describe('portable Studio backups of lane lines', () => {
  let db: DexieAdapter
  let service: ReturnType<typeof createStudioService>
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
    db = new DexieAdapter()
    let sequence = 0
    service = createStudioService({
      database: () => db,
      now: () => new Date('2026-11-03T12:00:00.000Z'),
      createId: () => `backup-${++sequence}`,
    })
  })
  afterEach(async () => {
    expect(studioReservedMemoryBytes()).toBe(0)
    await db.destroy()
    vi.unstubAllGlobals()
  })

  it('restores each lane with its lines under the lane new identity', async () => {
    // Arrange
    const empty = await service.createProject('Lines to keep')
    const data = await studioAssetFixture(empty.id)
    const arranged = studioArrangementFixture(empty)
    const line = [
      { frame: 0, value: 1 },
      { frame: 48000, value: -1 },
    ]
    const project = {
      ...arranged,
      tracks: [withStudioAutomation(arranged.tracks[0], 'pan', line)],
    }
    const lease = await service.acquireLease(empty.id, 'tab-one')
    await service.saveProject(project, { ...lease, expectedRevision: 0 }, [
      data,
    ])
    const archive = await createStudioBackup(
      project,
      (id) => service.readAssetBytes(project.id, id),
      { assetMetadata: [data.asset] },
    )
    await db.destroy()
    db = new DexieAdapter()

    // Act
    const restored = await restoreStudioBackup(archive, service)
    releaseStudioResource(archive)

    // Assert
    expect(restored.tracks[0].id).not.toBe(project.tracks[0].id)
    expect(restored.tracks[0].automation).toEqual({ pan: line })
    expect(await service.loadProject(restored.id)).toEqual(restored)
  })
})
