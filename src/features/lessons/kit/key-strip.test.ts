// ============================================================
// Key strip tests — the keys' places, their tap zones and the window
// ============================================================

import { describe, expect, it } from 'vitest'
import { stripHit, stripLayout, whiteRange } from './key-strip'

/** Lesson 4's wide strip: C4 to C6 across 650 px. */
const wide = stripLayout({
  lo: 60,
  hi: 84,
  x0: 0,
  x1: 650,
  top: 400,
  height: 80,
})

/** Lesson 4's phone strip: one octave of eight white keys across 356 px, `from` white keys in. */
const phone = (from: number) =>
  stripLayout({
    lo: 60,
    hi: 84,
    x0: 0,
    x1: 356,
    top: 300,
    height: 78,
    window: { from, keys: 8 },
  })

describe('whiteRange', () => {
  it('lists the white keys of two octaves, C4 to C6', () => {
    expect(whiteRange(60, 84)).toHaveLength(15)
    expect(whiteRange(60, 72)).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
  })
})

describe('stripLayout', () => {
  it('lays fifteen white keys edge to edge, with the ten black keys over their joins', () => {
    // Act
    const whites = wide.keys.filter((k) => k.white)
    const blacks = wide.keys.filter((k) => !k.white)

    // Assert
    expect(whites).toHaveLength(15)
    expect(blacks).toHaveLength(10)
    expect(wide.key(61)?.cx).toBeCloseTo(wide.ww, 9)
    expect(wide.key(84)?.x).toBeCloseTo(650 - wide.ww, 9)
  })

  it("keeps a black key's zone clear of its neighbour's", () => {
    // Act
    const cSharp = phone(0).key(61)?.zone
    const dSharp = phone(0).key(63)?.zone

    // Assert: 44 px each, half a pixel apart, on 44.5 px white keys
    expect(cSharp?.w).toBe(44)
    expect(dSharp?.w).toBe(44)
    expect(
      (dSharp?.x ?? 0) - ((cSharp?.x ?? 0) + (cSharp?.w ?? 0)),
    ).toBeCloseTo(0.5, 9)
  })

  it("fills a phone's width with the octave of a white start, D4 to D5", () => {
    // Act
    const strip = phone(1)
    const whites = strip.keys.filter((k) => k.white).map((k) => k.midi)

    // Assert
    expect(strip.ww).toBe(44.5)
    expect(whites).toEqual([62, 64, 65, 67, 69, 71, 72, 74])
    expect(strip.key(62)?.zone?.w).toBe(44.5)
  })

  it('centres the octave of a black start, its half keys at the edges taking no taps', () => {
    // Act: F♯4 to F♯5, from the middle of F4 to the middle of G5
    const strip = phone(3.5)

    // Assert
    expect(strip.key(66)?.zone).toEqual({
      x: 0.25,
      y: 300,
      w: 44,
      h: 78 * 0.62,
    })
    expect(strip.key(78)?.zone?.w).toBe(44)
    expect(strip.key(65)?.w).toBe(44.5)
    expect(strip.key(65)?.zone).toBeNull()
    expect(strip.key(79)?.zone).toBeNull()
  })
})

describe('stripHit', () => {
  it('lands on a black key before the white key under it, and on the white key below the black ones', () => {
    // Arrange
    const strip = phone(0)
    const cSharp = strip.key(61)

    // Act
    const onBlack = stripHit(strip, cSharp?.cx ?? 0, 310)
    const belowBlack = stripHit(strip, cSharp?.cx ?? 0, 370)
    const offStrip = stripHit(strip, 10, 200)

    // Assert
    expect(onBlack).toBe(61)
    expect(belowBlack).toBe(62)
    expect(offStrip).toBeNull()
  })
})
