// Studio persistence tests for the song document's versions and MIDI — a song stored at version 1 opens at version 2 with its record kept first, once, and deleted with the song; a newer song is refused in plain words and left as it was; a MIDI clip saves, copies and restores with its sequence, and a sequence no clip names is dropped as the song opens; and a version 15 browser loses its take notes store, not its songs.
import { Dexie } from 'dexie'
import { Blob as NodeBlob } from 'node:buffer'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter, MERCURY_PITCH_DB_NAME, } from '@/db/adapters/dexie-adapter'
import { createStudioProject } from '@/lib/studio/model/defaults'
import type { StudioProject, StudioSequence } from '@/lib/studio/model/types'
import { studioArrangementFixture, studioAssetFixture } from './studio.fixture'
import type { StudioProjectSnapshotRecord } from './studio-records'
import { createStudioService } from './studio-service'
import { STUDIO_STORES } from './studio-storage-types'

/** One note over the fixture take's 64 frames, at 120 bpm: 3 ticks hold them. */
const SEQUENCE: StudioSequence = {
  id: 'sequence-one',
  ppq: 960,
  tempoBpm: 120,
  lengthTicks: 3,
  nextNoteId: 2,
  notes: [{ id: 1, pitch: 60, startTick: 0, lengthTicks: 2, velocity: 0.5 }],
}

/** The arrangement fixture with its clip playing SEQUENCE. */
function midiArrangement(project: StudioProject): StudioProject {
  const arranged = studioArrangementFixture(project)
  return {
    ...arranged,
    clips: [
      {
        ...arranged.clips[0],
        midi: { sequenceId: SEQUENCE.id, renderKey: 'key-one' },
      },
    ],
    sequences: [SEQUENCE],
  }
}

/** The object stores the database holds now. */
async function storeNames(): Promise<string[]> {
  const raw = new Dexie(MERCURY_PITCH_DB_NAME)
  await raw.open()
  const names = raw.tables.map((table) => table.name)
  raw.close()
  return names
}

