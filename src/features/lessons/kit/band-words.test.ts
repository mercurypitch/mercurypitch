// ============================================================
// Band words tests — the live line's octave tag
// ============================================================

import { describe, expect, it } from 'vitest'
import { octavesOf, octaveTag } from './band-words'

describe("the live line's octave tag", () => {
  it("names an octave away only within 50 cents of Merc's note", () => {
    expect(octaveTag(-1, 10)).toBe('octave lower')
    expect(octaveTag(1, -50)).toBe('octave higher')
    expect(octaveTag(-2, 0)).toBe('two octaves lower')
    expect(octaveTag(-1, 51)).toBeNull()
    expect(octaveTag(0, 0)).toBeNull()
  })

  it("names no octave more than 50 cents below Merc's note either", () => {
    // Act
    const tag = octaveTag(-1, -51)

    // Assert
    expect(tag).toBeNull()
  })
})

describe('octavesOf', () => {
  it.each([
    ['an octave lower', -1190, 10, -1],
    ['two octaves higher', 2350, -50, 2],
    ["Merc's own octave", 450, 450, 0],
    ['a large fold', -1700, -500, -1],
  ] as const)(
    'counts %s (raw %i, folded %i) as %i octaves',
    (_name, raw, folded, octaves) => {
      // Act
      const counted = octavesOf(raw, folded)

      // Assert
      expect(counted).toBe(octaves)
    },
  )
})
