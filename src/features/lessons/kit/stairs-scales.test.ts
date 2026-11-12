// ============================================================
// Staircase scales tests — the steps of a set of degrees, its names and its letters
// ============================================================
//
// Lesson 20's two pentatonics on the staircase (its WEB-SPEC, Toys 1 and
// What the kit and the app still need, item 4; FACTS 21 to 27): the steps
// of a set of degrees, the minor five as the major five from la, the
// syllables from do, and the spelling, with flats for a minor pentatonic.

import { describe, expect, it } from 'vitest'
import { MAJOR_DEGREES } from './major-scale'
import type { Spelled } from './notes'
import { signName } from './notes'
import { MAJOR_FIVE, MINOR_FIVE, risersOf, rotation, scaleKind, spellDegrees, syllableOf, } from './stairs-scales'

const C3 = 48
const A2 = 45

const letters = (s: readonly Spelled[]): string[] =>
  s.map((n) => signName(n, { octave: false }))

describe('risersOf', () => {
  it.each([
    ['the major scale', MAJOR_DEGREES, [2, 2, 1, 2, 2, 2, 1]],
    ['the major five', MAJOR_FIVE, [2, 2, 3, 2, 3]],
    ['the minor five', MINOR_FIVE, [3, 2, 2, 3, 2]],
  ] as const)('gives the steps of %s in semitones', (_name, degrees, steps) => {
    // Act
    const risers = risersOf(degrees)

    // Assert
    expect(risers).toEqual(steps)
  })
})

describe('rotation', () => {
  it('starts the major five on la and gets the minor five (FACTS 24)', () => {
    // Act
    const fromLa = rotation(MAJOR_FIVE, 9)

    // Assert
    expect(fromLa).toEqual(MINOR_FIVE)
  })

  it('throws for a degree the scale does not hold', () => {
    expect(() => rotation(MAJOR_FIVE, 5)).toThrow()
  })
})

describe('syllableOf', () => {
  it('names the major five do, re, mi, so, la, do and the minor five do, me, fa, so, te, do (FACTS 25)', () => {
    // Act
    const major = MAJOR_FIVE.map(syllableOf)
    const minor = MINOR_FIVE.map(syllableOf)

    // Assert
    expect(major).toEqual(['do', 're', 'mi', 'so', 'la', 'do'])
    expect(minor).toEqual(['do', 'me', 'fa', 'so', 'te', 'do'])
  })

  it('throws for a degree the lessons never name', () => {
    expect(() => syllableOf(1)).toThrow()
  })
})

describe('spellDegrees', () => {
  it.each([
    ['C major five', C3, MAJOR_FIVE, ['C', 'D', 'E', 'G', 'A', 'C']],
    ['D major five', C3 + 2, MAJOR_FIVE, ['D', 'E', 'F♯', 'A', 'B', 'D']],
    ['A minor five', A2, MINOR_FIVE, ['A', 'C', 'D', 'E', 'G', 'A']],
    ['C minor five', C3, MINOR_FIVE, ['C', 'E♭', 'F', 'G', 'B♭', 'C']],
    ['E minor five', 64, MINOR_FIVE, ['E', 'G', 'A', 'B', 'D', 'E']],
    [
      'D major, the major scale itself',
      C3 + 2,
      MAJOR_DEGREES,
      ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯', 'D'],
    ],
  ] as const)('spells %s', (_name, tonic, degrees, names) => {
    // Act
    const spelled = spellDegrees(tonic, degrees)

    // Assert
    expect(letters(spelled)).toEqual(names)
  })

  it("keeps each note's own pitch: the minor five on C3 runs C3 to C4", () => {
    // Act
    const spelled = spellDegrees(C3, MINOR_FIVE)

    // Assert
    expect(spelled.map((n) => signName(n))).toEqual([
      'C3',
      'E♭3',
      'F3',
      'G3',
      'B♭3',
      'C4',
    ])
  })

  it('throws for a degree neither the major scale nor its relative minor holds', () => {
    expect(() => spellDegrees(C3, [0, 1, 12])).toThrow()
  })
})

describe('scaleKind', () => {
  it('names the three scales a staircase draws, and no other', () => {
    expect(
      [MAJOR_DEGREES, MAJOR_FIVE, MINOR_FIVE, [0, 2, 4, 5, 7]].map(scaleKind),
    ).toEqual(['major', 'major pentatonic', 'minor pentatonic', null])
  })
})
