import { describe, expect, it } from 'vitest'
import { quantizeBeat } from './quantize'

describe('quantizeBeat', () => {
  it('snaps fully to the grid at strength 1', () => {
    expect(quantizeBeat(0.62, 0.5, 1)).toBeCloseTo(0.5, 6)
    expect(quantizeBeat(0.8, 0.5, 1)).toBeCloseTo(1.0, 6)
  })

  it('does not move at strength 0', () => {
    expect(quantizeBeat(0.62, 0.5, 0)).toBeCloseTo(0.62, 6)
  })

  it('moves partway at intermediate strength', () => {
    // nearest grid = 0.5, delta = -0.12, strength 0.5 => 0.62 - 0.06 = 0.56
    expect(quantizeBeat(0.62, 0.5, 0.5)).toBeCloseTo(0.56, 6)
  })

  it('leaves positions inside the dead-zone untouched', () => {
    // 0.53 is within 0.05 of grid 0.5 -> untouched.
    expect(quantizeBeat(0.53, 0.5, 1, 0.05)).toBeCloseTo(0.53, 6)
    // 0.6 is outside the dead-zone -> snaps.
    expect(quantizeBeat(0.6, 0.5, 1, 0.05)).toBeCloseTo(0.5, 6)
  })

  it('returns the input unchanged for a non-positive grid', () => {
    expect(quantizeBeat(0.62, 0)).toBeCloseTo(0.62, 6)
  })

  it('clamps strength to [0,1]', () => {
    expect(quantizeBeat(0.62, 0.5, 5)).toBeCloseTo(0.5, 6)
  })
})
