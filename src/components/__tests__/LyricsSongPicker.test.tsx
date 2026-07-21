// ============================================================
// LyricsSongPicker — LRCLIB search bar + results (shared studio/zen)
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LyricsSongPickerProps } from '@/components/LyricsSongPicker'
import { LyricsSongPicker } from '@/components/LyricsSongPicker'
import type { LyricsSearchMatch } from '@/lib/lyrics-service'

afterEach(cleanup)

const match = (over: Partial<LyricsSearchMatch>): LyricsSearchMatch =>
  ({
    id: 1,
    artist: 'Iron Maiden',
    title: 'Como Estais Amigos',
    syncedLyrics: '[00:01.00] hi',
    ...over,
  }) as LyricsSearchMatch

const baseProps = (
  over: Partial<LyricsSongPickerProps> = {},
): LyricsSongPickerProps => ({
  matches: [],
  query: 'Iron Maiden - Como Estais Amigos',
  onQueryChange: vi.fn(),
  onPick: vi.fn(),
  onRefine: vi.fn(),
  ...over,
})

describe('LyricsSongPicker', () => {
  it('shows the query and reports edits', () => {
    const onQueryChange = vi.fn()
    render(() => LyricsSongPicker(baseProps({ onQueryChange })))
    const input = screen.getByLabelText(
      'Search lyrics by artist and title',
    ) as HTMLInputElement
    expect(input.value).toBe('Iron Maiden - Como Estais Amigos')
    fireEvent.input(input, { target: { value: 'Metallica - One' } })
    expect(onQueryChange).toHaveBeenCalledWith('Metallica - One')
  })

  it('searches on the button and on Enter', () => {
    const onRefine = vi.fn()
    render(() => LyricsSongPicker(baseProps({ onRefine })))
    fireEvent.click(screen.getByTitle('Search LRCLIB'))
    fireEvent.keyDown(
      screen.getByLabelText('Search lyrics by artist and title'),
      { key: 'Enter' },
    )
    expect(onRefine).toHaveBeenCalledTimes(2)
  })

  it('lists matches with an LRC badge and picks one', () => {
    const onPick = vi.fn()
    const matches = [
      match({ id: 1, title: 'Take One' }),
      match({ id: 2, title: 'Take Two', syncedLyrics: undefined }),
    ]
    render(() => LyricsSongPicker(baseProps({ matches, onPick })))
    expect(screen.getByText('2 matches')).toBeInTheDocument()
    // Only the synced match carries the LRC badge.
    expect(screen.getAllByText('LRC')).toHaveLength(1)
    fireEvent.click(screen.getByText('Take One'))
    expect(onPick).toHaveBeenCalledWith(matches[0])
  })

  it('singular "match" for exactly one result', () => {
    render(() => LyricsSongPicker(baseProps({ matches: [match({})] })))
    expect(screen.getByText('1 match')).toBeInTheDocument()
  })

  it('panel variant: header, no-results fallback, and footer actions', () => {
    const onUploadFile = vi.fn()
    const onCancel = vi.fn()
    render(() =>
      LyricsSongPicker(
        baseProps({ variant: 'panel', matches: [], onUploadFile, onCancel }),
      ),
    )
    expect(screen.getByText('Search Lyrics Online')).toBeInTheDocument()
    expect(screen.getByText('No matches yet')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Upload LRC / TXT file'))
    expect(onUploadFile).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('inline variant: bare — no header, no-results fallback, or footer', () => {
    render(() =>
      LyricsSongPicker(
        baseProps({ variant: 'inline', matches: [], onUploadFile: vi.fn() }),
      ),
    )
    expect(screen.queryByText('Search Lyrics Online')).toBeNull()
    expect(screen.queryByText('No matches yet')).toBeNull()
    expect(screen.queryByText('Upload LRC / TXT file')).toBeNull()
    // The search field is still there — always available in the no-lyrics state.
    expect(
      screen.getByLabelText('Search lyrics by artist and title'),
    ).toBeInTheDocument()
  })

  it('shows the Paste button only when onPasteText is wired', () => {
    const { unmount } = render(() =>
      LyricsSongPicker(baseProps({ onPasteText: vi.fn() })),
    )
    expect(screen.getByText('Paste')).toBeInTheDocument()
    unmount()
    render(() => LyricsSongPicker(baseProps({})))
    expect(screen.queryByText('Paste')).toBeNull()
  })
})
