// "Find my key": the key shift that puts a melody inside a singer's range.
import { describe, expect, it } from 'vitest'
import type { SingerRange, TimedNote } from './key-suggest'
import { suggestKeyShift } from './key-suggest'

function melody(midis: readonly number[], seconds = 1): TimedNote[] {
  return midis.map((midi, index) => ({
    midi,
    startTime: index * seconds,
    endTime: (index + 1) * seconds,
  }))
}

const TENOR: SingerRange = { lowMidi: 48, highMidi: 72 }
const BASS: SingerRange = { lowMidi: 40, highMidi: 64 }
const MID_MELODY = melody([55, 57, 59, 60, 62, 64, 65, 67])
const SOPRANO_MELODY = melody([72, 74, 76, 77, 79, 81, 83, 84])

function sungMidis(notes: readonly TimedNote[], shift: number): number[] {
  return notes.map((note) => note.midi + shift)
}

describe('suggestKeyShift', () => {
  it('keeps the original key when the melody already sits in the range', () => {
    expect(suggestKeyShift(MID_MELODY, TENOR)).toEqual({
      keyShift: 0,
      octave: 0,
      inRange: 1,
    })
  })

  it('lowers the key for a lower voice, with every note inside the range', () => {
    const suggestion = suggestKeyShift(MID_MELODY, BASS)

    expect(suggestion?.keyShift).toBeLessThan(0)
    expect(suggestion?.octave).toBe(0)
    expect(suggestion?.inRange).toBe(1)
    const shift = (suggestion?.keyShift ?? 0) + (suggestion?.octave ?? 0)
    for (const midi of sungMidis(MID_MELODY, shift)) {
      expect(midi).toBeGreaterThanOrEqual(BASS.lowMidi)
      expect(midi).toBeLessThanOrEqual(BASS.highMidi)
    }
  })

  it('sends a soprano line an octave down for a tenor rather than shifting the backing 6', () => {
    const suggestion = suggestKeyShift(SOPRANO_MELODY, TENOR)

    expect(suggestion?.octave).toBe(-12)
    expect(Math.abs(suggestion?.keyShift ?? 99)).toBeLessThanOrEqual(2)
    expect(suggestion?.inRange).toBe(1)
  })

  it('weights long notes over short ones', () => {
    // A long note at the bottom of the comfortable band and two short ones
    // above the range. Counted equally, the short notes would pull the key
    // down four semitones and push the long note out of the range.
    const notes: TimedNote[] = [
      { midi: 50, startTime: 0, endTime: 8 },
      { midi: 74, startTime: 8, endTime: 8.1 },
      { midi: 76, startTime: 8.1, endTime: 8.2 },
    ]

    const suggestion = suggestKeyShift(notes, TENOR)

    expect(suggestion?.keyShift).toBe(0)
    expect(suggestion?.octave).toBe(0)
    expect(suggestion?.inRange).toBeCloseTo(8 / 8.2, 5)
  })

  it('has no answer for an empty melody or a range it cannot use', () => {
    expect(suggestKeyShift([], TENOR)).toBeNull()
    expect(
      suggestKeyShift([{ midi: 60, startTime: 1, endTime: 1 }], TENOR),
    ).toBeNull()
    expect(
      suggestKeyShift(MID_MELODY, { lowMidi: 60, highMidi: 62 }),
    ).toBeNull()
    expect(
      suggestKeyShift(MID_MELODY, { lowMidi: Number.NaN, highMidi: 72 }),
    ).toBeNull()
  })

  it('gives the same answer every time', () => {
    const first = suggestKeyShift(SOPRANO_MELODY, BASS)

    for (let run = 0; run < 5; run++)
      expect(suggestKeyShift(SOPRANO_MELODY, BASS)).toEqual(first)
  })
})
