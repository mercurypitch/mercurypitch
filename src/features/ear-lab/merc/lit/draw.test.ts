// The lit instruments' arithmetic: easing held to its ends, part of a
// polyline, and a sine wave from its start to its end.

import { describe, expect, it } from 'vitest'
import { easeInOut, easeOut, easeOutBack, partialD, progress, sineD, } from './draw'

describe("the lit instruments' arithmetic", () => {
  it('holds progress to 0 before it starts and 1 after it ends', () => {
    expect(progress(-5, 0, 100)).toBe(0)
    expect(progress(50, 0, 100)).toBe(0.5)
    expect(progress(500, 0, 100)).toBe(1)
  })

  it('eases from 0 to 1, the back ease settling at 1', () => {
    for (const ease of [easeOut, easeInOut, easeOutBack]) {
      expect(ease(0)).toBeCloseTo(0, 6)
      expect(ease(1)).toBeCloseTo(1, 6)
    }
    // It overshoots on its way.
    expect(Math.max(...[0.6, 0.7, 0.8].map(easeOutBack))).toBeGreaterThan(1)
  })

  it('draws part of a polyline, its tip on the way to the next point', () => {
    const points = [
      [0, 0],
      [10, 0],
      [10, 10],
    ] as const
    const half = partialD(points, 0.75)
    expect(half.reached).toBe(1)
    expect(half.tip).toEqual([10, 5])
    expect(half.d).toBe('M0 0L10 0L10 5')
    expect(partialD(points, 1).d).toBe('M0 0L10 0L10 10')
  })

  it('draws a sine wave from its start to its end, level where the envelope is nothing', () => {
    const d = sineD(0, 100, 50, 10, 25, 0)
    expect(d.startsWith('M0 50')).toBe(true)
    expect(d.endsWith('L100 50')).toBe(true)
    expect(sineD(0, 100, 50, 10, 25, 1.2, () => 0)).not.toMatch(/ (?!50)\d/u)
  })
})
