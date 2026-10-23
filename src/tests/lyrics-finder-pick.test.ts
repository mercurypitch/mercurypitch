/**
 * A pick from LRCLIB's list says how it went.
 *
 * A pick whose record brought no lyrics closed the list and went back to
 * the search box without a word (owner, mp-v0.8.41 on an iPhone): nothing
 * said whether LRCLIB had none, was busy or could not be reached, and the
 * versions to pick another from were gone. Now the search's own copy of the
 * lyrics is used when it has one, the list stays until a pick works, and a
 * pick that brings nothing says why.
 */
import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStemMixerLyricsController } from '@/features/stem-mixer/useStemMixerLyricsController'
import type * as LrclibRecord from '@/lib/lrclib-record'
import type { LyricsByIdOutcome } from '@/lib/lrclib-record'
import type * as LyricsService from '@/lib/lyrics-service'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'

const byId = vi.fn<(id: number) => Promise<LyricsByIdOutcome>>()
const searchMulti = vi.fn<() => Promise<LyricsSearchMatch[]>>()
const toasts = vi.hoisted(() => ({ shown: [] as [string, string?][] }))

vi.mock('@/lib/lrclib-record', async (importOriginal) => ({
  ...(await importOriginal<typeof LrclibRecord>()),
  fetchLyricsByIdOutcome: (id: number) => byId(id),
}))

vi.mock('@/lib/lyrics-service', async (importOriginal) => {
  const actual = await importOriginal<typeof LyricsService>()
  return {
    ...actual,
    searchLyricsMulti: () => searchMulti(),
    searchLyrics: () => Promise.resolve(null),
  }
})

vi.mock('@/stores/notifications-store', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  showNotification: (message: string, kind?: string) => {
    toasts.shown.push([message, kind])
  },
}))

const SYNCED = '[00:01.00]A line\n[00:04.00]Another line\n'

const match = (
  id: number,
  lyrics: Partial<LyricsSearchMatch> = {},
): LyricsSearchMatch => ({
  id,
  title: 'Pompeii',
  artist: 'Bastille',
  ...lyrics,
})

function makeController() {
  return useStemMixerLyricsController({
    sessionId: 'pick-test',
    songTitle: 'Pompeii',
    duration: () => 200,
    playing: () => false,
    elapsed: () => 0,
    seekToWithWindow: () => {},
  })
}

describe('a pick from the lyrics list', () => {
  beforeEach(() => {
    localStorage.clear()
    byId.mockReset()
    searchMulti.mockReset()
    searchMulti.mockResolvedValue([])
    toasts.shown = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the lyrics the search already carries, with no second request', async () => {
    await createRoot(async (dispose) => {
      const controller = makeController()
      searchMulti.mockResolvedValue([
        match(1, { syncedLyrics: SYNCED }),
        match(2),
      ])
      await controller.handleForceSearch()

      await controller.handleSongPick(match(1, { syncedLyrics: SYNCED }))

      expect(byId).not.toHaveBeenCalled()
      expect(controller.lrcLines().map((line) => line.text)).toEqual([
        'A line',
        'Another line',
      ])
      expect(controller.showSongPicker()).toBe(false)
      expect(controller.songMatches()).toEqual([])
      dispose()
    })
  })

  it('asks LRCLIB for a record the search sent without lyrics', async () => {
    byId.mockResolvedValue({
      kind: 'found',
      result: { text: SYNCED, format: 'lrc' },
    })

    await createRoot(async (dispose) => {
      const controller = makeController()

      await controller.handleSongPick(match(2))

      expect(byId).toHaveBeenCalledWith(2)
      expect(controller.lrcLines()).toHaveLength(2)
      expect(toasts.shown).toEqual([])
      dispose()
    })
  })

  it('keeps the list and says why when the record brings nothing', async () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
    byId.mockResolvedValue({ kind: 'http', status: 503 })
    const versions = [match(2), match(3)]

    await createRoot(async (dispose) => {
      const controller = makeController()
      searchMulti.mockResolvedValue(versions)
      await controller.handleForceSearch()

      await controller.handleSongPick(match(2))

      expect(controller.songMatches()).toEqual(versions)
      expect(controller.showSongPicker()).toBe(true)
      expect(controller.lyricsLoading()).toBe(false)
      expect(toasts.shown).toEqual([
        [
          'LRCLIB could not send the lyrics for "Pompeii" by Bastille (error 503). Try again in a moment, or pick another version.',
          'warning',
        ],
      ])
      expect(String(warned.mock.calls[0]?.[0])).toContain(
        'LRCLIB record 2 (Bastille - Pompeii): http 503',
      )
      dispose()
    })
  })

  it('says LRCLIB has no lyrics for a record with none', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    byId.mockResolvedValue({ kind: 'empty' })

    await createRoot(async (dispose) => {
      const controller = makeController()

      await controller.handleSongPick(match(4))

      expect(toasts.shown[0]?.[0]).toBe(
        'LRCLIB has no lyrics for "Pompeii" by Bastille. Pick another version, or add your own.',
      )
      dispose()
    })
  })
})
