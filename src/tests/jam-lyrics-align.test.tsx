// ============================================================
// A room's lyric column can be aligned, and remembers it
// ============================================================
//
// The left half of a song room was hard-left with no header, which on a
// wide stage left the words pinned against one edge and a hand's width
// of nothing beside them. The mixer solved this once already, so the room
// keeps the mixer's three values and its glyphs rather than growing a
// second idea of what "aligned" means -- but under its OWN storage key,
// because centring a room's words must not re-centre somebody's stem
// editor, and as three buttons rather than the mixer's one-chip select,
// because this header has the room and that chip's menu is drawn by the
// operating system. The buttons' own contract (one tab stop, arrows,
// sizes) is in LyricsAlignButtons.test.tsx; this file is about the room.
//
// jsdom applies no CSS Modules, so the alignment itself is asserted
// where it lives: the data-align attribute the rules hang off, and the
// rules themselves read off the stylesheet.

import { fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamSongLyrics } from '@/components/jam/JamSongLyrics'
import { JAM_LYRICS_ALIGN_KEY, setJamLyricsAlign, } from '@/lib/jam/jam-view-prefs'

vi.mock('@/stores/jam-store', () => ({
  assignJamSongLines: vi.fn(),
  jamAssignBrush: () => null,
  jamIsHost: () => true,
  jamLineIsMine: () => false,
  jamPeerId: () => 'me',
  jamPeers: () => [],
  jamSong: () => null,
  jamSongParts: () => ({}),
}))
vi.mock('@/components/jam/JamAssignBar', () => ({
  JamAssignBar: () => <div data-testid="stub-assign-bar" />,
}))
vi.mock('@/components/jam/JamLyricsFinder', () => ({
  JamLyricsFinder: () => <div data-testid="stub-finder" />,
}))

beforeAll(() => {
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo
})

const LINES = [
  { text: 'first line of the song', startSec: 0 },
  { text: 'second line of the song', startSec: 2 },
]

function renderSheet() {
  const utils = render(() => (
    <JamSongLyrics lines={LINES} positionSec={() => 0} showNotes={false} />
  ))
  const scroll = utils.container.querySelector('[data-align]')
  expect(scroll).not.toBeNull()
  return { ...utils, scroll: scroll as HTMLElement }
}

const CSS = readFileSync('src/components/jam/JamSongLyrics.module.css', 'utf8')

/**
 * The first rule whose selector ends with `needle`.
 *
 * The brace is part of the needle on purpose: `.line` is a prefix of
 * `.lineText`, and a substring match finds the wrong rule.
 */
function ruleWith(needle: string): string {
  const rules = CSS.match(/[^{}]+\{[^}]*\}/g) ?? []
  return (
    rules.find((rule) => `${rule.split('{')[0] ?? ''}{`.includes(needle)) ?? ''
  )
}

describe('the room lyric alignment buttons', () => {
  beforeEach(() => {
    localStorage.clear()
    setJamLyricsAlign('center')
  })

  it('sit in a header of their own, above the words', () => {
    const { getByRole, getByText } = renderSheet()
    expect(getByText('Lyrics')).toBeInTheDocument()
    const group = getByRole('radiogroup', { name: 'Lyric alignment' })
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(3)
  })

  it('are buttons, not a menu the operating system draws', () => {
    const { container } = renderSheet()
    expect(container.querySelector('select')).toBeNull()
  })

  it('start centred, which is how a teleprompter is read', () => {
    const { scroll, getByRole } = renderSheet()
    expect(scroll.dataset.align).toBe('center')
    expect(getByRole('radio', { name: 'Middle' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('move the words when another one is pressed', () => {
    const { scroll, getByRole } = renderSheet()
    fireEvent.click(getByRole('radio', { name: 'Left' }))
    expect(scroll.dataset.align).toBe('left')
    fireEvent.click(getByRole('radio', { name: 'Right' }))
    expect(scroll.dataset.align).toBe('right')
  })

  it('move the words from the keyboard too', () => {
    const { scroll, getByRole } = renderSheet()
    const middle = getByRole('radio', { name: 'Middle' })
    middle.focus()
    fireEvent.keyDown(middle, { key: 'ArrowLeft' })
    expect(scroll.dataset.align).toBe('left')
  })

  it('remember the choice on this device, under the room key', () => {
    const { getByRole } = renderSheet()
    fireEvent.click(getByRole('radio', { name: 'Left' }))
    expect(localStorage.getItem(JAM_LYRICS_ALIGN_KEY)).toBe('left')
    // Not the mixer's: two panels, two settings.
    expect(localStorage.getItem('pitchperfect_lyrics_align')).toBeNull()
  })

  it('wear the room glass rather than an opaque chip', () => {
    // The group is a shared component that knows nothing about a room;
    // the header hands it the surface the transparency slider drives.
    expect(ruleWith('.header {')).toContain(
      '--lyrics-align-surface: var(--jam-float',
    )
  })
})

describe('what data-align is actually wired to', () => {
  it('aligns the text of a line, not the row that carries it', () => {
    // The row is a flex line holding the words, the singer's name, a
    // score and the assign button. Centring the ROW centres that whole
    // train, which reads as a wandering left edge.
    expect(ruleWith("[data-align='left'] .lineText {")).toContain(
      'text-align: left',
    )
    expect(ruleWith("[data-align='right'] .lineText {")).toContain(
      'text-align: right',
    )
    expect(ruleWith("[data-align='center'] .lineText {")).toContain(
      'text-align: center',
    )
  })

  it('keeps a symmetric gutter so centred words are centred on the panel', () => {
    // Without it the words centre in whatever is left after the trailing
    // furniture, which moves the centre line as scores arrive.
    const gutter = ruleWith("[data-align='center'] .line {")
    expect(gutter).toContain('padding-inline')
    const trail = ruleWith("[data-align='center'] .lineTrail {")
    expect(trail).toContain('position: absolute')
  })
})
