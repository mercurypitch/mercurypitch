// Key-shift maths: the semitone range, speed compensation and key names.
import { describe, expect, it } from 'vitest'
import { clampKeyShift, formatKeyShift, isCleanKeyShift, KEY_SHIFT_CLEAN_LIMIT, KEY_SHIFT_MAX, KEY_SHIFT_MIN, pitchRatio, shifterSemitones, transposeKeyName, transposeNamedNotes, transposeNotes, transposePitchReadings, } from './key-shift'

describe('clampKeyShift', () => {
  it('rounds to whole semitones inside −6..+6', () => {
    expect(clampKeyShift(7.4)).toBe(6)
    expect(clampKeyShift(-9)).toBe(-6)
    expect(clampKeyShift(2.6)).toBe(3)
    expect(clampKeyShift(-2.4)).toBe(-2)
    expect([KEY_SHIFT_MIN, KEY_SHIFT_MAX]).toEqual([-6, 6])
  })

  it('reads anything that is not a finite number as the original key', () => {
    expect(clampKeyShift(Number.NaN)).toBe(0)
    expect(clampKeyShift(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('never returns negative zero', () => {
    expect(Object.is(clampKeyShift(-0.2), 0)).toBe(true)
  })
})

describe('isCleanKeyShift', () => {
  it('marks ±4 as clean and ±5 as a stretch', () => {
    expect(KEY_SHIFT_CLEAN_LIMIT).toBe(4)
    expect(isCleanKeyShift(4)).toBe(true)
    expect(isCleanKeyShift(-4)).toBe(true)
    expect(isCleanKeyShift(5)).toBe(false)
    expect(isCleanKeyShift(-6)).toBe(false)
  })
})

describe('shifterSemitones', () => {
  it('cancels the pitch change a playback rate would cause', () => {
    expect(shifterSemitones(0, 0.5)).toBe(12)
    expect(shifterSemitones(2, 1)).toBe(2)
    expect(shifterSemitones(-3, 2)).toBe(-15)
    expect(shifterSemitones(0, 0.85)).toBeCloseTo(2.8136, 3)
  })

  it('treats a rate that is not positive and finite as normal speed', () => {
    expect(shifterSemitones(1, 0)).toBe(1)
    expect(shifterSemitones(1, -1)).toBe(1)
    expect(shifterSemitones(1, Number.NaN)).toBe(1)
  })
})

describe('pitchRatio', () => {
  it('doubles per octave', () => {
    expect(pitchRatio(12)).toBe(2)
    expect(pitchRatio(-12)).toBe(0.5)
    expect(pitchRatio(0)).toBe(1)
    expect(pitchRatio(2)).toBeCloseTo(1.12246, 5)
  })
})

describe('formatKeyShift', () => {
  it('signs every shift, with a true minus sign', () => {
    expect(formatKeyShift(2)).toBe('+2')
    expect(formatKeyShift(-3)).toBe('−3')
    expect(formatKeyShift(0)).toBe('0')
  })
})

describe('transposeKeyName', () => {
  it('moves a key name round the octave', () => {
    expect(transposeKeyName('G', 2)).toBe('A')
    expect(transposeKeyName('A#', 1)).toBe('B')
    expect(transposeKeyName('B', 1)).toBe('C')
    expect(transposeKeyName('C', -1)).toBe('B')
    expect(transposeKeyName('F#', 6)).toBe('C')
  })

  it('reads flat spellings and answers in the app’s sharp spelling', () => {
    expect(transposeKeyName('Bb', 2)).toBe('C')
    expect(transposeKeyName('Eb', 1)).toBe('E')
  })

  it('leaves a name it does not know alone', () => {
    expect(transposeKeyName('H', 2)).toBe('H')
    expect(transposeKeyName('', 2)).toBe('')
  })
})

describe('transposeNotes', () => {
  it('moves every note and keeps its other fields', () => {
    const notes = [
      { id: 1, midi: 60, startTime: 0 },
      { id: 2, midi: 64, startTime: 1 },
    ]

    expect(transposeNotes(notes, -2)).toEqual([
      { id: 1, midi: 58, startTime: 0 },
      { id: 2, midi: 62, startTime: 1 },
    ])
    expect(notes[0].midi).toBe(60)
  })

  it('returns the same array at 0, so memos downstream stay put', () => {
    const notes = [{ midi: 60 }]

    expect(transposeNotes(notes, 0)).toBe(notes)
  })
})

describe('transposePitchReadings', () => {
  it('moves each reading and renames it, keeping its time', () => {
    const readings = [{ time: 1.5, frequency: 440, noteName: 'A', octave: 4 }]

    const [moved] = transposePitchReadings(readings, 3)

    expect(moved.time).toBe(1.5)
    expect(moved.frequency).toBeCloseTo(523.25, 2)
    expect(moved.noteName).toBe('C')
    expect(moved.octave).toBe(5)
  })

  it('returns the same array at 0', () => {
    const readings = [{ time: 0, frequency: 220, noteName: 'A', octave: 3 }]

    expect(transposePitchReadings(readings, 0)).toBe(readings)
  })
})

describe('transposeNamedNotes', () => {
  it('moves the note and its name, in the name’s own format', () => {
    const words = [
      { word: 'love', midi: 64, noteName: 'E4' },
      { word: 'me', midi: 64, noteName: 'E' },
      { word: 'do', midi: null, noteName: null },
    ]

    expect(transposeNamedNotes(words, 2)).toEqual([
      { word: 'love', midi: 66, noteName: 'F#4' },
      { word: 'me', midi: 66, noteName: 'F#' },
      { word: 'do', midi: null, noteName: null },
    ])
    expect(transposeNamedNotes(words, -5)[0].noteName).toBe('B3')
  })

  it('returns the same array at 0', () => {
    const words = [{ midi: 60, noteName: 'C4' }]

    expect(transposeNamedNotes(words, 0)).toBe(words)
  })
})
