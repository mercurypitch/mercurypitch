// ============================================================
// The back swipe from the left edge
// ============================================================
//
// A touch that starts at the edge and moves mostly sideways drags the screen;
// a release past a third of the width, or a flick, is Back. A touch that
// starts anywhere else, or turns into a scroll, or comes from a mouse, is
// left alone, and on Android the system's own back gesture is the only one.
// jsdom has no PointerEvent with coordinates, so each event is a plain Event
// carrying the fields the handler reads.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMMIT_FRACTION, EDGE_PX, installEdgeSwipe, SETTLE_MS, swipeCommits, swipeIntent, } from './edge-swipe'

const WIDTH = 390

function pointer(
  type: string,
  x: number,
  y: number,
  at: number,
  pointerType = 'touch',
): Event {
  const event = new Event(type, { bubbles: true })
  Object.defineProperties(event, {
    clientX: { value: x },
    clientY: { value: y },
    pointerId: { value: 7 },
    pointerType: { value: pointerType },
    timeStamp: { value: at },
  })
  return event
}

/** A drag from `from` to `to`, in even steps 16 ms apart, then a release. */
function drag(
  screen: HTMLElement,
  from: [number, number],
  to: [number, number],
  options: { steps?: number; release?: 'pointerup' | 'pointercancel' } = {},
): void {
  const steps = options.steps ?? 10
  screen.dispatchEvent(pointer('pointerdown', from[0], from[1], 0))
  for (let step = 1; step <= steps; step += 1) {
    const x = from[0] + ((to[0] - from[0]) * step) / steps
    const y = from[1] + ((to[1] - from[1]) * step) / steps
    screen.dispatchEvent(pointer('pointermove', x, y, step * 16))
  }
  screen.dispatchEvent(
    pointer(options.release ?? 'pointerup', to[0], to[1], steps * 16),
  )
}

let screen: HTMLElement
let release: () => void = () => undefined

function install(platform = 'ios'): ReturnType<typeof vi.fn> {
  const onBack = vi.fn()
  release = installEdgeSwipe(screen, { onBack, platform })
  return onBack
}

beforeEach(() => {
  vi.useFakeTimers()
  screen = document.createElement('div')
  screen.getBoundingClientRect = () =>
    ({ width: WIDTH, height: 844, top: 0, left: 0 }) as DOMRect
  document.body.appendChild(screen)
})

afterEach(() => {
  release()
  release = () => undefined
  screen.remove()
  vi.useRealTimers()
})

describe('what a touch from the edge is doing', () => {
  it('is a tap until it has moved past the slop', () => {
    expect(swipeIntent(4, 3)).toBe('pending')
  })

  it('is a swipe when it moves mostly right, and a scroll otherwise', () => {
    expect(swipeIntent(40, 10)).toBe('swipe')
    expect(swipeIntent(12, 40)).toBe('scroll')
    expect(swipeIntent(-30, 2)).toBe('scroll')
  })

  it('is Back past a third of the width, or on a flick', () => {
    expect(swipeCommits(WIDTH * COMMIT_FRACTION, WIDTH, 0)).toBe(true)
    expect(swipeCommits(60, WIDTH, 0.1)).toBe(false)
    expect(swipeCommits(60, WIDTH, 0.8)).toBe(true)
    expect(swipeCommits(-10, WIDTH, 2)).toBe(false)
  })
})

describe('the swipe on a pushed screen', () => {
  it('drags the screen with the finger and goes back once it is off', () => {
    const onBack = install()
    screen.dispatchEvent(pointer('pointerdown', 6, 400, 0))
    screen.dispatchEvent(pointer('pointermove', 60, 404, 40))
    expect(screen.style.transform).toBe('translate3d(54px, 0, 0)')
    expect(screen.getAttribute('data-swiping')).toBe('on')
    screen.dispatchEvent(pointer('pointermove', 200, 410, 400))
    screen.dispatchEvent(pointer('pointerup', 200, 410, 420))

    // It finishes the slide first, then goes back.
    expect(screen.style.transform).toBe(`translate3d(${WIDTH}px, 0, 0)`)
    expect(onBack).not.toHaveBeenCalled()
    vi.advanceTimersByTime(SETTLE_MS)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('puts the screen back when it is let go too early', () => {
    const onBack = install()
    drag(screen, [6, 400], [80, 404], { steps: 20 })
    vi.advanceTimersByTime(SETTLE_MS * 2)
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.style.transform).toBe('')
    expect(screen.hasAttribute('data-swiping')).toBe(false)
  })

  it('goes back on a quick flick that has not gone far', () => {
    const onBack = install()
    drag(screen, [6, 400], [90, 402], { steps: 2 })
    vi.advanceTimersByTime(SETTLE_MS)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('leaves a touch that starts away from the edge to the page', () => {
    const onBack = install()
    drag(screen, [EDGE_PX + 20, 400], [300, 400])
    vi.advanceTimersByTime(SETTLE_MS)
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.style.transform).toBe('')
  })

  it('hands a vertical drag to the scroller', () => {
    const onBack = install()
    drag(screen, [6, 400], [30, 120])
    vi.advanceTimersByTime(SETTLE_MS)
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.style.transform).toBe('')
  })

  it('puts the screen back when the browser takes the touch', () => {
    const onBack = install()
    drag(screen, [6, 400], [250, 400], { release: 'pointercancel' })
    vi.advanceTimersByTime(SETTLE_MS)
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.style.transform).toBe('')
  })

  it('ignores a mouse', () => {
    const onBack = install()
    screen.dispatchEvent(pointer('pointerdown', 4, 400, 0, 'mouse'))
    screen.dispatchEvent(pointer('pointermove', 300, 400, 100, 'mouse'))
    screen.dispatchEvent(pointer('pointerup', 300, 400, 120, 'mouse'))
    vi.advanceTimersByTime(SETTLE_MS)
    expect(onBack).not.toHaveBeenCalled()
  })

  it("leaves Android's edge to the system back gesture", () => {
    const onBack = install('android')
    drag(screen, [6, 400], [300, 400])
    vi.advanceTimersByTime(SETTLE_MS)
    expect(onBack).not.toHaveBeenCalled()
    expect(screen.style.transform).toBe('')
  })

  it('stops listening once released', () => {
    const onBack = install()
    release()
    drag(screen, [6, 400], [300, 400])
    vi.advanceTimersByTime(SETTLE_MS)
    expect(onBack).not.toHaveBeenCalled()
  })
})
