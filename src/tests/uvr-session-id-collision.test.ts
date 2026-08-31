// ============================================================
// Two sessions born in the same millisecond stay two sessions
// ============================================================
//
// `startUvrSession` minted its id as `uvr-session-${Date.now()}`. Two calls
// inside one millisecond — a multi-file upload loop, or an e2e seeder — got
// the SAME id, and the second upsert silently swallowed the first session.
// Observed as the karaoke rail listing one of two seeded songs, but any
// fast batch of uploads could lose a file the same way.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryAdapter } from './utils/in-memory-db'

const adapter = new InMemoryAdapter()

vi.mock('@/db', () => ({
  getDb: async () => adapter,
}))

import { getAllUvrSessions, saveAllUvrSessions, startUvrSession, } from '@/stores/app-store'

describe('startUvrSession id minting', () => {
  beforeEach(() => {
    saveAllUvrSessions([])
    vi.restoreAllMocks()
  })

  it('keeps both sessions when the clock does not move between them', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_788_000_000_000)

    const first = startUvrSession('one.wav', 10, 'audio/wav')
    const second = startUvrSession('two.wav', 10, 'audio/wav')

    expect(second).not.toBe(first)
    const names = getAllUvrSessions().map((s) => s.originalFile?.name)
    expect(names).toContain('one.wav')
    expect(names).toContain('two.wav')
  })

  it('keeps them apart across a reload, where any counter starts over', async () => {
    // A batch burns ids ahead of the wall clock, so a counter alone is only
    // unique for the life of the page. Reloading inside that window — or a
    // second tab, whose counter is its own zero — mints into the range
    // already spent. The upsert is by session id and the stem blobs are
    // keyed by it, so the collision hands one song another's audio.
    vi.spyOn(Date, 'now').mockReturnValue(1_788_000_000_000)

    vi.resetModules()
    const firstLoad = await import('@/stores/app-store')
    const before = [
      firstLoad.startUvrSession('one.wav', 10, 'audio/wav'),
      firstLoad.startUvrSession('two.wav', 10, 'audio/wav'),
      firstLoad.startUvrSession('three.wav', 10, 'audio/wav'),
    ]

    vi.resetModules()
    const secondLoad = await import('@/stores/app-store')
    const after = secondLoad.startUvrSession('four.wav', 10, 'audio/wav')

    expect(before).not.toContain(after)
  })
})
