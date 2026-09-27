// ============================================================
// Storage's imported songs, in a build that imports them (plan S8 §9)
// ============================================================
//
// The singer's own Karaoke songs are a category of their own: how many, and
// the space their voice and music take, which the total includes. A size
// never recorded adds nothing and is said to be unknown, never zero.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImportedSongs } from '@/features/karaoke-room/karaoke-imported-songs'
import type * as NativeBuild from '@/lib/native-build'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  IS_NATIVE_BUILD: true,
  KARAOKE_IMPORT: true,
}))
vi.mock('@/db/services/voice-take-service', () => ({
  getVoiceStorageSnapshot: vi.fn(async () =>
    Promise.resolve({
      takeCount: 0,
      voiceBytes: 0,
      browserUsage: null,
      browserQuota: null,
      persistent: null,
    }),
  ),
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  loadLocalVoiceprints: () => [],
}))

const phone = vi.hoisted(() => ({
  songs: { count: 0, bytes: 0 } as ImportedSongs,
  waited: 0,
}))
vi.mock('@/features/karaoke-room/karaoke-imported-songs', () => ({
  importedSongs: () => phone.songs,
}))
vi.mock('@/stores/uvr-store', () => ({
  whenSessionStoreReady: vi.fn(async () => {
    phone.waited += 1
    return Promise.resolve()
  }),
}))

import { loadStorageFacts } from './storage-facts'

beforeEach(() => {
  phone.songs = { count: 0, bytes: 0 }
  phone.waited = 0
})

describe('the storage facts, with imported songs', () => {
  it('count them once the songs are read, and add their size to the total', async () => {
    phone.songs = { count: 7, bytes: 71_200_000 }

    const facts = await loadStorageFacts()

    expect(phone.waited).toBe(1)
    expect(facts.importedSongs).toEqual({ count: 7, bytes: 71_200_000 })
    expect(facts.total).toBe(71_200_000 + 12_812_345)
  })

  it('add nothing for a size never recorded, and keep it unknown', async () => {
    phone.songs = { count: 2, bytes: null }

    const facts = await loadStorageFacts()

    expect(facts.importedSongs).toEqual({ count: 2, bytes: null })
    expect(facts.total).toBe(12_812_345)
  })
})
