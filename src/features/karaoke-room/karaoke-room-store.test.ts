// ============================================================
// What the Karaoke room keeps, and what a first launch starts with
// ============================================================
//
// The persisted settings are read once, when the module loads, so each case
// loads it afresh over the storage it means to test.

import { beforeEach, describe, expect, it, vi } from 'vitest'

async function freshStore() {
  vi.resetModules()
  return import('./karaoke-room-store')
}

beforeEach(() => {
  localStorage.clear()
})

describe('a first launch', () => {
  it('pins nothing, plays the next song, and shows medium lyrics with no notes', async () => {
    const store = await freshStore()

    expect(store.karaokePinned()).toBe('none')
    expect(store.karaokePlayNext()).toBe(true)
    expect(store.karaokeLyricsSize()).toBe('current')
    expect(store.karaokeNoteGlyphs()).toBe(false)
    expect(store.lastSungSong()).toBeNull()
  })
})

describe('a later launch', () => {
  it('finds what the singer set', async () => {
    localStorage.setItem('karaoke-room-pinned', 'notes')
    localStorage.setItem('karaoke-room-play-next', 'false')
    localStorage.setItem('sm-zen-lyrics-size', 'bigger')
    localStorage.setItem('sm-zen-note-glyphs', 'true')
    localStorage.setItem(
      'karaoke-room-last-song',
      'karaoke-night-demo:josephine',
    )

    const store = await freshStore()

    expect(store.karaokePinned()).toBe('notes')
    expect(store.karaokePlayNext()).toBe(false)
    expect(store.karaokeLyricsSize()).toBe('bigger')
    expect(store.karaokeNoteGlyphs()).toBe(true)
    expect(store.lastSungSong()).toBe('karaoke-night-demo:josephine')
  })

  it('falls back to the defaults over values it does not know', async () => {
    localStorage.setItem('karaoke-room-pinned', 'the-mixer')
    localStorage.setItem('sm-zen-lyrics-size', 'huge')

    const store = await freshStore()

    expect(store.karaokePinned()).toBe('none')
    expect(store.karaokeLyricsSize()).toBe('current')
  })
})

describe('a parked song', () => {
  it('comes back once', async () => {
    const store = await freshStore()
    store.parkKaraokeSong({
      sessionId: 'karaoke-night-demo',
      seconds: 31,
      guide: { volume: 0.3, muted: false },
    })

    expect(store.takeParkedKaraokeSong()?.seconds).toBe(31)
    expect(store.takeParkedKaraokeSong()).toBeNull()
  })
})
