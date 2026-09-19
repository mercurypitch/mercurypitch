// ============================================================
// A lyric line is something to press, not something to select
// ============================================================
//
// Owner report (2026-09-19): every row wore the text cursor and a click
// could start a selection, so "take it from the chorus" felt like editing
// a document, and arming a singer on top of a half-made selection felt
// worse. The jump itself was always there for the host; what was missing
// was everything that says so.

import { fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamSongLyrics } from '@/components/jam/JamSongLyrics'

const room = vi.hoisted(() => ({ brush: null as string | null, host: true }))

vi.mock('@/stores/jam-store', () => ({
  assignJamSongLines: vi.fn(),
  jamAssignBrush: () => room.brush,
  jamIsHost: () => room.host,
  jamLineIsMine: () => false,
  jamPeerId: () => 'me',
  jamPeers: () => [],
  jamSong: () => null,
  jamSongParts: () => ({}),
}))
// Children with their own store surface -- not under test.
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

beforeEach(() => {
  room.brush = null
  room.host = true
})

const LINES = [
  { text: 'line zero', startSec: 0 },
  { text: 'line one', startSec: 12.5 },
  { text: 'line two', startSec: 30 },
]

function renderSheet(onSeek?: (toSec: number) => void) {
  const utils = render(() => (
    <JamSongLyrics
      lines={LINES}
      positionSec={() => 0}
      showNotes={false}
      onSeek={onSeek}
    />
  ))
  const rows = Array.from(
    utils.container.querySelectorAll<HTMLElement>('[data-line]'),
  )
  expect(rows).toHaveLength(3)
  return { ...utils, rows }
}

describe('pressing a lyric line', () => {
  it('takes the song to that line', () => {
    const onSeek = vi.fn()
    const { rows } = renderSheet(onSeek)
    fireEvent.click(rows[1]!)
    expect(onSeek).toHaveBeenCalledTimes(1)
    expect(onSeek).toHaveBeenCalledWith(12.5)
  })

  it('marks every row the host can jump to, which is what gets the hand', () => {
    const { rows } = renderSheet(vi.fn())
    for (const row of rows) expect(row.hasAttribute('data-seekable')).toBe(true)
  })

  it('leaves a guest the arrow, because their rows go nowhere', () => {
    room.host = false
    // The stage hands a guest no onSeek at all.
    const { rows } = renderSheet(undefined)
    for (const row of rows)
      expect(row.hasAttribute('data-seekable')).toBe(false)
  })

  it('paints instead of jumping while a singer is armed', () => {
    room.brush = 'peer-a'
    const onSeek = vi.fn()
    const { rows } = renderSheet(onSeek)
    fireEvent.click(rows[2]!)
    expect(onSeek).not.toHaveBeenCalled()
  })
})

// jsdom applies no stylesheet, so the half of this that lives in CSS is
// pinned the way the rest of the sheet's CSS contracts are: by reading it.
describe('the stylesheet that goes with it', () => {
  const CSS = readFileSync(
    'src/components/jam/JamSongLyrics.module.css',
    'utf8',
  )
  /** The declarations of the first rule whose selector is exactly this. */
  const rule = (selector: string): string => {
    const start = CSS.indexOf(`\n${selector} {`)
    expect(start, `no rule for ${selector}`).toBeGreaterThanOrEqual(0)
    return CSS.slice(start, CSS.indexOf('\n}', start))
  }

  it('makes the whole sheet unselectable, in Safari too', () => {
    const scroll = rule('.scroll')
    expect(scroll).toMatch(/[^-]user-select: none;/)
    expect(scroll).toContain('-webkit-user-select: none;')
    expect(scroll).toContain('-webkit-touch-callout: none;')
  })

  it('gives a row that jumps the pointer', () => {
    expect(rule('.line[data-seekable]')).toContain('cursor: pointer;')
  })

  it('lets the brush keep its crosshair over a row that would jump', () => {
    // Same specificity as the pointer rule, so it has to come later.
    expect(rule('.line.painting')).toContain('cursor: crosshair;')
    expect(CSS.indexOf('\n.line.painting {')).toBeGreaterThan(
      CSS.indexOf('\n.line[data-seekable] {'),
    )
  })

  it('only brightens on hover where hovering exists', () => {
    // Bare, a tapped row stays lit on a phone until something else is.
    expect(CSS).toContain(
      '@media (hover: hover) {\n  .line[data-seekable]:hover {',
    )
  })
})
