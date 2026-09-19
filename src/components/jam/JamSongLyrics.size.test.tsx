// ── JamSongLyrics: the size of the words ─────────────────────────────
// One number, written by three things -- the header buttons, a modified
// wheel and a two-finger pinch -- and read by one stylesheet. What can go
// wrong is mostly what the gestures do to everything ELSE: this box is a
// scroller, and a wheel handler that cancels one event too many, or a
// touch handler that cancels a one-finger drag, takes away the thing
// people do here most. So the negative cases are asserted as hard as the
// positive ones.
//
// jsdom applies no CSS Modules, so what the number DOES to the words is
// read off the stylesheet here and measured in a real browser in
// jam-stage-layout.spec.ts.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamSongLyrics } from '@/components/jam/JamSongLyrics'
import { JAM_LYRICS_SCALE_DEFAULT, JAM_LYRICS_SCALE_MAX, JAM_LYRICS_SCALE_MIN, } from '@/lib/jam/jam-lyrics-scale'
import { JAM_LYRICS_SCALE_KEY, jamLyricsScale, setJamLyricsScale, } from '@/lib/jam/jam-view-prefs'

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

/** `startAt` is where the song is, in seconds; line 0 is sung at 0. */
function renderSheet(startAt = 0) {
  const [position, setPosition] = createSignal(startAt)
  const utils = render(() => (
    <JamSongLyrics lines={LINES} positionSec={position} showNotes={false} />
  ))
  const scroll = utils.container.querySelector('[data-align]')
  expect(scroll).not.toBeNull()
  return {
    ...utils,
    setPosition,
    scroll: scroll as HTMLElement,
    larger: utils.getByRole('button', { name: 'Larger lyrics' }),
    smaller: utils.getByRole('button', { name: 'Smaller lyrics' }),
    readout: utils.getByTitle('Reset lyric size'),
    control: utils.getByTestId('jam-lyrics-size'),
  }
}

/** A wheel the handler can cancel, which is the thing under test. */
function wheel(
  target: HTMLElement,
  init: WheelEventInit,
): { event: WheelEvent; delivered: boolean } {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  return { event, delivered: target.dispatchEvent(event) }
}

interface Finger {
  x: number
  y: number
  /** Where the finger landed. Defaults to a lyric line inside the box. */
  target?: Element
}

/**
 * A touch event with real `touches`.
 *
 * jsdom has no Touch constructor, so the list is plain objects on a plain
 * cancelable event -- which is all the handler reads, and cancelable is
 * the property the assertions are about.
 */
function touch(box: HTMLElement, type: string, fingers: Finger[]): Event {
  const line = box.querySelector('[data-line="0"]') as Element
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: fingers.map((finger, identifier) => ({
      identifier,
      clientX: finger.x,
      clientY: finger.y,
      target: finger.target ?? line,
    })),
  })
  box.dispatchEvent(event)
  return event
}

beforeEach(() => {
  localStorage.clear()
  setJamLyricsScale(JAM_LYRICS_SCALE_DEFAULT)
  scrollTo.mockClear()
  Element.prototype.scrollTo = scrollTo as typeof Element.prototype.scrollTo
})

afterEach(cleanup)

describe('the lyric size control in the room header', () => {
  it('sits beside the alignment buttons and says what it changes', () => {
    const { larger, smaller, readout, getByRole } = renderSheet()
    expect(getByRole('radiogroup', { name: 'Lyric alignment' })).toBeTruthy()
    expect(larger.tagName).toBe('BUTTON')
    expect(smaller.tagName).toBe('BUTTON')
    expect(readout).toHaveTextContent('100%')
    expect(readout).toHaveAttribute(
      'aria-label',
      'Lyric size 100%. Reset to 100%',
    )
  })

  it('is not mistaken for the lane zoom by anything looking for that', () => {
    // Both are the same component. The e2e finds the lanes' one by test
    // id and by title, and two matches is a strict-mode failure there.
    const { queryByTestId, queryByTitle, queryByLabelText } = renderSheet()
    expect(queryByTestId('jam-lane-zoom')).toBeNull()
    expect(queryByTitle('Reset the zoom')).toBeNull()
    expect(queryByLabelText('Look closer at the pitch lanes')).toBeNull()
  })

  it('walks the ladder up and down, and the readout follows', () => {
    const { larger, smaller, readout } = renderSheet()
    fireEvent.click(larger)
    expect(jamLyricsScale()).toBe(1.1)
    expect(readout).toHaveTextContent('110%')
    fireEvent.click(larger)
    expect(jamLyricsScale()).toBe(1.25)
    fireEvent.click(smaller)
    fireEvent.click(smaller)
    fireEvent.click(smaller)
    expect(jamLyricsScale()).toBe(0.9)
    expect(readout).toHaveTextContent('90%')
  })

  it('gets back to the shipped size in one click, from anywhere', () => {
    setJamLyricsScale(1.73)
    const { readout } = renderSheet()
    expect(readout).not.toBeDisabled()
    fireEvent.click(readout)
    expect(jamLyricsScale()).toBe(JAM_LYRICS_SCALE_DEFAULT)
    expect(readout).toBeDisabled()
  })

  it('stops at each end rather than pretending to go further', () => {
    setJamLyricsScale(JAM_LYRICS_SCALE_MAX)
    const atMax = renderSheet()
    expect(atMax.larger).toBeDisabled()
    expect(atMax.smaller).not.toBeDisabled()
    cleanup()

    setJamLyricsScale(JAM_LYRICS_SCALE_MIN)
    const atMin = renderSheet()
    expect(atMin.smaller).toBeDisabled()
    expect(atMin.larger).not.toBeDisabled()
  })

  it('remembers the size on this device, under its own key', () => {
    const { larger } = renderSheet()
    fireEvent.click(larger)
    expect(localStorage.getItem(JAM_LYRICS_SCALE_KEY)).toBe('1.1')
    // Not the lanes': zooming a lane must not resize the words.
    expect(localStorage.getItem('pitchperfect_jam_lane_zoom')).toBeNull()
  })
})

