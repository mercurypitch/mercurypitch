// ============================================================
// Lesson 25's toy in words tests — the staircase, the chord column and the switches, said
// ============================================================
//
// The WEB-SPEC's Toys 1 and Contract: the staircase named with its notes and
// its steps in semitones; the chord on so spelled one letter per chord
// tone, E, G or G sharp, B, with its gaps and its name; and each switch's
// change, "Te raised to ti: G sharp 3".

import { describe, expect, it } from 'vitest'
import { HARMONIC_MINOR_DEGREES, MELODIC_MINOR_UP_DEGREES, NATURAL_MINOR_DEGREES, } from '@/features/lessons/kit/chords'
import { MAJOR_DEGREES } from '@/features/lessons/kit/major-scale'
import { chordSaid, columnChord, lookSaid, raiseSaid } from './minor-words'

describe("the toy's words", () => {
  it('names each staircase it draws, with its notes and its steps', () => {
    expect(lookSaid({ degrees: HARMONIC_MINOR_DEGREES, tonic: 45 })).toBe(
      'A harmonic minor, do to do: A, B, C, D, E, F, G sharp, A. Steps of 2, 1, 2, 2, 1, 3 and 1 semitones.',
    )
    expect(lookSaid({ degrees: MELODIC_MINOR_UP_DEGREES, tonic: 57 })).toBe(
      'A melodic minor, going up, do to do: A, B, C, D, E, F sharp, G sharp, A. Steps of 2, 1, 2, 2, 2, 2 and 1 semitones.',
    )
    expect(lookSaid({ degrees: NATURAL_MINOR_DEGREES, tonic: 48 })).toBe(
      'C natural minor, do to do: C, D, E flat, F, G, A flat, B flat, C. Steps of 2, 1, 2, 2, 1, 2 and 2 semitones.',
    )
    expect(lookSaid({ degrees: MAJOR_DEGREES, tonic: 48 })).toBe(
      'C major, do to do: C, D, E, F, G, A, B, C. Steps of 2, 2, 1, 2, 2, 2 and 1 semitones.',
    )
  })

  it("draws A minor's chord on so as E minor, or with te raised E major, one letter per chord tone", () => {
    expect(columnChord(45, false)).toEqual({
      notes: [52, 55, 59],
      names: ['E3', 'G3', 'B3'],
      label: 'E minor',
    })
    expect(columnChord(57, true)).toEqual({
      notes: [64, 68, 71],
      names: ['E4', 'G♯4', 'B4'],
      label: 'E major',
    })
    // the hero's, its letters alone
    expect(columnChord(57, true, false).names).toEqual(['E', 'G♯', 'B'])
  })

  it('says the chord on so with its gaps and its name', () => {
    expect(chordSaid(45, false)).toBe('E, G, B: 3 and 4 semitones, E minor.')
    expect(chordSaid(45, true)).toBe(
      'E, G sharp, B: 4 and 3 semitones, E major.',
    )
  })

  it('says each switch as it moves', () => {
    expect(raiseSaid('te', true, 45)).toBe('Te raised to ti: G sharp 3.')
    expect(raiseSaid('te', false, 45)).toBe('Ti back down to te: G3.')
    expect(raiseSaid('le', true, 57)).toBe(
      'Le raised to la, going up: F sharp 4. Coming down, both fall back.',
    )
    expect(raiseSaid('le', false, 57)).toBe('La back down to le: F4.')
  })
})
