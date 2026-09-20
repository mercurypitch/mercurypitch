// ── JamSongLyrics: following the song without holding the words ──────
// Owner report (2026-09-20): while a song played, the lyric sheet could not
// be scrolled. The centring effect read the song's POSITION, so it ran on
// every tick of the clock -- four times a second -- and each run glided the
// sheet back to the sung line. A scroll lasted a quarter of a second.
//
// What it should do is what the karaoke mixer's sheet does: leave the words
// to whoever is touching them, and come back when the NEXT line starts. And
// never stay away -- a sheet left where a hand put it, with the song going
// on underneath, is the other way to get this wrong.
//
// jsdom lays nothing out, so the geometry is handed to it here. The real
// thing is measured in jam-lyrics-follow.spec.ts.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamSongLyrics } from '@/components/jam/JamSongLyrics'
import { LYRICS_HANDS_OFF_MS } from '@/lib/jam/lyrics-hands-off'

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
  { text: 'fourth line of the song', startSec: 6 },
  { text: 'fifth line of the song', startSec: 8 },
]

const scrollTo = vi.fn()

const rectAt = (top: number, height: number) => () =>
  ({ top, height, bottom: top + height }) as DOMRect

function renderSheet(lines = LINES) {
  const [position, setPosition] = createSignal(-5)
  const [shown, setShown] = createSignal(lines)
  const utils = render(() => (
    <JamSongLyrics lines={shown()} positionSec={position} showNotes={false} />
  ))
  const scroll = utils.container.querySelector('[data-align]') as HTMLElement
  scroll.getBoundingClientRect = () => rectAt(100, 200)()
  Object.defineProperties(scroll, {
    clientHeight: { get: () => 200 },
    scrollHeight: { value: 1000 },
  })
  for (const row of scroll.querySelectorAll<HTMLElement>('[data-line]')) {
    const index = Number(row.dataset.line)
    row.getBoundingClientRect = rectAt(100 + index * 120, 40)
    Object.defineProperty(row, 'offsetHeight', { value: 40 })
  }
  return { ...utils, scroll, setPosition, setShown }
}

const touch = (type: string, touches: number): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: Array.from({ length: touches }, () => ({ clientX: 0, clientY: 0 })),
  })
  return event
}

