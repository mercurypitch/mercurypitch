import { describe, expect, it } from 'vitest'
import { COUNT_IN_MIN_INTERVAL_SECONDS, countInRemainingAt, planCountIn, } from './piano-night-count-in'

describe('planCountIn', () => {
  it('counts one beat per number at a readable tempo', () => {
    const plan = planCountIn(120, 4)
    expect(plan.beatsPerCount).toBe(1)
    expect(plan.intervalSeconds).toBeCloseTo(0.5)
    expect(plan.totalSeconds).toBeCloseTo(2)
    expect(plan.offsetsSeconds).toEqual([0, 0.5, 1, 1.5])
  })

  it('moves to half notes when a beat is too short to read', () => {
    const plan = planCountIn(200, 4)
    expect(plan.beatSeconds).toBeCloseTo(0.3)
    expect(plan.beatsPerCount).toBe(2)
    expect(plan.intervalSeconds).toBeCloseTo(0.6)
    expect(plan.intervalSeconds).toBeGreaterThanOrEqual(
      COUNT_IN_MIN_INTERVAL_SECONDS,
    )
    // Four counts still land on a downbeat: two full bars of 4/4.
    expect(plan.counts * plan.beatsPerCount).toBe(8)
  })

  it('keeps doubling for extreme tempos and never exceeds eight beats a count', () => {
    expect(planCountIn(320, 4).beatsPerCount).toBe(4)
    expect(planCountIn(2000, 4).beatsPerCount).toBe(8)
  })

  it('falls back to a sane tempo and count for nonsense input', () => {
    expect(planCountIn(0, 4).tempoBpm).toBe(120)
    expect(planCountIn(Number.NaN, 4).tempoBpm).toBe(120)
    expect(planCountIn(120, -3).counts).toBe(0)
    expect(planCountIn(120, 2.9).counts).toBe(2)
  })
})

describe('countInRemainingAt', () => {
  const plan = planCountIn(120, 4)

  it('shows the full count until the first click, then one less per click', () => {
    expect(countInRemainingAt(plan, -0.05)).toBe(4)
    expect(countInRemainingAt(plan, 0)).toBe(4)
    expect(countInRemainingAt(plan, 0.49)).toBe(4)
    expect(countInRemainingAt(plan, 0.5)).toBe(3)
    expect(countInRemainingAt(plan, 1)).toBe(2)
    expect(countInRemainingAt(plan, 1.5)).toBe(1)
    expect(countInRemainingAt(plan, 1.99)).toBe(1)
  })

  it('is nothing at all for a count-in of zero beats', () => {
    expect(countInRemainingAt(planCountIn(120, 0), 0)).toBe(0)
  })
})
