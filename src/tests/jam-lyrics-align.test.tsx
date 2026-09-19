// ============================================================
// A room's lyric column can be aligned, and remembers it
// ============================================================
//
// The left half of a song room was hard-left with no header, which on a
// wide stage left the words pinned against one edge and a hand's width
// of nothing beside them. The mixer solved this once already with a
// single chip, so the room reuses that chip rather than growing a second
// idea of what "aligned" means -- but under its OWN storage key, because
// centring a room's words must not re-centre somebody's stem editor.
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

describe('the room lyric alignment chip', () => {
  beforeEach(() => {
    localStorage.clear()
    setJamLyricsAlign('center')
  })

  it('sits in a header of its own, above the words', () => {
    const { getByLabelText, getByText } = renderSheet()
    expect(getByText('Lyrics')).toBeInTheDocument()
    expect(getByLabelText('Lyric alignment')).toBeInTheDocument()
  })

  it('starts centred, which is how a teleprompter is read', () => {
    const { scroll } = renderSheet()
    expect(scroll.dataset.align).toBe('center')
  })

  it('moves the words when the chip changes', () => {
    const { scroll, getByLabelText } = renderSheet()
    const select = getByLabelText('Lyric alignment') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'left' } })
    expect(scroll.dataset.align).toBe('left')
    fireEvent.change(select, { target: { value: 'right' } })
    expect(scroll.dataset.align).toBe('right')
  })

  it('remembers the choice on this device, under the room key', () => {
    const { getByLabelText } = renderSheet()
    fireEvent.change(getByLabelText('Lyric alignment'), {
      target: { value: 'left' },
    })
    expect(localStorage.getItem(JAM_LYRICS_ALIGN_KEY)).toBe('left')
    // Not the mixer's: two panels, two settings.
    expect(localStorage.getItem('pitchperfect_lyrics_align')).toBeNull()
  })

  it('reaches past the panel on a coarse pointer', () => {
    // 1.35rem square is under the 24px touch floor. The room header has
    // the space the mixer's does not, so it asks for the bigger target.
    const { getByLabelText } = renderSheet()
    const chip = getByLabelText('Lyric alignment').closest(
      '.sm-lyrics-align-select',
    )
    expect(chip).not.toBeNull()
    expect((chip as HTMLElement).dataset.hitTarget).toBe('roomy')
    const css = readFileSync('src/components/LyricsAlignSelect.css', 'utf8')
    expect(css).toContain("[data-hit-target='roomy']")
    expect(css).toContain('pointer: coarse')
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
