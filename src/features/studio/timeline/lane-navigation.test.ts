// Studio lane navigation tests — which wheel turns zoom, which scroll through the song, which the browser keeps, what a pinch does between two frames, and Safari's trackpad pinch.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachStudioLaneNavigation, studioGestureZoom, studioPinchStep, studioWheelIntent, studioWheelPixels, } from './lane-navigation'

const wheel = (more: Partial<WheelEvent> = {}) => ({
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  deltaX: 0,
  deltaY: 100,
  deltaMode: 0,
  ...more,
})

const both = { vertical: true, horizontal: true }
const wide = { vertical: false, horizontal: true }

describe('studioWheelIntent', () => {
  it('zooms for Ctrl or Cmd with the wheel, and for a trackpad pinch', () => {
    expect(studioWheelIntent(wheel({ ctrlKey: true }), both)).toBe('zoom')
    expect(studioWheelIntent(wheel({ metaKey: true }), wide)).toBe('zoom')
    expect(
      studioWheelIntent(wheel({ ctrlKey: true, deltaY: -2.5 }), both),
    ).toBe('zoom')
  })

  it('leaves the browser its own scrolling while the lanes can scroll that way', () => {
    expect(studioWheelIntent(wheel(), both)).toBe('native')
    expect(studioWheelIntent(wheel({ shiftKey: true }), wide)).toBe('native')
    expect(studioWheelIntent(wheel({ deltaX: 80, deltaY: 0 }), wide)).toBe(
      'native',
    )
  })

  it('scrolls through the song for a plain wheel over lanes that all fit', () => {
    expect(studioWheelIntent(wheel(), wide)).toBe('sideways')
    expect(studioWheelIntent(wheel({ deltaY: -3, deltaMode: 1 }), wide)).toBe(
      'sideways',
    )
  })

  it('leaves a wheel alone when there is nowhere to scroll at all', () => {
    expect(
      studioWheelIntent(wheel(), { vertical: false, horizontal: false }),
    ).toBe('native')
  })
})

describe('studioWheelPixels', () => {
  it('reads lines and pages as pixels', () => {
    expect(studioWheelPixels(wheel({ deltaY: 100 }), 900)).toBe(100)
    expect(studioWheelPixels(wheel({ deltaY: 3, deltaMode: 1 }), 900)).toBe(99)
    expect(studioWheelPixels(wheel({ deltaY: -1, deltaMode: 2 }), 900)).toBe(
      -900,
    )
  })
})

describe('studioPinchStep', () => {
  it('zooms by how far the fingers spread, about the point between them', () => {
    const step = studioPinchStep(
      { distance: 100, x: 400, y: 300 },
      { distance: 150, x: 400, y: 300 },
    )
    expect(step).toEqual({ factor: 1.5, anchorX: 400, panX: 0, panY: 0 })
  })

  it('pans as the point between the fingers moves, the way the fingers go', () => {
    const step = studioPinchStep(
      { distance: 100, x: 400, y: 300 },
      { distance: 100, x: 370, y: 320 },
    )
    expect(step).toEqual({ factor: 1, anchorX: 370, panX: 30, panY: -20 })
  })

  it('does not zoom from fingers that landed on one spot', () => {
    expect(
      studioPinchStep({ distance: 0, x: 0, y: 0 }, { distance: 40, x: 0, y: 0 })
        .factor,
    ).toBe(1)
  })
})

describe('studioGestureZoom', () => {
  it("zooms by each Safari gesture event's scale against the one before", () => {
    expect(studioGestureZoom(1, 1.25)).toBe(1.25)
    expect(studioGestureZoom(1.25, 1.5625)).toBeCloseTo(1.25, 10)
    expect(studioGestureZoom(1.5, 1.5)).toBe(1)
    expect(studioGestureZoom(2, 1)).toBe(0.5)
  })

  it('reads a missing or broken scale as no zoom, and never jumps more than twice', () => {
    expect(studioGestureZoom(1, Number.NaN)).toBe(1)
    expect(studioGestureZoom(0, 1.2)).toBe(1)
    expect(studioGestureZoom(1, 0)).toBe(1)
    expect(studioGestureZoom(0.1, 5)).toBe(2)
  })
})

