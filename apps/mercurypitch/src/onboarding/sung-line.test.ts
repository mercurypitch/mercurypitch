// ============================================================
// The sung line: ten notes, its words, and the key it is sung in
// ============================================================

import { describe, expect, it } from 'vitest'
import { HIGHEST_MIDI, LOWEST_MIDI, SAMPLE_SUSTAIN_END, SAMPLE_SUSTAIN_START, } from '@/features/echo/merc-voice-set'
import { highNote, LINE, LINE_SPAN, LINE_TEXT, LINE_WORDS, lineNotes, linePhrase, lineTonic, MIDDLE_TONIC, } from './sung-line'

describe('the line', () => {
  it('is ten notes, one a syllable, spelling its words in order', () => {
    expect(LINE).toHaveLength(10)
    const words = LINE_WORDS.map((_, word) =>
      LINE.filter((note) => note.word === word)
        .map((note) => note.syllable)
        .join(''),
    )
    expect(words.join(' ').toLowerCase()).toBe(
      LINE_TEXT.replace(',', '').toLowerCase(),
    )
  })

  it('moves at every note, so each is a note of its own to sing', () => {
    for (let i = 1; i < LINE.length; i++) {
      expect(LINE[i].degree).not.toBe(LINE[i - 1].degree)
      expect(LINE[i].at).toBeGreaterThanOrEqual(
        LINE[i - 1].at + LINE[i - 1].seconds,
      )
    }
  })

  it("holds no note longer than Merc's recorded voice does", () => {
    const held = SAMPLE_SUSTAIN_END - SAMPLE_SUSTAIN_START
    for (const note of LINE) expect(note.seconds).toBeLessThanOrEqual(held)
  })

  it('spans a fifth, its two high notes on "win-dow"', () => {
    expect(LINE_SPAN).toBe(7)
    expect(
      LINE.filter((_, index) => highNote(index)).map((note) => note.syllable),
    ).toEqual(['win', 'dow'])
  })
})

describe('lineTonic', () => {
  it('sings from C4 with no range', () => {
    expect(lineTonic(null)).toBe(MIDDLE_TONIC)
    expect(MIDDLE_TONIC).toBe(60)
  })

  it('sits inside a wide range, a little under its middle', () => {
    // E2 to G4, a baritone's: the middle is between F3 and F#3.
    const tonic = lineTonic({ lowMidi: 40, highMidi: 67 })
    expect(tonic).toBe(49)
    expect(tonic).toBeGreaterThanOrEqual(40)
    expect(tonic + LINE_SPAN).toBeLessThanOrEqual(67)
    expect(tonic + LINE_SPAN / 2).toBeLessThan((40 + 67) / 2)
  })

  it('stays inside a range only just wide enough', () => {
    expect(lineTonic({ lowMidi: 57, highMidi: 64 })).toBe(57)
  })

  it('centres the line on a range narrower than it', () => {
    // A4 to C#5, four semitones: the line overhangs both ends alike.
    const tonic = lineTonic({ lowMidi: 69, highMidi: 73 })
    expect(tonic).toBe(Math.round(71 - LINE_SPAN / 2))
  })

  it("keeps every note within Merc's reach, whatever the range", () => {
    for (const range of [
      { lowMidi: 20, highMidi: 30 },
      { lowMidi: 28, highMidi: 50 },
      { lowMidi: 80, highMidi: 100 },
      { lowMidi: 70, highMidi: 96 },
    ]) {
      const tonic = lineTonic(range)
      expect(tonic).toBeGreaterThanOrEqual(LOWEST_MIDI)
      expect(tonic + LINE_SPAN).toBeLessThanOrEqual(HIGHEST_MIDI)
    }
  })
})

describe('the line on a clock', () => {
  it("is Merc's call from the tonic", () => {
    expect(linePhrase(60).map((note) => note.midi)).toEqual([
      60, 62, 64, 67, 65, 64, 62, 64, 62, 60,
    ])
  })

  it('starts where it is told, in order', () => {
    const notes = lineNotes(55, 3)
    expect(notes[0]).toMatchObject({ midi: 55, from: 3, index: 0 })
    expect(notes[9].to).toBeCloseTo(3 + 7.7, 5)
  })
})
