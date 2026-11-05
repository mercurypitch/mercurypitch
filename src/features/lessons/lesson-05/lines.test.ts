// ============================================================
// Lesson 5 lines tests — the hold demo, by hand (its two takes: kit/push-take.test.ts)
// ============================================================

import { describe, expect, it } from 'vitest'
import { DEMO_SEC, DEMO_STEADY_AT, demoCents, demoFrames, demoRise, VIBRATO, } from './lines'

describe('the hold demo (FACTS 76)', () => {
  it('starts 60 cents low and wavers up to 25 cents either side of a straight rise', () => {
    expect(demoCents(0)).toBe(-60)
    for (let t = 0; t < DEMO_STEADY_AT; t += 0.01) {
      const straight = -60 + 60 * (t / DEMO_STEADY_AT)
      expect(Math.abs(demoRise(t) - straight)).toBeLessThanOrEqual(25)
    }
  })

  it("holds the band's middle from 0.9 s with a small, regular wave inside the band", () => {
    for (let t = DEMO_STEADY_AT; t <= DEMO_SEC; t += 0.013)
      expect(Math.abs(demoCents(t))).toBeLessThanOrEqual(VIBRATO.cents + 1e-9)
    expect(VIBRATO).toEqual({ hz: 5.5, cents: 14, grow: 0.35 })
  })

  it("hands the reader ten seconds of frames, its first at the voice's start", () => {
    const frames = demoFrames(57)
    expect(frames[0].t).toBe(0)
    expect(frames.at(-1)?.t).toBeCloseTo(DEMO_SEC, 6)
    expect(frames.every((f) => f.conf > 0.9)).toBe(true)
  })
})
