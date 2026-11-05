// ============================================================
// Pushed take tests — Lesson 5's two takes, easy and pushed, by hand
// ============================================================
//
// Lesson 5 FACTS 72, as Lesson 5's page played them before they moved into
// the kit, and as Lesson 14's Step 3 plays the pushed one (its FACTS 39).

import { describe, expect, it } from 'vitest'
import { HIT_TOLERANCE_CENTS } from './band-words'
import { TAKE_SEC, takeCents, takeContour, takeDb, takeLevel, } from './push-take'

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
