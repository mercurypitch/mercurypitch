// ============================================================
// An armed lyric sheet under a finger
// ============================================================
//
// Owner report, 2026-09-20, from a tablet, twice: once "the parts assignment
// also didn't work", once "the touch and drag to move the lyrics up/down
// doesn't work", each mended by a reload. Neither was reproduced. What the
// audit did find is the one state in the room that looks exactly like the
// second: with a singer armed in the Parts bar a finger paints and the words
// do not scroll at all, nothing on the words said so, and a reload is what
// puts a forgotten brush down.
//
// So the sheet says when it is armed, and a sweep in progress cancels the
// browser's pan itself rather than leaving it to a class the browser may not
// have caught up with. jsdom has no touch and no layout: that a finger really
// paints, and really scrolls again after Done, is in `jam-lyrics-follow.spec.ts`.

import { fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { createSignal } from 'solid-js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const [brush, setBrush] = createSignal<string | null>(null)

vi.mock('@/stores/jam-store', () => ({
  assignJamSongLines: vi.fn(),
  jamAssignBrush: () => brush(),
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

import { JamSongLyrics } from '@/components/jam/JamSongLyrics'

beforeAll(() => {
  Element.prototype.scrollTo = (() => {}) as typeof Element.prototype.scrollTo
})

beforeEach(() => {
  setBrush(null)
})

const LINES = [
  { text: 'first line of the song', startSec: 0 },
  { text: 'second line of the song', startSec: 2 },
  { text: 'third line of the song', startSec: 4 },
]

function renderSheet() {
  const utils = render(() => (
    <JamSongLyrics lines={LINES} positionSec={() => 0} showNotes={false} />
  ))
  const scroll = utils.container.querySelector('[data-align]') as HTMLElement
  const row = (index: number) =>
    utils.container.querySelector(`[data-line="${index}"]`) as HTMLElement
  return { ...utils, scroll, row }
}

/** One finger moving on a row, as the sheet's own listener sees it. */
function touchMoveOn(target: HTMLElement): Event {
  const event = new Event('touchmove', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: [{ target, clientX: 10, clientY: 10 }],
  })
  target.dispatchEvent(event)
  return event
}

describe('a lyric sheet with a singer armed', () => {
  it('says so on the words, where the finger is', () => {
    const { scroll } = renderSheet()
    expect(scroll).not.toHaveAttribute('data-armed')

    setBrush('me')
    expect(scroll).toHaveAttribute('data-armed')

    // Done, or the same name again: the sheet scrolls, and says nothing.
    setBrush(null)
    expect(scroll).not.toHaveAttribute('data-armed')
  })

  it('draws that as a ring in the brush’s own colour', () => {
    const css = readFileSync(
      'src/components/jam/JamSongLyrics.module.css',
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    const rule = /\.scroll\[data-armed\] \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule).toContain('box-shadow: inset')
    expect(rule).toContain('var(--brush-color')
  })

  it('keeps the browser from panning under a sweep', () => {
    const { row } = renderSheet()
    setBrush('me')

    fireEvent.pointerDown(row(0))
    const move = touchMoveOn(row(1))

    expect(move.defaultPrevented).toBe(true)
  })

  it('lets one finger scroll whenever no sweep is anchored', () => {
    // The gesture this box is mostly for. It is never cancelled: not with no
    // singer armed, and not with one armed before a line has been pressed.
    const { row } = renderSheet()
    expect(touchMoveOn(row(1)).defaultPrevented).toBe(false)

    setBrush('me')
    expect(touchMoveOn(row(1)).defaultPrevented).toBe(false)
  })

  it('stops cancelling once the finger is up', () => {
    const { row } = renderSheet()
    setBrush('me')
    fireEvent.pointerDown(row(0))
    fireEvent.pointerUp(document)

    setBrush(null)
    expect(touchMoveOn(row(1)).defaultPrevented).toBe(false)
  })
})

describe('the Parts bar on a touch screen', () => {
  const bar = readFileSync('src/components/jam/JamAssignBar.tsx', 'utf8')
  const css = readFileSync(
    'src/components/jam/JamAssignBar.module.css',
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '')

  it('says how to get the scroll back', () => {
    expect(bar).toContain('Drag down their lines. Done to scroll again.')
  })

  it('says it instead of the mouse’s sentence, not as well', () => {
    // Two sentences pushed Done onto a third row of a tablet's lyric column,
    // and a row of this bar is 32px of words. One or the other is drawn.
    expect(bar).toContain('Now drag down the lines they sing.')
    // A mouse still has its wheel while a singer is armed, so it is not told.
    expect(css).toMatch(/\.touchOnly \{\s*display: none;/)
    const coarse = /@media \(pointer: coarse\) \{([\s\S]*?)\n\}/.exec(css)?.[1]
    expect(coarse).toMatch(/\.touchOnly \{\s*display: inline;/)
    expect(coarse).toMatch(/\.mouseOnly \{\s*display: none;/)
  })

  it('still says nothing on a phone, where a hint costs a line of words', () => {
    // The phone block hides `.hintArmed`, and it has to come AFTER the rule
    // that shows the touch hint or a phone would get it back.
    const phone = css.indexOf('@media (max-width: 900px)')
    expect(phone).toBeGreaterThan(css.indexOf('.touchOnly'))
    expect(css.slice(phone)).toMatch(
      /\.hint,\s*\.hintArmed \{\s*display: none;/,
    )
  })
})
