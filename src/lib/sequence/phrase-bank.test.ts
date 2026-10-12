// ============================================================
// Phrase bank — Echo's motifs, their minor variants, the seeded random
// ============================================================

import { describe, expect, it } from 'vitest'
import type { Motif, PhraseMode } from './phrase-bank'
import { ECHO_MOTIFS, echoPhrase, motifSemitones, phraseModes, seededRandom, } from './phrase-bank'
import type { EchoLevelId } from './sequence-engine'
import { callSeconds, ECHO_LEVELS } from './sequence-engine'

const LEVELS = Object.keys(ECHO_LEVELS) as EchoLevelId[]
const MODES: readonly PhraseMode[] = ['major', 'minor']

/** Every motif of a level in both modes, as semitones above the root. */
const allSemitones = (level: EchoLevelId): number[][] =>
  ECHO_MOTIFS[level].flatMap((motif) =>
    MODES.map((mode) => motifSemitones(motif, mode)),
  )

const adjacent = (notes: readonly number[]): Array<[number, number]> =>
  notes.slice(1).map((note, i) => [notes[i], note])

describe('ECHO_MOTIFS', () => {
  it('is keyed by the accuracy tier ids, as the levels are', () => {
    // Act
    const keys = [Object.keys(ECHO_MOTIFS), Object.keys(ECHO_LEVELS)]

    // Assert
    expect(keys).toEqual([
      ['learning', 'singer', 'professional'],
      ['learning', 'singer', 'professional'],
    ])
  })

  it.each(LEVELS)(
    "gives every %s motif the level's number of notes",
    (level) => {
      // Act
      const lengths = ECHO_MOTIFS[level].map((motif) => motif.length)

      // Assert
      expect(new Set(lengths)).toEqual(
        new Set([ECHO_LEVELS[level].notesPerPhrase]),
      )
    },
  )

  it.each(LEVELS)(
    'never repeats a note straight after itself at %s',
    (level) => {
      // Act
      const repeats = allSemitones(level).filter((notes) =>
        adjacent(notes).some(([a, b]) => a === b),
      )

      // Assert
      expect(repeats).toEqual([])
    },
  )

  it.each(LEVELS.filter((level) => ECHO_LEVELS[level].octaveFold))(
    'never puts two adjacent notes an octave apart at %s, which folds octaves',
    (level) => {
      // Act
      const octaves = allSemitones(level).filter((notes) =>
        adjacent(notes).some(([a, b]) => (b - a) % 12 === 0),
      )

      // Assert
      expect(octaves).toEqual([])
    },
  )

  it.each([
    ['learning', 7],
    ['singer', 9],
    ['professional', 12],
  ] as const)('keeps %s within %i semitones of the root', (level, widest) => {
    // Act
    const tops = allSemitones(level).map((notes) => Math.max(...notes))

    // Assert
    expect(Math.max(...tops)).toBe(widest)
  })
})

describe('motifSemitones', () => {
  it.each<[Motif, number[], number[]]>([
    [
      [1, 2, 3],
      [0, 2, 4],
      [0, 2, 3],
    ],
    [
      [3, 5, 6, 5],
      [4, 7, 9, 7],
      [3, 7, 8, 7],
    ],
    [
      [8, 7, 5, 3, 1],
      [12, 11, 7, 4, 0],
      [12, 11, 7, 3, 0],
    ],
    [
      [5, '#4', 5, 3, 1],
      [7, 6, 7, 4, 0],
      [7, 6, 7, 3, 0],
    ],
  ])('flattens only the 3 and the 6 in minor: %j', (motif, major, minor) => {
    // Act
    const sung = [
      motifSemitones(motif, 'major'),
      motifSemitones(motif, 'minor'),
    ]

    // Assert
    expect(sung).toEqual([major, minor])
  })
})

describe('echoPhrase', () => {
  it("sings a motif from its root at Merc's even pace", () => {
    // Act
    const phrase = echoPhrase([1, 3, 5], 'minor', 57, 0.9)

    // Assert: A3, C4, E4, each 0.9 s.
    expect(phrase.notes).toEqual([
      { midi: 57, at: 0, seconds: 0.9 },
      { midi: 60, at: 0.9, seconds: 0.9 },
      { midi: 64, at: 1.8, seconds: 0.9 },
    ])
    expect(callSeconds(phrase)).toBeCloseTo(2.7, 9)
  })
})

describe('seededRandom', () => {
  it('draws the same numbers for the same seed, and other numbers for another', () => {
    // Act
    const draw = (seed: number) => {
      const random = seededRandom(seed)
      return Array.from({ length: 5 }, () => random())
    }

    // Assert
    expect(draw(7)).toEqual(draw(7))
    expect(draw(7)).not.toEqual(draw(8))
    expect(draw(7).every((x) => x >= 0 && x < 1)).toBe(true)
  })
})

describe('phraseModes', () => {
  const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1)

  it('opens a run in major and mixes minor in from the third phrase', () => {
    // Act
    const runs = SEEDS.map((seed) => phraseModes(5, seededRandom(seed)))

    // Assert
    expect(
      runs.filter((modes) => modes[0] !== 'major' || modes[1] !== 'major'),
    ).toEqual([])
    expect(runs.filter((modes) => !modes.slice(2).includes('minor'))).toEqual(
      [],
    )
    expect(new Set(runs.map((modes) => modes.join(' '))).size).toBeGreaterThan(
      3,
    )
  })

  it('keeps a run of two in major', () => {
    // Act
    const modes = phraseModes(2, seededRandom(1))

    // Assert
    expect(modes).toEqual(['major', 'major'])
  })
})
