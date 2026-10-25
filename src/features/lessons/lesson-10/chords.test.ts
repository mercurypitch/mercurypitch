// ============================================================
// Lesson 10 chords tests — every triad and scale spelled, sized and named
// ============================================================
//
// WEB-SPEC, Tests 1 and 2: FACTS 19's fourteen triads and FACTS 27's
// fourteen scales, spelled one letter per degree with no double sign and no
// E♯, B♯, C♭ or F♭; C minor's third is E♭4, never D♯4; major is 4 then 3
// semitones and minor 3 then 4, both 7 to the fifth (FACTS 17); in the cold
// open C, E♭, G is minor and C, E, G♭ is neither (FACTS 41b); B, E, G
// stacks in thirds as E, G, B, E minor (FACTS 41a); natural minor steps 2,
// 1, 2, 2, 1, 2, 2 and lowers degrees 3, 6 and 7 (FACTS 22, 24). And the
// slide's roots and the window every chord stays inside (FACTS 70a).

import { describe, expect, it } from 'vitest'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import type { Spelled } from '@/features/lessons/kit/notes'
import { signName } from '@/features/lessons/kit/notes'
import type { ChordTone, Quality } from './chords'
import { LOWERED_DEGREES, NATURAL_MINOR_DEGREES, nextRoot, QUALITIES, qualityOf, ROOTS, scaleOf, stackInThirds, thirdOf, tone, triad, WINDOW, } from './chords'

/** A note's letters with any sign, no octave: "E♭". */
const letters = (notes: readonly ChordTone[]): string =>
  notes.map((n) => signName(n.spelled, { octave: false })).join(' ')

/** A note with its octave: "E♭4". */
const named = (n: ChordTone): string => signName(n.spelled)

const midis = (notes: readonly ChordTone[]): number[] =>
  notes.map((n) => n.midi)

/** FACTS 19: the fourteen triads, each white-key root major then minor. */
const FACTS_19: Readonly<Record<number, readonly [string, string]>> = {
  60: ['C E G', 'C E♭ G'],
  62: ['D F♯ A', 'D F A'],
  64: ['E G♯ B', 'E G B'],
  65: ['F A C', 'F A♭ C'],
  67: ['G B D', 'G B♭ D'],
  69: ['A C♯ E', 'A C E'],
  71: ['B D♯ F♯', 'B D F♯'],
}

/** FACTS 27: the fourteen scales, the majors as Lesson 4's table spells them. */
const FACTS_27: Readonly<Record<number, readonly [string, string]>> = {
  60: ['C D E F G A B C', 'C D E♭ F G A♭ B♭ C'],
  62: ['D E F♯ G A B C♯ D', 'D E F G A B♭ C D'],
  64: ['E F♯ G♯ A B C♯ D♯ E', 'E F♯ G A B C D E'],
  65: ['F G A B♭ C D E F', 'F G A♭ B♭ C D♭ E♭ F'],
  67: ['G A B C D E F♯ G', 'G A B♭ C D E♭ F G'],
  69: ['A B C♯ D E F♯ G♯ A', 'A B C D E F G A'],
  71: ['B C♯ D♯ E F♯ G♯ A♯ B', 'B C♯ D E F♯ G A B'],
}

/** No double sign, and none of the four white keys renamed: E♯, B♯, C♭ or F♭. */
function oddSpellings(notes: readonly ChordTone[]): string[] {
  const odd = (s: Spelled): boolean =>
    Math.abs(s.alter) > 1 ||
    (s.alter === 1 && (s.letter === 'E' || s.letter === 'B')) ||
    (s.alter === -1 && (s.letter === 'C' || s.letter === 'F'))
  return notes.filter((n) => odd(n.spelled)).map(named)
}

/** Every triad a slide reaches, in both qualities. */
const EVERY_TRIAD: readonly { root: number; quality: Quality }[] =
  ROOTS.flatMap((root) => QUALITIES.map((quality) => ({ root, quality })))

describe('the triads', () => {
  it("spell FACTS 19's fourteen, one letter per chord tone", () => {
    for (const root of ROOTS) {
      // Act
      const spelled = QUALITIES.map((q) => letters(triad(root, q)))

      // Assert
      expect(spelled, `root ${root}`).toEqual(FACTS_19[root])
    }
  })

  it('carry no double sign and no E sharp, B sharp, C flat or F flat', () => {
    // Act
    const odd = EVERY_TRIAD.flatMap(({ root, quality }) =>
      oddSpellings(triad(root, quality)),
    )

    // Assert
    expect(odd).toEqual([])
  })

  it("spell C minor's third E♭4, never D♯4", () => {
    // Act
    const [, third] = triad(60, 'minor')

    // Assert
    expect(named(third)).toBe('E♭4')
    expect(third.midi).toBe(63)
    expect(third.spelled).toEqual({ letter: 'E', alter: -1, octave: 4 })
  })

  it('stack major as 4 then 3 semitones and minor as 3 then 4, both 7 from root to fifth', () => {
    for (const { root, quality } of EVERY_TRIAD) {
      // Act
      const [r, t, f] = midis(triad(root, quality))

      // Assert
      const gaps = [t - r, f - t]
      expect(gaps, `${root} ${quality}`).toEqual(
        quality === 'major' ? [4, 3] : [3, 4],
      )
      expect(f - r).toBe(7)
    }
  })

  it("give Step 1's third as the triad's root and third", () => {
    // Act
    const major = thirdOf(60, 'major')
    const minor = thirdOf(60, 'minor')

    // Assert
    expect(major.map(named)).toEqual(['C4', 'E4'])
    expect(minor.map(named)).toEqual(['C4', 'E♭4'])
  })
})

