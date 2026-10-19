// ============================================================
// Lesson 3 band toy tests — the chase's three readings, set by hand
// ============================================================

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { CHASE_READINGS, CHASE_SEC, chaseCents, LINE_SEC, MERC_SEC, readingWords, } from './toy-band'

describe('the chase (FACTS, Illustrations)', () => {
  it('starts 80 cents low, adjusts to 40 low, then settles 12 low, inside the band', () => {
    expect(chaseCents(0)).toBe(-80)
    expect(chaseCents(0.9)).toBe(-80)
    expect(chaseCents(1.8)).toBe(-40)
    expect(chaseCents(LINE_SEC)).toBe(-12)
    expect(CHASE_READINGS).toEqual([-80, -40, -12])
    expect(CHASE_SEC).toBe(MERC_SEC + LINE_SEC)
  })

  it('moves smoothly between its readings, never past them', () => {
    // Act
    const glide = Array.from({ length: 51 }, (_, i) => chaseCents(1 + i * 0.01))

    // Assert
    for (let i = 1; i < glide.length; i++)
      expect(glide[i]).toBeGreaterThanOrEqual(glide[i - 1])
    expect(Math.min(...glide)).toBeGreaterThanOrEqual(-80)
    expect(Math.max(...glide)).toBeLessThanOrEqual(-40)
  })

  it("lists its readings in words for reduced motion, by Voice Mirror's edges", () => {
    expect(CHASE_READINGS.map(readingWords)).toEqual([
      "80 cents below Merc's note: outside the band",
      "40 cents below Merc's note: close",
      "12 cents below Merc's note: right in the middle",
    ])
  })
})
