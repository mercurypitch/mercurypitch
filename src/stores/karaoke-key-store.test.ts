// The per-song karaoke key: remembered, clamped, and bounded.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'mp_karaoke_song_keys'

async function freshStore() {
  vi.resetModules()
  return import('./karaoke-key-store')
}

describe('karaoke key store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('knows no key for a song nobody has moved', async () => {
    const { songKeyShift } = await freshStore()

    expect(songKeyShift('song-a')).toBeUndefined()
  })

  it('stores whole semitones inside −6..+6', async () => {
    const { setSongKeyShift, songKeyShift } = await freshStore()

    setSongKeyShift('song-a', 2.6)
    setSongKeyShift('song-b', -9)

    expect(songKeyShift('song-a')).toBe(3)
    expect(songKeyShift('song-b')).toBe(-6)
  })

  it('forgets a song set back to its original key, or cleared', async () => {
    const { setSongKeyShift, songKeyShift } = await freshStore()
    setSongKeyShift('song-a', 2)
    setSongKeyShift('song-b', -1)

    setSongKeyShift('song-a', 0)
    setSongKeyShift('song-b', undefined)

    expect(songKeyShift('song-a')).toBeUndefined()
    expect(songKeyShift('song-b')).toBeUndefined()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({})
  })

  it('survives a reload', async () => {
    const first = await freshStore()
    first.setSongKeyShift('song-a', -2)

    const second = await freshStore()

    expect(second.songKeyShift('song-a')).toBe(-2)
  })

  it('keeps the 500 most recently set songs', async () => {
    const { setSongKeyShift, songKeyShift } = await freshStore()
    for (let i = 0; i < 500; i++) setSongKeyShift(`song-${i}`, 1)
    // Setting song-0 again makes it the newest, so song-1 is the oldest.
    setSongKeyShift('song-0', 2)

    setSongKeyShift('song-500', 3)

    expect(songKeyShift('song-1')).toBeUndefined()
    expect(songKeyShift('song-0')).toBe(2)
    expect(songKeyShift('song-500')).toBe(3)
    expect(
      Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')),
    ).toHaveLength(500)
  })

  it('ignores a stored map it cannot read', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      '{"song-a": "loud", "song-b": 99, "song-c": 2}',
    )

    const { songKeyShift } = await freshStore()

    expect(songKeyShift('song-a')).toBeUndefined()
    expect(songKeyShift('song-b')).toBe(6)
    expect(songKeyShift('song-c')).toBe(2)
  })

  it('answers reactively', async () => {
    const { createRoot, createMemo } = await import('solid-js')
    const { setSongKeyShift, songKeyShift } = await freshStore()

    createRoot((dispose) => {
      const key = createMemo(() => songKeyShift('song-a'))
      expect(key()).toBeUndefined()
      setSongKeyShift('song-a', 4)
      expect(key()).toBe(4)
      dispose()
    })
  })
})
