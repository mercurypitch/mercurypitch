// ============================================================
// Stage 2's half of the shell: the import queue and the store
// ============================================================
//
// A build with Import (every dev-target build: TestFlight, the probe, the
// tests) runs the queue that sends imported songs for as long as the shell
// does, and hands the room a subscription that fails closed until the store
// is real. A build without it (the store build) gets neither.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'

const build = vi.hoisted(() => ({ importing: false }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get KARAOKE_IMPORT() {
    return build.importing
  },
}))

const queue = vi.hoisted(() => ({ starts: 0, stops: 0 }))
vi.mock('@/features/karaoke-room/karaoke-import-queue', () => ({
  startKaraokeImportQueue: () => {
    queue.starts += 1
    return () => {
      queue.stops += 1
    }
  },
}))

const auth = vi.hoisted(() => ({ asked: 0 }))
vi.mock('@/db/services/auth-service', () => ({
  requireAuth: vi.fn(async () => {
    auth.asked += 1
    return Promise.resolve(true)
  }),
}))

import { installKaraokeImport } from './karaoke-import-wiring'

beforeEach(() => {
  build.importing = false
  queue.starts = 0
  queue.stops = 0
  auth.asked = 0
})

describe('the shell in a build without Import', () => {
  it('starts no queue and offers the room no subscription', () => {
    const wiring = installKaraokeImport()

    expect(wiring.api).toEqual({})
    expect(queue.starts).toBe(0)
    wiring.stop()
    expect(queue.stops).toBe(0)
  })
})

describe('the shell in a build with Import', () => {
  it('runs the queue for as long as the shell does', () => {
    build.importing = true

    const wiring = installKaraokeImport()

    expect(queue.starts).toBe(1)
    wiring.stop()
    expect(queue.stops).toBe(1)
  })

  it('hands the room a subscription that fails closed until the store is real', async () => {
    build.importing = true

    const subscription = installKaraokeImport().api.karaokeSubscription

    await expect(subscription?.subscribe()).resolves.toBe('unavailable')
    await expect(subscription?.restore()).resolves.toBe('unavailable')
    expect(subscription?.manage).toBeUndefined()
    // No identity is made for a store that is not there.
    expect(auth.asked).toBe(0)
  })
})
