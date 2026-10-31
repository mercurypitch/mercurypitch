// Studio whole frame tests — a start time lands on its frame or a hair past it, and a fresh place on the clock on a whole frame.
import { describe, expect, it } from 'vitest'
import { frameTime, onWholeFrame, wholeFrameAtOrAfter } from './whole-frame'

const RATES = [22050, 44100, 48000, 96000]

describe('a Studio frame time', () => {
  it('lands on its frame or a hair past it, never a hair before, at every rate', () => {
    for (const rate of RATES) {
      let under = 0
      let soonest = Infinity
      let latest = -Infinity
      // Thirteen hours of frames, sampled.
      for (let frame = 0; frame < rate * 47_000; frame += 104_729) {
        if ((frame / rate) * rate < frame) under++
        const past = frameTime(frame, rate) * rate - frame
        soonest = Math.min(soonest, past)
        latest = Math.max(latest, past)
      }
      // Plain division puts some of them a hair before their frame.
      expect(under).toBeGreaterThan(0)
      expect(soonest).toBeGreaterThanOrEqual(0)
      expect(latest).toBeLessThan(1e-6)
    }
  })

  it('is the plain quotient when that already lands on the frame', () => {
    expect(frameTime(24000, 48000)).toBe(0.5)
    expect(frameTime(7, 48000)).toBe(7 / 48000)
  })
})

describe('the first whole frame at or after a time', () => {
  it('takes the frame a time is on, float noise past it included', () => {
    expect(wholeFrameAtOrAfter(0.5, 48000) * 48000).toBe(24000)
    expect(wholeFrameAtOrAfter(0.5 + 1e-9 / 48000, 48000) * 48000).toBe(24000)
  })

  it('takes the next frame for a time between two, so it is never sooner than asked', () => {
    const asked = 2 + 661.5 / 44100
    const start = wholeFrameAtOrAfter(asked, 44100)
    expect(start * 44100).toBeCloseTo(2 * 44100 + 662, 6)
    expect(start).toBeGreaterThan(asked)
    expect(start - asked).toBeLessThan(1 / 44100)
  })
})

describe('a time put on its whole frame', () => {
  it('moves a time off its frame by float noise onto it', () => {
    const noisy = (1 + 100 / 48000) * (1 - 1e-15)
    const start = onWholeFrame(noisy, 48000)
    expect(start * 48000 - 48100).toBeGreaterThanOrEqual(0)
    expect(start * 48000 - 48100).toBeLessThan(1e-6)
  })

  it('leaves a time a real fraction between frames where it is', () => {
    const between = 1 + 100.25 / 44100
    expect(onWholeFrame(between, 44100)).toBe(between)
  })
})