describe("Safari's trackpad pinch over the lanes", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  /** A browser with Safari's GestureEvent; any constructor stands in for it. */
  const safari = () => vi.stubGlobal('GestureEvent', Event)

  function lanes() {
    const viewport = document.createElement('div')
    document.body.append(viewport)
    const zoomBy = vi.fn()
    const detach = attachStudioLaneNavigation(viewport, { zoomBy })
    return { viewport, zoomBy, detach }
  }

  /** A gesture event as Safari sends one: its scale since the pinch began. */
  function gesture(
    target: Element,
    type: string,
    more: { scale?: number; clientX?: number } = {},
  ): Event {
    const event = Object.assign(
      new Event(type, { bubbles: true, cancelable: true }),
      more,
    )
    target.dispatchEvent(event)
    return event
  }

  it('zooms the timeline about the pointer, not the page', () => {
    safari()
    const { viewport, zoomBy } = lanes()

    const start = gesture(viewport, 'gesturestart', { scale: 1, clientX: 300 })
    const change = gesture(viewport, 'gesturechange', {
      scale: 1.5,
      clientX: 300,
    })
    gesture(viewport, 'gesturechange', { scale: 3, clientX: 320 })
    const end = gesture(viewport, 'gestureend', { scale: 3, clientX: 320 })

    expect(zoomBy.mock.calls).toEqual([
      [1.5, 300],
      [2, 320],
    ])
    for (const event of [start, change, end])
      expect(event.defaultPrevented).toBe(true)
  })

  it('zooms about where the pointer last was when the event does not say', () => {
    safari()
    const { viewport, zoomBy } = lanes()
    viewport.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX: 420 }),
    )
    gesture(viewport, 'gesturestart', { scale: 1 })
    gesture(viewport, 'gesturechange', { scale: 1.2 })
    expect(zoomBy).toHaveBeenCalledExactlyOnceWith(1.2, 420)
  })

  it('leaves a pinch on a touch screen to its fingers, so it zooms once', () => {
    safari()
    const { viewport, zoomBy } = lanes()
    const touches = [
      { clientX: 200, clientY: 100 },
      { clientX: 300, clientY: 100 },
    ]
    viewport.dispatchEvent(
      Object.assign(new Event('touchstart', { bubbles: true }), { touches }),
    )
    gesture(viewport, 'gesturestart', { scale: 1, clientX: 250 })
    const change = gesture(viewport, 'gesturechange', {
      scale: 1.5,
      clientX: 250,
    })
    expect(zoomBy).not.toHaveBeenCalled()
    // Safari's own page zoom still stays out of the lanes.
    expect(change.defaultPrevented).toBe(true)
  })

  it('does not zoom twice when a pinch also comes as Ctrl and the wheel', () => {
    safari()
    const { viewport, zoomBy } = lanes()
    gesture(viewport, 'gesturestart', { scale: 1, clientX: 300 })
    const wheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -4,
      clientX: 300,
    })
    viewport.dispatchEvent(wheel)
    expect(wheel.defaultPrevented).toBe(true)
    expect(zoomBy).not.toHaveBeenCalled()
  })

  it('listens for no gesture events where the browser has none, as in Chromium', () => {
    const { viewport, zoomBy } = lanes()
    const change = gesture(viewport, 'gesturechange', {
      scale: 2,
      clientX: 300,
    })
    expect(zoomBy).not.toHaveBeenCalled()
    expect(change.defaultPrevented).toBe(false)
  })

  it('stops listening once detached', () => {
    safari()
    const { viewport, zoomBy, detach } = lanes()
    detach()
    gesture(viewport, 'gesturestart', { scale: 1, clientX: 300 })
    gesture(viewport, 'gesturechange', { scale: 2, clientX: 300 })
    expect(zoomBy).not.toHaveBeenCalled()
  })
})
