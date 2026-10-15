// ============================================================
// Between two arches: the world slows to a stand, stands, rolls on
// ============================================================

import { describe, expect, it } from 'vitest'
import { archGapAt, planArchGap } from './glide-gap'

/** Lip roll at Singer: the wave's speed, its landing and its rest. */
const V = 0.825 / 4.3
const WIDTH = 0.1
const FROM = 4.3
const LANDING_END = 4.6
const TO = 7.1

const speedAt = (gap: ReturnType<typeof planArchGap>, t: number): number => {
  const h = 1e-5
  return (archGapAt(gap, t + h) - archGapAt(gap, t - h)) / (2 * h)
}

describe('planArchGap, with room for a stand', () => {
  const gap = planArchGap(FROM, LANDING_END, TO, 2, WIDTH, V)

  it('covers the width, from the arch speed back to the arch speed', () => {
    expect(archGapAt(gap, FROM)).toBeCloseTo(2, 12)
    expect(archGapAt(gap, TO)).toBeCloseTo(2 + WIDTH, 12)
    expect(speedAt(gap, FROM + 1e-4)).toBeCloseTo(V, 3)
    expect(speedAt(gap, TO - 1e-4)).toBeCloseTo(V, 3)
  })

  it('stands still from the landing end until the go, and never runs back', () => {
    const go = (2 * WIDTH) / V - (LANDING_END - FROM)
    expect(gap.stand?.still).toBeCloseTo(LANDING_END, 12)
    expect(gap.stand?.go).toBeCloseTo(TO - go, 12)
    const stood = archGapAt(gap, LANDING_END)
    for (let t = LANDING_END; t <= TO - go; t += 0.01) {
      expect(archGapAt(gap, t)).toBe(stood)
    }
    let previous = archGapAt(gap, FROM)
    for (let i = 1; i <= 400; i++) {
      const x = archGapAt(gap, FROM + ((TO - FROM) * i) / 400)
      expect(x).toBeGreaterThanOrEqual(previous - 1e-12)
      previous = x
    }
  })

  it('slows and starts with no jolt: the speed changes smoothly', () => {
    const dt = 1 / 240
    let previous = speedAt(gap, FROM + 1e-4)
    for (let t = FROM + dt; t < TO - dt; t += dt) {
      const v = speedAt(gap, t)
      expect(Math.abs(v - previous)).toBeLessThan(V * 0.05)
      previous = v
    }
  })
})

describe('planArchGap, with a rest too short to stand', () => {
  it('crawls instead, and still covers the width at the arch speed', () => {
    const to = LANDING_END + 0.2
    const gap = planArchGap(FROM, LANDING_END, to, 0, WIDTH, V)

    expect(gap.stand).toBeNull()
    expect(archGapAt(gap, to)).toBeCloseTo(WIDTH, 12)
    expect(speedAt(gap, FROM + 1e-4)).toBeCloseTo(V, 3)
    expect(speedAt(gap, to - 1e-4)).toBeCloseTo(V, 3)
    expect(speedAt(gap, (FROM + to) / 2)).toBeGreaterThan(0)
  })
})
