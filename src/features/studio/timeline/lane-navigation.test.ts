// Studio lane navigation tests — which wheel turns zoom, which scroll through the song, which the browser keeps, and what a pinch does between two frames.
import { describe, expect, it } from 'vitest'
import { studioPinchStep, studioWheelIntent, studioWheelPixels, } from './lane-navigation'

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
