import { describe, expect, it } from 'vitest'
import { buildClickSchedule, CALIBRATION_CLICK_COUNT, MAX_OFFSET_MS, median, medianOffsetMs, nearestClickDelta, spreadMs, } from '@/lib/tap-calibration'

describe('buildClickSchedule', () => {
  it('lays clicks out at a fixed interval from the start time', () => {
    expect(buildClickSchedule(10, 4, 0.5)).toEqual([10, 10.5, 11, 11.5])
  })

  it('defaults to the calibration run length', () => {
    expect(buildClickSchedule(0)).toHaveLength(CALIBRATION_CLICK_COUNT)
  })
})

describe('nearestClickDelta', () => {
  const clicks = [1, 2, 3]

  it('returns a positive delta for a late tap', () => {
    expect(nearestClickDelta(clicks, 2.18)).toBeCloseTo(0.18, 5)
  })

  it('returns a negative delta for an early tap', () => {
    expect(nearestClickDelta(clicks, 1.9)).toBeCloseTo(-0.1, 5)
  })

  it('picks the nearest click, not the first in range', () => {
    expect(nearestClickDelta(clicks, 2.9)).toBeCloseTo(-0.1, 5)
  })

  it('discards a tap too far from every click', () => {
    expect(nearestClickDelta(clicks, 3.9)).toBeNull()
    expect(nearestClickDelta(clicks, 90)).toBeNull()
  })

  it('attributes every tap between two clicks at the default tolerance', () => {
    // Clicks are 1s apart and the tolerance is 0.5s, so nothing that lands
    // inside the run is thrown away — only taps outside it, or wild ones.
    expect(nearestClickDelta(clicks, 2.5)).not.toBeNull()
  })

  it('honours a tighter tolerance', () => {
    expect(nearestClickDelta(clicks, 2.3, 0.2)).toBeNull()
    expect(nearestClickDelta(clicks, 2.15, 0.2)).toBeCloseTo(0.15, 5)
  })
})

describe('median', () => {
  it('takes the middle of an odd sample', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('averages the two middles of an even sample', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('returns null for an empty sample', () => {
    expect(median([])).toBeNull()
  })
})

describe('medianOffsetMs', () => {
  it('converts the median signed error to whole milliseconds', () => {
    expect(medianOffsetMs([0.18, 0.2, 0.19, 0.21, 0.2])).toBe(200)
  })

  it('ignores a single wild tap — the reason it is a median', () => {
    // Four consistent taps around 190ms plus one that arrived 2s late.
    expect(medianOffsetMs([0.19, 0.185, 0.195, 0.19, 2])).toBe(190)
  })

  it('clamps an anticipating operator to zero rather than negative', () => {
    expect(medianOffsetMs([-0.1, -0.12, -0.09, -0.11])).toBe(0)
  })

  it('clamps to the same ceiling the mapper persists', () => {
    expect(medianOffsetMs([2, 2, 2, 2])).toBe(MAX_OFFSET_MS)
  })

  it('refuses to guess from too few taps', () => {
    expect(medianOffsetMs([0.2, 0.2, 0.2])).toBeNull()
  })
})

describe('spreadMs', () => {
  it('is small for consistent taps', () => {
    expect(spreadMs([0.19, 0.2, 0.195, 0.205])).toBeLessThanOrEqual(15)
  })

  it('is large for scattered taps', () => {
    expect(spreadMs([0.05, 0.4, 0.1, 0.38])).toBeGreaterThan(100)
  })

  it('needs at least two samples', () => {
    expect(spreadMs([0.2])).toBeNull()
  })
})
