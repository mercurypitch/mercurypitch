// ============================================================
// F0 measurement tests — neutral preprocessing remains gap-aware
// ============================================================

import { describe, expect, it } from 'vitest'
import { estimateFrameHop, foldCents, hzToCents, medianFilter, preprocessF0Frames, } from './f0'

function centsToHz(cents: number): number {
  return 440 * 2 ** ((cents - 6_900) / 1_200)
}

describe('neutral F0 measurements', () => {
  it('keeps exact cents conversion separate from optional octave folding', () => {
    expect(hzToCents(220)).toBeCloseTo(5_700, 6)
    expect(hzToCents(220) - 6_900).toBeCloseTo(-1_200, 6)
    expect(foldCents(hzToCents(220) - 6_900)).toBeCloseTo(0, 6)
  })

  it('honors configured confidence, median, and gap rules', () => {
    const frames = [
      { t: 0, f0: centsToHz(6_900), conf: 0.9 },
      { t: 0.02, f0: centsToHz(8_100), conf: 0.9 },
      { t: 0.04, f0: centsToHz(6_900), conf: 0.9 },
      { t: 0.4, f0: centsToHz(7_100), conf: 0.9 },
      { t: 0.42, f0: centsToHz(7_100), conf: 0.4 },
    ]
    const result = preprocessF0Frames(frames, {
      confidenceFloor: 0.6,
      medianWindow: 3,
      maxVoicedGapSeconds: 0.08,
    })
    expect(result).toHaveLength(4)
    expect(result[0].cents).toBeCloseTo(6_900, 6)
    expect(result[1].cents).toBeCloseTo(6_900, 6)
    expect(result[2].cents).toBeCloseTo(6_900, 6)
    expect(result[3].cents).toBeCloseTo(7_100, 6)
  })

  it('uses the median positive frame gap', () => {
    expect(
      estimateFrameHop([{ t: 0 }, { t: 0.01 }, { t: 0.04 }, { t: 0.06 }]),
    ).toBeCloseTo(0.02, 12)
  })

  it('rejects even median windows instead of silently using another width', () => {
    expect(() =>
      preprocessF0Frames([{ t: 0, f0: 440, conf: 0.9 }], { medianWindow: 4 }),
    ).toThrow('positive odd integer')
  })

  it('uses a full odd window at edges by default', () => {
    expect(medianFilter([1, 100, 100, 1, 1], 5)[0]).toBe(1)
  })
})
