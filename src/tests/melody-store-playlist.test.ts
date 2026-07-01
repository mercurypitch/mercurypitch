import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { melodyStore } from '@/stores/melody-store'

const {
  resetMelodyLibrary,
  createNewMelody,
  createPlaylist,
  addMelodyToPlaylist,
  deleteMelody,
  playPlaylist,
  getCurrentMelody,
} = melodyStore

describe('playPlaylist', () => {
  beforeEach(() => {
    resetMelodyLibrary()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('advances through every melody in order', () => {
    const a = createNewMelody('A')
    const b = createNewMelody('B')
    const playlistId = createPlaylist('My playlist')
    addMelodyToPlaylist(playlistId, a.id)
    addMelodyToPlaylist(playlistId, b.id)

    playPlaylist(playlistId)
    expect(getCurrentMelody()?.id).toBe(a.id)

    vi.advanceTimersByTime(3000)
    expect(getCurrentMelody()?.id).toBe(b.id)
  })

  it('skips a melody deleted after playback started instead of stalling', () => {
    const a = createNewMelody('A')
    const b = createNewMelody('B')
    const c = createNewMelody('C')
    const playlistId = createPlaylist('My playlist')
    addMelodyToPlaylist(playlistId, a.id)
    addMelodyToPlaylist(playlistId, b.id)
    addMelodyToPlaylist(playlistId, c.id)

    playPlaylist(playlistId)
    expect(getCurrentMelody()?.id).toBe(a.id)

    // Delete the next melody in the playlist before its turn comes up.
    deleteMelody(b.id)

    // Previously this stalled forever because playPlaylist captured the
    // library once at start and never advanced past a missing melody.
    vi.advanceTimersByTime(3000)
    expect(getCurrentMelody()?.id).toBe(c.id)
  })
})
