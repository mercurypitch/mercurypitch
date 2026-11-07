// Studio storage quality — the device setting, an answer that lasts a visit or is remembered, and how many takes each mode fits in a song.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fitsStudioProjectStorageBudget, STUDIO_PROJECT_STORAGE_LIMITS, studioProjectStorageShare, } from '../model/storage-limits'
import type { StudioStorageQuality } from './storage-quality'
import { DEFAULT_STUDIO_STORAGE_SETTINGS, readStudioStorageSettings, sanitizeStudioStorageSettings, STUDIO_REFERENCE_TAKE, studioTakesPerSong, studioTakeStorageBytes, wavByteLength, writeStudioStorageSettings, } from './storage-quality'

const KEY = 'mercurypitch.studio.storage'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

/** A fresh page: the module's visit answer starts empty, storage stays. */
async function newVisit() {
  vi.resetModules()
  return import('./storage-quality')
}

/** `count` takes of the reference shape, as the budget sees them. */
function takes(count: number, quality: StudioStorageQuality) {
  const bytes = studioTakeStorageBytes(STUDIO_REFERENCE_TAKE, quality)
  return Array.from({ length: count }, () => ({
    byteLength: STUDIO_REFERENCE_TAKE.originalBytes,
    canonicalPcmByteLength: bytes - STUDIO_REFERENCE_TAKE.originalBytes,
  }))
}

describe('Studio storage setting', () => {
  it('starts at Full quality, not remembered, so the first import asks', async () => {
    const storage = await newVisit()

    expect(readStudioStorageSettings()).toEqual({
      quality: 'full',
      remembered: false,
    })
    expect(storage.studioStorageChoice()).toBeNull()
    expect(storage.studioStorageQuality()).toBe('full')
  })

  it('keeps an answer not remembered for this visit only', async () => {
    const first = await newVisit()
    first.chooseStudioStorage('compact', false)
    expect(first.studioStorageChoice()).toBe('compact')
    expect(localStorage.getItem(KEY)).toBeNull()

    const next = await newVisit()

    expect(next.studioStorageChoice()).toBeNull()
  })

  it('keeps a remembered answer on this device, for every visit after', async () => {
    const first = await newVisit()
    const heard = vi.fn()
    first.subscribeStudioStorage(heard)
    first.chooseStudioStorage('compact', true)
    expect(heard).toHaveBeenCalledWith('compact')

    const next = await newVisit()

    expect(next.studioStorageChoice()).toBe('compact')
    expect(next.studioStorageQuality()).toBe('compact')
    expect(next.studioCanonicalFormat(next.studioStorageQuality())).toBe(
      'int16',
    )
  })

  it('keeps the defaults for damaged storage, and the choice for the session when storage refuses', () => {
    localStorage.setItem(KEY, '{not json')
    expect(readStudioStorageSettings()).toEqual(DEFAULT_STUDIO_STORAGE_SETTINGS)
    expect(sanitizeStudioStorageSettings({ quality: 'tiny' })).toEqual(
      DEFAULT_STUDIO_STORAGE_SETTINGS,
    )
    expect(
      sanitizeStudioStorageSettings({ quality: 'compact', remembered: 'yes' }),
    ).toEqual({ quality: 'compact', remembered: false })

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(
      writeStudioStorageSettings({ quality: 'compact', remembered: true }),
    ).toEqual({ quality: 'compact', remembered: true })
  })
})

describe('Studio storage budget at each mode', () => {
  it('counts a four-minute stereo WAV at 132 MiB at Full quality and 88 MiB to Save space', () => {
    expect(STUDIO_REFERENCE_TAKE.originalBytes).toBe(
      wavByteLength(11_520_000, 2, 16),
    )
    expect(studioTakeStorageBytes(STUDIO_REFERENCE_TAKE, 'full')).toBe(
      46_080_044 + 92_160_032,
    )
    expect(studioTakeStorageBytes(STUDIO_REFERENCE_TAKE, 'compact')).toBe(
      46_080_044 + 46_080_032,
    )
  })

  it.each([
    ['full', 3],
    ['compact', 5],
  ] as const)(
    'fits %s takes, by the count the song budget makes: %i, and refuses one more',
    (quality, fit) => {
      expect(studioTakesPerSong(STUDIO_REFERENCE_TAKE, quality)).toBe(fit)
      expect(fitsStudioProjectStorageBudget(takes(fit, quality))).toBe(true)
      expect(fitsStudioProjectStorageBudget(takes(fit + 1, quality))).toBe(
        false,
      )
    },
  )

  it('fits more of a smaller file: an MP3 of four minutes, 4 at Full quality and 9 to Save space', () => {
    const mp3 = { ...STUDIO_REFERENCE_TAKE, originalBytes: 9_600_000 }

    expect(studioTakesPerSong(mp3, 'full')).toBe(4)
    expect(studioTakesPerSong(mp3, 'compact')).toBe(9)
  })

  it("says how full a song is by the budget's own count, takes no clip uses included", () => {
    expect(studioProjectStorageShare([])).toBe(0)
    expect(studioProjectStorageShare(takes(3, 'full'))).toBeCloseTo(
      (3 * 138_240_076) / STUDIO_PROJECT_STORAGE_LIMITS.audioBytes,
    )
    // Many tiny takes fill the count before the bytes.
    expect(
      studioProjectStorageShare(
        Array.from({ length: 64 }, () => ({
          byteLength: 10,
          canonicalPcmByteLength: 40,
        })),
      ),
    ).toBe(0.5)
  })
})
