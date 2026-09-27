// ============================================================
// The library sheet: one vertical list, songs named as songs (§3, K7)
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomSong } from './karaoke-room-library'
import { formatSongDuration, KaraokeLibrarySheet } from './KaraokeLibrarySheet'

const example = (
  sessionId: string,
  title: string,
  durationSec: number,
): RoomSong => ({
  sessionId,
  title,
  artist: 'Josh Woodward',
  durationSec,
  credit: 'Josh Woodward · CC BY 4.0',
  kind: 'example',
  stems: { vocal: '/v.m4a', instrumental: '/i.m4a' },
})

const GOODBYE = example('karaoke-night-demo', 'Goodbye to Spring', 246)
const JOSEPHINE = example(
  'karaoke-night-demo:josephine',
  "I'll Be Right Behind You, Josephine",
  258,
)
const MINE: RoomSong = {
  sessionId: 'mine',
  title: 'My Song',
  artist: null,
  durationSec: 201,
  credit: null,
  kind: 'yours',
  stems: { vocal: 'blob:v', instrumental: 'blob:i' },
}

afterEach(() => {
  cleanup()
})

function open(songs: RoomSong[], currentId: string | null = null) {
  const onPick = vi.fn()
  const close = vi.fn()
  render(() => (
    <KaraokeLibrarySheet
      isOpen
      close={close}
      songs={() => songs}
      currentId={() => currentId}
      onPick={onPick}
    />
  ))
  return { onPick, close, sheet: screen.getByTestId('karaoke-library') }
}

const rowFor = (title: string): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(`^${title}`, 'u') })

describe('the library sheet', () => {
  it('lists your songs, then the examples, each under its heading', () => {
    const { sheet } = open([MINE, GOODBYE, JOSEPHINE])

    const headings = within(sheet)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual(['Your songs', 'Examples'])
    const titles = within(sheet)
      .getAllByTestId('karaoke-library-row')
      .map((row) => row.dataset.session)
    expect(titles).toEqual([
      'mine',
      'karaoke-night-demo',
      'karaoke-night-demo:josephine',
    ])
  })

  it('has no heading for your songs while there are none', () => {
    const { sheet } = open([GOODBYE, JOSEPHINE])

    expect(within(sheet).queryByText('Your songs')).toBeNull()
    expect(within(sheet).getByText('Examples')).toBeTruthy()
  })

  it('names the song, its credit and its length', () => {
    open([GOODBYE])

    const row = rowFor('Goodbye to Spring')
    expect(row.textContent).toContain('Goodbye to Spring')
    expect(row.textContent).toContain('Josh Woodward · CC BY 4.0')
    expect(row.textContent).toContain('4:06')
  })

  it('says the examples are part of the app, under the examples', () => {
    open([MINE, GOODBYE])

    const note = screen.getByText(
      'Part of the app: they play with the phone offline.',
    )
    expect(note.closest('section')?.querySelector('h3')?.textContent).toBe(
      'Examples',
    )
  })

  it('marks the song on the stage, and only that one', () => {
    open([GOODBYE, JOSEPHINE], JOSEPHINE.sessionId)

    expect(
      rowFor("I'll Be Right Behind You").getAttribute('aria-current'),
    ).toBe('true')
    expect(rowFor('Goodbye to Spring').hasAttribute('aria-current')).toBe(false)
  })

  it('cues the song tapped', () => {
    const { onPick } = open([GOODBYE, JOSEPHINE], GOODBYE.sessionId)

    fireEvent.click(rowFor("I'll Be Right Behind You"))

    expect(onPick).toHaveBeenCalledWith(JOSEPHINE)
  })

  it('closes from its own button', () => {
    const { close } = open([GOODBYE])

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(close).toHaveBeenCalled()
  })
})

describe('a song length', () => {
  it('is minutes and two-digit seconds', () => {
    expect(formatSongDuration(246)).toBe('4:06')
    expect(formatSongDuration(285)).toBe('4:45')
    expect(formatSongDuration(59.6)).toBe('1:00')
    expect(formatSongDuration(7)).toBe('0:07')
  })

  it('is nothing when the song does not know it', () => {
    expect(formatSongDuration(null)).toBeNull()
    expect(formatSongDuration(0)).toBeNull()
  })
})
