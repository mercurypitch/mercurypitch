// ============================================================
// Lesson 22 ribbon tests — the app's mark, by the app's own function
// ============================================================
//
// WEB-SPEC, Toys 2, state 4 (FACTS 30, 68): the ribbon swings once per 22
// pixels of the note's width, 5 swings at Stretch's 120 px, 10 at its
// starting 220 and 15 at 330, whatever a singer's rate; its path is the one
// the app's `vibratoShapePath` traces, top edge and bottom, closed, at the
// note's width.

import { describe, expect, it } from 'vitest'
import { ribbonPath, ribbonSwings, STRETCH, VIEW } from './ribbon'

/** The path's x coordinates. */
const xsOf = (d: string): number[] =>
  [...d.matchAll(/[ML](-?[\d.]+) -?[\d.]+/g)].map((m) => Number(m[1]))

describe("the app's ribbon", () => {
  it('swings once per 22 px: 5 at 120 px, 10 at 220 px, 15 at 330 px', () => {
    // Assert
    expect(ribbonSwings(STRETCH.min)).toBe(5)
    expect(ribbonSwings(STRETCH.start)).toBe(10)
    expect(ribbonSwings(STRETCH.max)).toBe(15)
  })

  it("traces the app's path at the note's width, centred, and closes it", () => {
    // Act
    const d = ribbonPath(220)

    // Assert
    const xs = xsOf(d)
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    expect(Math.min(...xs)).toBeCloseTo((VIEW.w - 220) / 2, 6)
    expect(Math.max(...xs)).toBeCloseTo((VIEW.w + 220) / 2, 6)
  })

  it("draws the widest note inside the panel's room", () => {
    // Assert
    const xs = xsOf(ribbonPath(STRETCH.max))
    expect(Math.min(...xs)).toBeGreaterThan(0)
    expect(Math.max(...xs)).toBeLessThan(VIEW.w)
  })
})
