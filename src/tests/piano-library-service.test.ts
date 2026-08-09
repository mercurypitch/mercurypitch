// ============================================================
// Piano Library Service tests — strict local CRUD and atomic migration
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import type { PianoProjectMigrationRecord, PianoProjectRecord, } from '@/db/entities'
import { createPianoLibraryService } from '@/db/services/piano-library-service'
import type { LegacyMidiSong } from '@/features/piano-project/legacy-midi-migration'
import { LEGACY_MIDI_STORAGE_KEY, legacyMidiSongToProject, } from '@/features/piano-project/legacy-midi-migration'
import type { PianoProject } from '@/features/piano-project/piano-project'

function legacySong(name = 'Nocturne', id = 'legacy-random'): LegacyMidiSong {
  return {
    id,
    name,
    bpm: 100,
    tracks: [
      {
        id: 't0c0',
        name: 'Piano',
        instrumentName: 'Acoustic Grand Piano',
        noteCount: 1,
        notes: [{ midi: 60, startBeat: 0, duration: 1 }],
      },
      {
        id: 't1c1',
        name: 'Strings',
        instrumentName: 'String Ensemble 1',
        noteCount: 1,
        notes: [{ midi: 48, startBeat: 0, duration: 1 }],
      },
    ],
    scoreTrackId: 't0c0',
    backingTrackIds: ['t1c1'],
    importedAt: 1_750_000_000_000,
  }
}

function project(
  id: string,
  sourceHash: string,
  updatedAt: string,
): PianoProject {
  return {
    ...legacyMidiSongToProject(legacySong(id, id), sourceHash),
    id,
    name: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
    source: {
      kind: 'legacy-midi',
      storageKey: LEGACY_MIDI_STORAGE_KEY,
      sourceHash,
      ticksPerQuarter: 480,
    },
  }
}

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const HASH_C = 'c'.repeat(64)

function mutableStorage(initial: unknown[]): {
  storage: Storage
  setRows(rows: unknown[]): void
  raw(): string
} {
  let raw = JSON.stringify(initial)
  const storage: Storage = {
    get length() {
      return 1
    },
    clear: vi.fn(),
    getItem: vi.fn((key: string) =>
      key === LEGACY_MIDI_STORAGE_KEY ? raw : null,
    ),
    key: vi.fn(() => LEGACY_MIDI_STORAGE_KEY),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  }
  return {
    storage,
    setRows(rows) {
      raw = JSON.stringify(rows)
    },
    raw: () => raw,
  }
}

