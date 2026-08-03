/**
 * Opening the lyrics finder should already have looked.
 *
 * The finder used to open on an empty match list seeded with the song's
 * title, waiting for a press of Search to ask LRCLIB a question nobody had
 * changed. An empty list reads as "there are no lyrics for this song",
 * which is a different claim from "we have not asked yet".
 */
import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'
import type * as LyricsService from '@/lib/lyrics-service'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'

const searchLyricsMulti =
  vi.fn<(q: string, signal?: AbortSignal) => Promise<LyricsSearchMatch[]>>()

vi.mock('@/lib/lyrics-service', async (importOriginal) => {
  const actual = await importOriginal<typeof LyricsService>()
  return {
    ...actual,
    searchLyricsMulti: (q: string, signal?: AbortSignal) =>
      searchLyricsMulti(q, signal),
    searchLyrics: () => Promise.resolve(null),
  }
})

const match = (id: number, title: string): LyricsSearchMatch => ({
  id,
  title,
  artist: 'Tester',
  syncedLyrics: '[00:01.00]A line',
})

function makeController(songTitle: string) {
  return useStemMixerLyricsController({
    sessionId: `autosearch-${songTitle}`,
    songTitle,
    duration: () => 200,
    playing: () => false,
    elapsed: () => 0,
    seekToWithWindow: () => {},
  })
}

describe('lyrics finder auto-search', () => {
  beforeEach(() => {
    localStorage.clear()
    searchLyricsMulti.mockReset()
  })

  it('searches once for the song when the finder opens', async () => {
    searchLyricsMulti.mockResolvedValue([
      match(1, 'Ghosts'),
      match(2, 'Ghosts (live)'),
    ])

    await createRoot(async (dispose) => {
      const controller = makeController('Ghosts')
      await controller.handleForceSearch()

      expect(controller.showSongPicker()).toBe(true)
      expect(controller.songPickerQuery()).toBe('Ghosts')
      expect(searchLyricsMulti.mock.calls[0]?.[0]).toBe('Ghosts')
      expect(controller.songMatches()).toHaveLength(2)
      dispose()
    })
  })

  it('still opens the finder when the search finds nothing', async () => {
    searchLyricsMulti.mockResolvedValue([])

    await createRoot(async (dispose) => {
      const controller = makeController('Nothing At All')
      await controller.handleForceSearch()

      expect(controller.showSongPicker()).toBe(true)
      expect(controller.songMatches()).toEqual([])
      dispose()
    })
  })

  it('does not search when there is no title to search for', async () => {
    await createRoot(async (dispose) => {
      const controller = useStemMixerLyricsController({
        sessionId: 'Unknown',
        songTitle: 'Unknown',
        duration: () => 200,
        playing: () => false,
        elapsed: () => 0,
        seekToWithWindow: () => {},
      })
      await controller.handleForceSearch()

      expect(controller.showSongPicker()).toBe(true)
      expect(controller.songPickerQuery()).toBe('')
      expect(searchLyricsMulti).not.toHaveBeenCalled()
      dispose()
    })
  })
})
