// ============================================================
// UVR persistence ordering — bulk saves share each session's write queue
// ============================================================
//
// Run the real store over a stateful repository. Deferred I/O makes the older
// write finish last deliberately; assertions inspect saved rows and reloads,
// not which persistence helper the store happened to call.

import { setImmediate } from 'node:timers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionGroupRecord, UvrSessionRecord } from '@/db/entities'
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

// All fake I/O uses promises over synchronous Maps. One event-loop checkpoint
// drains runnable I/O while our explicit gate stays held; it is not a sleep or
// a timing threshold. Writes correctly queued behind the gate remain pending.
function settleRunnableIo(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

function deferredIo() {
  const entered = Promise.withResolvers<undefined>()
  const release = Promise.withResolvers<undefined>()
  releases.push(() => release.resolve(undefined))
  return { entered, release }
}

function sessionRepo() {
  return adapter.getRepository<UvrSessionRecord>('uvrSessions')
}

function savedRows(sessionId: string) {
  return sessionRepo().findAll({ where: { appSessionId: sessionId } })
}

function requireSession(store: Store, sessionId: string) {
  const session = store.getUvrSession(sessionId)
  if (session === undefined)
    throw new Error(`Missing test session ${sessionId}`)
  return session
}

async function savedSession(store: Store, name: string) {
  const sessionId = store.startUvrSession(
    name,
    12,
    'audio/wav',
    'separate',
    'server',
  )
  expect(
    await store.persistSessionDurable(requireSession(store, sessionId)),
  ).toBe(true)
  expect(await savedRows(sessionId)).toHaveLength(1)
  return sessionId
}

/** Delay the first database acquisition, before any repository snapshot. */
function holdNextDb() {
  const io = deferredIo()
  boundary.nextDbWait = async () => {
    io.entered.resolve(undefined)
    await io.release.promise
  }
  return io
}

/** A bulk save writes A before B in the broken implementation. */
function holdBulkWrite(firstId: string, secondId: string) {
  const repo = sessionRepo()
  const update = repo.update.bind(repo)
  const first = deferredIo()
  const firstWritten = Promise.withResolvers<undefined>()
  const secondWritten = Promise.withResolvers<undefined>()
  let held = false
  vi.spyOn(repo, 'update').mockImplementation(async (id, patch) => {
    if (patch.appSessionId === firstId && patch.progress === 19 && !held) {
      held = true
      first.entered.resolve(undefined)
      await first.release.promise
    }
    const record = await update(id, patch)
    if (patch.appSessionId === firstId && patch.progress === 19) {
      firstWritten.resolve(undefined)
    }
    if (
      patch.appSessionId === secondId &&
      patch.progress === 19 &&
      patch.apiSessionId === undefined &&
      patch.groupId === undefined
    ) {
      secondWritten.resolve(undefined)
    }
    return record
  })
  return { first, firstWritten, secondWritten }
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

describe('UVR per-session and whole-list persistence', () => {
  it('creates one row when a fresh session is immediately marked processing by a bulk save', async () => {
    const store = await import('./uvr-store')
    const repo = sessionRepo()
    const create = repo.create.bind(repo)
    const firstCreate = deferredIo()
    const firstCreated = Promise.withResolvers<undefined>()
    let sessionId = ''
    let held = false
    vi.spyOn(repo, 'create').mockImplementation(async (data) => {
      if (data.appSessionId === sessionId && !held) {
        held = true
        firstCreate.entered.resolve(undefined)
        await firstCreate.release.promise
        const record = await create(data)
        firstCreated.resolve(undefined)
        return record
      }
      return create(data)
    })

    sessionId = store.startUvrSession(
      'First.wav',
      12,
      'audio/wav',
      'separate',
      'server',
    )
    // PitchTestingTab mutates the newly-created session and saves the list
    // synchronously, before the initial per-session insert has completed.
    requireSession(store, sessionId).status = 'processing'
    store.saveAllUvrSessions(store.getAllUvrSessions())
    await firstCreate.entered.promise
    try {
      await settleRunnableIo()
    } finally {
      firstCreate.release.resolve(undefined)
    }
    await firstCreated.promise
    expect(
      await store.persistSessionDurable(requireSession(store, sessionId)),
    ).toBe(true)
    expect(await savedRows(sessionId)).toEqual([
      expect.objectContaining({
        appSessionId: sessionId,
        status: 'processing',
      }),
    ])
  })

  it('keeps a later durable provider ID when an older bulk save finishes last', async () => {
    const store = await import('./uvr-store')
    const firstId = await savedSession(store, 'Slow.wav')
    const secondId = await savedSession(store, 'Recoverable.wav')
    const { first, firstWritten, secondWritten } = holdBulkWrite(
      firstId,
      secondId,
    )
    store.saveAllUvrSessions(
      store.getAllUvrSessions().map((session) => ({
        ...session,
        status: 'processing' as const,
        progress: 19,
      })),
    )
    await first.entered.promise
    const newer = store.setUvrSessionApiIdDurable(
      secondId,
      'runpod-recoverable',
    )
    try {
      await settleRunnableIo()
    } finally {
      first.release.resolve(undefined)
    }
    expect(await newer).toBe(true)
    await Promise.all([firstWritten.promise, secondWritten.promise])
    expect(await savedRows(secondId)).toEqual([
      expect.objectContaining({
        apiSessionId: 'runpod-recoverable',
        status: 'processing',
      }),
    ])

    vi.resetModules()
    const reloaded = await import('./uvr-store')
    await reloaded.initSessionStore()
    expect(reloaded.getUvrSession(secondId)?.apiSessionId).toBe(
      'runpod-recoverable',
    )
    expect(
      (await reloaded.resumableServerSessions()).map(
        (session) => session.sessionId,
      ),
    ).toContain(secondId)
  })

  it('does not delete a new session created after a whole-list save was requested', async () => {
    const store = await import('./uvr-store')
    const firstId = await savedSession(store, 'Existing.wav')
    const repo = sessionRepo()
    const update = repo.update.bind(repo)
    const bulkWritten = Promise.withResolvers<undefined>()
    vi.spyOn(repo, 'update').mockImplementation(async (id, patch) => {
      const record = await update(id, patch)
      if (patch.appSessionId === firstId && patch.progress === 19)
        bulkWritten.resolve(undefined)
      return record
    })
    const snapshot = holdNextDb()
    store.saveAllUvrSessions([
      { ...requireSession(store, firstId), progress: 19 },
    ])
    await snapshot.entered.promise
    const newId = store.startUvrSession(
      'Arrived later.wav',
      12,
      'audio/wav',
      'separate',
      'server',
    )
    const newer = store.persistSessionDurable(requireSession(store, newId))
    try {
      await settleRunnableIo()
    } finally {
      snapshot.release.resolve(undefined)
    }
    expect(await newer).toBe(true)
    await bulkWritten.promise
    expect(await savedRows(newId)).toEqual([
      expect.objectContaining({
        appSessionId: newId,
        originalFileName: 'Arrived later.wav',
      }),
    ])
    expect(store.getUvrSession(newId)?.originalFile?.name).toBe(
      'Arrived later.wav',
    )
  })

  it('does not recreate a deleted session when an older whole-list save resumes', async () => {
    const store = await import('./uvr-store')
    const firstId = await savedSession(store, 'Kept.wav')
    const deletedId = await savedSession(store, 'Deleted.wav')
    const repo = sessionRepo()
    const update = repo.update.bind(repo)
    const keptWritten = Promise.withResolvers<undefined>()
    vi.spyOn(repo, 'update').mockImplementation(async (id, patch) => {
      const record = await update(id, patch)
      if (patch.appSessionId === firstId && patch.progress === 19)
        keptWritten.resolve(undefined)
      return record
    })
    const snapshot = holdNextDb()
    store.saveAllUvrSessions(
      store
        .getAllUvrSessions()
        .map((session) => ({ ...session, progress: 19 })),
    )
    await snapshot.entered.promise
    const deleted = store.deleteUvrSession(deletedId)
    try {
      await settleRunnableIo()
    } finally {
      snapshot.release.resolve(undefined)
    }
    expect(await deleted).toBe(true)
    await keptWritten.promise
    expect(
      await store.persistSessionDurable({
        sessionId: deletedId,
        status: 'processing',
        progress: 10,
        createdAt: Date.now(),
      }),
    ).toBe(true)
    expect(await savedRows(deletedId)).toEqual([])
    expect(store.getUvrSession(deletedId)).toBeUndefined()
    expect(await savedRows(firstId)).toHaveLength(1)
  })

  it('preserves a later group assignment and its index when an old bulk save resumes', async () => {
    const store = await import('./uvr-store')
    const firstId = await savedSession(store, 'Slow.wav')
    const secondId = await savedSession(store, 'Grouped.wav')
    const group = await store.createGroup('Set list')
    const { first, firstWritten, secondWritten } = holdBulkWrite(
      firstId,
      secondId,
    )
    store.saveAllUvrSessions(
      store
        .getAllUvrSessions()
        .map((session) => ({ ...session, progress: 19 })),
    )
    await first.entered.promise
    const grouped = store.addSessionToGroup(secondId, group.id)
    try {
      await settleRunnableIo()
    } finally {
      first.release.resolve(undefined)
    }
    await grouped
    await Promise.all([firstWritten.promise, secondWritten.promise])
    expect(await savedRows(secondId)).toEqual([
      expect.objectContaining({ groupId: group.id }),
    ])
    expect(
      await adapter
        .getRepository<SessionGroupRecord>('sessionGroups')
        .findById(group.id),
    ).toMatchObject({
      sessionIds: [secondId],
    })
    expect(store.getUvrSession(secondId)?.groupId).toBe(group.id)
  })

  it('allows a later durable write after an earlier bulk write rejects', async () => {
    const store = await import('./uvr-store')
    const sessionId = await savedSession(store, 'Retry.wav')
    const repo = sessionRepo()
    const update = repo.update.bind(repo)
    const rejected = Promise.withResolvers<undefined>()
    let failed = false
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(repo, 'update').mockImplementation(async (id, patch) => {
      if (
        patch.appSessionId === sessionId &&
        patch.progress === 19 &&
        !failed
      ) {
        failed = true
        rejected.resolve(undefined)
        throw new Error('Simulated temporary storage failure')
      }
      return update(id, patch)
    })
    store.saveAllUvrSessions([
      { ...requireSession(store, sessionId), progress: 19 },
    ])
    await rejected.promise
    expect(
      await store.setUvrSessionApiIdDurable(sessionId, 'runpod-after-failure'),
    ).toBe(true)
    expect(await savedRows(sessionId)).toEqual([
      expect.objectContaining({
        apiSessionId: 'runpod-after-failure',
        progress: 19,
      }),
    ])
  })

  it('orders a whole-list save after an earlier write to the same session', async () => {
    const store = await import('./uvr-store')
    const sessionId = await savedSession(store, 'Ordered.wav')
    const repo = sessionRepo()
    const update = repo.update.bind(repo)
    const first = deferredIo()
    const bulkWritten = Promise.withResolvers<undefined>()
    vi.spyOn(repo, 'update').mockImplementation(async (id, patch) => {
      if (patch.appSessionId === sessionId && patch.progress === 11) {
        first.entered.resolve(undefined)
        await first.release.promise
      }
      const record = await update(id, patch)
      if (patch.appSessionId === sessionId && patch.progress === 22)
        bulkWritten.resolve(undefined)
      return record
    })
    const session = requireSession(store, sessionId)
    const older = store.persistSessionDurable({ ...session, progress: 11 })
    await first.entered.promise
    store.saveAllUvrSessions([{ ...session, progress: 22 }])
    try {
      await settleRunnableIo()
    } finally {
      first.release.resolve(undefined)
    }
    expect(await older).toBe(true)
    await bulkWritten.promise
    expect(await savedRows(sessionId)).toEqual([
      expect.objectContaining({ progress: 22 }),
    ])
  })

  it('persists consecutive whole-list saves in invocation order', async () => {
    const store = await import('./uvr-store')
    const sessionId = await savedSession(store, 'Bulk order.wav')
    const repo = sessionRepo()
    const update = repo.update.bind(repo)
    const firstWritten = Promise.withResolvers<undefined>()
    const secondWritten = Promise.withResolvers<undefined>()
    vi.spyOn(repo, 'update').mockImplementation(async (id, patch) => {
      const record = await update(id, patch)
      if (patch.appSessionId === sessionId && patch.progress === 11)
        firstWritten.resolve(undefined)
      if (patch.appSessionId === sessionId && patch.progress === 22)
        secondWritten.resolve(undefined)
      return record
    })
    const session = requireSession(store, sessionId)
    const first = holdNextDb()
    store.saveAllUvrSessions([{ ...session, progress: 11 }])
    await first.entered.promise
    store.saveAllUvrSessions([{ ...session, progress: 22 }])
    try {
      await settleRunnableIo()
    } finally {
      first.release.resolve(undefined)
    }
    await Promise.all([firstWritten.promise, secondWritten.promise])
    expect(await savedRows(sessionId)).toEqual([
      expect.objectContaining({ progress: 22 }),
    ])
  })

  it('keeps writes to different sessions independent when no bulk save is pending', async () => {
    const store = await import('./uvr-store')
    const firstId = await savedSession(store, 'Held.wav')
    const secondId = await savedSession(store, 'Independent.wav')
    const { first, firstWritten } = holdBulkWrite(firstId, secondId)
    const held = store.persistSessionDurable({
      ...requireSession(store, firstId),
      progress: 19,
    })
    await first.entered.promise
    try {
      expect(
        await store.setUvrSessionApiIdDurable(secondId, 'runpod-independent'),
      ).toBe(true)
      expect(await savedRows(secondId)).toEqual([
        expect.objectContaining({ apiSessionId: 'runpod-independent' }),
      ])
    } finally {
      first.release.resolve(undefined)
    }
    expect(await held).toBe(true)
    await firstWritten.promise
  })

  it('finishes a durable retry before a newer write to the same session', async () => {
    const store = await import('./uvr-store')
    const sessionId = await savedSession(store, 'Retried.wav')
    const repo = sessionRepo()
    const update = repo.update.bind(repo)
    const failure = deferredIo()
    let failed = false
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(repo, 'update').mockImplementation(async (id, patch) => {
      if (
        patch.appSessionId === sessionId &&
        patch.progress === 11 &&
        !failed
      ) {
        failed = true
        failure.entered.resolve(undefined)
        await failure.release.promise
        throw new Error('Simulated first-attempt failure')
      }
      return update(id, patch)
    })
    const session = requireSession(store, sessionId)
    const older = store.persistSessionDurable({ ...session, progress: 11 })
    await failure.entered.promise
    const newer = store.persistSessionDurable({ ...session, progress: 22 })
    failure.release.resolve(undefined)
    expect(await older).toBe(true)
    expect(await newer).toBe(true)
    expect(await savedRows(sessionId)).toEqual([
      expect.objectContaining({ progress: 22 }),
    ])
  })

  it('drains an older bulk save before wiping and permits reseeding an explicit session ID', async () => {
    const store = await import('./uvr-store')
    const sessionId = await savedSession(store, 'Before reset.wav')
    const original = requireSession(store, sessionId)
    const snapshot = holdNextDb()
    store.saveAllUvrSessions([{ ...original, progress: 19 }])
    await snapshot.entered.promise
    store.deleteAllUvrSessions()
    const wiped = store.uvrSessionsWipeSettled()
    try {
      await settleRunnableIo()
    } finally {
      snapshot.release.resolve(undefined)
    }
    await wiped
    await settleRunnableIo()
    expect(await savedRows(sessionId)).toEqual([])
    expect(store.getAllUvrSessions()).toEqual([])

    expect(
      await store.importUvrSessionDurable({
        ...original,
        originalFile: {
          name: 'Reseeded demo.wav',
          size: 12,
          mimeType: 'audio/wav',
        },
      }),
    ).toBe(true)
    expect(await savedRows(sessionId)).toEqual([
      expect.objectContaining({ originalFileName: 'Reseeded demo.wav' }),
    ])
  })

  it('does not restore a deleted group from an older bulk session snapshot', async () => {
    const store = await import('./uvr-store')
    const sessionId = await savedSession(store, 'Ungrouped after delete.wav')
    const group = await store.createGroup('Removed group')
    await store.addSessionToGroup(sessionId, group.id)
    const repo = sessionRepo()
    const update = repo.update.bind(repo)
    const bulkWritten = Promise.withResolvers<undefined>()
    vi.spyOn(repo, 'update').mockImplementation(async (id, patch) => {
      const record = await update(id, patch)
      if (patch.appSessionId === sessionId && patch.progress === 19)
        bulkWritten.resolve(undefined)
      return record
    })
    const snapshot = holdNextDb()
    store.saveAllUvrSessions([
      { ...requireSession(store, sessionId), progress: 19 },
    ])
    await snapshot.entered.promise
    const deleted = store.deleteGroup(group.id)
    try {
      await settleRunnableIo()
    } finally {
      snapshot.release.resolve(undefined)
    }
    await deleted
    await bulkWritten.promise
    expect(await savedRows(sessionId)).toEqual([
      expect.objectContaining({ groupId: undefined }),
    ])
    expect(
      await adapter
        .getRepository<SessionGroupRecord>('sessionGroups')
        .findById(group.id),
    ).toBeNull()
    expect(store.getUvrSession(sessionId)?.groupId).toBeUndefined()
  })
})
