// UVR record persistence uses immutable input and treats failed reads as errors.
// The real store runs over retained rows; only I/O delays and failures are fake.

import { setImmediate } from 'node:timers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSessionRecord } from '@/db/entities'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'
import type * as StoreModule from './uvr-store'

const adapter = new InMemoryAdapter()
const boundary = vi.hoisted(() => ({
  nextDbWait: undefined as (() => Promise<void>) | undefined,
}))

vi.mock('@/db', () => ({
  getDb: async () => {
    const wait = boundary.nextDbWait
    boundary.nextDbWait = undefined
    if (wait !== undefined) await wait()
    return adapter
  },
}))

type Store = typeof StoreModule
const releases: (() => void)[] = []

function sessionRepo() {
  return adapter.getRepository<UvrSessionRecord>('uvrSessions')
}

function requireSession(store: Store, sessionId: string) {
  const session = store.getUvrSession(sessionId)
  if (session === undefined)
    throw new Error(`Missing test session ${sessionId}`)
  return session
}

async function savedSession(store: Store) {
  const id = store.startUvrSession(
    'Original.wav',
    12,
    'audio/wav',
    'separate',
    'server',
  )
  expect(await store.persistSessionDurable(requireSession(store, id))).toBe(
    true,
  )
  expect(
    await sessionRepo().findAll({ where: { appSessionId: id } }),
  ).toHaveLength(1)
  return id
}

function holdNextDb() {
  const entered = Promise.withResolvers<undefined>()
  const release = Promise.withResolvers<undefined>()
  releases.push(() => release.resolve(undefined))
  boundary.nextDbWait = async () => {
    entered.resolve(undefined)
    await release.promise
  }
  return { entered, release }
}

// An event-loop checkpoint drains these synchronous-Map I/O promises. There is
// no elapsed-time assertion or delay choosing which competing write wins.
function settleRunnableIo(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetModules()
  await adapter.destroy()
  localStorage.clear()
  boundary.nextDbWait = undefined
  releases.length = 0
})

afterEach(() => {
  for (const release of releases) release()
  boundary.nextDbWait = undefined
})

