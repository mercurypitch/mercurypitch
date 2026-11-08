// Studio take notes store tests — a take's notes read back by its id after the database reopens, a take with none reads none, and its notes go with its song.
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { createStudioService } from './studio-service'
import { STUDIO_STORES } from './studio-storage-types'
import { createStudioTakeNotesStore } from './studio-take-notes'

const notes = [
  { midi: 60, velocity: 100, startFrame: 96_000, endFrame: 108_000 },
  { midi: 64, velocity: 90, startFrame: 100_000, endFrame: 110_000 },
]

describe('Studio take notes store', () => {
  let db: DexieAdapter
  const store = () =>
    createStudioTakeNotesStore({
      database: () => db,
      now: () => new Date('2026-11-08T12:00:00.000Z'),
    })

  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto)
    db = new DexieAdapter()
  })
  afterEach(async () => {
    await db.destroy()
    vi.unstubAllGlobals()
  })

  it("reads a take's notes back by its id after the database reopens, and none for a take without", async () => {
    // Arrange
    await store().keep('song-1', 'take-1', notes)
    db.close()
    db = new DexieAdapter()

    // Act
    const read = await store().read('take-1')
    const none = await store().read('take-2')

    // Assert
    expect(read).toEqual(notes)
    expect(none).toEqual([])
  })

  it('goes with its song when the song is deleted', async () => {
    // Arrange
    const service = createStudioService({
      database: () => db,
      now: () => new Date('2026-11-08T12:00:00.000Z'),
      createId: () => 'song-1',
    })
    const project = await service.createProject('Demo')
    const lease = await service.acquireLease(project.id, 'tab-one')
    await store().keep(project.id, 'take-1', notes)

    // Act
    await service.deleteProject(project.id, { ...lease, expectedRevision: 0 })

    // Assert
    expect(await db.readAllStrict(STUDIO_STORES.notes)).toEqual([])
  })
})
