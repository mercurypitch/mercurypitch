// A staircase on the plate: its log scale and grid lines, the misses
// read off it, and a calibration's points split by track.

import { describe, expect, it } from 'vitest'
import type { TracePoint } from '@/features/ear-lab/stage-room'
import { byTrack, logDomain, logPlace, logTicks, staircaseMisses, } from './staircase'

const point = (level: number, correct = true, track?: number): TracePoint => ({
  level,
  turn: false,
  correct,
  track,
})

describe("a staircase's scale", () => {
  it('reads a Hairline run off round grid lines', () => {
    const [lo, hi] = logDomain([50, 42, 35, 30, 12, 9.4])
    expect(lo).toBeLessThan(9.4)
    expect(hi).toBeGreaterThan(50)
    expect(logTicks(lo, hi)).toEqual([10, 20, 50])
  })

  it('keeps a scale for a run that barely moved', () => {
    const [lo, hi] = logDomain([6, 6, 6])
    expect(hi / lo).toBeGreaterThanOrEqual(4)
    expect(logPlace(6, lo, hi)).toBeCloseTo(0.5)
  })

  it('places a level from the bottom, finer levels lower', () => {
    expect(logPlace(10, 10, 100)).toBe(0)
    expect(logPlace(100, 10, 100)).toBe(1)
    expect(logPlace(Math.sqrt(1000), 10, 100)).toBeCloseTo(0.5)
  })

  it('thins its grid lines, keeping the largest', () => {
    expect(logTicks(0.4, 300)).toEqual([2, 20, 200])
    expect(logTicks(0.4, 300, 6)).toEqual([0.5, 2, 10, 50, 200])
  })
})

describe("a staircase's misses", () => {
  const RUN = [
    point(50),
    point(30),
    point(12, false),
    point(14),
    point(9, false),
  ]

  it('counts them, and finds the easiest one came at', () => {
    expect(staircaseMisses(RUN, true)).toEqual({ count: 2, edge: 12 })
    // Where more is better (Span's notes), the easiest is the fewest.
    expect(staircaseMisses(RUN, false)).toEqual({ count: 2, edge: 9 })
  })

  it('has none to name on a clean run', () => {
    expect(staircaseMisses([point(50), point(30)], true)).toEqual({
      count: 0,
      edge: null,
    })
  })
})

describe("a calibration's tracks", () => {
  it('are split from the interleaved run, each in its own order', () => {
    const run = [point(40, true, 0), point(40, true, 1), point(30, true, 0)]
    expect(byTrack(run, 3).map((track) => track.map((p) => p.level))).toEqual([
      [40, 30],
      [40],
      [],
    ])
  })
})
