// The storage port, at the two things that can lose an account.
//
// Cache semantics: a synchronous reader must keep working behind an async
// store, and it must not answer from the WRONG store while hydration is in
// flight — a stale `mp:userId` read from `localStorage` on a device whose
// real identity lives in Preferences is how one device ends up wearing
// another's id.
//
// Migration: the first native launch finds an empty port and a populated
// `localStorage`. If that is not carried across, the device mints a fresh
// UUID and secret and the server row it used to own becomes unreachable
// forever. It is a copy, not a move, deliberately.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoragePort } from '@/lib/storage-port'
import { AUTH_TOKEN_KEY, DEVICE_SECRET_KEY, flushStoragePort, hydrateStoragePort, installStoragePort, readStored, removeStored, resetStoragePort, storageDurable, storagePortSnapshot, USER_ID_KEY, writeStored, } from '@/lib/storage-port'

/** A stand-in for `@capacitor/preferences`: async, and its own store. */
function fakePort(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  const port: StoragePort = {
    get: (key) => Promise.resolve(store.get(key) ?? null),
    set: (key, value) => {
      store.set(key, value)
      return Promise.resolve()
    },
    remove: (key) => {
      store.delete(key)
      return Promise.resolve()
    },
  }
  return { port, store }
}

beforeEach(() => {
  resetStoragePort()
  localStorage.clear()
})

afterEach(() => {
  resetStoragePort()
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('the web backend', () => {
  it('reads and writes localStorage with no hydration at all', async () => {
    await hydrateStoragePort()

    expect(writeStored(USER_ID_KEY, 'u-1')).toBe(true)
    expect(localStorage.getItem(USER_ID_KEY)).toBe('u-1')
    expect(readStored(USER_ID_KEY)).toBe('u-1')
  })

  it('never enters the hydration window at all', () => {
    // Nothing is installed and nothing is awaited on the web: the browser's
    // own store IS the synchronous cache. This is the assertion that the
    // native boot-order guard did not leak into a tab.
    expect(() => readStored(USER_ID_KEY)).not.toThrow()
    expect(() => writeStored(USER_ID_KEY, 'u-1')).not.toThrow()
    expect(() => removeStored(USER_ID_KEY)).not.toThrow()
    expect(storageDurable()).toBe(true)
  })

  it('sees a value another part of the app wrote directly', () => {
    // The browser's own store IS the cache here, so there is no second copy
    // to go stale. Several tests and both e2e suites seed identity this way.
    localStorage.setItem(AUTH_TOKEN_KEY, 'jwt')

    expect(readStored(AUTH_TOKEN_KEY)).toBe('jwt')
  })

  it('reports a refused write rather than pretending it landed', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(writeStored(DEVICE_SECRET_KEY, 'secret')).toBe(false)
    expect(storageDurable()).toBe(false)
  })

  it('reports a refused read the same way', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('site data blocked')
    })

    expect(readStored(USER_ID_KEY)).toBeNull()
    expect(storageDurable()).toBe(false)
  })
})

