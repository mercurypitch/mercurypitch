import { clampRate, MAX_RATE, MIN_RATE, rampedRate, } from '@/features/guitar-practice/practice-rate'

describe('clampRate', () => {
  it('clamps to the supported range', () => {
    expect(clampRate(0.01)).toBe(MIN_RATE)
    expect(clampRate(9)).toBe(MAX_RATE)
    expect(clampRate(1)).toBe(1)
  })
})

describe('rampedRate', () => {
  it('adds the step and clamps at the ceiling', () => {
    expect(rampedRate(0.5, 0.25)).toBeCloseTo(0.75)
    expect(rampedRate(1.9, 0.25)).toBe(MAX_RATE)
  })
})