describe('where the size lands', () => {
  it('is one custom property on the scroll box, kept up to date', () => {
    const { scroll, larger } = renderSheet()
    expect(scroll.style.getPropertyValue('--jam-lyrics-scale')).toBe('1.000')
    fireEvent.click(larger)
    expect(scroll.style.getPropertyValue('--jam-lyrics-scale')).toBe('1.100')
    setJamLyricsScale(1.37)
    expect(scroll.style.getPropertyValue('--jam-lyrics-scale')).toBe('1.370')
  })

  it('starts from what this device remembered', () => {
    setJamLyricsScale(1.5)
    const { scroll, readout } = renderSheet()
    expect(scroll.style.getPropertyValue('--jam-lyrics-scale')).toBe('1.500')
    expect(readout).toHaveTextContent('150%')
  })

  it('leaves the brush colour on the same element alone', () => {
    const { scroll, larger } = renderSheet()
    const before = scroll.style.getPropertyValue('--brush-color')
    expect(before).not.toBe('')
    fireEvent.click(larger)
    expect(scroll.style.getPropertyValue('--brush-color')).toBe(before)
  })
})

describe('a wheel over the words', () => {
  it('sizes them when ctrl is held, and keeps the page from zooming too', () => {
    const { scroll } = renderSheet()
    const { event } = wheel(scroll, { deltaY: -100, ctrlKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(jamLyricsScale()).toBeGreaterThan(JAM_LYRICS_SCALE_DEFAULT)

    const grown = jamLyricsScale()
    wheel(scroll, { deltaY: 100, ctrlKey: true })
    expect(jamLyricsScale()).toBeLessThan(grown)
  })

  it('takes cmd for ctrl, which is what a Mac sends', () => {
    const { scroll } = renderSheet()
    const { event } = wheel(scroll, { deltaY: -100, metaKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(jamLyricsScale()).toBeGreaterThan(JAM_LYRICS_SCALE_DEFAULT)
  })

  it('is left completely alone without a modifier, so the words scroll', () => {
    const { scroll } = renderSheet()
    const { event, delivered } = wheel(scroll, { deltaY: -100 })
    expect(event.defaultPrevented).toBe(false)
    expect(delivered).toBe(true)
    expect(jamLyricsScale()).toBe(JAM_LYRICS_SCALE_DEFAULT)
  })

  it('reaches the handler from a line, which is where a pointer really is', () => {
    const { scroll } = renderSheet()
    const line = scroll.querySelector('[data-line="1"]') as HTMLElement
    const { event } = wheel(line, { deltaY: -100, ctrlKey: true })
    expect(event.defaultPrevented).toBe(true)
    expect(jamLyricsScale()).toBeGreaterThan(JAM_LYRICS_SCALE_DEFAULT)
  })
})

describe('fingers on the words', () => {
  it('size them with two, and keep the browser out of the gesture', () => {
    const { scroll } = renderSheet()
    touch(scroll, 'touchstart', [
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ])
    const move = touch(scroll, 'touchmove', [
      { x: 50, y: 200 },
      { x: 250, y: 200 },
    ])
    expect(move.defaultPrevented).toBe(true)
    expect(jamLyricsScale()).toBeGreaterThan(1.5)
  })

  it('shrink them again when the fingers close', () => {
    setJamLyricsScale(1.5)
    const { scroll } = renderSheet()
    touch(scroll, 'touchstart', [
      { x: 50, y: 200 },
      { x: 250, y: 200 },
    ])
    touch(scroll, 'touchmove', [
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ])
    expect(jamLyricsScale()).toBeLessThan(1.5)
  })

  it('never cancel a one-finger drag, which is how the words are scrolled', () => {
    const { scroll } = renderSheet()
    const start = touch(scroll, 'touchstart', [{ x: 100, y: 300 }])
    const move = touch(scroll, 'touchmove', [{ x: 100, y: 120 }])
    expect(start.defaultPrevented).toBe(false)
    expect(move.defaultPrevented).toBe(false)
    expect(jamLyricsScale()).toBe(JAM_LYRICS_SCALE_DEFAULT)
  })

  it('stop sizing when one of the two lifts', () => {
    const { scroll } = renderSheet()
    touch(scroll, 'touchstart', [
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ])
    touch(scroll, 'touchend', [{ x: 100, y: 200 }])
    // The finger that stayed is a scroll again, from its first move.
    const move = touch(scroll, 'touchmove', [{ x: 100, y: 400 }])
    expect(move.defaultPrevented).toBe(false)
    expect(jamLyricsScale()).toBe(JAM_LYRICS_SCALE_DEFAULT)
  })

  it('do not count a finger resting somewhere else on the screen', () => {
    // One on the words and one on the lanes is not a pinch of either.
    const { scroll } = renderSheet()
    const elsewhere = document.createElement('div')
    document.body.appendChild(elsewhere)
    try {
      const fingers = [
        { x: 100, y: 200 },
        { x: 600, y: 200, target: elsewhere },
      ]
      touch(scroll, 'touchstart', fingers)
      const move = touch(scroll, 'touchmove', [
        { x: 50, y: 200 },
        { x: 700, y: 200, target: elsewhere },
      ])
      expect(move.defaultPrevented).toBe(false)
      expect(jamLyricsScale()).toBe(JAM_LYRICS_SCALE_DEFAULT)
    } finally {
      elsewhere.remove()
    }
  })

  it('leave a touchmove the browser already owns uncancelled', () => {
    // A second finger added mid-scroll: the pan is committed, the event
    // is not cancelable, and cancelling it anyway only logs a warning.
    const { scroll } = renderSheet()
    touch(scroll, 'touchstart', [
      { x: 100, y: 200 },
      { x: 200, y: 200 },
    ])
    const line = scroll.querySelector('[data-line="0"]') as Element
    const move = new Event('touchmove', { bubbles: true, cancelable: false })
    Object.defineProperty(move, 'touches', {
      value: [
        { identifier: 0, clientX: 50, clientY: 200, target: line },
        { identifier: 1, clientX: 250, clientY: 200, target: line },
      ],
    })
    const preventDefault = vi.spyOn(move, 'preventDefault')
    scroll.dispatchEvent(move)
    expect(preventDefault).not.toHaveBeenCalled()
    // The size still follows: the gesture is the viewer's either way.
    expect(jamLyricsScale()).toBeGreaterThan(JAM_LYRICS_SCALE_DEFAULT)
  })
})

// Where the middle IS has a file of its own, JamSongLyrics.centre.test.tsx.
// This is only what a change of size adds to it.
describe('keeping the sung line in the middle while the size changes', () => {
  it('re-centres when the size changes, because every line above it moved', () => {
    const { larger } = renderSheet(2.5)
    scrollTo.mockClear()
    fireEvent.click(larger)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('jumps rather than glides for a size change, so a pinch cannot outrun it', () => {
    const { scroll } = renderSheet(2.5)
    scrollTo.mockClear()
    wheel(scroll, { deltaY: -100, ctrlKey: true })
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ behavior: 'auto' })
  })

  it('goes back to gliding for the next line after a size change', () => {
    const { larger, setPosition } = renderSheet(0)
    fireEvent.click(larger)
    scrollTo.mockClear()
    setPosition(4.5)
    expect(scrollTo.mock.lastCall?.[0]).toMatchObject({ behavior: 'smooth' })
  })

  it('does not scroll for a new size before the song has reached a line', () => {
    const { larger } = renderSheet(-5)
    scrollTo.mockClear()
    fireEvent.click(larger)
    expect(scrollTo).not.toHaveBeenCalled()
  })
})

describe('what the number is wired to', () => {
  const css = readFileSync(
    'src/components/jam/JamSongLyrics.module.css',
    'utf8',
  )

  it('scales the line, at both widths the stylesheet sizes it for', () => {
    expect(css).toContain('font-size: calc(1rem * var(--jam-lyrics-scale, 1))')
    expect(css).toContain(
      'font-size: calc(0.92rem * var(--jam-lyrics-scale, 1))',
    )
    // No fixed size left behind to win the cascade at one width.
    expect(css).not.toMatch(/\.line \{[^}]*font-size: [\d.]+rem;/)
  })

  it('never reads the property without a fallback', () => {
    // An undefined custom property does not fall back to the previous
    // value, it discards the declaration: no fallback, no font size.
    const reads = css.match(/var\(--jam-lyrics-scale[^)]*\)/g) ?? []
    expect(reads.length).toBeGreaterThanOrEqual(3)
    for (const read of reads) expect(read).toBe('var(--jam-lyrics-scale, 1)')
  })

  it('keeps one finger scrolling and the page zoom out of a pinch', () => {
    const scroll = css.match(/\.scroll \{[^}]*\}/)?.[0] ?? ''
    expect(scroll).toContain('touch-action: pan-y')
    expect(scroll).toContain('overflow-y: auto')
  })
})
