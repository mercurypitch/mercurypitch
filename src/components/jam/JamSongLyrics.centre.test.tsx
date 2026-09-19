// ── JamSongLyrics: keeping the sung line in the middle ───────────────
// The sheet scrolls itself so the line being sung sits in the middle of
// its box. The sum used to start from `offsetTop`, which is measured from
// the element's offsetParent -- and the box is not one. The panel around
// it is (its backdrop-filter makes it a containing block), so the header
// and the parts bar above the box were counted as if they scrolled with
// the words, and the sung line sat that much too high: 76px or more, which
// in a phone's 212px box is the top edge.
//
// The second half is the box changing height under a song that is standing
// still -- the parts bar wrapping, the seam being dragged -- which moves
// the middle without moving the song.
//
// jsdom lays nothing out, so the geometry is handed to it here. Where the
// line really lands is measured in jam-stage-layout.spec.ts.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamSongLyrics } from '@/components/jam/JamSongLyrics'

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

const LINES = [
  { text: 'first line of the song', startSec: 0 },
  { text: 'second line of the song', startSec: 2 },
  { text: 'third line of the song', startSec: 4 },
]

const scrollTo = vi.fn()

const rectAt = (top: number, height: number) => () =>
  ({ top, height, bottom: top + height }) as DOMRect

/** How tall the box is. A test changes it to resize the box. */
let boxHeight = 200

/**
 * The sheet, before the song has reached a line, laid out like a real
 * panel: a 200px box that starts 100px down the viewport, under a header
 * and a parts bar, with 1000px of words in it.
 */
function renderSheet() {
  const [position, setPosition] = createSignal(-5)
  const utils = render(() => (
    <JamSongLyrics lines={LINES} positionSec={position} showNotes={false} />
  ))
  const scroll = utils.container.querySelector('[data-align]') as HTMLElement
  scroll.getBoundingClientRect = () => rectAt(100, boxHeight)()
  Object.defineProperties(scroll, {
    clientHeight: { get: () => boxHeight },
    scrollHeight: { value: 1000 },
  })
  return { ...utils, scroll, setPosition }
}

/**
 * Put a line `into` pixels down the box's own content.
 *
 * `offsetTop` is what a browser really reports for it: measured from the
 * PANEL, so it carries the 76px of header and parts bar above the box.
 */
function placeLine(scroll: HTMLElement, index: number, into: number): void {
  const line = scroll.querySelector(`[data-line="${index}"]`) as HTMLElement
  line.getBoundingClientRect = rectAt(100 + into, 40)
  Object.defineProperties(line, {
    offsetHeight: { value: 40 },
    offsetTop: { value: into + 76 },
  })
}

beforeEach(() => {
  localStorage.clear()
  boxHeight = 200
  scrollTo.mockClear()
  Element.prototype.scrollTo = scrollTo as typeof Element.prototype.scrollTo
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('keeping the sung line in the middle of the words', () => {
  it('does not scroll anywhere before the song has reached a line', () => {
    renderSheet()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('glides to the line when the song reaches it', () => {
    const { scroll, setPosition } = renderSheet()
    placeLine(scroll, 1, 300)
    setPosition(2.5)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ behavior: 'smooth' })
  })

  it('centres the line in the box, not in whatever its offsetParent is', () => {
    const { scroll, setPosition } = renderSheet()
    placeLine(scroll, 1, 300)
    setPosition(2.5)
    // 300 into the content, less half the box, plus half the line. The
    // panel's 76px would have made it 296: the line 76px above centre.
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ top: 220 })
  })

  it('counts what has already been scrolled past', () => {
    // The rects are where things are on SCREEN, so a box that has already
    // scrolled 250px shows the same line 250px higher. The answer is a
    // place in the content and must not move with it.
    const { scroll, setPosition } = renderSheet()
    placeLine(scroll, 1, 300 - 250)
    Object.defineProperty(scroll, 'scrollTop', { value: 250 })
    setPosition(2.5)
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ top: 220 })
  })

  it('stops at the top for a first line that cannot be centred', () => {
    const { scroll, setPosition } = renderSheet()
    placeLine(scroll, 0, 10)
    setPosition(0.5)
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ top: 0 })
  })

  it('stops at the bottom for a last line that cannot be centred', () => {
    const { scroll, setPosition } = renderSheet()
    placeLine(scroll, 2, 950)
    setPosition(4.5)
    // 1000px of words in a 200px box: 800 is as far as it goes.
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ top: 800 })
  })
})

describe('keeping it there when the box changes height', () => {
  /** What the browser calls when the box it was given changes size. */
  let resized: () => void = () => {}
  const observe = vi.fn()
  const disconnect = vi.fn()

  // jsdom has no ResizeObserver, so the sheet is handed one whose
  // callback the test holds. It has to be there before the sheet renders:
  // the box is watched from its ref.
  beforeEach(() => {
    observe.mockClear()
    disconnect.mockClear()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized = callback
        }
        observe = observe
        unobserve = vi.fn()
        disconnect = disconnect
      },
    )
  })

  /** The sheet parked on its second line, 300px into the words. */
  function renderParked() {
    const sheet = renderSheet()
    placeLine(sheet.scroll, 1, 300)
    sheet.setPosition(2.5)
    scrollTo.mockClear()
    return sheet
  }

  it('watches the box the words scroll in', () => {
    const { scroll } = renderSheet()
    expect(observe).toHaveBeenCalledTimes(1)
    expect(observe).toHaveBeenCalledWith(scroll)
  })

  it('brings the line back to the new middle', () => {
    renderParked()
    // The parts bar wrapped onto a second row and took 40px off the box.
    boxHeight = 160
    resized()
    // Half of a shorter box is less to take off: 300 - 80 + 20.
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ top: 240 })
  })

  it('jumps rather than glides, so a dragged seam cannot outrun it', () => {
    renderParked()
    boxHeight = 160
    resized()
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ behavior: 'auto' })
  })

  it('goes back to gliding for the next line', () => {
    const { scroll, setPosition } = renderParked()
    boxHeight = 160
    resized()
    placeLine(scroll, 2, 360)
    setPosition(4.5)
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ behavior: 'smooth' })
  })

  it('leaves the words alone when the box is reported at the height it had', () => {
    renderParked()
    resized()
    scrollTo.mockClear()
    // A width change, or the observer's own first report, said twice.
    resized()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('does not scroll a sheet the song has not reached', () => {
    renderSheet()
    boxHeight = 160
    resized()
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('stops watching when the sheet goes away', () => {
    const { unmount } = renderSheet()
    expect(disconnect).not.toHaveBeenCalled()
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
