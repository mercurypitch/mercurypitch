// ============================================================
// The guide vocal floats in a corner of the words
// ============================================================
//
// Owner report (2026-09-20): the vocal level was the first button in the
// playback row, in front of play and stop -- the one thing in the transport
// that is not transport. It belongs over the words, the way the sing pill
// sits over them on the karaoke stage. Which corner depends on how the
// viewer has the words lined up, and the right-hand one has the who-sings
// buttons in it, which it must not sit on.

import { render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { createSignal } from 'solid-js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamSongLyrics } from '@/components/jam/JamSongLyrics'
import { setJamLyricsAlign } from '@/lib/jam/jam-view-prefs'

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

// jsdom has no Element.scrollTo; the sheet's auto-centre effect calls it.
beforeAll(() => {
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo
})

beforeEach(() => setJamLyricsAlign('left'))

const LINES = [
  { text: 'line zero', startSec: 0 },
  { text: 'line one', startSec: 12.5 },
]

function sheet(corner?: () => Element, lines = LINES) {
  return render(() => (
    <JamSongLyrics
      lines={lines}
      positionSec={() => 0}
      showNotes={false}
      corner={corner}
    />
  ))
}

const control = () => (<button type="button">Guide vocal</button>) as Element

describe('the corner of the lyric panel', () => {
  it('is not there unless something is put in it', () => {
    const { queryByTestId, container } = sheet()
    expect(queryByTestId('jam-lyrics-corner')).toBeNull()
    // Nor the room it would have needed: the words keep their last line.
    expect(container.querySelector('[data-corner]')).toBeNull()
  })

  it('holds the control, built once', () => {
    const build = vi.fn(control)
    const { getByTestId } = sheet(build)
    expect(getByTestId('jam-lyrics-corner').textContent).toBe('Guide vocal')
    expect(build).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['left', 'right'],
    ['center', 'right'],
    ['right', 'left'],
  ] as const)('words on the %s leave the %s corner free', (align, side) => {
    setJamLyricsAlign(align)
    const { getByTestId } = sheet(control)
    expect(getByTestId('jam-lyrics-corner').getAttribute('data-side')).toBe(
      side,
    )
  })

  it('is still there for a song with no words, and says there are none', () => {
    // A karaoke song of yours with a vocal stem and no lyrics yet: the
    // finder has the panel, and the singer still needs turning down.
    const { getByTestId, container } = sheet(control, [])
    expect(getByTestId('jam-lyrics-corner').textContent).toBe('Guide vocal')
    expect(container.querySelector('[data-corner][data-wordless]')).not.toBe(
      null,
    )
  })

  it('does not call a song with words wordless', () => {
    const { container } = sheet(control)
    expect(container.querySelector('[data-wordless]')).toBeNull()
  })

  it('is not rebuilt because it was handed a new builder for the same thing', () => {
    // The stage's song object is replaced whenever its words or notes
    // change. A builder written inline is a new function each time, and a
    // level control rebuilt in the middle of a drag drops the drag.
    const builds = vi.fn(control)
    const [builder, setBuilder] = createSignal<() => Element>(() => builds())
    const { getByTestId } = render(() => (
      <JamSongLyrics
        lines={LINES}
        positionSec={() => 0}
        showNotes={false}
        corner={builder()}
      />
    ))
    const first = getByTestId('jam-lyrics-corner').firstElementChild
    setBuilder(() => () => builds())
    setBuilder(() => () => builds())
    expect(builds).toHaveBeenCalledTimes(1)
    expect(getByTestId('jam-lyrics-corner').firstElementChild).toBe(first)
  })

  it('moves when the words do, without rebuilding the control', () => {
    const build = vi.fn(control)
    const { getByTestId } = sheet(build)
    setJamLyricsAlign('right')
    expect(getByTestId('jam-lyrics-corner').getAttribute('data-side')).toBe(
      'left',
    )
    expect(build).toHaveBeenCalledTimes(1)
  })
})

describe('what the stylesheet promises about it', () => {
  const css = readFileSync(
    'src/components/jam/JamSongLyrics.module.css',
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '')

  const rule = (selector: string): string => {
    const at = css.indexOf(`${selector} {`)
    expect(at, `${selector} is in the stylesheet`).toBeGreaterThan(-1)
    return css.slice(at, css.indexOf('}', at))
  }

  it('steps inside the who-sings column on the right', () => {
    // The scroller's 16px gutter plus the 20px button is 36px of column.
    const right = /right:\s*(\d+)px/.exec(rule(".corner[data-side='right']"))
    expect(Number(right?.[1])).toBeGreaterThanOrEqual(44)
  })

  it('lets the last line rest above it', () => {
    expect(rule('.panel[data-corner] .scroll')).toMatch(
      /padding-bottom:\s*5\dpx/,
    )
  })

  it('keeps the corner clear when the finder has the panel', () => {
    expect(rule('.panel[data-corner][data-wordless]')).toMatch(
      /padding-bottom:\s*5\dpx/,
    )
  })

  it('stands down on a phone and on a short screen, which have other homes for it', () => {
    const query = '@media (max-width: 640px), (max-height: 600px)'
    expect(css).toContain(query)
    expect(css.slice(css.indexOf(query))).toMatch(
      /^[^{]*\{\s*\.corner\s*\{\s*display:\s*none/,
    )
  })

  it('shows one home at a time: the playback row takes exactly the short screens', () => {
    const room = readFileSync(
      'src/components/jam/JamPanel.module.css',
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    // Hidden unless asked for...
    expect(room).toMatch(/\.guideInline\s*\{\s*display:\s*none/)
    expect(room).toMatch(/\.guideDock\s*\{\s*display:\s*none/)
    // ...and asked for only where the corner stood down and the dock did not
    // step in: wider than a phone, shorter than the corner needs.
    const short = '@media (min-width: 641px) and (max-height: 600px)'
    expect(room).toContain(short)
    expect(room.slice(room.indexOf(short))).toMatch(
      /^[^{]*\{\s*\.guideInline\s*\{\s*display:\s*flex/,
    )
    expect(css).toContain('@media (min-width: 641px) and (min-height: 601px)')
  })
})
