// The Danger Zone reset, tested at both layers.
//
// Unit: each scope runs its steps in order against an injected environment —
// most importantly that STORAGE IS CLEARED LAST. The old flow cleared
// localStorage first and then hung on deleteDatabase, leaving a half-wiped
// app with no feedback.
//
// Integration (fake-indexeddb): deleteDatabase genuinely waits while a
// connection is open. The app holds two of its own (the db singleton and
// local-database's second adapter); closing them first is the fix for the
// reset button that "just hangs", and the blocked callback is how the one
// remaining cause — another tab — gets explained to the user.

import { describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { MERCURY_PITCH_DB_NAME } from '@/db/adapters/dexie-adapter'
import { MODEL_CACHE_DB_NAME } from '@/lib/model-cache'
import type { ResetEnv } from '@/lib/reset-app-data'
import { PRESERVED_KEY_PREFIX, RESET_STEPS, resetAppData, } from '@/lib/reset-app-data'

function fakeLocalStorage(initial: Record<string, string>) {
  const map = new Map(Object.entries(initial))
  return {
    store: map,
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
    removeItem: (k: string) => map.delete(k),
    clear: vi.fn(() => map.clear()),
  }
}

function fakeEnv(overrides: Partial<ResetEnv> = {}) {
  const calls: string[] = []
  const local = fakeLocalStorage({
    'mp:userId': 'u1',
    'mp:authToken': 't1',
    'mercurypitch.someSetting.v1': 'x',
    'km-collapsed': '1',
  })
  const env: ResetEnv = {
    closeConnections: vi.fn(async () => {
      calls.push('close')
    }),
    deleteIdb: vi.fn(async (name: string) => {
      calls.push(`delete:${name}`)
    }),
    localStorage: local,
    sessionStorage: { clear: vi.fn(() => calls.push('session')) },
    caches: {
      keys: vi.fn(async () => ['mercurypitch-assets-a', 'other']),
      delete: vi.fn(async (name: string) => {
        calls.push(`cache:${name}`)
        return true
      }),
    },
    swContainer: {
      getRegistrations: vi.fn(
        async () =>
          [
            { unregister: vi.fn(async () => calls.push('sw') !== 0) },
          ] as unknown as readonly ServiceWorkerRegistration[],
      ),
    },
    ...overrides,
  }
  // Wrap clear to record ordering alongside everything else.
  const originalClear = local.clear.getMockImplementation()!
  local.clear.mockImplementation(() => {
    calls.push('storage-clear')
    originalClear()
  })
  return { env, calls, local }
}

describe('resetAppData — scopes', () => {
  it('settings: clears storage but keeps the identity keys and the database', async () => {
    const { env, local } = fakeEnv()
    const steps: string[] = []
    await resetAppData(
      'settings',
      { onStep: (s, i, t) => steps.push(`${s.id}:${i}/${t}`) },
      env,
    )

    // Identity and auth survive — the database rows they own are being kept.
    expect([...local.store.keys()]).toEqual(['mp:userId', 'mp:authToken'])
    expect(env.sessionStorage.clear).toHaveBeenCalledTimes(1)
    expect(env.deleteIdb).not.toHaveBeenCalled()
    expect(env.closeConnections).not.toHaveBeenCalled()
    expect(steps).toEqual(['settings:0/1'])
  })

  it('database: closes connections, then deletes both databases, keeping storage', async () => {
    const { env, calls, local } = fakeEnv()
    await resetAppData('database', {}, env)

    expect(calls).toEqual([
      'close',
      `delete:${MERCURY_PITCH_DB_NAME}`,
      `delete:${MODEL_CACHE_DB_NAME}`,
    ])
    expect(local.store.size).toBe(4)
  })

  it('factory: everything, with storage cleared only after the deletes', async () => {
    const { env, calls } = fakeEnv()
    const steps: string[] = []
    await resetAppData(
      'factory',
      { onStep: (s, i, t) => steps.push(`${s.id}:${i}/${t}`) },
      env,
    )

    expect(calls).toEqual([
      'close',
      `delete:${MERCURY_PITCH_DB_NAME}`,
      `delete:${MODEL_CACHE_DB_NAME}`,
      'storage-clear',
      'session',
      'cache:mercurypitch-assets-a',
      'cache:other',
      'sw',
    ])
    expect(steps).toEqual(RESET_STEPS.factory.map((s, i) => `${s.id}:${i}/6`))
  })

  it('a failing delete leaves storage untouched (the old flow wiped it first)', async () => {
    const { env, local } = fakeEnv({
      deleteIdb: vi.fn(async () => {
        throw new Error('blocked forever')
      }),
    })
    await expect(resetAppData('factory', {}, env)).rejects.toThrow(
      'blocked forever',
    )

    expect(local.clear).not.toHaveBeenCalled()
    expect(local.store.size).toBe(4)
    expect(env.sessionStorage.clear).not.toHaveBeenCalled()
  })

  it('relays the blocked signal from the delete', async () => {
    const { env } = fakeEnv({
      deleteIdb: vi.fn(async (_name, onBlocked) => {
        onBlocked?.()
      }),
    })
    const onBlocked = vi.fn()
    await resetAppData('database', { onBlocked }, env)

    expect(onBlocked).toHaveBeenCalledTimes(2)
  })

  it('factory copes with no cache storage and no service worker', async () => {
    const { env } = fakeEnv({ caches: undefined, swContainer: undefined })
    await expect(resetAppData('factory', {}, env)).resolves.toBeUndefined()
  })

  it('preserved-prefix constant matches the identity keys the app writes', () => {
    // auth-service/user-service write mp:userId, mp:deviceSecret,
    // mp:authToken — all under this prefix. A rename there must fail here.
    expect('mp:userId'.startsWith(PRESERVED_KEY_PREFIX)).toBe(true)
  })
})

describe('resetAppData — against a real (fake) IndexedDB', () => {
  it('closing the app’s own connections lets the delete finish unblocked', async () => {
    // Open every connection the app actually holds: the db singleton,
    // local-database's second adapter, and — the dangerous one — the model
    // cache. Dexie closes its own connections when a delete fires
    // versionchange, but the model cache is a RAW IndexedDB connection with
    // no versionchange handler, opened at startup for the pitch models:
    // without the close step, deleting its database waits forever.
    const { getDb } = await import('@/db')
    const { getLocalDatabase } = await import('@/db/local-database')
    const { getCachedModel } = await import('@/lib/model-cache')
    await getDb()
    await getLocalDatabase().getRepository('userProfiles').findAll({})
    await getCachedModel('any-model')

    const onBlocked = vi.fn()
    await resetAppData('database', { onBlocked })

    expect(onBlocked).not.toHaveBeenCalled()
  })

  it('a foreign connection blocks the delete, and it completes once closed', async () => {
    // The "another tab" case: someone else holds the database open. The
    // delete must report blocked (so the UI can say why nothing happens)
    // and still finish the moment that connection goes away.
    const foreign = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = globalThis.indexedDB.open(MERCURY_PITCH_DB_NAME)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    const onBlocked = vi.fn(() => foreign.close())
    await resetAppData('database', { onBlocked })

    expect(onBlocked).toHaveBeenCalled()
  })
})

describe('resetAppData — default environment edges', () => {
  it('rejects when the browser refuses the delete, keeping the error', async () => {
    // The default deleteIdb's error path — a quota or corruption failure.
    const original = globalThis.indexedDB.deleteDatabase.bind(
      globalThis.indexedDB,
    )
    const fakeRequest = (error: DOMException | null) => {
      const req = {
        error,
        onblocked: null,
        onsuccess: null,
        onerror: null as (() => void) | null,
      }
      setTimeout(() => req.onerror?.(), 0)
      return req as unknown as IDBOpenDBRequest
    }
    globalThis.indexedDB.deleteDatabase = vi
      .fn()
      .mockReturnValueOnce(
        fakeRequest(new DOMException('quota', 'QuotaExceededError')),
      )
      .mockReturnValueOnce(fakeRequest(null))
    try {
      await expect(
        resetAppData('database', {}, { closeConnections: async () => {} }),
      ).rejects.toThrow('quota')
      // And with no error object, a readable fallback message.
      await expect(
        resetAppData('database', {}, { closeConnections: async () => {} }),
      ).rejects.toThrow('deleteDatabase(MercuryPitchDB) failed')
    } finally {
      globalThis.indexedDB.deleteDatabase = original
    }
  })

  it('uses the page’s own cache storage and worker registry when present', async () => {
    const cacheDelete = vi.fn(async () => true)
    const unregister = vi.fn(async () => true)
    Object.defineProperty(globalThis, 'caches', {
      value: {
        keys: async () => ['mercurypitch-assets-x'],
        delete: cacheDelete,
      },
      configurable: true,
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: async () => [{ unregister }] },
      configurable: true,
    })
    try {
      await resetAppData(
        'factory',
        {},
        { closeConnections: async () => {}, deleteIdb: async () => {} },
      )
      expect(cacheDelete).toHaveBeenCalledWith('mercurypitch-assets-x')
      expect(unregister).toHaveBeenCalledTimes(1)
    } finally {
      Reflect.deleteProperty(globalThis, 'caches')
      Reflect.deleteProperty(navigator, 'serviceWorker')
    }
  })
})
