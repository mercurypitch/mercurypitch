import { describe, expect, it } from 'vitest'
import { sliderToGain } from '@/lib/volume-curve'

describe('sliderToGain', () => {
  it('keeps the endpoints exact', () => {
    expect(sliderToGain(0)).toBe(0)
    expect(sliderToGain(1)).toBe(1)
  })

  it('maps 50% to -12 dB instead of linear -6 dB', () => {
    const db = 20 * Math.log10(sliderToGain(0.5))
    expect(db).toBeCloseTo(-12.04, 1)
  })

  it('is strictly monotonic across the travel', () => {
    let prev = -1
    for (let p = 0; p <= 100; p++) {
      const g = sliderToGain(p / 100)
      expect(g).toBeGreaterThan(prev)
      prev = g
    }
  })

  it('clamps out-of-range slider positions', () => {
    expect(sliderToGain(-0.5)).toBe(0)
    expect(sliderToGain(1.5)).toBe(1)
  })
})
