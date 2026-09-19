// Words are found by a search that takes seconds, and the host is free to
// pick another song while it runs. The words used to land on whatever was
// loaded when the answer came back -- one song's lyrics on another, sent to
// the whole room. They belong to the song they were chosen for.

import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'
import type * as LyricsService from '@/lib/lyrics-service'
import type { LyricsSearchResult } from '@/lib/lyrics-service'
import { jamSong, setJamSong } from '@/stores/jam-store'

const fetchLyricsById =
  vi.fn<(id: number) => Promise<LyricsSearchResult | null>>()
vi.mock('@/lib/lyrics-service', async (importOriginal) => {
  const actual = await importOriginal<typeof LyricsService>()
  return {
    ...actual,
    searchLyricsMulti: async () => [
      {
        id: 7,
        title: 'Ghosts',
        artist: 'Tester',
        syncedLyrics: '[00:01.00]A line',
      },
    ],
    fetchLyricsById: (id: number) => fetchLyricsById(id),
  }
})

const saveLyricsToDb = vi.hoisted(() =>
  vi.fn<(sessionId: string, data: unknown) => Promise<void>>(async () => {}),
)
vi.mock('@/db/services/lyrics-db-service', () => ({
  saveLyricsToDb,
  loadLyricsFromDb: vi.fn(async () => null),
}))

const { JamLyricsFinder } = await import('@/components/jam/JamLyricsFinder')

const song = (id: string, lines: JamSong['lines'] = []): JamSong => ({
  id,
  title: 'Tester - Ghosts',
  stems: { instrumental: 'blob:instrumental' },
  lines,
  notes: [],
  durationSec: 180,
  origin: 'local',
})

const FOUND: LyricsSearchResult = {
  text: '[00:01.00]Found for the first song',
  format: 'lrc',
}

describe('jam lyrics finder — the song changes while the words are fetched', () => {
  beforeEach(() => {
    fetchLyricsById.mockReset()
    saveLyricsToDb.mockClear()
  })

  afterEach(() => {
    cleanup()
    setJamSong(null)
  })

  it('keeps them off the next song, and still saves them for their own', async () => {
    let answer!: (found: LyricsSearchResult) => void
    fetchLyricsById.mockReturnValue(
      new Promise<LyricsSearchResult>((resolve) => (answer = resolve)),
    )
    setJamSong(song('session:first'))
    const { findByText } = render(() => <JamLyricsFinder />)
    fireEvent.click(await findByText('Ghosts'))
    await waitFor(() => expect(fetchLyricsById).toHaveBeenCalledWith(7))

    const next = song('session:next', [{ text: 'its own words', startSec: 2 }])
    setJamSong(next)
    answer(FOUND)

    await waitFor(() => expect(saveLyricsToDb).toHaveBeenCalledTimes(1))
    expect(saveLyricsToDb.mock.calls[0]?.[0]).toBe('first')
    expect(jamSong()?.lines).toEqual(next.lines)
  })

  it('gives them to the song when it is still the one loaded', async () => {
    fetchLyricsById.mockResolvedValue(FOUND)
    setJamSong(song('session:first'))
    const { findByText } = render(() => <JamLyricsFinder />)
    fireEvent.click(await findByText('Ghosts'))

    await waitFor(() =>
      expect(jamSong()?.lines).toEqual([
        { text: 'Found for the first song', startSec: 1 },
      ]),
    )
  })
})