describe('local Studio persistence of song versions and MIDI', () => {
  let db: DexieAdapter
  let service: ReturnType<typeof createStudioService>
  let clock: number
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob)
    vi.stubGlobal('crypto', webcrypto)
    clock = Date.parse('2026-11-09T12:00:00.000Z')
    let nextId = 0
    db = new DexieAdapter()
    service = createStudioService({
      database: () => db,
      now: () => new Date(clock),
      createId: () => `new-${++nextId}`,
    })
  })
  afterEach(async () => {
    await db.destroy()
    vi.unstubAllGlobals()
  })

  /** A saved song with one take, then its stored record set back to `version`. */
  async function storedAt(version: number) {
    const empty = await service.createProject('Kept before MIDI')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const saved = await service.saveProject(
      studioArrangementFixture(empty),
      { ...lease, expectedRevision: 0 },
      [await studioAssetFixture(empty.id)],
    )
    const record = { ...saved, schemaVersion: version }
    await db.putStrict(STUDIO_STORES.projects, record)
    return { saved, record, lease }
  }

  it('opens a song stored at version 1 at version 2, keeping its record as it was first, once', async () => {
    // Arrange
    const { saved, record } = await storedAt(1)

    // Act
    const opened = await service.loadProject(saved.id)
    clock += 60_000
    await service.loadProject(saved.id)

    // Assert
    expect(opened).toEqual(saved)
    expect(
      await db.readAllStrict<StudioProjectSnapshotRecord>(
        STUDIO_STORES.snapshots,
      ),
    ).toEqual([
      {
        id: `${saved.id}:1`,
        projectId: saved.id,
        schemaVersion: 1,
        project: record,
        createdAt: '2026-11-09T12:00:00.000Z',
        updatedAt: '2026-11-09T12:00:00.000Z',
      },
    ])
    expect(
      await db.readByIdStrict<StudioProject>(STUDIO_STORES.projects, saved.id),
    ).toMatchObject({ schemaVersion: 1 })
  })

  it('saves a song read at version 1 at version 2, and deletes its kept record with it', async () => {
    // Arrange
    const { saved, lease } = await storedAt(1)
    const opened = await service.loadProject(saved.id)

    // Act
    const resaved = await service.saveProject(
      { ...opened, title: 'Kept after MIDI', revision: opened.revision + 1 },
      { ...lease, expectedRevision: opened.revision },
    )
    const stored = await db.readByIdStrict<StudioProject>(
      STUDIO_STORES.projects,
      saved.id,
    )
    await service.deleteProject(saved.id, {
      ...lease,
      expectedRevision: resaved.revision,
    })

    // Assert
    expect(stored?.schemaVersion).toBe(2)
    expect(await db.readAllStrict(STUDIO_STORES.snapshots)).toEqual([])
  })

  it('refuses a song saved by a newer build in plain words, and leaves it as it was', async () => {
    // Arrange
    const { saved, record } = await storedAt(3)

    // Act
    const refusal = await service
      .loadProject(saved.id)
      .catch((error: unknown) => error)

    // Assert
    expect(refusal).toMatchObject({
      code: 'newer-version',
      message:
        'This song was saved by a newer MercuryPitch. Update the app to open it.',
    })
    expect(await db.readByIdStrict(STUDIO_STORES.projects, saved.id)).toEqual(
      record,
    )
    expect(await db.readAllStrict(STUDIO_STORES.snapshots)).toEqual([])
  })

  it('saves, opens and copies a MIDI clip with the sequence it plays', async () => {
    // Arrange
    const empty = await service.createProject('Keys')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const song = midiArrangement(empty)

    // Act
    await service.saveProject(song, { ...lease, expectedRevision: 0 }, [
      await studioAssetFixture(empty.id),
    ])
    const opened = await service.loadProject(empty.id)
    const copy = await service.forkProject(opened)

    // Assert: a copy's clips are new, the sequence they name the same.
    expect(opened).toEqual(song)
    expect(copy.sequences).toEqual([SEQUENCE])
    expect(copy.clips[0].id).not.toBe(song.clips[0].id)
    expect(copy.clips[0].midi).toEqual(song.clips[0].midi)
    expect(await service.loadProject(copy.id)).toEqual(copy)
  })

  it('drops a sequence no clip names as the song opens', async () => {
    // Arrange
    const empty = await service.createProject('Keys')
    const lease = await service.acquireLease(empty.id, 'tab-one')
    const song = midiArrangement(empty)
    await service.saveProject(song, { ...lease, expectedRevision: 0 }, [
      await studioAssetFixture(empty.id),
    ])
    const spare = { ...SEQUENCE, id: 'sequence-spare' }
    await db.putStrict(STUDIO_STORES.projects, {
      ...song,
      sequences: [SEQUENCE, spare],
    })

    // Act
    const opened = await service.loadProject(empty.id)

    // Assert
    expect(opened.sequences).toEqual([SEQUENCE])
  })

  it('upgrades a version 15 browser: its take notes store goes, its songs stay and open', async () => {
    // Arrange: a song stored at version 1, and a take's notes kept the
    // version 15 way.
    await db.destroy()
    const song = {
      ...createStudioProject({
        id: 'song-one',
        title: 'Old',
        now: '2026-11-01T12:00:00.000Z',
      }),
      schemaVersion: 1,
    }
    const legacy = new Dexie(MERCURY_PITCH_DB_NAME)
    legacy.version(15).stores({
      studioProjects: 'id, updatedAt',
      studioTakeNotes: 'id, projectId',
    })
    await legacy.table('studioProjects').put(song)
    await legacy.table('studioTakeNotes').put({
      id: 'take-one',
      projectId: 'song-one',
      notes: [{ midi: 60, velocity: 100, startFrame: 0, endFrame: 10 }],
    })
    legacy.close()

    // Act
    db = new DexieAdapter()
    const opened = await service.loadProject('song-one')

    // Assert
    expect(opened).toEqual({ ...song, schemaVersion: 2 })
    const names = await storeNames()
    expect(names).toContain('studioProjectSnapshots')
    expect(names).not.toContain('studioTakeNotes')
  })
})
