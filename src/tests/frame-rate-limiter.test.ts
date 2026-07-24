import { describe, expect, it } from 'vitest'
import { createFrameRateLimiter } from '@/lib/frame-rate-limiter'

describe('createFrameRateLimiter', () => {
  it('runs immediately and caps work at the requested cadence', () => {
    const limiter = createFrameRateLimiter(30)

    expect(limiter.shouldRun(0)).toBe(true)
    expect(limiter.shouldRun(1 / 60)).toBe(false)
    expect(limiter.shouldRun(1 / 30)).toBe(true)
    expect(limiter.shouldRun(1 / 30 + 1 / 120)).toBe(false)
  })

  it('resumes immediately after reset or a clock restart', () => {
    const limiter = createFrameRateLimiter(30)

    expect(limiter.shouldRun(5)).toBe(true)
    expect(limiter.shouldRun(5.01)).toBe(false)
    limiter.reset()
    expect(limiter.shouldRun(5.01)).toBe(true)
    expect(limiter.shouldRun(0)).toBe(true)
  })

  it('ignores non-finite timestamps', () => {
    const limiter = createFrameRateLimiter(30)

    expect(limiter.shouldRun(Number.NaN)).toBe(false)
    expect(limiter.shouldRun(Number.POSITIVE_INFINITY)).toBe(false)
    expect(limiter.shouldRun(1)).toBe(true)
  })

  it('falls back to a safe cadence for invalid limits', () => {
    const limiter = createFrameRateLimiter(Number.NaN)

    expect(limiter.shouldRun(0)).toBe(true)
    expect(limiter.shouldRun(0.5)).toBe(false)
    expect(limiter.shouldRun(1)).toBe(true)
  })
})
