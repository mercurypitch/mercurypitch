// Journey gesture tests — touch cancellation and drag cannot become island taps.

import { describe, expect, it } from 'vitest'
import { createJourneyPointerTracker, journeyWheelZoomDelta, } from './interaction'

const point = (pointerId: number, clientX: number, clientY: number) => ({
  pointerId,
  clientX,
  clientY,
})

describe('journey pointer tracker', () => {
  it('selects on a short mouse tap', () => {
    const tracker = createJourneyPointerTracker()
    tracker.down(point(1, 20, 30))
    tracker.move(point(1, 23, 32))
    expect(tracker.up(point(1, 23, 32))).toEqual({
      kind: 'tap',
      clientX: 23,
      clientY: 32,
    })
  })

  it('turns travel into drag without selecting on release', () => {
    const tracker = createJourneyPointerTracker()
    tracker.down(point(2, 20, 30))
    expect(tracker.move(point(2, 31, 30))).toEqual({
      kind: 'drag',
      dx: 11,
      dy: 0,
    })
    expect(tracker.move(point(2, 35, 33))).toEqual({
      kind: 'drag',
      dx: 4,
      dy: 3,
    })
    expect(tracker.up(point(2, 35, 33))).toBeUndefined()
  })

  it('includes initial travel in a one-move swipe and rejects a distant release', () => {
    const tracker = createJourneyPointerTracker()
    tracker.down(point(1, 20, 30))
    tracker.move(point(1, 22, 31))
    expect(tracker.move(point(1, 60, 50))).toEqual({
      kind: 'drag',
      dx: 40,
      dy: 20,
    })
    expect(tracker.up(point(1, 60, 50))).toBeUndefined()
    tracker.down(point(2, 20, 30))
    expect(tracker.up(point(2, 60, 50))).toBeUndefined()
  })

  it('suppresses cancelled and multitouch gestures until every pointer lifts', () => {
    const tracker = createJourneyPointerTracker()
    tracker.down(point(3, 10, 10))
    tracker.cancel(3)
    expect(tracker.up(point(3, 10, 10))).toBeUndefined()

    tracker.down(point(4, 10, 10))
    tracker.down(point(5, 12, 12))
    expect(tracker.up(point(4, 10, 10))).toBeUndefined()
    expect(tracker.up(point(5, 12, 12))).toBeUndefined()

    tracker.down(point(6, 10, 10))
    expect(tracker.up(point(6, 10, 10))?.kind).toBe('tap')
  })

  it('reports two-pointer scale without allowing either pointer to select', () => {
    const tracker = createJourneyPointerTracker()
    tracker.down(point(1, 20, 40))
    tracker.down(point(2, 60, 40))
    expect(tracker.move(point(2, 100, 40))).toEqual({
      kind: 'pinch',
      scale: 2,
    })
    expect(tracker.move(point(2, 80, 40))).toEqual({
      kind: 'pinch',
      scale: 0.75,
    })
    expect(tracker.up(point(1, 20, 40))).toBeUndefined()
    expect(tracker.up(point(2, 80, 40))).toBeUndefined()
  })

  it('rebases pinch distance when the active pointer pair changes', () => {
    const tracker = createJourneyPointerTracker()
    tracker.down(point(1, 0, 0))
    tracker.down(point(2, 40, 0))
    tracker.down(point(3, 80, 0))
    expect(tracker.up(point(1, 0, 0))).toBeUndefined()
    expect(tracker.move(point(3, 100, 0))).toEqual({
      kind: 'pinch',
      scale: 1.5,
    })
    expect(tracker.up(point(2, 40, 0))).toBeUndefined()
    expect(tracker.up(point(3, 100, 0))).toBeUndefined()
  })

  it('normalizes wheel, trackpad and page deltas without one-event jumps', () => {
    expect(journeyWheelZoomDelta(-100, 0, 800)).toBeCloseTo(1 / 7)
    expect(journeyWheelZoomDelta(3, 1, 800)).toBeCloseTo(-48 / 700)
    expect(journeyWheelZoomDelta(-1, 2, 800)).toBeCloseTo(240 / 700)
    expect(journeyWheelZoomDelta(100_000, 0, 800)).toBeCloseTo(-240 / 700)
    expect(journeyWheelZoomDelta(Number.NaN, 0, 800)).toBe(0)
  })
})
