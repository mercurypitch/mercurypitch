// ============================================================
// Lesson 25 sounds tests — every step play's notes, spellings, lengths and looks
// ============================================================
//
// FACTS 60 to 64 and the WEB-SPEC's Toys 1 and Audio: a scale a note every
// 0.4 s, each 0.35 s, up in 3.15 s, up and down in 5.95 s, two scales 0.5
// s apart in 6.8 s; so, te or ti, do in 2.4 s; the chord on so, then home,
// two chords of 1.2 s at 0.075 a voice, each in its own column; the pairs
// 3.6 s; every note spelled one letter per degree in the learner's
// octave, and each figure a bar of its own with the staircase it shows.

import { describe, expect, it } from 'vitest'
import { HARMONIC_MINOR_DEGREES, MELODIC_MINOR_UP_DEGREES, NATURAL_MINOR_DEGREES, } from '@/features/lessons/kit/chords'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import { signName } from '@/features/lessons/kit/notes'
import { CHORD_GAIN } from '@/features/lessons/kit/sound'
import { midiOf } from '@/features/lessons/kit/staff-places'
import type { Figure, Play, PlayId } from './sounds'
import { C_MINOR_KEY, FLAT_COLUMNS, HARMONIC, MELODIC, NATURAL, playLength, playOf, rowsOf, } from './sounds'

/** A figure's notes as written, with their octaves: "A2 B2 C3". */
const written = (f: Figure): string =>
  f.notes.map((n) => signName(n.note)).join(' ')

/** Each figure's notes, in order. */
const figures = (p: Play): string[] => p.map(written)

const ALL: readonly PlayId[] = [
  'so-te-do',
  'so-ti-do',
  'chord-home',
  'harmonic',
  'le-pairs',
  'melodic',
  'major-melodic',
  'scale',
  'relative',
  'c-minor',
]

