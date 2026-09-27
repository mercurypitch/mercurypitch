// ============================================================
// What MercuryPitch keeps on this phone, in four categories
// ============================================================
//
// S6 step 7 (6a). Takes and their size from the voice store's own snapshot,
// the device's voiceprints, the pitch model and its runtime (measured when
// the app was built, since they go only with the app), and the rooms cache,
// which is empty in a build where every room ships inside the app.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getVoiceStorageSnapshot } from '@/db/services/voice-take-service'
import { loadLocalVoiceprints } from '@/db/services/voiceprint-service'
import { formatBytes, loadStorageFacts, storageTotal } from './storage-facts'

vi.mock('@/db/services/voice-take-service', () => ({
  getVoiceStorageSnapshot: vi.fn(),
}))
vi.mock('@/db/services/voiceprint-service', () => ({
  loadLocalVoiceprints: vi.fn(),
}))

const snapshotMock = vi.mocked(getVoiceStorageSnapshot)
const voiceprintsMock = vi.mocked(loadLocalVoiceprints)

beforeEach(() => {
  snapshotMock.mockReset()
  voiceprintsMock.mockReset()
  snapshotMock.mockResolvedValue({
    takeCount: 23,
    voiceBytes: 186_000_000,
    browserUsage: null,
    browserQuota: null,
    persistent: null,
  })
  voiceprintsMock.mockReturnValue([
    {
      id: 'v-1',
      takenAt: '2026-09-01T10:00:00Z',
      summary: {} as never,
      twin: null,
      source: 'mirror' as never,
    },
  ])
})

describe('the storage facts', () => {
  it('counts each category and adds them up', async () => {
    const facts = await loadStorageFacts()

    expect(facts.takes).toEqual({ count: 23, bytes: 186_000_000 })
    expect(facts.voiceprints.count).toBe(1)
    expect(facts.voiceprints.bytes).toBeGreaterThan(0)
    expect(facts.models.bytes).toBe(12_812_345)
    expect(facts.cachedRooms.bytes).toBe(0)
    expect(facts.total).toBe(186_000_000 + facts.voiceprints.bytes + 12_812_345)
    expect(storageTotal()).toBe(facts.total)
    // A build that cannot import songs has none to count.
    expect(facts.importedSongs).toBeUndefined()
  })

  it('names a takes store it could not read, rather than calling it empty', async () => {
    snapshotMock.mockRejectedValue(new Error('IndexedDB is closed'))

    const facts = await loadStorageFacts()

    expect(facts.takes).toBeNull()
    expect(facts.voiceprints.count).toBe(1)
  })
})

describe('sizes, the way the phone writes them', () => {
  it('uses MB below a gigabyte and GB above it', () => {
    expect(formatBytes(0)).toBe('0 MB')
    expect(formatBytes(1_400_000)).toBe('1.4 MB')
    expect(formatBytes(12_812_345)).toBe('12.8 MB')
    expect(formatBytes(186_000_000)).toBe('186 MB')
    expect(formatBytes(18_400_000_000)).toBe('18.4 GB')
    expect(formatBytes(2_300)).toBe('2 KB')
  })
})