describe('an installed port', () => {
  it('refuses to answer a read until it has been hydrated', () => {
    localStorage.setItem(USER_ID_KEY, 'from-localstorage')
    const { port } = fakePort({ [USER_ID_KEY]: 'from-the-port' })

    installStoragePort(port)

    // Not 'from-localstorage', and not null either. Answering from the store
    // the port replaced is one failure; answering null is the worse one,
    // because `getUserId()` reads that as a new device and mints a third
    // identity straight over a durable one. A boot-order bug has to be loud.
    expect(() => readStored(USER_ID_KEY)).toThrow('storage port not hydrated')
  })

  it('refuses a write in that same window', () => {
    const { port, store } = fakePort({ [USER_ID_KEY]: 'u-durable' })

    installStoragePort(port)

    expect(() => writeStored(USER_ID_KEY, 'u-minted')).toThrow(
      'storage port not hydrated',
    )
    // And nothing was queued against the port on the way out.
    expect(store.get(USER_ID_KEY)).toBe('u-durable')
  })

  it('refuses a removal in that same window', () => {
    const { port, store } = fakePort({ [DEVICE_SECRET_KEY]: 's-durable' })

    installStoragePort(port)

    expect(() => removeStored(DEVICE_SECRET_KEY)).toThrow(
      'storage port not hydrated',
    )
    expect(store.get(DEVICE_SECRET_KEY)).toBe('s-durable')
  })

  it('is not durable in that window, so the mint path asks and gets no', () => {
    const { port } = fakePort()

    installStoragePort(port)

    // `getDeviceSecret()` asks this before it mints. A `true` here would send
    // it straight into the write that throws.
    expect(storageDurable()).toBe(false)
  })

  it('is readable and durable again the moment hydration has run', async () => {
    const { port } = fakePort()
    installStoragePort(port)

    await hydrateStoragePort()

    expect(storageDurable()).toBe(true)
    expect(() => readStored(USER_ID_KEY)).not.toThrow()
  })

  it('answers every later read from the cache, synchronously', async () => {
    const { port } = fakePort({
      [USER_ID_KEY]: 'u-9',
      [DEVICE_SECRET_KEY]: 's-9',
    })
    installStoragePort(port)

    await hydrateStoragePort()

    expect(readStored(USER_ID_KEY)).toBe('u-9')
    expect(readStored(DEVICE_SECRET_KEY)).toBe('s-9')
    expect(readStored(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('makes a write readable in the same tick, and persists it after', async () => {
    const { port, store } = fakePort()
    installStoragePort(port)
    await hydrateStoragePort()

    writeStored(AUTH_TOKEN_KEY, 'jwt-1')

    // The cache first: `setAuthToken` is followed synchronously by code that
    // reads the token back out.
    expect(readStored(AUTH_TOKEN_KEY)).toBe('jwt-1')
    await flushStoragePort()
    expect(store.get(AUTH_TOKEN_KEY)).toBe('jwt-1')
  })

  it('forgets a value in both places', async () => {
    const { port, store } = fakePort({ [DEVICE_SECRET_KEY]: 's-1' })
    installStoragePort(port)
    await hydrateStoragePort()

    removeStored(DEVICE_SECRET_KEY)

    expect(readStored(DEVICE_SECRET_KEY)).toBeNull()
    await flushStoragePort()
    expect(store.has(DEVICE_SECRET_KEY)).toBe(false)
  })

  it('never leaves a rejected write unhandled, and admits it failed', async () => {
    const { port } = fakePort()
    const failing: StoragePort = {
      ...port,
      set: () => Promise.reject(new Error('bridge gone')),
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    installStoragePort(failing)
    await hydrateStoragePort()

    writeStored(USER_ID_KEY, 'u-2')
    await flushStoragePort()

    // A fire-and-forget tail whose rejection nobody owns turns a green run
    // red at the end of the file that started it.
    expect(storageDurable()).toBe(false)
  })

  it('reports the port unreadable when hydration cannot reach it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    installStoragePort({
      get: () => Promise.reject(new Error('bridge gone')),
      set: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    })

    await hydrateStoragePort()

    expect(storageDurable()).toBe(false)
  })
})

describe('the first native launch', () => {
  it('copies an existing identity out of localStorage, and leaves it there', async () => {
    localStorage.setItem(USER_ID_KEY, 'u-old')
    localStorage.setItem(DEVICE_SECRET_KEY, 's-old')
    const { port, store } = fakePort()
    installStoragePort(port)

    await hydrateStoragePort()

    expect(readStored(USER_ID_KEY)).toBe('u-old')
    expect(store.get(DEVICE_SECRET_KEY)).toBe('s-old')
    // Copied, not moved: a device that fails halfway must still be able to
    // fall back, and the WebView clears the old copy on its own schedule.
    expect(localStorage.getItem(USER_ID_KEY)).toBe('u-old')
  })

  it('never lets the old copy overwrite what the port already holds', async () => {
    localStorage.setItem(USER_ID_KEY, 'u-stale')
    const { port, store } = fakePort({ [USER_ID_KEY]: 'u-current' })
    installStoragePort(port)

    await hydrateStoragePort()

    expect(readStored(USER_ID_KEY)).toBe('u-current')
    expect(store.get(USER_ID_KEY)).toBe('u-current')
  })

  it('treats an empty string as nothing to carry', async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, '')
    const { port, store } = fakePort()
    installStoragePort(port)

    await hydrateStoragePort()

    expect(store.has(AUTH_TOKEN_KEY)).toBe(false)
    expect(readStored(AUTH_TOKEN_KEY)).toBeNull()
  })
})

describe('storagePortSnapshot', () => {
  it('reports every ported key, present or not', async () => {
    const { port } = fakePort({ [USER_ID_KEY]: 'u-3' })
    installStoragePort(port)
    await hydrateStoragePort()

    expect(storagePortSnapshot()).toEqual({
      [USER_ID_KEY]: 'u-3',
      [DEVICE_SECRET_KEY]: null,
      [AUTH_TOKEN_KEY]: null,
    })
  })
})