describe('the scales', () => {
  it("spell FACTS 27's fourteen, one letter per degree, with no odd spelling", () => {
    for (const root of ROOTS) {
      // Act
      const spelled = QUALITIES.map((q) => scaleOf(root, q))

      // Assert
      expect(spelled.map(letters), `root ${root}`).toEqual(FACTS_27[root])
      expect(spelled.flatMap(oddSpellings)).toEqual([])
    }
  })

  it('climb natural minor 2, 1, 2, 2, 1, 2, 2: tone, semitone, tone, tone, semitone, tone, tone', () => {
    // Act
    const steps = NATURAL_MINOR_DEGREES.slice(1).map(
      (d, i) => d - NATURAL_MINOR_DEGREES[i],
    )

    // Assert: FACTS 22
    expect(steps).toEqual([2, 1, 2, 2, 1, 2, 2])
    expect(steps.reduce((a, b) => a + b, 0)).toBe(12)
  })

  it('lower degrees 3, 6 and 7 a semitone each against the major scale, and no other', () => {
    // Act
    const lowered = MAJOR_DEGREES.flatMap((d, i) =>
      NATURAL_MINOR_DEGREES[i] === d ? [] : [i + 1],
    )
    const by = MAJOR_DEGREES.map((d, i) => d - NATURAL_MINOR_DEGREES[i])

    // Assert: FACTS 24
    expect(lowered).toEqual([3, 6, 7])
    expect(LOWERED_DEGREES).toEqual(lowered)
    expect(by.filter((x) => x !== 0)).toEqual([1, 1, 1])
  })

  it("hold the minor triad as the scale's first, third and fifth: do, me and so", () => {
    for (const root of ROOTS) {
      // Act
      const scale = scaleOf(root, 'minor')

      // Assert: FACTS 28
      expect(triad(root, 'minor')).toEqual([scale[0], scale[2], scale[4]])
    }
  })
})

describe('the cold open and stacking', () => {
  // C4, E4 and G4, and each with one note moved down a semitone on its own letter
  const C = tone(60, 'C')
  const E = tone(64, 'E')
  const G = tone(67, 'G')

  it('hears C, E♭, G as minor and C, E, G as major', () => {
    // Act
    const moved = qualityOf([C, tone(63, 'E'), G])
    const home = qualityOf([C, E, G])

    // Assert: FACTS 41
    expect(moved).toBe('minor')
    expect(home).toBe('major')
  })

  it('hears C, E, G♭ as neither: its fifth is 6 semitones, not 7', () => {
    // Arrange
    const notes = [C, E, tone(66, 'G')]

    // Act
    const quality = qualityOf(notes)
    const stacked = stackInThirds(notes)

    // Assert: FACTS 41b
    expect(quality).toBe('neither')
    expect(stacked?.map(named)).toEqual(['C4', 'E4', 'G♭4'])
    expect((stacked?.[2].midi ?? 0) - (stacked?.[0].midi ?? 0)).toBe(6)
  })

  it('stacks B, E, G in thirds as E, G, B, E minor, its root E, not C', () => {
    // Arrange: do moved down a semitone
    const notes = [tone(59, 'B'), E, G]

    // Act
    const stacked = stackInThirds(notes)

    // Assert: FACTS 41a
    expect(stacked?.map(named)).toEqual(['E4', 'G4', 'B4'])
    expect(midis(stacked ?? [])).toEqual([64, 67, 71])
    expect(qualityOf(notes)).toBe('minor')
  })

  it('names every triad by its own quality, however its notes are ordered', () => {
    for (const { root, quality } of EVERY_TRIAD) {
      // Arrange
      const [r, t, f] = triad(root, quality)

      // Act
      const orders = [
        [r, t, f],
        [f, r, t],
        [t, f, r],
      ].map(qualityOf)

      // Assert
      expect(orders, `${root} ${quality}`).toEqual([quality, quality, quality])
    }
  })

  it('stacks nothing but three notes, and three notes that are not thirds as neither', () => {
    // Act
    const two = stackInThirds([C, E])
    const seconds = qualityOf([C, tone(62, 'D'), E])

    // Assert
    expect(two).toBeNull()
    expect(seconds).toBe('neither')
  })
})

describe('the slide and the window', () => {
  it('steps the root through the white keys from C4 to B4, and no further', () => {
    // Act
    const up = ROOTS.map((r) => nextRoot(r, 1))
    const down = ROOTS.map((r) => nextRoot(r, -1))

    // Assert: WEB-SPEC, Edge cases, the root at its ends
    expect(up).toEqual([62, 64, 65, 67, 69, 71, null])
    expect(down).toEqual([null, 60, 62, 64, 65, 67, 69])
    expect(nextRoot(61, 1)).toBeNull()
  })

  it("keeps every chord a slide reaches inside C4 to F♯5, B's fifth on the window's top row", () => {
    // Act
    const all = EVERY_TRIAD.flatMap(({ root, quality }) =>
      midis(triad(root, quality)),
    )

    // Assert: FACTS 70a, 18 semitones
    expect(Math.min(...all)).toBe(WINDOW.lo)
    expect(Math.max(...all)).toBe(WINDOW.hi)
    expect([WINDOW.lo, WINDOW.hi]).toEqual([60, 78])
    expect(named(triad(71, 'major')[2])).toBe('F♯5')
  })

  it('refuses a black key as a root', () => {
    // Act
    const black = (): ChordTone[] => triad(61, 'major')

    // Assert
    expect(black).toThrow()
  })
})
