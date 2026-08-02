import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canAttachLyrics, linesFromLrc, persistSongLyrics, sessionIdOfSong, } from '@/lib/jam/jam-lyrics-attach'
import type { JamSong } from '@/lib/jam/jam-song'

const saveLyricsToDb = vi.hoisted(() => vi.fn())
vi.mock('@/db/services/lyrics-db-service', () => ({ saveLyricsToDb }))

function song(over: Partial<JamSong> = {}): JamSong {
  return {
    id: 'session:abc-123',
    title: 'Take Me Home',
    stems: { instrumental: 'blob:x' },
    lines: [],
    notes: [],
    durationSec: 100,
    origin: 'local',
    ...over,
  }
}

describe('sessionIdOfSong', () => {
  it('recovers the session behind a room song', () => {
    expect(sessionIdOfSong(song())).toBe('abc-123')
  })

  it('keeps an id that itself contains a colon', () => {
    expect(sessionIdOfSong(song({ id: 'session:a:b' }))).toBe('a:b')
  })

  it('is null for a song that is not a session', () => {
    expect(sessionIdOfSong(song({ id: 'demo:karaoke-night' }))).toBeNull()
    expect(sessionIdOfSong(song({ id: 'session:' }))).toBeNull()
    expect(sessionIdOfSong(null)).toBeNull()
  })
})

describe('canAttachLyrics', () => {
  it('offers to find words for a session that has none', () => {
    expect(canAttachLyrics(song())).toBe(true)
  })

  it('leaves a song that already has words alone', () => {
    expect(
      canAttachLyrics(song({ lines: [{ text: 'hi', startSec: 0 }] })),
    ).toBe(false)
  })

  it('does not offer for songs it could not save against', () => {
    // The demo ships with its lyrics and has no session to write back to.
    expect(canAttachLyrics(song({ id: 'demo:karaoke-night' }))).toBe(false)
    expect(canAttachLyrics(null)).toBe(false)
  })
})

describe('linesFromLrc', () => {
  it('turns timed LRC into lines the column can scroll', () => {
    const lines = linesFromLrc('[00:01.00] one\n[00:03.50] two')
    expect(lines).toEqual([
      { text: 'one', startSec: 1, endSec: 3.5 },
      { text: 'two', startSec: 3.5 },
    ])
  })

  it('returns nothing for plain lyrics, which cannot follow the song', () => {
    expect(linesFromLrc('just some words\nwith no times')).toEqual([])
  })

  it('strips enhanced-LRC word timings out of the visible text', () => {
    const [first] = linesFromLrc(
      '[00:01.00] Lay, <00:01.50> and <00:02.00> put',
    )
    expect(first?.text).toBe('Lay, and put')
  })
})

describe('persistSongLyrics', () => {
  beforeEach(() => {
    saveLyricsToDb.mockReset()
  })

  it('saves as LRC so the mixer and the next room both find them', async () => {
    await persistSongLyrics('abc-123', '[00:01.00] one', 'Artist - Song.lrc')
    expect(saveLyricsToDb).toHaveBeenCalledWith('abc-123', {
      text: '[00:01.00] one',
      format: 'lrc',
      filename: 'Artist - Song.lrc',
    })
  })

  it('swallows a failed save, because the room already has the words', async () => {
    saveLyricsToDb.mockImplementation(async () => {
      throw new Error('quota')
    })
    // Losing the cache must not surface as an error over a live take.
    await expect(
      persistSongLyrics('abc-123', '[00:01.00] one', 'x.lrc'),
    ).resolves.toBeUndefined()
  })
})
