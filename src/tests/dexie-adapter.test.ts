// DexieAdapter query-engine tests.
//
// The hand-rolled findAll (index-vs-in-memory branching, in-memory sort and
// slice-based pagination) and update semantics were previously untestable —
// fake-indexeddb gives us a real IndexedDB so these run end-to-end.

import DexieDB from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import type { DbEntity } from '@/db/types'

// DexieRepository.create() uses window.crypto.randomUUID(); some jsdom builds
// expose crypto without randomUUID. Back it with Node's implementation.
if (
  typeof window !== 'undefined' &&
  (window.crypto === undefined ||
    typeof window.crypto.randomUUID !== 'function')
) {
  Object.defineProperty(window, 'crypto', {
    value: globalThis.crypto,
    configurable: true,
  })
}

interface Rec extends DbEntity {
  userId: string
  score: number
}

interface PianoRec extends DbEntity {
  title: string
  sourceKind: string
  sourceHash?: string
}

interface MigrationRec extends DbEntity {
  migrationKey: string
  projectId: string
  completedAt: string
}

interface StemRec extends DbEntity {
  sessionId: string
  stemType: string
}

interface SongManifestRec extends DbEntity {
  userId: string
  fileHash: string
  title: string
  quality: string
}

interface VoiceTakeMigrationRec extends DbEntity {
  source: string
  comparisonKey: string
  capturedAt: string
}

interface VoiceTakeAudioMigrationRec extends DbEntity {
  takeId: string
  mimeType: string
  size: number
  data: ArrayBuffer
}

interface VoiceTakeContourMigrationRec extends DbEntity {
  takeId: string
  contourVersion: number
  analysisSource: string
  pointCount: number
  payloadJson: string
}

interface DrumProjectRec extends DbEntity {
  title: string
  sourceKind: string
  sourceRef: string
}

interface DrumTakeRec extends DbEntity {
  projectId: string
  completedAt: string
  score: number
}

