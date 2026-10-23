// UVR session persistence through the real Dexie adapter and IndexedDB schema.
// Only the database factory is redirected; repository reads/writes are real.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { DexieAdapter } from '@/db/adapters/dexie-adapter'
import type { UvrSessionRecord } from '@/db/entities'
import type * as StoreModule from './uvr-store'

let adapter: DexieAdapter
vi.mock('@/db', () => ({ getDb: async () => adapter }))

type Store = typeof StoreModule

function requireSession(store: Store, sessionId: string) {
  const session = store.getUvrSession(sessionId)
  if (session === undefined)
    throw new Error(`Missing test session ${sessionId}`)
  return session
}

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  adapter = new DexieAdapter()
})

afterEach(async () => {
  await adapter.destroy()
})

describe('UVR IndexedDB persistence', () => {
  it('reloads one recoverable row after immediate start, bulk save and provider acknowledgement', async () => {
    const store = await import('./uvr-store')
    const id = store.startUvrSession(
      'Recoverable.wav',
      120,
      'audio/wav',
      'separate',
      'server',
    )
    requireSession(store, id).status = 'processing'
    store.saveAllUvrSessions(store.getAllUvrSessions())
    expect(await store.setUvrSessionApiIdDurable(id, 'runpod-accepted')).toBe(
      true,
    )

    const rows = await adapter
      .getRepository<UvrSessionRecord>('uvrSessions')
      .findAll({
        where: { appSessionId: id },
        throwOnError: true,
      })
    expect(rows).toEqual([
      expect.objectContaining({
        appSessionId: id,
        apiSessionId: 'runpod-accepted',
        status: 'processing',
      }),
    ])

    vi.resetModules()
    const reloaded = await import('./uvr-store')
    await reloaded.initSessionStore()
    expect(reloaded.getUvrSession(id)).toMatchObject({
      apiSessionId: 'runpod-accepted',
      status: 'processing',
    })
    expect(
      (await reloaded.resumableServerSessions()).map(
        (session) => session.sessionId,
      ),
    ).toEqual([id])
  })

  it('replaces contradictory duplicate records with the acknowledged payload before reload', async () => {
    const store = await import('./uvr-store')
    const id = store.startUvrSession(
      'Legacy.wav',
      120,
      'audio/wav',
      'separate',
      'server',
    )
    expect(await store.persistSessionDurable(requireSession(store, id))).toBe(
      true,
    )
    const repo = adapter.getRepository<UvrSessionRecord>('uvrSessions')
    const [existing] = await repo.findAll({
      where: { appSessionId: id },
      throwOnError: true,
    })
    await repo.create({
      ...existing,
      apiSessionId: 'runpod-outdated',
      status: 'error',
      error: 'Old failure',
    })
    expect(
      await repo.findAll({ where: { appSessionId: id }, throwOnError: true }),
    ).toHaveLength(2)

    expect(
      await store.persistSessionDurable({
        ...requireSession(store, id),
        status: 'processing',
        apiSessionId: 'runpod-current',
        error: undefined,
      }),
    ).toBe(true)
    const saved = await repo.findAll({
      where: { appSessionId: id },
      throwOnError: true,
    })
    expect(saved).toEqual([
      expect.objectContaining({
        apiSessionId: 'runpod-current',
        status: 'processing',
      }),
    ])
    // Dexie removes fields updated to undefined; both absence and undefined
    // represent the cleared optional error to callers.
    expect(saved[0].error).toBeUndefined()

    vi.resetModules()
    const reloaded = await import('./uvr-store')
    await reloaded.initSessionStore()
    expect(reloaded.getUvrSession(id)).toMatchObject({
      apiSessionId: 'runpod-current',
      status: 'processing',
      error: undefined,
    })
  })
})
