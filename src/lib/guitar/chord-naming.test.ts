import { describe, expect, it } from 'vitest'
import { chordLabelForMidis } from './chord-naming'

describe('chordLabelForMidis', () => {
  it('names the power chords a MIDI tab cannot label for itself', () => {
    // The case that started this: two notes on the highway, no name, and a
    // player reading "0 2" mid-passage.
    expect(chordLabelForMidis([40, 47])).toBe('E5') // E2 + B2
    expect(chordLabelForMidis([43, 50])).toBe('G5')
    expect(chordLabelForMidis([45, 52])).toBe('A5')
    expect(chordLabelForMidis([50, 57])).toBe('D5')
  })

  it('names common triads and sevenths', () => {
    expect(chordLabelForMidis([60, 64, 67])).toBe('C')
    expect(chordLabelForMidis([57, 60, 64])).toBe('Am')
    expect(chordLabelForMidis([59, 62, 65])).toBe('Bdim')
    expect(chordLabelForMidis([60, 64, 68])).toBe('Caug')
    expect(chordLabelForMidis([60, 62, 67])).toBe('Csus2')
    expect(chordLabelForMidis([60, 65, 67])).toBe('Csus4')
    expect(chordLabelForMidis([55, 59, 62, 65])).toBe('G7')
    expect(chordLabelForMidis([60, 64, 67, 71])).toBe('Cmaj7')
    expect(chordLabelForMidis([57, 60, 64, 67])).toBe('Am7')
  })

  it('marks an inversion with the bass it is actually played over', () => {
    // Same pitch classes as C, but the third is underneath: a different shape
    // under the hand, and reading it as plain C would send the player to the
    // wrong fret.
    expect(chordLabelForMidis([64, 67, 72])).toBe('C/E')
    expect(chordLabelForMidis([67, 72, 76])).toBe('C/G')
  })

  it('is octave agnostic and ignores doubled voices', () => {
    expect(chordLabelForMidis([40, 47, 52, 64])).toBe('E5')
    expect(chordLabelForMidis([60, 64, 67, 72, 76])).toBe('C')
  })

  it('declines rather than guessing', () => {
    expect(chordLabelForMidis([60])).toBeNull()
    expect(chordLabelForMidis([])).toBeNull()
    // An octave is one note played twice.
    expect(chordLabelForMidis([60, 72])).toBeNull()
    // A cluster that is not a chord must not be forced into one.
    expect(chordLabelForMidis([60, 61, 62])).toBeNull()
  })
})
