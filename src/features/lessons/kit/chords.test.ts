// ============================================================
// Chords tests — every triad and scale spelled, sized and named
// ============================================================
//
// Lesson 10's WEB-SPEC, Tests 1 and 2, and its FACTS: FACTS 19's fourteen
// triads and FACTS 27's fourteen scales, spelled one letter per degree with
// no double sign and no E♯, B♯, C♭ or F♭; C minor's third is E♭4, never D♯4;
// major is 4 then 3 semitones and minor 3 then 4, both 7 to the fifth (FACTS
// 17); in the cold open C, E♭, G is minor and C, E, G♭ is neither (FACTS
// 41b); B, E, G stacks in thirds as E, G, B, E minor (FACTS 41a); natural
// minor steps 2, 1, 2, 2, 1, 2, 2 and lowers degrees 3, 6 and 7 (FACTS 22,
// 24). And the slide's roots and the window every chord stays inside (FACTS
// 70a).
//
// Lesson 25's, from its FACTS: any white key a root, A2 to B4 there; Raise
// te lifting te to ti both ways, harmonic minor, A B C D E F G♯ A climbing
// 2, 1, 2, 2, 1, 3, 1 (FACTS 12); Raise le lifting le and te going up only,
// melodic minor, A B C D E F♯ G♯ A up and natural minor down (FACTS 13);
// and the chord on so, E, G, B, E minor, 3 and 4, or with te raised E, G♯,
// B, E major, 4 and 3 (FACTS 1a).

import { describe, expect, it } from 'vitest'
import type { ChordTone, Quality, Raises } from './chords'
import { chordOnSo, gapsOf, HARMONIC_MINOR_DEGREES, LE_STAIR, lifted, LOWERED_DEGREES, MELODIC_MINOR_UP_DEGREES, minorDegrees, minorScale, NATURAL_MINOR_DEGREES, nextRoot, QUALITIES, qualityOf, ROOTS, scaleOf, stackInThirds, stairsOf, TE_STAIR, thirdOf, tone, triad, whiteRoots, WINDOW, } from './chords'
import { MAJOR_DEGREES } from './major-scale'
import type { Spelled } from './notes'
import { signName } from './notes'
import { risersOf } from './stairs-scales'

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

describe("minor's three forms and the chord on so (Lesson 25)", () => {
  const NATURAL: Raises = { te: false, le: false }
  const HARMONIC: Raises = { te: true, le: false }
  const MELODIC: Raises = { te: true, le: true }

  it('takes any white key as a root, A2 to B4 on Lesson 25, spelled one letter per chord tone, and still no black key', () => {
    // Act
    const roots = whiteRoots(45, 71)

    // Assert
    expect(roots).toEqual([
      45, 47, 48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71,
    ])
    expect(ROOTS).toEqual([60, 62, 64, 65, 67, 69, 71])
    expect(triad(45, 'minor').map(named)).toEqual(['A2', 'C3', 'E3'])
    expect(triad(52, 'major').map(named)).toEqual(['E3', 'G♯3', 'B3'])
    expect(() => triad(46, 'major')).toThrow(/not a white key/)
  })

  it("steps a page's own roots, and no further than their ends", () => {
    // Arrange: Lesson 25's starts for the lower voice, A2 to C3
    const roots = whiteRoots(45, 48)

    // Act
    const steps = [
      nextRoot(45, -1, roots),
      nextRoot(45, 1, roots),
      nextRoot(48, 1, roots),
    ]

    // Assert
    expect(steps).toEqual([null, 47, null])
  })

  it('lifts te both ways for Raise te, and le and te going up only once Raise le is on', () => {
    // Act
    const each = [NATURAL, HARMONIC, MELODIC].map((r) => [
      lifted(r),
      lifted(r, 'down'),
    ])

    // Assert
    expect([LE_STAIR, TE_STAIR]).toEqual([5, 6])
    expect(each).toEqual([
      [[], []],
      [[TE_STAIR], [TE_STAIR]],
      [[LE_STAIR, TE_STAIR], []],
    ])
  })

  it('climbs harmonic minor 2, 1, 2, 2, 1, 3, 1, A B C D E F G♯ A, the same both ways (FACTS 12)', () => {
    // Act
    const up = minorDegrees(HARMONIC)

    // Assert
    expect(up).toEqual(HARMONIC_MINOR_DEGREES)
    expect(minorDegrees(HARMONIC, 'down')).toEqual(HARMONIC_MINOR_DEGREES)
    expect(risersOf(up)).toEqual([2, 1, 2, 2, 1, 3, 1])
    expect(letters(minorScale(57, HARMONIC))).toBe('A B C D E F G♯ A')
    expect(stairsOf(57, [2, 1, 2, 2, 1, 3, 1])).toEqual(
      midis(minorScale(57, HARMONIC)),
    )
  })

  it('goes up melodic minor, A B C D E F♯ G♯ A, and comes down natural minor (FACTS 13)', () => {
    // Act
    const up = minorScale(57, MELODIC)
    const down = minorScale(57, MELODIC, 'down')

    // Assert
    expect(minorDegrees(MELODIC)).toEqual(MELODIC_MINOR_UP_DEGREES)
    expect(minorDegrees(MELODIC, 'down')).toEqual(NATURAL_MINOR_DEGREES)
    expect(minorDegrees(NATURAL)).toEqual(NATURAL_MINOR_DEGREES)
    expect(risersOf(MELODIC_MINOR_UP_DEGREES)).toEqual([2, 1, 2, 2, 2, 2, 1])
    expect([letters(up), letters(down)]).toEqual([
      'A B C D E F♯ G♯ A',
      'A B C D E F G A',
    ])
  })

  it("counts a chord's gaps: 3 and 4 for E minor, 4 and 3 for E major", () => {
    expect(gapsOf([52, 55, 59])).toEqual([3, 4])
    expect(gapsOf([52, 56, 59])).toEqual([4, 3])
  })

  it("builds A minor's chord on so, E, G, B, or with te raised E, G♯, B, and C minor's, G, B♭, D or G, B, D (FACTS 1a)", () => {
    // Act
    const chords = [
      chordOnSo(45, false),
      chordOnSo(45, true),
      chordOnSo(57, true),
      chordOnSo(48, false),
      chordOnSo(48, true),
    ]

    // Assert
    expect(chords.map((c) => c.map(named).join(' '))).toEqual([
      'E3 G3 B3',
      'E3 G♯3 B3',
      'E4 G♯4 B4',
      'G3 B♭3 D4',
      'G3 B3 D4',
    ])
    expect(chords.map(qualityOf)).toEqual([
      'minor',
      'major',
      'major',
      'minor',
      'major',
    ])
  })
})
