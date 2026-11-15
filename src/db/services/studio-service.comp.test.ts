// Studio persistence tests for comps — a saved loop take opens with the pass each stretch plays, as it was comped; a stored version 2 song reads back as it was stored, and a copy keeps the comp.
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import type { StudioProject } from '@/lib/studio/model/types'
import { studioArrangementFixture, studioAssetFixture } from './studio.fixture'
import type { StudioProjectSnapshotRecord } from './studio-records'
import { createStudioService } from './studio-service'
import { STUDIO_STORES } from './studio-storage-types'

/** The fixture's 64 frames as three 20-frame passes, the clip heard on the middle one. */
const PASSES = { firstFrame: 4, frames: 20, count: 3 }
const COMP = [
  { fromSourceFrame: 24, toSourceFrame: 30, pass: 0 },
  { fromSourceFrame: 30, toSourceFrame: 41, pass: 2 },
  { fromSourceFrame: 41, toSourceFrame: 44, pass: 1 },
]

/** The arrangement fixture with its clip a loop take on the middle pass, playing COMP. */
function compedArrangement(project: StudioProject): StudioProject {
  const base = studioArrangementFixture(project)
  return {
    ...base,
    clips: [
      {
        ...base.clips[0],
        sourceInFrame: 24,
        sourceOutFrame: 44,
        fades: { curve: 'linear-amplitude' },
        passes: PASSES,
        comp: COMP,
      },
    ],
  }
}

describe('local Studio persistence of comps', () => {
  let db: DexieAdapter
  let service: ReturnType<typeof createStudioService>
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
    db = new DexieAdapter()
    let nextId = 0
    service = createStudioService({
      database: () => db,
      now: () => new Date('2026-11-04T12:00:00.000Z'),
      createId: () => `new-${++nextId}`,
    })
  })
  afterEach(async () => {
    await db.destroy()
    vi.unstubAllGlobals()
  })

  it('opens a saved loop take with its comp as it was swiped', async () => {
    // Arrange
    const empty = await service.createProject('Comped')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const data = await studioAssetFixture(empty.id)
    const base = studioArrangementFixture(empty)
    const comped = {
      ...base,
      clips: [
        {
          ...base.clips[0],
          sourceInFrame: 24,
          sourceOutFrame: 44,
          fades: { curve: 'linear-amplitude' as const },
          passes: PASSES,
          comp: COMP,
        },
      ],
    }

    // Act
    await service.saveProject(comped, { ...lease, expectedRevision: 0 }, [data])
    const opened = await service.loadProject(empty.id)

    // Assert
    expect(opened.clips[0]).toMatchObject({
      sourceInFrame: 24,
      sourceOutFrame: 44,
      passes: PASSES,
      comp: COMP,
    })
  })

  it('reads a version 2 song back with its comp exactly as stored, keeping no earlier record, and copies it', async () => {
    // Arrange
    const empty = await service.createProject('Comped')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    await service.saveProject(
      compedArrangement(empty),
      { ...lease, expectedRevision: 0 },
      [await studioAssetFixture(empty.id)],
    )
    const stored = await db.readByIdStrict<StudioProject>(
      STUDIO_STORES.projects,
      empty.id,
    )

    // Act
    const opened = await service.loadProject(empty.id)
    const copy = await service.forkProject(opened)

    // Assert: the read migrated nothing, so it kept no snapshot either.
    expect(stored?.schemaVersion).toBe(2)
    expect(stored?.clips[0].comp).toEqual(COMP)
    expect(opened).toEqual(stored)
    expect(await db.readAllStrict(STUDIO_STORES.snapshots)).toEqual([])
    expect(copy.clips[0].id).not.toBe(opened.clips[0].id)
    expect(copy.clips[0].comp).toEqual(COMP)
    expect(await service.loadProject(copy.id)).toEqual(copy)
  })

  it('steps a version 1 song that holds a comp up to version 2 with its comp', async () => {
    // Arrange: only a comping build from before version 2 stored one.
    const empty = await service.createProject('Comped early')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const saved = await service.saveProject(
      compedArrangement(empty),
      { ...lease, expectedRevision: 0 },
      [await studioAssetFixture(empty.id)],
    )
    const record = { ...saved, schemaVersion: 1 }
    await db.putStrict(STUDIO_STORES.projects, record)

    // Act
    const opened = await service.loadProject(empty.id)

    // Assert
    expect(opened).toEqual(saved)
    expect(
      await db.readAllStrict<StudioProjectSnapshotRecord>(
        STUDIO_STORES.snapshots,
      ),
    ).toMatchObject([
      { schemaVersion: 1, project: { clips: [{ comp: COMP }] } },
    ])
  })

  it('refuses to save a comp with a gap in it', async () => {
    const empty = await service.createProject('Gap')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const data = await studioAssetFixture(empty.id)
    const base = studioArrangementFixture(empty)
    const gapped = {
      ...base,
      clips: [
        {
          ...base.clips[0],
          sourceInFrame: 24,
          sourceOutFrame: 44,
          fades: { curve: 'linear-amplitude' as const },
          passes: PASSES,
          comp: [COMP[0], { ...COMP[1], fromSourceFrame: 31 }, COMP[2]],
        },
      ],
    }

    await expect(
      service.saveProject(gapped, { ...lease, expectedRevision: 0 }, [data]),
    ).rejects.toThrow('The project contains unsupported or invalid data.')
    expect((await service.loadProject(empty.id)).clips).toEqual([])
  })
})
