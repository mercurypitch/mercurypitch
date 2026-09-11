// The regression that shipped as TestFlight build 29: a Capacitor plugin
// object is a proxy that answers EVERY property with a bridge call, `then`
// included. Hand it to a promise and the promise treats it as a thenable,
// calls `Preferences.then()`, which rejects unhandled and never resolves the
// outer promise — hydration hangs and the app never renders. The fake below
// behaves exactly like the real proxy on the `then` property.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { hydrateStoragePort, installStoragePort, readStored, resetStoragePort, USER_ID_KEY, } from '@/lib/storage-port'
import { createPreferencesStoragePort } from './preferences-storage'

const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }))

vi.mock('@capacitor/preferences', () => {
  const real = {
    get: async ({ key }: { key: string }) => ({
      value: store.get(key) ?? null,
    }),
    set: async ({ key, value }: { key: string; value: string }) => {
      store.set(key, value)
    },
    remove: async ({ key }: { key: string }) => {
      store.delete(key)
    },
  }
  const Preferences = new Proxy(real, {
    get(target, prop) {
      if (prop in target) return target[prop as keyof typeof target]
      // What the real proxy does for an unknown method: a bridge call that
      // rejects, and — because a thenable's `then` is expected to call its
      // callbacks, which this never does — a promise that never settles.
      return () =>
        new Promise((_, reject) => {
          reject(
            new Error(
              `"Preferences.${String(prop)}()" is not implemented on web`,
            ),
          )
        })
    },
  })
  return { Preferences }
})

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`did not settle in ${ms} ms`)), ms)
    }),
  ])
}

afterEach(() => {
  resetStoragePort()
  store.clear()
})

describe('createPreferencesStoragePort', () => {
  it('never hands the plugin proxy to a promise', async () => {
    store.set(USER_ID_KEY, 'u1')
    const port = createPreferencesStoragePort()
    await expect(withDeadline(port.get(USER_ID_KEY), 500)).resolves.toBe('u1')
    await withDeadline(port.set('k', 'v'), 500)
    expect(store.get('k')).toBe('v')
    await withDeadline(port.remove('k'), 500)
    expect(store.has('k')).toBe(false)
  })

  it('hydrates the storage port from Preferences before the first frame', async () => {
    store.set(USER_ID_KEY, 'u1')
    installStoragePort(createPreferencesStoragePort())
    await withDeadline(hydrateStoragePort(), 1000)
    expect(readStored(USER_ID_KEY)).toBe('u1')
  })
})
