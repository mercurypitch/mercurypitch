// Studio take journal — a take recorded into the journal reads back up to its last whole row, survives a reopen, and goes with its project.
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import { createStudioService } from './studio-service'
import { STUDIO_STORES } from './studio-storage-types'
import { createStudioTakeJournal } from './studio-take-journal'

const header = {
  id: 'take-1',
  trackId: 'lane-1',
  title: 'Take 1',
  sampleRate: 48000,
  fromFrame: 96000,
  heardFirst: 88000,
}

const pcm = (from: number, count: number) =>
  Int16Array.from({ length: count }, (_, i) => (from + i) % 30000)

describe('Studio take journal', () => {
  let db: DexieAdapter
  let clock: number
  const journal = () =>
    createStudioTakeJournal({
      database: () => db,
      now: () => new Date(clock),
    })

  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto)
    clock = Date.parse('2026-11-01T12:00:00.000Z')
    db = new DexieAdapter()
  })
  afterEach(async () => {
    await db.destroy()
    vi.unstubAllGlobals()
  })

  it('reads a take back whole, in order, after the database reopens', async () => {
    const writer = journal().writer('song-1')
    await writer.begin(header)
    await writer.append('take-1', 0, 0, pcm(0, 48000))
    await writer.append('take-1', 1, 48000, pcm(48000, 1000))
    await writer.place('take-1', 87000)
    db.close()
    db = new DexieAdapter()

    const [listed] = await journal().list('song-1')
    expect(listed).toMatchObject({
      ...header,
      heardFirst: 87000,
      projectId: 'song-1',
      frames: 49000,
    })
    const read = await journal().read('take-1')
    expect(read?.pcm).toEqual(pcm(0, 49000))
  })

  it('keeps everything before a missing row and nothing after it', async () => {
    const writer = journal().writer('song-1')
    await writer.begin(header)
    await writer.append('take-1', 0, 0, pcm(0, 100))
    await writer.append('take-1', 2, 300, pcm(300, 100))

    const read = await journal().read('take-1')

    expect(read?.pcm).toEqual(pcm(0, 100))
  })

  it('lists only the takes of the song asked about, and forgets a discarded one', async () => {
    const writer = journal().writer('song-1')
    await writer.begin(header)
    await writer.append('take-1', 0, 0, pcm(0, 10))
    await journal()
      .writer('song-2')
      .begin({ ...header, id: 'take-2' })

    expect((await journal().list('song-1')).map((take) => take.id)).toEqual([
      'take-1',
    ])
    await writer.discard('take-1')

    expect(await journal().list('song-1')).toEqual([])
    expect(await journal().read('take-1')).toBeNull()
    expect(await db.readAllStrict(STUDIO_STORES.takeChunks)).toEqual([])
  })

  it('goes with its project when the project is deleted', async () => {
    const service = createStudioService({
      database: () => db,
      now: () => new Date(clock),
      createId: () => 'song-1',
    })
    const project = await service.createProject('Demo')
    const lease = await service.acquireLease(project.id, 'tab-one')
    const writer = journal().writer(project.id)
    await writer.begin(header)
    await writer.append('take-1', 0, 0, pcm(0, 10))

    await service.deleteProject(project.id, { ...lease, expectedRevision: 0 })

    expect(await db.readAllStrict(STUDIO_STORES.takes)).toEqual([])
    expect(await db.readAllStrict(STUDIO_STORES.takeChunks)).toEqual([])
  })
})