describe('Piano Library Service', () => {
  let adapter: DexieAdapter
  let service: ReturnType<typeof createPianoLibraryService>

  beforeEach(() => {
    adapter = new DexieAdapter()
    service = createPianoLibraryService({
      database: () => adapter,
      now: () => new Date('2026-08-09T12:00:00.000Z'),
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await adapter.destroy()
  })

  it('round-trips projects and lists newest first with a stable id tie-break', async () => {
    const older = project('older', HASH_A, '2026-08-08T12:00:00.000Z')
    const beta = project('beta', HASH_B, '2026-08-09T12:00:00.000Z')
    const alpha = project('alpha', HASH_C, '2026-08-09T12:00:00.000Z')

    expect(await service.saveProject(older)).toMatchObject({ ok: true })
    expect(await service.saveProject(beta)).toMatchObject({ ok: true })
    expect(await service.saveProject(alpha)).toMatchObject({ ok: true })

    const listed = await service.listProjects()
    expect(listed.ok && listed.value.map((item) => item.id)).toEqual([
      'alpha',
      'beta',
      'older',
    ])
    expect(await service.readProject('beta')).toEqual({
      ok: true,
      value: beta,
    })
  })

  it('updates canonical score and backing choices without accepting dangling ids', async () => {
    const original = project(
      'selection-project',
      HASH_A,
      '2026-08-08T12:00:00.000Z',
    )
    expect(await service.saveProject(original)).toMatchObject({ ok: true })

    const updated = await service.updateProjectSelection(original.id, 't1c1', [
      't0c0',
    ])
    expect(updated).toMatchObject({
      ok: true,
      value: {
        id: original.id,
        updatedAt: '2026-08-09T12:00:00.000Z',
        scoreTrackId: 't1c1',
        backingTrackIds: ['t0c0'],
      },
    })

    expect(
      await service.updateProjectSelection(original.id, 'missing', []),
    ).toEqual({ ok: false, code: 'invalid-project' })
    expect(await service.readProject(original.id)).toEqual(updated)
    expect(
      await service.updateProjectSelection('missing-project', 't0c0', []),
    ).toEqual({ ok: false, code: 'not-found' })
  })

  it('distinguishes a failed read from an empty library and skips corrupt rows', async () => {
    const now = '2026-08-09T12:00:00.000Z'
    await adapter.putStrict<PianoProjectRecord>('pianoProjects', {
      id: 'corrupt',
      createdAt: now,
      updatedAt: now,
      sourceKind: 'legacy-midi',
      sourceHash: 'corrupt',
      project: { nope: true },
    })
    expect(await service.listProjects()).toEqual({
      ok: true,
      value: [],
      skippedRecords: 1,
    })

    vi.spyOn(adapter, 'readAllStrict').mockRejectedValueOnce(
      new DOMException('blocked', 'UnknownError'),
    )
    expect(await service.listProjects()).toMatchObject({
      ok: false,
      code: 'storage-unavailable',
    })
  })

  it('migrates once, preserves the source bytes, and discovers later rows', async () => {
    const legacy = mutableStorage([legacySong()])
    const original = legacy.raw()

    expect(await service.migrateLegacyProjects(legacy.storage)).toMatchObject({
      status: 'complete',
      imported: 1,
      alreadyPresent: 0,
    })
    expect(legacy.raw()).toBe(original)
    expect(legacy.storage.setItem).not.toHaveBeenCalled()
    expect(legacy.storage.removeItem).not.toHaveBeenCalled()
    expect(legacy.storage.clear).not.toHaveBeenCalled()

    expect(await service.migrateLegacyProjects(legacy.storage)).toMatchObject({
      status: 'complete',
      imported: 0,
      alreadyPresent: 1,
    })
    expect(
      await adapter.readAllStrict<PianoProjectRecord>('pianoProjects'),
    ).toHaveLength(1)

    legacy.setRows([legacySong(), legacySong('Prelude', 'later-random')])
    expect(await service.migrateLegacyProjects(legacy.storage)).toMatchObject({
      status: 'complete',
      imported: 1,
      alreadyPresent: 1,
    })
    expect(
      await adapter.readAllStrict<PianoProjectRecord>('pianoProjects'),
    ).toHaveLength(2)
    expect(
      await adapter.readAllStrict<PianoProjectMigrationRecord>(
        'pianoProjectMigrations',
      ),
    ).toHaveLength(2)
  })

  it('reports invalid and duplicate rows without hiding valid projects', async () => {
    const first = legacySong()
    const duplicate = { ...legacySong(), id: 'another', importedAt: 2 }
    const legacy = mutableStorage([first, { broken: true }, duplicate])

    expect(await service.migrateLegacyProjects(legacy.storage)).toMatchObject({
      status: 'complete-with-skips',
      imported: 1,
      skippedRows: 1,
      duplicateRows: 1,
    })
  })

  it('rolls project and marker back together, then succeeds on retry', async () => {
    const legacy = mutableStorage([legacySong()])
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const add = vi
      .spyOn(adapter, 'addStrict')
      .mockRejectedValue(new DOMException('write failed', 'UnknownError'))

    const failed = await service.migrateLegacyProjects(legacy.storage)
    expect(failed).toMatchObject({
      status: 'failed',
      imported: 0,
      quotaExceeded: false,
    })
    expect(failed.fallbackProjects).toHaveLength(1)
    expect(
      await adapter.readAllStrict<PianoProjectRecord>('pianoProjects'),
    ).toEqual([])
    expect(
      await adapter.readAllStrict<PianoProjectMigrationRecord>(
        'pianoProjectMigrations',
      ),
    ).toEqual([])

    add.mockRestore()
    expect(await service.migrateLegacyProjects(legacy.storage)).toMatchObject({
      status: 'complete',
      imported: 1,
    })
    expect(errorLog).toHaveBeenCalled()
  })

  it('reports quota failure without retrying or leaving a marker', async () => {
    const legacy = mutableStorage([legacySong()])
    const add = vi
      .spyOn(adapter, 'addStrict')
      .mockRejectedValue(new DOMException('full', 'QuotaExceededError'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await service.migrateLegacyProjects(legacy.storage)).toMatchObject({
      status: 'failed',
      quotaExceeded: true,
    })
    expect(add).toHaveBeenCalledTimes(1)
    expect(
      await adapter.readAllStrict<PianoProjectRecord>('pianoProjects'),
    ).toEqual([])
  })

  it('deletes a project and its migration marker in one transaction', async () => {
    const legacy = mutableStorage([legacySong()])
    await service.migrateLegacyProjects(legacy.storage)
    const listed = await service.listProjects()
    if (!listed.ok) throw new Error('migration did not create a project')

    expect(await service.deleteProject(listed.value[0]!.id)).toEqual({
      ok: true,
      value: undefined,
    })
    expect(
      await adapter.readAllStrict<PianoProjectRecord>('pianoProjects'),
    ).toEqual([])
    expect(
      await adapter.readAllStrict<PianoProjectMigrationRecord>(
        'pianoProjectMigrations',
      ),
    ).toEqual([])
  })
})