describe('DexieAdapter', () => {
  let adapter: DexieAdapter

  beforeEach(() => {
    adapter = new DexieAdapter()
  })

  afterEach(async () => {
    // Deletes the underlying IndexedDB so each test starts clean.
    await adapter.destroy()
  })

  it('orders by a non-indexed field descending with a where filter', async () => {
    const repo = adapter.getRepository<Rec>('sessionRecords')
    await repo.create({ userId: 'u1', score: 10 })
    await repo.create({ userId: 'u1', score: 30 })
    await repo.create({ userId: 'u2', score: 99 })

    const rows = await repo.findAll({
      where: { userId: 'u1' },
      orderBy: 'score',
      orderDir: 'desc',
    })

    expect(rows.map((r) => r.score)).toEqual([30, 10])
  })

  it('applies offset and limit as a window', async () => {
    const repo = adapter.getRepository<Rec>('sessionRecords')
    for (const score of [1, 2, 3, 4, 5]) {
      await repo.create({ userId: 'u', score })
    }

    const rows = await repo.findAll({
      where: { userId: 'u' },
      orderBy: 'score',
      orderDir: 'asc',
      offset: 1,
      limit: 2,
    })

    expect(rows.map((r) => r.score)).toEqual([2, 3])
  })

  it('orders by the indexed primary scan field without a where clause', async () => {
    const repo = adapter.getRepository<Rec>('sessionRecords')
    await repo.create({ userId: 'a', score: 5 })
    await repo.create({ userId: 'b', score: 1 })
    await repo.create({ userId: 'c', score: 3 })

    // endedAt is an index but unset here; score is not indexed → in-memory sort.
    const rows = await repo.findAll({ orderBy: 'score', orderDir: 'asc' })
    expect(rows.map((r) => r.score)).toEqual([1, 3, 5])
  })

  it('update preserves id/createdAt, bumps updatedAt, and throws on a missing id', async () => {
    const repo = adapter.getRepository<Rec>('sessionRecords')
    const created = await repo.create({ userId: 'u', score: 1 })

    const updated = await repo.update(created.id, { score: 2 })
    expect(updated.id).toBe(created.id)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.score).toBe(2)
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(created.createdAt).getTime(),
    )

    await expect(repo.update('does-not-exist', { score: 9 })).rejects.toThrow()
  })

  it('preserves concurrent patches to different fields on one record', async () => {
    const repo = adapter.getRepository<Rec>('sessionRecords')
    const created = await repo.create({ userId: 'u', score: 1 })

    await Promise.all([
      repo.update(created.id, { score: 2 }),
      repo.update(created.id, { userId: 'renamed' }),
    ])

    await expect(repo.findById(created.id)).resolves.toMatchObject({
      score: 2,
      userId: 'renamed',
    })
  })

  it('count respects the where clause and the bare count', async () => {
    const repo = adapter.getRepository<Rec>('sessionRecords')
    await repo.create({ userId: 'a', score: 1 })
    await repo.create({ userId: 'b', score: 1 })

    expect(await repo.count({ where: { userId: 'a' } })).toBe(1)
    expect(await repo.count()).toBe(2)
  })

  it('findById returns null for a missing row', async () => {
    const repo = adapter.getRepository<Rec>('sessionRecords')
    expect(await repo.findById('nope')).toBeNull()
  })

  it('rethrows failed audited reads while ordinary reads stay resilient', async () => {
    const repo = adapter.getRepository<Rec>('sessionRecords')
    const table = (
      repo as unknown as {
        table: { toCollection: () => unknown }
      }
    ).table
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(table, 'toCollection').mockImplementation(() => {
      throw new Error('indexeddb unavailable')
    })

    await expect(repo.findAll()).resolves.toEqual([])
    await expect(repo.findAll({ throwOnError: true })).rejects.toThrow(
      'indexeddb unavailable',
    )
  })

  it('transaction runs the callback against a real transaction and returns its result', async () => {
    const result = await adapter.transaction(async (db) => {
      const repo = db.getRepository<Rec>('sessionRecords')
      const created = await repo.create({ userId: 'tx', score: 1 })
      return created.userId
    })
    expect(result).toBe('tx')

    // The write actually committed.
    const repo = adapter.getRepository<Rec>('sessionRecords')
    expect(await repo.count({ where: { userId: 'tx' } })).toBe(1)
  })

  it('exposes strict v7 Piano project reads, upserts, and deletes', async () => {
    const now = new Date().toISOString()
    const project: PianoRec = {
      id: 'project-1',
      createdAt: now,
      updatedAt: now,
      title: 'Nocturne',
      sourceKind: 'midi',
      sourceHash: 'source-1',
    }

    await adapter.putStrict('pianoProjects', project)
    expect(
      await adapter.readByIdStrict<PianoRec>('pianoProjects', project.id),
    ).toEqual(project)
    expect(
      await adapter.readByIndexStrict<PianoRec>(
        'pianoProjects',
        'sourceHash',
        'source-1',
      ),
    ).toEqual([project])

    await adapter.deleteByIdStrict('pianoProjects', project.id)
    expect(
      await adapter.readByIdStrict<PianoRec>('pianoProjects', project.id),
    ).toBeUndefined()
  })

  it('rolls a Piano project back when its unique migration marker fails', async () => {
    const now = new Date().toISOString()
    const project: PianoRec = {
      id: 'project-rollback',
      createdAt: now,
      updatedAt: now,
      title: 'Rollback',
      sourceKind: 'midi',
      sourceHash: 'rollback-source',
    }
    const marker = (id: string): MigrationRec => ({
      id,
      createdAt: now,
      updatedAt: now,
      migrationKey: 'legacy-midi-v1:rollback-source',
      projectId: project.id,
      completedAt: now,
    })

    await expect(
      adapter.transaction(async () => {
        await adapter.putStrict('pianoProjects', project)
        await adapter.addStrict('pianoProjectMigrations', marker('marker-1'))
        await adapter.addStrict('pianoProjectMigrations', marker('marker-2'))
      }),
    ).rejects.toThrow()

    expect(
      await adapter.readByIdStrict<PianoRec>('pianoProjects', project.id),
    ).toBeUndefined()
    expect(
      await adapter.readAllStrict<MigrationRec>('pianoProjectMigrations'),
    ).toEqual([])
  })

  it('pins the indexes of the blob-bearing stores', () => {
    // Adding an index to a store whose rows carry multi-megabyte audio makes
    // the next open re-index every row inside one upgrade transaction --
    // minutes on a large library, with every reader blocked behind getDb().
    // v6 and v10 both did it to uvrStemBlobs. This test is the tripwire: a
    // new index here must come with its own migration plan, not a schema
    // line. (fake-indexeddb hides the cost, so nothing else would notice.)
    const db = (adapter as unknown as { db: DexieDB }).db
    const indexesOf = (store: string): string[] =>
      db
        .table(store)
        .schema.indexes.map((index) => index.src)
        .sort()
    expect(indexesOf('uvrStemBlobs')).toEqual(
      [
        'sessionId',
        'stemType',
        'createdAt',
        '[sessionId+stemType]',
        '[sessionId+stemType+createdAt]',
      ].sort(),
    )
    expect(indexesOf('voiceTakeAudio')).toEqual(['&takeId'])
  })

  it('exposes strict v11 Drum project and compound take-summary indexes', async () => {
    const now = new Date().toISOString()
    const project: DrumProjectRec = {
      id: 'drum-project-1',
      createdAt: now,
      updatedAt: now,
      title: 'Pocket',
      sourceKind: 'prepared-first-pocket',
      sourceRef: 'first-pocket:1',
    }
    const take: DrumTakeRec = {
      id: 'drum-take-1',
      createdAt: now,
      updatedAt: now,
      projectId: project.id,
      completedAt: now,
      score: 91,
    }

    await adapter.putStrict('drumProjects', project)
    await adapter.putStrict('drumTakeSummaries', take)
    expect(
      await adapter.readByIndexStrict<DrumProjectRec>(
        'drumProjects',
        'sourceRef',
        'first-pocket:1',
      ),
    ).toEqual([project])
    expect(
      await adapter.readByCompoundIndexStrict<DrumTakeRec>(
        'drumTakeSummaries',
        '[projectId+completedAt]',
        [project.id, now],
      ),
    ).toEqual([take])
  })

  it('upgrades the current-main v6 stem schema into the reconciled stores', async () => {
    await adapter.destroy()
    const legacy = new DexieDB('MercuryPitchDB')
    legacy.version(6).stores({
      uvrStemBlobs: 'id, sessionId, stemType, createdAt, [sessionId+stemType]',
    })
    const stem: StemRec = {
      id: 'stem-before-v7',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sessionId: 'session-before-v7',
      stemType: 'vocal',
    }
    await legacy.table<StemRec, string>('uvrStemBlobs').put(stem)
    legacy.close()

    adapter = new DexieAdapter()
    expect(
      await adapter.countByCompoundIndexStrict(
        'uvrStemBlobs',
        '[sessionId+stemType]',
        [stem.sessionId, stem.stemType],
      ),
    ).toBe(1)
    expect(await adapter.readAllStrict('voiceTakes')).toEqual([])
    expect(await adapter.readAllStrict('pianoProjects')).toEqual([])
  })

  it('upgrades the Hear Yourself preview v6 schema without replacing voice rows', async () => {
    await adapter.destroy()
    const legacy = new DexieDB('MercuryPitchDB')
    legacy.version(6).stores({
      voiceTakes: 'id, createdAt, capturedAt, source, comparisonKey',
      voiceTakeAudio: 'id, &takeId',
    })
    const take: VoiceTakeMigrationRec = {
      id: 'take-before-v7',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      capturedAt: '2026-01-01T00:00:00.000Z',
      source: 'freeform',
      comparisonKey: 'freeform:preview-thread',
    }
    const audio: VoiceTakeAudioMigrationRec = {
      id: 'audio-before-v7',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      takeId: take.id,
      mimeType: 'audio/webm',
      size: 3,
      data: new Uint8Array([1, 2, 3]).buffer,
    }
    await legacy.table<VoiceTakeMigrationRec, string>('voiceTakes').put(take)
    await legacy
      .table<VoiceTakeAudioMigrationRec, string>('voiceTakeAudio')
      .put(audio)
    legacy.close()

    adapter = new DexieAdapter()
    expect(
      await adapter.readByIdStrict<VoiceTakeMigrationRec>(
        'voiceTakes',
        take.id,
      ),
    ).toEqual(take)
    expect(
      await adapter.readByIndexStrict<VoiceTakeAudioMigrationRec>(
        'voiceTakeAudio',
        'takeId',
        take.id,
      ),
    ).toEqual([audio])
    expect(await adapter.readAllStrict('uvrStemBlobs')).toEqual([])
    expect(await adapter.readAllStrict('voiceTakeContours')).toEqual([])
  })

  it('upgrades the current-main v7 schema without replacing its rows', async () => {
    await adapter.destroy()
    const legacy = new DexieDB('MercuryPitchDB')
    legacy.version(7).stores({
      sessionRecords: 'id, userId, endedAt',
      uvrStemBlobs: 'id, sessionId, stemType, createdAt, [sessionId+stemType]',
      pianoProjects: 'id, updatedAt, sourceKind, sourceHash',
      pianoProjectMigrations: 'id, &migrationKey, completedAt',
    })
    const existing: Rec = {
      id: 'before-v8',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      userId: 'local-user',
      score: 93,
    }
    const project: PianoRec = {
      id: 'project-before-v8',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Existing project',
      sourceKind: 'midi',
      sourceHash: 'existing-source',
    }
    const stem: StemRec = {
      id: 'stem-before-v8',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sessionId: 'session-before-v8',
      stemType: 'vocal',
    }
    const migration: MigrationRec = {
      id: 'migration-before-v8',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      migrationKey: 'legacy-midi-v1:existing-source',
      projectId: project.id,
      completedAt: '2026-01-01T00:00:00.000Z',
    }
    await legacy.table<Rec, string>('sessionRecords').put(existing)
    await legacy.table<StemRec, string>('uvrStemBlobs').put(stem)
    await legacy.table<PianoRec, string>('pianoProjects').put(project)
    await legacy
      .table<MigrationRec, string>('pianoProjectMigrations')
      .put(migration)
    legacy.close()

    adapter = new DexieAdapter()
    expect(
      await adapter.readByIdStrict<Rec>('sessionRecords', existing.id),
    ).toEqual(existing)
    expect(
      await adapter.readByIdStrict<PianoRec>('pianoProjects', project.id),
    ).toEqual(project)
    expect(
      await adapter.countByCompoundIndexStrict(
        'uvrStemBlobs',
        '[sessionId+stemType]',
        [stem.sessionId, stem.stemType],
      ),
    ).toBe(1)
    expect(
      await adapter.readByIndexStrict<MigrationRec>(
        'pianoProjectMigrations',
        'migrationKey',
        migration.migrationKey,
      ),
    ).toEqual([migration])
    expect(await adapter.readAllStrict('voiceTakes')).toEqual([])
  })

  it('upgrades the main v8 manifest schema to v9 without replacing its rows', async () => {
    await adapter.destroy()
    const legacy = new DexieDB('MercuryPitchDB')
    legacy.version(6).stores({
      uvrStemBlobs: 'id, sessionId, stemType, createdAt, [sessionId+stemType]',
    })
    legacy.version(7).stores({
      pianoProjects: 'id, updatedAt, sourceKind, sourceHash',
      pianoProjectMigrations: 'id, &migrationKey, completedAt',
    })
    legacy.version(8).stores({
      songManifests: 'id, userId, fileHash, [userId+fileHash], updatedAt',
    })
    const stem: StemRec = {
      id: 'stem-before-v9',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      sessionId: 'session-before-v9',
      stemType: 'vocal',
    }
    const project: PianoRec = {
      id: 'project-before-v9',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      title: 'Existing project',
      sourceKind: 'midi',
      sourceHash: 'existing-v8-source',
    }
    const manifest: SongManifestRec = {
      id: 'manifest-before-v9',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      userId: 'local-user',
      fileHash: 'song-hash',
      title: 'Existing song',
      quality: 'lossless',
    }
    await legacy.table<StemRec, string>('uvrStemBlobs').put(stem)
    await legacy.table<PianoRec, string>('pianoProjects').put(project)
    await legacy.table<SongManifestRec, string>('songManifests').put(manifest)
    legacy.close()

    adapter = new DexieAdapter()
    expect(
      await adapter.countByCompoundIndexStrict(
        'uvrStemBlobs',
        '[sessionId+stemType]',
        [stem.sessionId, stem.stemType],
      ),
    ).toBe(1)
    expect(
      await adapter.readByIdStrict<PianoRec>('pianoProjects', project.id),
    ).toEqual(project)
    expect(
      await adapter.readByCompoundIndexStrict<SongManifestRec>(
        'songManifests',
        '[userId+fileHash]',
        [manifest.userId, manifest.fileHash],
      ),
    ).toEqual([manifest])
    expect(await adapter.readAllStrict('voiceTakes')).toEqual([])
  })

  it('upgrades the Hear Yourself preview v8 schema to v9 without replacing its rows', async () => {
    await adapter.destroy()
    const legacy = new DexieDB('MercuryPitchDB')
    legacy.version(8).stores({
      uvrStemBlobs: 'id, sessionId, stemType, createdAt, [sessionId+stemType]',
      pianoProjects: 'id, updatedAt, sourceKind, sourceHash',
      pianoProjectMigrations: 'id, &migrationKey, completedAt',
      voiceTakes: 'id, createdAt, capturedAt, source, comparisonKey',
      voiceTakeAudio: 'id, &takeId',
      voiceTakeContours: 'id, &takeId',
    })
    const take: VoiceTakeMigrationRec = {
      id: 'take-before-v9',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      capturedAt: '2026-01-01T00:00:00.000Z',
      source: 'freeform',
      comparisonKey: 'freeform:existing-thread',
    }
    const audio: VoiceTakeAudioMigrationRec = {
      id: 'audio-before-v9',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      takeId: take.id,
      mimeType: 'audio/webm',
      size: 3,
      data: new Uint8Array([1, 2, 3]).buffer,
    }
    const contour: VoiceTakeContourMigrationRec = {
      id: 'contour-before-v9',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      takeId: take.id,
      contourVersion: 1,
      analysisSource: 'realtime',
      pointCount: 1,
      payloadJson: '{"points":[]}',
    }
    await legacy.table<VoiceTakeMigrationRec, string>('voiceTakes').put(take)
    await legacy
      .table<VoiceTakeAudioMigrationRec, string>('voiceTakeAudio')
      .put(audio)
    await legacy
      .table<VoiceTakeContourMigrationRec, string>('voiceTakeContours')
      .put(contour)
    legacy.close()

    adapter = new DexieAdapter()
    expect(
      await adapter.readByIdStrict<VoiceTakeMigrationRec>(
        'voiceTakes',
        take.id,
      ),
    ).toEqual(take)
    expect(
      await adapter.readByIndexStrict<VoiceTakeAudioMigrationRec>(
        'voiceTakeAudio',
        'takeId',
        take.id,
      ),
    ).toEqual([audio])
    expect(
      await adapter.readByIndexStrict<VoiceTakeContourMigrationRec>(
        'voiceTakeContours',
        'takeId',
        take.id,
      ),
    ).toEqual([contour])
    expect(await adapter.readAllStrict('songManifests')).toEqual([])
  })

  it('upgrades an existing v9 database additively to empty Drum stores', async () => {
    await adapter.destroy()
    const legacy = new DexieDB('MercuryPitchDB')
    legacy.version(9).stores({ sessionRecords: 'id, userId, endedAt' })
    const existing: Rec = {
      id: 'before-v10',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      userId: 'local-user',
      score: 97,
    }
    await legacy.table<Rec, string>('sessionRecords').put(existing)
    legacy.close()

    adapter = new DexieAdapter()
    expect(
      await adapter.readByIdStrict<Rec>('sessionRecords', existing.id),
    ).toEqual(existing)
    expect(await adapter.readAllStrict('drumProjects')).toEqual([])
    expect(await adapter.readAllStrict('drumTakeSummaries')).toEqual([])
  })
})
