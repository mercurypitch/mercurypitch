// ============================================================
// Major scale tests — the twelve starts, their black keys and the white keys
// ============================================================

import { describe, expect, it } from 'vitest'
import { blackKeysOf, MAJOR_STEPS, majorScale, nameInScale, scaleNotes, stepSizes, whiteKeysFrom, } from './major-scale'
import type { Spelled } from './notes'
import { signName } from './notes'

const signs = (ss: readonly Spelled[]): string =>
  ss.map((s) => signName(s, { octave: false })).join(' ')

/** The twelve starts from C4 to B4, by the names Lesson 4 gives them. */
const STARTS: readonly [string, number][] = [
  ['C', 60],
  ['D♭', 61],
  ['D', 62],
  ['E♭', 63],
  ['E', 64],
  ['F', 65],
  ['F♯', 66],
  ['G', 67],
  ['A♭', 68],
  ['A', 69],
  ['B♭', 70],
  ['B', 71],
]

describe('majorScale', () => {
  it('spells all twelve starts one letter per step, as WEB-SPEC Toys 1 tabulates them', () => {
    // Act
    const spelled = Object.fromEntries(
      STARTS.map(([name, tonic]) => [name, signs(majorScale(tonic))]),
    )

    // Assert
    expect(spelled).toEqual({
      C: 'C D E F G A B C',
      'D♭': 'D♭ E♭ F G♭ A♭ B♭ C D♭',
      D: 'D E F♯ G A B C♯ D',
      'E♭': 'E♭ F G A♭ B♭ C D E♭',
      E: 'E F♯ G♯ A B C♯ D♯ E',
      F: 'F G A B♭ C D E F',
      'F♯': 'F♯ G♯ A♯ B C♯ D♯ E♯ F♯',
      G: 'G A B C D E F♯ G',
      'A♭': 'A♭ B♭ C D♭ E♭ F G A♭',
      A: 'A B C♯ D E F♯ G♯ A',
      'B♭': 'B♭ C D E♭ F G A B♭',
      B: 'B C♯ D♯ E F♯ G♯ A♯ B',
    })
  })

  it("writes F sharp major's seventh as E sharp in the octave of its letter", () => {
    // Act
    const ti = majorScale(66)[6]

    // Assert: E♯5 sounds as F5 (MIDI 77)
    expect(signName(ti)).toBe('E♯5')
  })
})

describe('blackKeysOf', () => {
  it('counts the black keys of every start as FACTS 12 does, from none on C to five', () => {
    // Act
    const counts = Object.fromEntries(
      STARTS.map(([name, tonic]) => [name, blackKeysOf(tonic).length]),
    )

    // Assert
    expect(counts).toEqual({
      C: 0,
      G: 1,
      F: 1,
      D: 2,
      'B♭': 2,
      A: 3,
      'E♭': 3,
      E: 4,
      'A♭': 4,
      B: 5,
      'D♭': 5,
      'F♯': 5,
    })
  })

  it("names D major's two as F sharp and C sharp, in scale order", () => {
    // Act
    const names = blackKeysOf(62).map((s) => signName(s, { octave: false }))

    // Assert
    expect(names).toEqual(['F♯', 'C♯'])
  })
})

describe('stepSizes', () => {
  it('reads the major pattern as two tone-tone-semitone groups joined by a tone, twelve semitones in all', () => {
    // Act
    const steps = MAJOR_STEPS.join(' ')
    const semitones = MAJOR_STEPS.reduce((n, s) => n + (s === 'T' ? 2 : 1), 0)

    // Assert
    expect(steps).toBe('T T S T T T S')
    expect(semitones).toBe(12)
  })

  it('keeps the same pattern from every start', () => {
    for (const [name, tonic] of STARTS)
      expect(stepSizes(scaleNotes(tonic)), name).toEqual(MAJOR_STEPS)
  })

  it('refuses a leap that is neither a tone nor a semitone', () => {
    expect(() => stepSizes([60, 64])).toThrow(/4 semitones/)
  })
})

describe('whiteKeysFrom', () => {
  it('climbs the white keys from D in a different order from the major pattern', () => {
    // Act
    const fromD = whiteKeysFrom(62)

    // Assert: D E F G A B C D, whose third and seventh are a semitone under F♯ and C♯
    expect(fromD).toEqual([62, 64, 65, 67, 69, 71, 72, 74])
    expect(stepSizes(fromD ?? []).join(' ')).toBe('T S T T T S T')
    expect(scaleNotes(62)[2] - (fromD ?? [])[2]).toBe(1)
    expect(scaleNotes(62)[6] - (fromD ?? [])[6]).toBe(1)
  })

  it('lies exactly on the major scale from C, and gives the orders of FACTS 11a from E, F, G, A and B', () => {
    // Act
    const orders = Object.fromEntries(
      [60, 64, 65, 67, 69, 71].map((start) => [
        start,
        stepSizes(whiteKeysFrom(start) ?? []).join(' '),
      ]),
    )

    // Assert
    expect(whiteKeysFrom(60)).toEqual(scaleNotes(60))
    expect(orders).toEqual({
      60: 'T T S T T T S',
      64: 'S T T T S T T',
      65: 'T T T S T T S',
      67: 'T T S T T S T',
      69: 'T S T T S T T',
      71: 'S T T S T T T',
    })
  })

  it('has nothing to compare from a black-key start', () => {
    for (const start of [61, 63, 66, 68, 70])
      expect(whiteKeysFrom(start), String(start)).toBeNull()
  })
})

describe('nameInScale', () => {
  it("gives a key the scale's own name, E sharp in F sharp major and B flat in F major", () => {
    // Act
    const eSharp = signName(nameInScale(77, 66))
    const bFlat = signName(nameInScale(70, 65))
    const outside = signName(nameInScale(70, 60))

    // Assert: a note the scale does not hold keeps its sharp name
    expect([eSharp, bFlat, outside]).toEqual(['E♯5', 'B♭4', 'A♯4'])
  })
})
