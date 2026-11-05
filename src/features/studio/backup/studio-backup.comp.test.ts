// Studio backup tests for comps — a backed-up loop take restores with the pass each stretch plays.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { studioArrangementFixture, studioAssetFixture, } from '@/db/services/studio.fixture'
import { createStudioService } from '@/db/services/studio-service'
import { releaseStudioResource, studioReservedMemoryBytes, } from '@/lib/studio/memory-budget'
import { createStudioBackup, restoreStudioBackup } from './studio-backup'

describe('portable Studio backups of comps', () => {
  const resources: object[] = []
  let db: DexieAdapter
  let service: ReturnType<typeof createStudioService>
  let sequence: number
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
    db = new DexieAdapter()
    sequence = 0
    service = createStudioService({
      database: () => db,
      now: () => new Date('2026-11-04T12:00:00.000Z'),
      createId: () => `backup-${++sequence}`,
    })
  })
  afterEach(async () => {
    for (const resource of resources.splice(0)) releaseStudioResource(resource)
    expect(studioReservedMemoryBytes()).toBe(0)
    await db.destroy()
    vi.unstubAllGlobals()
  })

  it('restores a comped loop take with every stretch on its pass', async () => {
    // Arrange
    const empty = await service.createProject('Comped song')
    const one = await studioAssetFixture(empty.id)
    const base = studioArrangementFixture(empty)
    const passes = { firstFrame: 4, frames: 20, count: 3 }
    const comp = [
      { fromSourceFrame: 24, toSourceFrame: 33, pass: 2 },
      { fromSourceFrame: 33, toSourceFrame: 44, pass: 0 },
    ]
    const project = {
      ...base,
      clips: [
        {
          ...base.clips[0],
          sourceInFrame: 24,
          sourceOutFrame: 44,
          fades: { curve: 'linear-amplitude' as const },
          passes,
          comp,
        },
      ],
    }
    const lease = await service.acquireLease(empty.id, 'tab-one')
    await service.saveProject(project, { ...lease, expectedRevision: 0 }, [one])
    const archive = await createStudioBackup(
      project,
      (id) => service.readAssetBytes(project.id, id),
      { assetMetadata: [one.asset] },
    )
    resources.push(archive)
    await db.destroy()
    db = new DexieAdapter()

    // Act
    const restored = await restoreStudioBackup(archive, service)

    // Assert
    expect(restored.clips[0]).toMatchObject({
      sourceInFrame: 24,
      sourceOutFrame: 44,
      passes,
      comp,
    })
  })
})
