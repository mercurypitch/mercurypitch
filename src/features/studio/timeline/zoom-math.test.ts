// Studio zoom math tests — stops, the floor a long song or a phone sets, wheel and pinch factors, and the scroll that keeps a moment in place.
import { describe, expect, it } from 'vitest'
import { clampStudioZoom, STUDIO_ZOOM_HOME, STUDIO_ZOOM_MAX, STUDIO_ZOOM_STOPS, studioAnchoredScroll, studioFitZoom, studioWheelZoomFactor, studioZoomFloor, studioZoomPercent, studioZoomStep, } from './zoom-math'

const RATE = 48_000

describe('studioFitZoom', () => {
  it('fits the song and a second of room to a tenth of a pixel per second', () => {
    // 140 s and a second of room across 560 px less 24 px of margin: 3.80 px/s.
    expect(studioFitZoom(560, 140 * RATE)).toBe(3.8)
  })

  it('stays between 1 and the widest stop', () => {
    expect(studioFitZoom(400, 3600 * RATE)).toBe(1)
    expect(studioFitZoom(4000, 1 * RATE)).toBe(STUDIO_ZOOM_MAX)
  })
})

describe('studioZoomStep', () => {
  it('steps to the next stop either way, from a stop or between two', () => {
    expect(studioZoomStep(40, 1, 10)).toBe(60)
    expect(studioZoomStep(40, -1, 10)).toBe(30)
    expect(studioZoomStep(47.3, 1, 10)).toBe(60)
    expect(studioZoomStep(47.3, -1, 10)).toBe(40)
  })

  it('ends zooming in at the widest stop', () => {
    expect(studioZoomStep(STUDIO_ZOOM_MAX, 1, 10)).toBeNull()
  })

  it("ends zooming out at a long song's fit, below the first stop", () => {
    expect(studioZoomStep(10, -1, 3.6)).toBe(3.6)
    expect(studioZoomStep(3.6, -1, 3.6)).toBeNull()
    expect(studioZoomStep(3.6, 1, 3.6)).toBe(10)
  })

  it("skips the stops under a phone's floor and lands on the floor itself", () => {
    // A phone fits a short song at 25.4 px/s: 20, 15 and 10 would show empty room.
    expect(studioZoomStep(40, -1, 25.4)).toBe(30)
    expect(studioZoomStep(30, -1, 25.4)).toBe(25.4)
    expect(studioZoomStep(25.4, -1, 25.4)).toBeNull()
  })
})

describe('studioZoomFloor', () => {
  it('is the first stop, or a fit below it, and never under 1', () => {
    expect(studioZoomFloor(60)).toBe(STUDIO_ZOOM_STOPS[0])
    expect(studioZoomFloor(3.6)).toBe(3.6)
    expect(studioZoomFloor(0.2)).toBe(1)
  })
})

describe('studioWheelZoomFactor', () => {
  it('zooms in a quarter for a notch up and back out for a notch down', () => {
    expect(studioWheelZoomFactor({ deltaY: -100, deltaMode: 0 })).toBe(1.25)
    expect(studioWheelZoomFactor({ deltaY: 120, deltaMode: 0 })).toBe(0.8)
    // Firefox counts a notch in lines.
    expect(studioWheelZoomFactor({ deltaY: -3, deltaMode: 1 })).toBe(1.25)
  })

  it('follows a trackpad pinch by its own small amounts, and a pair cancels out', () => {
    const out = studioWheelZoomFactor({ deltaY: 4, deltaMode: 0 })
    const back = studioWheelZoomFactor({ deltaY: -4, deltaMode: 0 })
    expect(out).toBeLessThan(1)
    expect(out).toBeGreaterThan(0.9)
    expect(out * back).toBeCloseTo(1, 10)
    expect(studioWheelZoomFactor({ deltaY: 0, deltaMode: 0 })).toBe(1)
  })
})

describe('studioAnchoredScroll', () => {
  it('keeps the moment under the pointer where it was', () => {
    // 300 px into the lanes at 40 px/s, scrolled 500 px: 20 s is under it.
    const seconds = (500 + 300) / 40
    const left = studioAnchoredScroll(seconds, 300, 80)
    expect((left + 300) / 80).toBe(20)
  })

  it('never scrolls before the start of the song', () => {
    expect(studioAnchoredScroll(2, 300, 20)).toBe(0)
  })
})

describe('studioZoomPercent', () => {
  it('reads the opening zoom as 100 percent', () => {
    expect(studioZoomPercent(STUDIO_ZOOM_HOME)).toBe(100)
    expect(studioZoomPercent(60)).toBe(150)
    expect(studioZoomPercent(3.6)).toBe(9)
  })
})

describe('clampStudioZoom', () => {
  it('keeps a zoom to a hundredth of a pixel per second, so a pinch reads 53.24 and not 53.24000000000001', () => {
    expect(40 * 1.1 * 1.1 * 1.1).not.toBe(53.24)
    expect(clampStudioZoom(40 * 1.1 * 1.1 * 1.1, 10)).toBe(53.24)
    expect(clampStudioZoom(40 * 1.25 * 1.25 * 1.25, 10)).toBe(78.13)
  })

  it('holds a zoom between the floor and the closest stop', () => {
    expect(clampStudioZoom(2, 10)).toBe(10)
    expect(clampStudioZoom(900, 10)).toBe(STUDIO_ZOOM_MAX)
    expect(clampStudioZoom(Number.NaN, 3.7)).toBe(3.7)
  })
})
