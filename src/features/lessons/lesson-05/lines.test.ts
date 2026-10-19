// ============================================================
// Lesson 5 lines tests — the cold open's takes and the hold demo, by hand
// ============================================================

import { describe, expect, it } from 'vitest'
import { HIT_TOLERANCE_CENTS } from '@/features/lessons/kit/band-words'
import { DEMO_SEC, DEMO_STEADY_AT, demoCents, demoFrames, demoRise, TAKE_SEC, takeCents, takeContour, takeDb, takeLevel, VIBRATO, } from './lines'

describe("the cold open's two takes (FACTS 72)", () => {
  it('sung easily: 40 cents low, into the middle of the band by 0.5 s, and held there', () => {
    expect(TAKE_SEC).toBe(4)
    expect(takeCents('easy', 0)).toBe(-40)
    expect(takeCents('easy', 0.5)).toBe(0)
    expect(takeCents('easy', 4)).toBe(0)
    expect(takeDb('easy', 4)).toBe(0)
  })

  it('pushing harder: the same for a second, then 6 dB louder and 60 cents higher by 4 s', () => {
    expect(takeCents('pushed', 1)).toBe(0)
    expect(takeCents('pushed', 4)).toBe(60)
    expect(takeDb('pushed', 4)).toBe(6)
    expect(takeLevel('pushed', 4) / takeLevel('pushed', 0)).toBeCloseTo(
      1.995,
      3,
    )
    // its centre leaves the 35-cent band at 2.75 s
    expect(takeCents('pushed', 2.75)).toBeCloseTo(HIT_TOLERANCE_CENTS, 9)
  })

  it('sings each take as the line shows it, pitch and level on one contour', () => {
    const pushed = takeContour('pushed', 57)
    expect(pushed.map((p) => p.t)).toEqual([0, 0.5, 1, 4])
    expect(pushed[3].hz).toBeCloseTo(220 * 2 ** (60 / 1200), 9)
    expect((pushed[3].level ?? 0) / (pushed[0].level ?? 1)).toBeCloseTo(
      1.995,
      3,
    )
    expect(takeContour('easy', 57).at(-1)?.hz).toBeCloseTo(220, 9)
  })
})

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