describe("the steps' plays", () => {
  it.each([
    ['so-te-do', 2.4],
    ['so-ti-do', 2.4],
    ['chord-home', 2.4],
    ['harmonic', 5.95],
    ['le-pairs', 3.6],
    ['melodic', 5.95],
    ['major-melodic', 6.8],
    ['scale', 5.95],
    ['relative', 6.8],
    ['c-minor', 3.15],
  ] as const)('times %s at %f s (FACTS 61 to 64)', (id, sec) => {
    expect(playLength(playOf(id, 'bass', HARMONIC))).toBeCloseTo(sec, 9)
  })

  it('plays so, te, do and so, ti, do from E3, 0.6, 0.6 and 1.2 s, the stairs lifting te for ti (FACTS 61)', () => {
    // Act
    const te = playOf('so-te-do', 'bass', NATURAL)[0]
    const ti = playOf('so-ti-do', 'bass', NATURAL)[0]

    // Assert
    expect([written(te), written(ti)]).toEqual(['E3 G3 A3', 'E3 G♯3 A3'])
    expect(te.notes.map((n) => [n.t, n.dur])).toEqual([
      [0, 0.6],
      [0.6, 0.6],
      [1.2, 1.2],
    ])
    expect(te.look.degrees).toEqual(NATURAL_MINOR_DEGREES)
    expect(ti.look.degrees).toEqual(HARMONIC_MINOR_DEGREES)
  })

  it('plays the chord on so as Raise te sets it, then home, each chord in a column of its own at 0.075 a voice (FACTS 61)', () => {
    // Act
    const minor = playOf('chord-home', 'bass', NATURAL)[0]
    const major = playOf('chord-home', 'treble', HARMONIC)[0]

    // Assert
    expect([written(minor), written(major)]).toEqual([
      'E3 G3 B3 A2 C3 E3',
      'E4 G♯4 B4 A3 C4 E4',
    ])
    expect(minor.notes.map((n) => [n.t, n.col])).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [1.2, 1],
      [1.2, 1],
      [1.2, 1],
    ])
    expect([minor.gain, minor.chord]).toEqual([CHORD_GAIN, 1.2])
  })

  it('plays harmonic minor up, then down as a bar of its own, G sharp both ways (FACTS 12, 62)', () => {
    // Act
    const play = playOf('harmonic', 'bass', NATURAL)

    // Assert
    expect(figures(play)).toEqual([
      'A2 B2 C3 D3 E3 F3 G♯3 A3',
      'G♯3 F3 E3 D3 C3 B2 A2',
    ])
    expect(play.map((f) => f.at)).toEqual([0, 3.2])
    expect(play.map((f) => f.look.degrees)).toEqual([
      HARMONIC_MINOR_DEGREES,
      HARMONIC_MINOR_DEGREES,
    ])
  })

  it('plays melodic minor up with F sharp and G sharp, and down plain, the stairs settling back (FACTS 13, 63)', () => {
    // Act
    const play = playOf('melodic', 'treble', NATURAL)

    // Assert
    expect(figures(play)).toEqual([
      'A3 B3 C4 D4 E4 F♯4 G♯4 A4',
      'G4 F4 E4 D4 C4 B3 A3',
    ])
    expect(play.map((f) => f.look.degrees)).toEqual([
      MELODIC_MINOR_UP_DEGREES,
      NATURAL_MINOR_DEGREES,
    ])
  })

  it('plays the scale as the switches set it: natural minor both ways with neither raised', () => {
    // Act
    const play = playOf('scale', 'bass', NATURAL)

    // Assert
    expect(figures(play)).toEqual([
      'A2 B2 C3 D3 E3 F3 G3 A3',
      'G3 F3 E3 D3 C3 B2 A2',
    ])
    expect(figures(playOf('scale', 'bass', MELODIC))).toEqual(
      figures(playOf('melodic', 'bass', NATURAL)),
    )
  })

  it('plays le to te, then le to ti, as two of Lesson 6’s pairs 0.5 s apart, the stairs natural minor’s, then harmonic minor’s (FACTS 62)', () => {
    // Act
    const play = playOf('le-pairs', 'bass', HARMONIC)

    // Assert
    expect(figures(play)).toEqual(['F3 G3', 'F3 G♯3'])
    expect(play.map((f) => f.at)).toEqual([0, 2.05])
    expect(play[0].notes.map((n) => [n.t, n.dur])).toEqual([
      [0, 0.6],
      [0.75, 0.8],
    ])
    expect(play.map((f) => f.look.degrees)).toEqual([
      NATURAL_MINOR_DEGREES,
      HARMONIC_MINOR_DEGREES,
    ])
  })

  it('plays A major, then melodic minor going up, the staircase A major’s first, its third stair mi (FACTS 21, 63)', () => {
    // Act
    const play = playOf('major-melodic', 'bass', HARMONIC)

    // Assert
    expect(figures(play)).toEqual([
      'A2 B2 C♯3 D3 E3 F♯3 G♯3 A3',
      'A2 B2 C3 D3 E3 F♯3 G♯3 A3',
    ])
    expect(play.map((f) => [f.at, f.look.degrees])).toEqual([
      [0, MAJOR_DEGREES],
      [3.65, MELODIC_MINOR_UP_DEGREES],
    ])
  })

  it('plays C major, then A minor on the same white keys, do moving from C3 down to A2 (FACTS 22, 64)', () => {
    // Act
    const play = playOf('relative', 'bass', HARMONIC)

    // Assert
    expect(figures(play)).toEqual([
      'C3 D3 E3 F3 G3 A3 B3 C4',
      'A2 B2 C3 D3 E3 F3 G3 A3',
    ])
    expect(play.map((f) => f.look)).toEqual([
      { degrees: MAJOR_DEGREES, tonic: 48 },
      { degrees: NATURAL_MINOR_DEGREES, tonic: 45 },
    ])
  })

  it('plays C minor from C4 for the treble clef, its flats in the columns that carry them, in the signature’s order (FACTS 27, 64)', () => {
    // Act
    const [run] = playOf('c-minor', 'treble', HARMONIC)
    const notes = run.notes.map((n) => n.note)

    // Assert
    expect(written(run)).toBe('C4 D4 E♭4 F4 G4 A♭4 B♭4 C5')
    expect(
      FLAT_COLUMNS.map((c) => signName(notes[c], { octave: false })),
    ).toEqual(['B♭', 'E♭', 'A♭'])
    expect(C_MINOR_KEY).toEqual({ sign: 'flat', count: 3 })
    expect(run.look).toEqual({ degrees: NATURAL_MINOR_DEGREES, tonic: 60 })
  })

  it('writes the house under every do, and only there', () => {
    // Act
    const homes = playOf('relative', 'bass', HARMONIC).map((f) =>
      f.notes.flatMap((n, i) => (n.home === true ? [i] : [])),
    )

    // Assert: C's two dos, then A's
    expect(homes).toEqual([
      [0, 7],
      [0, 7],
    ])
  })

  it("keeps every note inside its clef's rows, A2 to C4 or A3 to C5, so the staircase never lifts them", () => {
    for (const clef of ['bass', 'treble'] as const) {
      const { lo, hi } = rowsOf(clef)
      const midis = ALL.flatMap((id) =>
        [NATURAL, HARMONIC, MELODIC].flatMap((r) =>
          playOf(id, clef, r).flatMap((f) =>
            f.notes.map((n) => midiOf(n.note)),
          ),
        ),
      )
      expect(Math.min(...midis)).toBeGreaterThanOrEqual(lo)
      expect(Math.max(...midis)).toBeLessThanOrEqual(hi)
    }
  })
})