beforeEach(() => {
  localStorage.clear()
  scrollTo.mockClear()
  Element.prototype.scrollTo = scrollTo as typeof Element.prototype.scrollTo
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('following the song', () => {
  it('centres a line once, however long it is sung for', () => {
    const { setPosition } = renderSheet()
    setPosition(2.1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    // The clock ticks four times a second. None of these is a new line.
    for (const tick of [2.35, 2.6, 2.85, 3.1, 3.35, 3.6, 3.85]) {
      setPosition(tick)
    }
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('comes back for the next line', () => {
    const { setPosition } = renderSheet()
    setPosition(2.1)
    setPosition(3.9)
    setPosition(4.1)
    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ behavior: 'smooth' })
  })

  it('follows a seek backwards as well as the song forwards', () => {
    const { setPosition } = renderSheet()
    setPosition(6.2)
    setPosition(0.4)
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })
})

describe('leaving the words to whoever is scrolling them', () => {
  it('does not take the sheet back from a finger that is dragging it', () => {
    const { scroll, setPosition } = renderSheet()
    setPosition(2.1)
    scroll.dispatchEvent(touch('touchstart', 1))
    scroll.dispatchEvent(touch('touchmove', 1))
    // The next line starts with the finger still down.
    setPosition(4.1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('does not take it back in the moment after a wheel either', () => {
    const { scroll, setPosition } = renderSheet()
    setPosition(2.1)
    scroll.dispatchEvent(new Event('wheel', { bubbles: true }))
    vi.advanceTimersByTime(LYRICS_HANDS_OFF_MS - 50)
    setPosition(4.1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('treats a tap as a tap: a touch that never moved holds nothing off', () => {
    const { scroll, setPosition } = renderSheet()
    setPosition(2.1)
    scroll.dispatchEvent(touch('touchstart', 1))
    scroll.dispatchEvent(touch('touchend', 0))
    setPosition(4.1)
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })

  it('does not mistake a pinch for a scroll: two fingers size the words', () => {
    const { scroll, setPosition } = renderSheet()
    setPosition(2.1)
    scroll.dispatchEvent(touch('touchstart', 2))
    scroll.dispatchEvent(touch('touchmove', 2))
    scroll.dispatchEvent(touch('touchend', 0))
    setPosition(4.1)
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })
})

describe('never staying away', () => {
  it('catches up with the song once the hand has been gone for a moment', () => {
    const { scroll, setPosition } = renderSheet()
    setPosition(2.1)
    scroll.dispatchEvent(touch('touchstart', 1))
    scroll.dispatchEvent(touch('touchmove', 1))
    setPosition(4.1) // owed: the finger is down
    scroll.dispatchEvent(touch('touchend', 0))
    expect(scrollTo).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(LYRICS_HANDS_OFF_MS + 1)
    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ behavior: 'smooth' })
  })

  it('and goes on following after that', () => {
    const { scroll, setPosition } = renderSheet()
    setPosition(2.1)
    scroll.dispatchEvent(new Event('wheel', { bubbles: true }))
    vi.advanceTimersByTime(LYRICS_HANDS_OFF_MS + 1)
    // Nothing was owed, so the hand going is not a reason to move: the
    // reader keeps their place until the song has somewhere new to be.
    expect(scrollTo).toHaveBeenCalledTimes(1)
    setPosition(4.1)
    setPosition(6.1)
    expect(scrollTo).toHaveBeenCalledTimes(3)
  })

  it('a finger resting on the words is still reading them, however long', () => {
    const { scroll, setPosition } = renderSheet()
    setPosition(2.1)
    scroll.dispatchEvent(touch('touchstart', 1))
    scroll.dispatchEvent(touch('touchmove', 1))
    vi.advanceTimersByTime(LYRICS_HANDS_OFF_MS * 5)
    setPosition(4.1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('does not wait for a line change that may never come: the last line is caught up too', () => {
    // Scroll away during the second-to-last line and let go while the LAST
    // one is sung. There is no next line to come back on, so the sheet
    // comes back by itself once the hand has been gone for a moment.
    const { scroll, setPosition } = renderSheet()
    setPosition(6.1)
    scroll.dispatchEvent(new Event('wheel', { bubbles: true }))
    setPosition(8.1) // the last line starts inside the hands-off window
    expect(scrollTo).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(LYRICS_HANDS_OFF_MS + 1)
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })

  it('owes nothing for a line the song left and came back to', () => {
    // A pause settles a hair under the line's start and back again; a scrub
    // overshoots and is corrected. With a hand on the words that raised a
    // flag nothing could lower, and a STOPPED song pulled the sheet back to
    // a line it had never left. What is owed is decided when the hand goes,
    // from where the song is then.
    const { scroll, setPosition } = renderSheet()
    setPosition(4.1)
    scroll.dispatchEvent(new Event('wheel', { bubbles: true }))
    setPosition(3.99) // the line before, for a moment
    setPosition(4.1) // and back
    vi.advanceTimersByTime(LYRICS_HANDS_OFF_MS + 1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('does not pay a new layout back as a yank once the hand has gone', () => {
    // The words were replaced while the reader was scrolling them. The
    // sheet they are holding is the new one already; taking it back to the
    // sung line the moment they let go is the behaviour this file exists to
    // end. The next line brings it back, as it always does.
    const { scroll, setPosition, setShown } = renderSheet()
    setPosition(4.1)
    scroll.dispatchEvent(new Event('wheel', { bubbles: true }))
    setShown(LINES.map((line) => ({ ...line })))
    vi.advanceTimersByTime(LYRICS_HANDS_OFF_MS + 1)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    setPosition(6.1)
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })

  it('a cancelled touch counts as the hand going, not as one still down', () => {
    const { scroll, setPosition } = renderSheet()
    setPosition(2.1)
    scroll.dispatchEvent(touch('touchstart', 1))
    scroll.dispatchEvent(touch('touchmove', 1))
    scroll.dispatchEvent(touch('touchcancel', 0))
    vi.advanceTimersByTime(LYRICS_HANDS_OFF_MS + 1)
    setPosition(4.1)
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })
})

describe('the run-in', () => {
  it('takes a stopped song back to the top of its words', () => {
    // First line at two seconds, so zero is before it.
    const late = LINES.map((line) => ({ ...line, startSec: line.startSec + 2 }))
    const { setPosition } = renderSheet(late)
    setPosition(6.5)
    setPosition(0)
    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ top: 0 })
  })

  it('leaves a break between two lines where it is', () => {
    const gapped = LINES.map((line) => ({ ...line, endSec: line.startSec + 1 }))
    const { setPosition } = renderSheet(gapped)
    setPosition(2.1)
    setPosition(3.5) // line two has ended, line three has not begun
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })
})

describe('what still moves the sheet at once', () => {
  it('a new set of words under the same line number', () => {
    // Original to Edited: line 1 is still line 1, and it is somewhere else.
    const { setPosition, setShown } = renderSheet()
    setPosition(2.1)
    setShown(LINES.map((line) => ({ ...line, text: `${line.text}, again` })))
    expect(scrollTo).toHaveBeenCalledTimes(2)
  })
})
