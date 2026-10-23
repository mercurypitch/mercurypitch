// UVR bulk persistence preserves a strict cascade that deletes a snapshotted row.
// Import rollback can delete directly through the service while a save is pending.

import { setImmediate } from 'node:timers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UvrSessionRecord, UvrStemBlob } from '@/db/entities'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'
import type * as StoreModule from './uvr-store'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

type Store = typeof StoreModule
const releases: (() => void)[] = []

async function savedSession(store: Store, name: string): Promise<string> {
  const id = store.startUvrSession(name, 12, 'audio/wav', 'separate', 'server')
  const session = store.getUvrSession(id)
  if (session === undefined) throw new Error(`Missing test session ${id}`)
  expect(await store.persistSessionDurable(session)).toBe(true)
  return id
}

beforeEach(async () => {
  vi.restoreAllMocks()
  vi.resetModules()
  await adapter.destroy()
  localStorage.clear()
  releases.length = 0
})

afterEach(() => {
  for (const release of releases) release()
})

describe('UVR bulk save during direct import cleanup', () => {
  it('leaves a cascaded row deleted and continues saving later sessions', async () => {
    const store = await import('./uvr-store')
    const { deleteImportedUvrSessionDataStrict } =
      await import('@/db/services/uvr-service')
    const firstId = await savedSession(store, 'Held.wav')
    const deletedId = await savedSession(store, 'Rolled back.wav')
    const lastId = await savedSession(store, 'Still saved.wav')
    const repo = adapter.getRepository<UvrSessionRecord>('uvrSessions')
    const stems = adapter.getRepository<UvrStemBlob>('uvrStemBlobs')
    await stems.create({
      sessionId: deletedId,
      stemType: 'vocal',
      mimeType: 'audio/wav',
      data: new ArrayBuffer(4),
      size: 4,
      fileName: 'vocal.wav',
    })

    const entered = Promise.withResolvers<undefined>()
    const release = Promise.withResolvers<undefined>()
    const firstWritten = Promise.withResolvers<undefined>()
    releases.push(() => release.resolve(undefined))
    const update = repo.update.bind(repo)
    vi.spyOn(repo, 'update').mockImplementation(async (id, patch) => {
      const held = patch.appSessionId === firstId && patch.progress === 19
      if (held) {
        entered.resolve(undefined)
        await release.promise
      }
      const record = await update(id, patch)
      if (held) firstWritten.resolve(undefined)
      return record
    })

    store.saveAllUvrSessions(
      store
        .getAllUvrSessions()
        .map((session) => ({ ...session, progress: 19 })),
    )
    await entered.promise
    try {
      // The portable importer and archive rollback call this strict service
      // directly, without the store's session tombstone or queue.
      await deleteImportedUvrSessionDataStrict(deletedId)
      store.removeUvrSessionFromCache(deletedId)
      expect(
        await repo.findAll({ where: { appSessionId: deletedId } }),
      ).toEqual([])
      expect(await stems.findAll({ where: { sessionId: deletedId } })).toEqual(
        [],
      )
    } finally {
      release.resolve(undefined)
    }
    await firstWritten.promise
    // Drain runnable I/O over the synchronous Map adapter; no sleep or
    // elapsed-time threshold chooses which competing operation wins.
    await new Promise<void>((resolve) => setImmediate(resolve))

    expect(await repo.findAll({ where: { appSessionId: deletedId } })).toEqual(
      [],
    )
    expect(store.getUvrSession(deletedId)).toBeUndefined()
    expect(await repo.findAll({ where: { appSessionId: lastId } })).toEqual([
      expect.objectContaining({ appSessionId: lastId, progress: 19 }),
    ])
    expect(await stems.findAll({ where: { sessionId: deletedId } })).toEqual([])
  })
})
