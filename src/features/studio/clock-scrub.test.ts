// Studio clock scrub tests — a wheel notch, a trackpad swipe and a sideways drag over the clock move the playhead a grid step at a time.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { attachStudioClockScrub, studioClockWheelTurn } from './clock-scrub'
import { publishStudioScrubGrid } from './timeline/scrub-step'

const RATE = 48_000

beforeAll(() => {
  // jsdom has no PointerEvent; without one the events lose clientX.
  if (typeof window.PointerEvent === 'undefined')
    window.PointerEvent = class extends MouseEvent {
      readonly pointerId: number
      readonly pointerType: string
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerId = init.pointerId ?? 1
        this.pointerType = init.pointerType ?? 'mouse'
      }
    } as unknown as typeof PointerEvent
})

afterEach(() => {
  publishStudioScrubGrid(null)
  document.body.replaceChildren()
})

describe('studioClockWheelTurn', () => {
  it('steps once per notch: up or right is later, down or left earlier', () => {
    expect(
      studioClockWheelTurn(
        { deltaX: 0, deltaY: -100, deltaMode: 0, shiftKey: false },
        0,
      ),
    ).toEqual({ steps: 1, carry: 0 })
    expect(
      studioClockWheelTurn(
        { deltaX: 0, deltaY: 120, deltaMode: 0, shiftKey: false },
        0,
      ),
    ).toEqual({ steps: -1, carry: 0 })
    // Firefox counts a notch in lines.
    expect(
      studioClockWheelTurn(
        { deltaX: 0, deltaY: -3, deltaMode: 1, shiftKey: false },
        0,
      ),
    ).toEqual({ steps: 1, carry: 0 })
  })

  it('reads Shift with the wheel, which the browser turns sideways, as the same wheel', () => {
    expect(
      studioClockWheelTurn(
        { deltaX: 100, deltaY: 0, deltaMode: 0, shiftKey: true },
        0,
      ),
    ).toEqual({ steps: -1, carry: 0 })
  })

  it('adds up a trackpad swipe and steps every 40 px of it', () => {
    const first = studioClockWheelTurn(
      { deltaX: 15, deltaY: 2, deltaMode: 0, shiftKey: false },
      0,
    )
    expect(first).toEqual({ steps: 0, carry: 15 })
    const second = studioClockWheelTurn(
      { deltaX: 30, deltaY: 0, deltaMode: 0, shiftKey: false },
      first.carry,
    )
    expect(second).toEqual({ steps: 1, carry: 5 })
  })
})

function clock(playhead: number) {
  const input = document.createElement('input')
  document.body.append(input)
  let frame = playhead
  const seek = vi.fn((next: number) => {
    frame = next
  })
  const detach = attachStudioClockScrub(input, {
    frame: () => frame,
    endFrame: () => 60 * RATE,
    seek,
  })
  return { input, seek, detach, frame: () => frame }
}

function wheel(target: Element, init: WheelEventInit): WheelEvent {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

function pointer(
  target: Element,
  type: string,
  clientX: number,
  init: PointerEventInit = {},
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      pointerId: 1,
      isPrimary: true,
      clientX,
      ...init,
    }),
  )
}

describe('attachStudioClockScrub', () => {
  it('moves the playhead a second a notch with Snap off, a tenth with Shift, and keeps the page still', () => {
    const { input, seek } = clock(10 * RATE)

    const notch = wheel(input, { deltaY: -100 })
    wheel(input, { deltaY: 100, shiftKey: true })

    expect(seek.mock.calls).toEqual([[11 * RATE], [10.9 * RATE]])
    expect(notch.defaultPrevented).toBe(true)
  })

  it("steps along the timeline's grid while Snap is on", () => {
    // At 80 px/s and 120 bpm the grid is a beat: half a second.
    publishStudioScrubGrid({ snap: true, pixelsPerSecond: 80, tempoBpm: 120 })
    const { input, seek } = clock(10.2 * RATE)

    wheel(input, { deltaY: -100 })
    wheel(input, { deltaY: -100 })

    expect(seek.mock.calls).toEqual([[10.5 * RATE], [11 * RATE]])
  })

  it('stays inside the song: no seek before its start or past its end', () => {
    const { input, seek } = clock(0)
    wheel(input, { deltaY: 100 })
    expect(seek).not.toHaveBeenCalled()
  })

  it('counts every notch of a fast turn, before the playhead catches up', () => {
    const input = document.createElement('input')
    document.body.append(input)
    const seek = vi.fn()
    // The transport moves the playhead after the seek lands, not at once.
    attachStudioClockScrub(input, {
      frame: () => 5 * RATE,
      endFrame: () => 60 * RATE,
      seek,
    })

    wheel(input, { deltaY: -100 })
    wheel(input, { deltaY: -100 })

    expect(seek.mock.calls).toEqual([[6 * RATE], [7 * RATE]])
  })

  it('scrubs a step every 10 px of a sideways drag, past a small dead zone, and lets go of the field', () => {
    const { input, seek } = clock(10 * RATE)
    input.focus()

    pointer(input, 'pointerdown', 100)
    pointer(input, 'pointermove', 103)
    expect(seek).not.toHaveBeenCalled()
    pointer(input, 'pointermove', 125)
    pointer(input, 'pointermove', 131)
    pointer(input, 'pointermove', 82)
    pointer(input, 'pointerup', 82)
    pointer(input, 'pointermove', 200)

    expect(seek.mock.calls).toEqual([[12 * RATE], [13 * RATE], [9 * RATE]])
    expect(document.activeElement).not.toBe(input)
  })

  it('leaves a click alone, so the field still takes a typed time', () => {
    const { input, seek } = clock(10 * RATE)
    pointer(input, 'pointerdown', 100)
    pointer(input, 'pointerup', 102)
    expect(seek).not.toHaveBeenCalled()
  })

  it('stops listening once detached', () => {
    const { input, seek, detach } = clock(10 * RATE)
    detach()
    wheel(input, { deltaY: -100 })
    pointer(input, 'pointerdown', 100)
    pointer(input, 'pointermove', 160)
    expect(seek).not.toHaveBeenCalled()
  })
})
