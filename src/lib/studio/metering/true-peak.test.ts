// Peak reconstruction regressions cover the skipped region and padded/chunked filter state.
import { describe, expect, it } from 'vitest'
import { adversarialPeak, meterTone } from './meter.test-fixtures'
import { createTruePeakEstimator } from './true-peak'

function peak(data: Float32Array): number {
  const filter = createTruePeakEstimator()
  for (const sample of data) filter.push(sample)
  return filter.finish()
}

describe('Studio finite true-peak estimate', () => {
  it('captures the public adversarial overshoot and all filter phases', () => {
    expect(20 * Math.log10(peak(adversarialPeak()))).toBeGreaterThan(4)
    const tone = meterTone(48000, 0.1, 12000, 1, Math.PI / 4)
    expect(peak(tone)).toBeGreaterThan(0.99)
  })

  it('flushes a final impulse, matches a leading impulse and finishes idempotently', () => {
    const first = new Float32Array(100)
    first[0] = 1
    const last = new Float32Array(100)
    last[99] = 1
    expect(peak(first)).toBeCloseTo(peak(last), 12)
    const filter = createTruePeakEstimator()
    filter.push(1)
    expect(filter.finish()).toBe(1)
    expect(filter.finish()).toBe(1)
    expect(() => filter.push(0)).toThrow('complete')
    filter.reset()
    filter.push(0)
    expect(filter.finish()).toBe(0)
  })
})
