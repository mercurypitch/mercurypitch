// The finder used to open on a prefilled box and an empty result list,
// waiting for a press of Search to ask a question nobody had changed. A
// panel whose whole job is "here are the lyrics" opening with nothing on
// it reads as "there are none".

import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'
import type * as LyricsService from '@/lib/lyrics-service'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'
import { setJamSong } from '@/stores/jam-store'

const searchLyricsMulti = vi.fn<(q: string) => Promise<LyricsSearchMatch[]>>()

vi.mock('@/lib/lyrics-service', async (importOriginal) => {
  const actual = await importOriginal<typeof LyricsService>()
  return { ...actual, searchLyricsMulti: (q: string) => searchLyricsMulti(q) }
})

const { JamLyricsFinder } = await import('@/components/jam/JamLyricsFinder')

const song = (title: string): JamSong => ({
  id: `session:${title || 'untitled'}`,
  title,
  stems: { instrumental: 'blob:instrumental' },
  lines: [],
  notes: [],
  durationSec: 180,
  origin: 'local',
})

describe('jam lyrics finder — searching on open', () => {
  beforeEach(() => {
    searchLyricsMulti.mockReset()
    searchLyricsMulti.mockResolvedValue([
      {
        id: 7,
        title: 'Ghosts',
        artist: 'Tester',
        syncedLyrics: '[00:01.00]A line',
      },
    ])
  })

  afterEach(() => {
    cleanup()
    setJamSong(null)
  })

  it('runs the prefilled search once the panel appears', async () => {
    setJamSong(song('Tester - Ghosts'))
    const { getByText } = render(() => <JamLyricsFinder />)

    await waitFor(() => expect(searchLyricsMulti).toHaveBeenCalledTimes(1))
    expect(searchLyricsMulti.mock.calls[0]?.[0]).toBe('Tester - Ghosts')
    await waitFor(() => getByText('Ghosts'))
  })

  it('remounts with the matches it already has, without asking again', async () => {
    // A different title from the test above on purpose: what was found is
    // remembered per song, so reusing one would be answered by that test.
    setJamSong(song('Tester - Second Song'))
    const first = render(() => <JamLyricsFinder />)
    await waitFor(() => expect(searchLyricsMulti).toHaveBeenCalledTimes(1))
    first.unmount()

    const again = render(() => <JamLyricsFinder />)
    await Promise.resolve()
    expect(searchLyricsMulti).toHaveBeenCalledTimes(1)
    // The point of the cache: skipping the search must not put back the
    // empty panel the search exists to fill.
    again.getByText('Ghosts')
  })

  it('says so on a remount when the song genuinely has no matches', async () => {
    searchLyricsMulti.mockResolvedValue([])
    setJamSong(song('Tester - Nothing Out There'))
    const first = render(() => <JamLyricsFinder />)
    await waitFor(() => expect(searchLyricsMulti).toHaveBeenCalledTimes(1))
    first.unmount()

    const again = render(() => <JamLyricsFinder />)
    await Promise.resolve()
    expect(searchLyricsMulti).toHaveBeenCalledTimes(1)
    again.getByText(/Nothing found/)
  })

  it('does not search when the song has no title to search for', async () => {
    setJamSong(song(''))
    render(() => <JamLyricsFinder />)

    await Promise.resolve()
    expect(searchLyricsMulti).not.toHaveBeenCalled()
  })

  it('does not search for a song that already has its words', async () => {
    setJamSong({
      ...song('Tester - Already Has Them'),
      lines: [{ startSec: 1, text: 'A line' }],
    })
    render(() => <JamLyricsFinder />)

    await Promise.resolve()
    expect(searchLyricsMulti).not.toHaveBeenCalled()
  })
})
