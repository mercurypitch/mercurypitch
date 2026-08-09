// DexieAdapter query-engine tests.
//
// The hand-rolled findAll (index-vs-in-memory branching, in-memory sort and
// slice-based pagination) and update semantics were previously untestable —
// fake-indexeddb gives us a real IndexedDB so these run end-to-end.

import DexieDB from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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

  it('upgrades an existing v6 database without replacing its rows', async () => {
    await adapter.destroy()
    const legacy = new DexieDB('MercuryPitchDB')
    legacy.version(6).stores({ sessionRecords: 'id, userId, endedAt' })
    const existing: Rec = {
      id: 'before-v7',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      userId: 'local-user',
      score: 93,
    }
    await legacy.table<Rec, string>('sessionRecords').put(existing)
    legacy.close()

    adapter = new DexieAdapter()
    expect(
      await adapter.readByIdStrict<Rec>('sessionRecords', existing.id),
    ).toEqual(existing)
    expect(await adapter.readAllStrict<PianoRec>('pianoProjects')).toEqual([])
  })
})
