// Studio backup tests for takes: a clip's every take, playing or not, goes into the backup and comes back from it.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { studioArrangementFixture, studioAssetFixture, } from '@/db/services/studio.fixture'
import { createStudioService } from '@/db/services/studio-service'
import { releaseStudioResource, studioReservedMemoryBytes, } from '@/lib/studio/memory-budget'
import { createStudioBackup, restoreStudioBackup } from './studio-backup'

describe('portable Studio backups of takes', () => {
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
      now: () => new Date('2026-11-21T12:00:00.000Z'),
      createId: () => `backup-${++sequence}`,
    })
  })
  afterEach(async () => {
    for (const resource of resources.splice(0)) releaseStudioResource(resource)
    expect(studioReservedMemoryBytes()).toBe(0)
    await db.destroy()
    vi.unstubAllGlobals()
  })

  it("restores a clip of two takes with both takes' audio, the playing one still playing", async () => {
    // Arrange
    const empty = await service.createProject('Two takes')
    const one = await studioAssetFixture(empty.id)
    const two = await studioAssetFixture(empty.id, 'asset-two', 0.4)
    const base = studioArrangementFixture(empty)
    const project = {
      ...base,
      clips: [
        {
          ...base.clips[0],
          activeTake: 1,
          takes: [
            {
              assetId: 'asset-two',
              offsetFrames: -2,
              gainDb: -4,
              fades: { curve: 'linear-amplitude' as const },
            },
          ],
        },
      ],
    }
    const lease = await service.acquireLease(empty.id, 'tab-one')
    await service.saveProject(project, { ...lease, expectedRevision: 0 }, [
      one,
      two,
    ])
    const archive = await createStudioBackup(
      project,
      (id) => service.readAssetBytes(project.id, id),
      { assetMetadata: [one.asset, two.asset] },
    )
    resources.push(archive)
    await db.destroy()
    db = new DexieAdapter()

    // Act
    const restored = await restoreStudioBackup(archive, service)

    // Assert
    const [clip] = restored.clips
    expect(clip).toMatchObject({
      sourceInFrame: 4,
      activeTake: 1,
      takes: [{ offsetFrames: -2, gainDb: -4 }],
    })
    const owned = (await service.listAssets(restored.id)).map(
      (asset) => asset.id,
    )
    expect(owned).toHaveLength(2)
    expect(owned).toContain(clip.assetId)
    expect(owned).toContain(clip.takes![0].assetId)
  })
})
