// ============================================================
// Lesson 5 breath figure tests — one tap, in for 2 s, out for 5, no hold
// ============================================================

import { describe, expect, it } from 'vitest'
import { breathAt, figureBox, IN_SEC, OUT_SEC, PHASE_WORDS, } from './breath-figure'

describe('Breathe in (FACTS 33, 65)', () => {
  it('breathes in over 2 s and straight out over 5 s, then rests', () => {
    expect([IN_SEC, OUT_SEC]).toEqual([2, 5])
    expect(breathAt(null)).toEqual({ phase: 'rest', u: 0 })
    expect(breathAt(1).phase).toBe('in')
    expect(breathAt(1).u).toBeCloseTo(0.5, 9)
    expect(breathAt(2)).toEqual({ phase: 'out', u: 1 })
    expect(breathAt(4.5).u).toBeCloseTo(0.5, 9)
    expect(breathAt(7)).toEqual({ phase: 'rest', u: 0 })
  })

  it('never holds the breath: the dome moves on every step between the two', () => {
    // Arrange: the breath every 50 ms, in and out
    const u = Array.from({ length: 140 }, (_, i) => breathAt(i * 0.05).u)

    // Assert: rising to the turn at 2 s, falling straight after it
    for (let i = 1; i <= 40; i++) expect(u[i]).toBeGreaterThan(u[i - 1])
    for (let i = 41; i < 140; i++) expect(u[i]).toBeLessThan(u[i - 1])
  })

  it('says each phase as WEB-SPEC words it', () => {
    expect(PHASE_WORDS.in).toBe(
      'Breathing in: the diaphragm flattens and the belly moves out.',
    )
    expect(PHASE_WORDS.out).toBe('Breathing out on sss.')
  })
})

describe('the figure box', () => {
  it('fits a figure and its labels inside its slot, at a phone width and a desk width', () => {
    for (const [h, left, width] of [
      [250, 0, 358],
      [250, 179, 179],
      [300, 0, 540],
    ] as const) {
      const b = figureBox(h, left, width, true)
      expect(b.x).toBeGreaterThanOrEqual(left)
      expect(b.x + b.w * 1.62).toBeLessThanOrEqual(left + width + 1e-9)
      expect(b.y + b.h).toBeLessThanOrEqual(h)
    }
  })
})
