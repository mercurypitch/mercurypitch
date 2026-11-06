// Studio persistence tests for lane instruments — a saved song opens with the instrument the singer picked, and a lane nobody picked for saves none.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { studioArrangementFixture, studioAssetFixture } from './studio.fixture'
import { createStudioService } from './studio-service'

describe('local Studio persistence of lane instruments', () => {
  let db: DexieAdapter
  let service: ReturnType<typeof createStudioService>
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
    db = new DexieAdapter()
    let nextId = 0
    service = createStudioService({
      database: () => db,
      now: () => new Date('2026-11-06T12:00:00.000Z'),
      createId: () => `new-${++nextId}`,
    })
  })
  afterEach(async () => {
    await db.destroy()
    vi.unstubAllGlobals()
  })

  it('opens a saved song with the instrument the singer picked', async () => {
    // Arrange
    const empty = await service.createProject('Horns')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const data = await studioAssetFixture(empty.id)
    const arranged = studioArrangementFixture(empty)
    const picked = {
      ...arranged,
      tracks: [{ ...arranged.tracks[0], instrument: 'french-horn' }],
    }

    // Act
    await service.saveProject(picked, { ...lease, expectedRevision: 0 }, [data])
    const opened = await service.loadProject(empty.id)

    // Assert
    expect(opened.tracks[0].instrument).toBe('french-horn')
  })

  it('saves no instrument for a lane nobody picked one for', async () => {
    // Arrange
    const empty = await service.createProject('Untouched')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const data = await studioAssetFixture(empty.id)

    // Act
    await service.saveProject(
      studioArrangementFixture(empty),
      { ...lease, expectedRevision: 0 },
      [data],
    )
    const opened = await service.loadProject(empty.id)

    // Assert
    expect(Object.hasOwn(opened.tracks[0], 'instrument')).toBe(false)
  })
})
