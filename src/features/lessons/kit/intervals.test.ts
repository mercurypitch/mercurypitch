// ============================================================
// Intervals tests — every interval the staff toy reaches from C, turned upside down, and the signs each letter takes
// ============================================================

import { describe, expect, it } from 'vitest'
import type { Interval } from './intervals'
import { countLine, intervalOf, isTritone, liftedOf, nameOf, pairLine, saidLine, signsOf, sumsLine, upsideDown, } from './intervals'
import type { Letter, Spelled } from './notes'

const n = (letter: Letter, alter = 0, octave = 4): Spelled => ({
  letter,
  alter,
  octave,
})
const C4 = n('C')

/** Every top note the toy reaches from C4, with its letters and semitones (Lesson 23 FACTS 13, 14, 16, 17). */
const FROM_C: readonly (readonly [Spelled, number, number, string])[] = [
  [n('C'), 1, 0, 'a perfect unison'],
  [n('D', -1), 2, 1, 'a minor second'],
  [n('D'), 2, 2, 'a major second'],
  [n('D', 1), 2, 3, 'an augmented second'],
  [n('E', -1), 3, 3, 'a minor third'],
  [n('E'), 3, 4, 'a major third'],
  [n('F'), 4, 5, 'a perfect fourth'],
  [n('F', 1), 4, 6, 'an augmented fourth, a tritone'],
  [n('G', -1), 5, 6, 'a diminished fifth, a tritone'],
  [n('G'), 5, 7, 'a perfect fifth'],
  [n('G', 1), 5, 8, 'an augmented fifth'],
  [n('A', -1), 6, 8, 'a minor sixth'],
  [n('A'), 6, 9, 'a major sixth'],
  [n('A', 1), 6, 10, 'an augmented sixth'],
  [n('B', -1), 7, 10, 'a minor seventh'],
  [n('B'), 7, 11, 'a major seventh'],
  [n('C', 0, 5), 8, 12, 'a perfect octave'],
]

const of = (lo: Spelled, hi: Spelled): Interval => {
  const iv = intervalOf(lo, hi)
  if (iv === null) throw new Error('no interval')
  return iv
}

describe('intervalOf', () => {
  it('names every interval the toy reaches from C by its letters, its semitones and its quality', () => {
    for (const [top, letters, semitones, name] of FROM_C) {
      // Act
      const iv = of(C4, top)

      // Assert
      expect([iv.number, iv.semitones, nameOf(iv)], name).toEqual([
        letters,
        semitones,
        name,
      ])
    }
  })

  it('calls only the augmented fourth and the diminished fifth a tritone', () => {
    // Act
    const tritones = FROM_C.filter(([top]) => isTritone(of(C4, top))).map(
      ([top]) => top,
    )

    // Assert: F♯ and G♭, the one piano key with two names (FACTS 18, 19)
    expect(tritones).toEqual([n('F', 1), n('G', -1)])
  })

  it("names Step 4's pair and where it closes: B up to F a diminished fifth, C up to E a major third", () => {
    // Act
    const tritone = of(n('B', 0, 3), n('F'))
    const third = of(C4, n('E'))

    // Assert: FACTS 29
    expect([tritone.number, tritone.semitones, nameOf(tritone)]).toEqual([
      5,
      6,
      'a diminished fifth, a tritone',
    ])
    expect([third.number, third.semitones]).toEqual([3, 4])
  })

  it('is the same interval an octave lower, on the bass staff', () => {
    for (const [top] of FROM_C)
      expect(of(n('C', 0, 3), { ...top, octave: top.octave - 1 })).toEqual(
        of(C4, top),
      )
  })

  it('names no interval past the octave, falling, or past augmented and diminished', () => {
    expect(intervalOf(C4, n('D', 0, 5))).toBeNull()
    expect(intervalOf(n('E'), C4)).toBeNull()
    expect(intervalOf(C4, n('F', 2))).toBeNull()
    expect(intervalOf(C4, n('D', 2))).toBeNull()
  })
})

describe('upsideDown', () => {
  it('turns every interval from C into one whose numbers make 9 and semitones 12, the qualities swapped and perfect kept', () => {
    const SWAP = {
      perfect: 'perfect',
      major: 'minor',
      minor: 'major',
      augmented: 'diminished',
      diminished: 'augmented',
    } as const
    for (const [top] of FROM_C) {
      // Arrange
      const iv = of(C4, top)

      // Act: the bottom note moved up an octave
      const up = of(top, liftedOf(C4))

      // Assert: FACTS 21 to 24
      expect(upsideDown(iv)).toEqual(up)
      expect(iv.number + up.number).toBe(9)
      expect(iv.semitones + up.semitones).toBe(12)
      expect(up.quality).toBe(SWAP[iv.quality])
    }
  })

  it('folds the tritone onto six semitones again: F♯ up to C is 5 letters and 6 semitones', () => {
    // Act
    const up = of(n('F', 1), n('C', 0, 5))

    // Assert
    expect([up.number, up.semitones, nameOf(up)]).toEqual([
      5,
      6,
      'a diminished fifth, a tritone',
    ])
  })
})

describe('signsOf', () => {
  it('offers Sharp on D, F, G and A, Flat on D, E, G, A and B, and neither on C', () => {
    // Act
    const letters: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    const sharp = letters.filter((l) => signsOf(l).sharp)
    const flat = letters.filter((l) => signsOf(l).flat)

    // Assert: Lesson 23 WEB-SPEC, Toys 1, and Tests 3: no E♯, B♯, F♭ or C♭
    expect(sharp).toEqual(['D', 'F', 'G', 'A'])
    expect(flat).toEqual(['D', 'E', 'G', 'A', 'B'])
  })
})

describe("the readout's words", () => {
  it('counts the letters and semitones, one of each in the singular', () => {
    expect(countLine(of(C4, n('E')))).toBe(
      '3 letters · 4 semitones · a major third',
    )
    expect(countLine(of(C4, n('D', -1)))).toBe(
      '2 letters · 1 semitone · a minor second',
    )
    expect(countLine(of(C4, C4))).toBe(
      '1 letter · 0 semitones · a perfect unison',
    )
  })

  it('names the pair in signs for the eye, and in words with octaves for a screen reader', () => {
    // Arrange
    const iv = of(C4, n('E', -1))

    // Assert
    expect(pairLine(C4, n('E', -1))).toBe('C up to E♭')
    expect(saidLine(C4, n('E', -1), iv)).toBe(
      'C4 up to E flat 4: 3 letters, 3 semitones, a minor third.',
    )
  })

  it('sums an interval and its upside down: the numbers to 9, the semitones to 12', () => {
    expect(sumsLine(of(C4, n('G')))).toBe('5 + 4 = 9 · 7 + 5 = 12')
    expect(sumsLine(of(C4, n('F', 1)))).toBe('4 + 5 = 9 · 6 + 6 = 12')
  })
})