describe('UVR persisted records', () => {
  it.each(['durable', 'whole-list', 'progress'] as const)(
    'captures nested metadata and file details when the %s write is requested',
    async (writeKind) => {
      const store = await import('./uvr-store')
      const sessionId = await savedSession(store)
      const session = requireSession(store, sessionId)
      const originalFile = {
        name: 'Queued.wav',
        size: 120,
        mimeType: 'audio/wav',
      }
      const stemMeta = { vocal: { duration: 14, size: 400 } }
      session.originalFile = originalFile
      session.stemMeta = stemMeta
      session.progress = 19

      const repo = sessionRepo()
      const update = repo.update.bind(repo)
      const written = Promise.withResolvers<undefined>()
      vi.spyOn(repo, 'update').mockImplementation(async (id, patch) => {
        const record = await update(id, patch)
        if (patch.appSessionId === sessionId) written.resolve(undefined)
        return record
      })
      const held = holdNextDb()
      let durable: Promise<boolean> | undefined
      if (writeKind === 'durable')
        durable = store.persistSessionDurable(session)
      else if (writeKind === 'whole-list') store.saveAllUvrSessions([session])
      else store.updateUvrSessionProgress(sessionId, 19)
      await held.entered.promise
      try {
        originalFile.name = 'Changed after enqueue.mp3'
        originalFile.size = 999
        originalFile.mimeType = 'audio/mpeg'
        stemMeta.vocal.duration = 99
        stemMeta.vocal.size = 900
      } finally {
        held.release.resolve(undefined)
      }
      if (durable !== undefined) expect(await durable).toBe(true)
      await written.promise

      const records = await repo.findAll({ where: { appSessionId: sessionId } })
      expect(records).toEqual([
        expect.objectContaining({
          originalFileName: 'Queued.wav',
          originalFileSize: 120,
          originalFileType: 'audio/wav',
          progress: 19,
          stemMetaJson: JSON.stringify({ vocal: { duration: 14, size: 400 } }),
        }),
      ])
    },
  )

  it.each(['durable', 'whole-list', 'progress'] as const)(
    'contains a serialization failure in a %s write and permits the next write',
    async (writeKind) => {
      const store = await import('./uvr-store')
      const sessionId = await savedSession(store)
      const session = requireSession(store, sessionId)
      const repo = sessionRepo()
      const original = await repo.findAll({
        where: { appSessionId: sessionId },
      })
      const created = vi.spyOn(repo, 'create')
      const updated = vi.spyOn(repo, 'update')
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const invalidMeta = { vocal: { duration: 14, size: 400 } }
      // Corrupt metadata reaches JSON serialization, rather than replacing
      // the serializer or the store with a mock that fails unconditionally.
      Object.defineProperty(invalidMeta, 'cycle', {
        value: invalidMeta,
        enumerable: true,
      })
      session.stemMeta = invalidMeta

      if (writeKind === 'durable') {
        await expect(store.persistSessionDurable(session)).resolves.toBe(false)
      } else if (writeKind === 'whole-list') {
        expect(() => store.saveAllUvrSessions([session])).not.toThrow()
      } else {
        expect(() =>
          store.updateUvrSessionProgress(sessionId, 19),
        ).not.toThrow()
      }
      await settleRunnableIo()
      expect(
        await repo.findAll({ where: { appSessionId: sessionId } }),
      ).toEqual(original)
      expect(created).not.toHaveBeenCalled()
      expect(updated).not.toHaveBeenCalled()

      const repairedMeta = { vocal: { duration: 15, size: 450 } }
      expect(
        await store.persistSessionDurable({
          ...requireSession(store, sessionId),
          stemMeta: repairedMeta,
        }),
      ).toBe(true)
      expect(
        await repo.findAll({ where: { appSessionId: sessionId } }),
      ).toEqual([
        expect.objectContaining({
          id: original[0].id,
          stemMetaJson: JSON.stringify(repairedMeta),
        }),
      ])
    },
  )

  it('reports a persistent read failure without inserting a duplicate, then permits recovery', async () => {
    const store = await import('./uvr-store')
    const sessionId = await savedSession(store)
    const repo = sessionRepo()
    const read = repo.findAll.bind(repo)
    const original = await read({ where: { appSessionId: sessionId } })
    const created = vi.spyOn(repo, 'create')
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failedRead = vi
      .spyOn(repo, 'findAll')
      .mockImplementation(async (options) => {
        // Match Dexie's real failure contract: [] is its default fallback;
        // callers must request strict errors before deciding to insert a row.
        if (options?.throwOnError === true)
          throw new Error('Simulated IndexedDB read failure')
        return []
      })

    expect(
      await store.setUvrSessionApiIdDurable(sessionId, 'runpod-recoverable'),
    ).toBe(false)
    expect(created).not.toHaveBeenCalled()
    expect(await read({ where: { appSessionId: sessionId } })).toEqual(original)

    failedRead.mockRestore()
    expect(
      await store.persistSessionDurable(requireSession(store, sessionId)),
    ).toBe(true)
    expect(await read({ where: { appSessionId: sessionId } })).toEqual([
      expect.objectContaining({
        id: original[0].id,
        apiSessionId: 'runpod-recoverable',
      }),
    ])
  })

  it('leaves every record untouched when the whole-list existence scan fails', async () => {
    const store = await import('./uvr-store')
    const sessionId = await savedSession(store)
    const repo = sessionRepo()
    const read = repo.findAll.bind(repo)
    const original = await read()
    const created = vi.spyOn(repo, 'create')
    const updated = vi.spyOn(repo, 'update')
    const deleted = vi.spyOn(repo, 'delete')
    const scanned = Promise.withResolvers<undefined>()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(repo, 'findAll').mockImplementation(async (options) => {
      if (options?.where !== undefined) return read(options)
      scanned.resolve(undefined)
      if (options?.throwOnError === true)
        throw new Error('Simulated IndexedDB scan failure')
      return []
    })

    store.saveAllUvrSessions([
      { ...requireSession(store, sessionId), progress: 88 },
    ])
    await scanned.promise
    await settleRunnableIo()
    expect(await read()).toEqual(original)
    expect(created).not.toHaveBeenCalled()
    expect(updated).not.toHaveBeenCalled()
    expect(deleted).not.toHaveBeenCalled()
  })

  it('updates the canonical row before deleting legacy duplicates', async () => {
    const store = await import('./uvr-store')
    const sessionId = await savedSession(store)
    const repo = sessionRepo()
    const [canonical] = await repo.findAll({
      where: { appSessionId: sessionId },
    })
    const duplicate = await repo.create({
      ...canonical,
      apiSessionId: 'runpod-stale',
    })
    const remove = repo.delete.bind(repo)
    const removals: { id: string; canonical: UvrSessionRecord | null }[] = []
    vi.spyOn(repo, 'delete').mockImplementation(async (id) => {
      removals.push({ id, canonical: await repo.findById(canonical.id) })
      await remove(id)
    })

    expect(
      await store.persistSessionDurable({
        ...requireSession(store, sessionId),
        apiSessionId: 'runpod-current',
        stemMeta: { vocal: { duration: 14, size: 400 } },
      }),
    ).toBe(true)
    expect(await repo.findAll({ where: { appSessionId: sessionId } })).toEqual([
      expect.objectContaining({
        id: canonical.id,
        apiSessionId: 'runpod-current',
        stemMetaJson: JSON.stringify({ vocal: { duration: 14, size: 400 } }),
      }),
    ])
    expect(removals).toEqual([
      {
        id: duplicate.id,
        canonical: expect.objectContaining({
          id: canonical.id,
          apiSessionId: 'runpod-current',
          stemMetaJson: JSON.stringify({ vocal: { duration: 14, size: 400 } }),
        }),
      },
    ])
  })

  it('keeps every legacy row when the canonical update persistently fails', async () => {
    const store = await import('./uvr-store')
    const sessionId = await savedSession(store)
    const repo = sessionRepo()
    const [canonical] = await repo.findAll({
      where: { appSessionId: sessionId },
    })
    await repo.create({ ...canonical, apiSessionId: 'runpod-existing' })
    const original = await repo.findAll({ where: { appSessionId: sessionId } })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(repo, 'update').mockRejectedValue(
      new Error('Simulated persistent write failure'),
    )
    const deleted = vi.spyOn(repo, 'delete')

    expect(
      await store.persistSessionDurable({
        ...requireSession(store, sessionId),
        apiSessionId: 'runpod-new',
      }),
    ).toBe(false)
    expect(await repo.findAll({ where: { appSessionId: sessionId } })).toEqual(
      original,
    )
    expect(deleted).not.toHaveBeenCalled()
  })
})
