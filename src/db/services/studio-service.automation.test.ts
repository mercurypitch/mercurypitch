// Studio persistence tests for lane lines — a saved song opens with its volume and pan lines as drawn.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { withStudioAutomation } from '@/lib/studio/model/automation'
import { studioArrangementFixture, studioAssetFixture } from './studio.fixture'
import { createStudioService } from './studio-service'

describe('local Studio persistence of lane lines', () => {
  let db: DexieAdapter
  let service: ReturnType<typeof createStudioService>
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
    db = new DexieAdapter()
    let nextId = 0
    service = createStudioService({
      database: () => db,
      now: () => new Date('2026-11-03T12:00:00.000Z'),
      createId: () => `new-${++nextId}`,
    })
  })
  afterEach(async () => {
    await db.destroy()
    vi.unstubAllGlobals()
  })

  it('opens a saved song with its lane lines as they were drawn', async () => {
    // Arrange
    const empty = await service.createProject('Lines')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const data = await studioAssetFixture(empty.id)
    const arranged = studioArrangementFixture(empty)
    const drawn = {
      ...arranged,
      tracks: [
        withStudioAutomation(
          withStudioAutomation(arranged.tracks[0], 'volume', [
            { frame: 96000, value: -24 },
            { frame: 144000, value: 3 },
          ]),
          'pan',
          [{ frame: 0, value: -0.5 }],
        ),
      ],
    }

    // Act
    await service.saveProject(drawn, { ...lease, expectedRevision: 0 }, [data])
    const opened = await service.loadProject(empty.id)

    // Assert
    expect(opened.tracks[0].automation).toEqual({
      volume: [
        { frame: 96000, value: -24 },
        { frame: 144000, value: 3 },
      ],
      pan: [{ frame: 0, value: -0.5 }],
    })
  })
})
