// ============================================================
// Where a song is separated, in the native app: on the server
// ============================================================
//
// The native app separates in the cloud only (plan S8 §6, "No Browser mode").
// The mode is a persisted preference that Settings sync carries between
// devices, so a phone can arrive holding the web's "local" from a laptop;
// the native build must not act on it.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'
import { InMemoryAdapter } from '@/tests/utils/in-memory-db'

const build = vi.hoisted(() => ({ native: true }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return build.native
  },
}))
vi.mock('@/db', () => ({ getDb: async () => new InMemoryAdapter() }))

const KEY = 'pitchperfect_uvr-processing-mode'

async function freshStore() {
  vi.resetModules()
  return import('./uvr-store')
}

beforeEach(() => {
  localStorage.clear()
  build.native = true
})

describe('where a song is separated', () => {
  it('is the server in the native app, whatever the phone was told before', async () => {
    localStorage.setItem(KEY, 'local')

    const store = await freshStore()

    expect(store.getUvrProcessingMode()).toBe('server')
    expect(store.uvrProcessingMode()).toBe('server')
  })

  it('stays the server when something asks the native app for the browser', async () => {
    const store = await freshStore()

    store.setUvrProcessingMode('local')

    expect(store.uvrProcessingMode()).toBe('server')
    expect(localStorage.getItem(KEY)).not.toBe('local')
  })

  it('is still the choice it was on the web', async () => {
    build.native = false
    localStorage.setItem(KEY, 'local')

    const store = await freshStore()
    expect(store.getUvrProcessingMode()).toBe('local')

    store.setUvrProcessingMode('server')
    expect(store.uvrProcessingMode()).toBe('server')
  })
})
