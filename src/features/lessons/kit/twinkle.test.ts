// ============================================================
// Twinkle tests — the verse as its score has it, its chords and its breaths
// ============================================================
//
// Lesson 14 WEB-SPEC, Tests 1: 42 notes in six lines of seven, each line
// eight beats ending on its only minim (FACTS 17, 25); the degrees, never ti
// (FACTS 18); the syllables, printed as the score joins them; the chords per
// line (FACTS 43), every melody note a note of the chord under it; the
// breath marks (FACTS 85); and Lesson 6's first two lines read from it.

import { describe, expect, it } from 'vitest'
import { TWINKLE } from '@/features/lessons/lesson-06/melody'
import { MAJOR_DEGREES } from './major-scale'
import { BEAT_SEC, BREATH_SEC, CHORD_STEPS, LINE_SEC, lineBeats, VERSE, VERSE_BREATHS, VERSE_CHORDS, VERSE_SEC, } from './twinkle'

const SYLLABLE = ['do', 're', 'mi', 'fa', 'so', 'la', 'ti']

describe('the verse', () => {
  it('is six lines of seven notes, each eight beats with its only minim at its end', () => {
    // Assert
    expect(VERSE).toHaveLength(6)
    expect(VERSE.flat()).toHaveLength(42)
    for (const line of VERSE) {
      expect(line.map((n) => n.beats)).toEqual([1, 1, 1, 1, 1, 1, 2])
      expect(line.reduce((sum, n) => sum + n.beats, 0)).toBe(8)
    }
  })

  it('runs do do so so la la so, fa fa mi mi re re do, so so fa fa mi mi re twice, then the first two lines, never ti', () => {
    // Act
    const lines = VERSE.map((line) =>
      line.map((n) => SYLLABLE[n.degree]).join(' '),
    )

    // Assert
    expect(lines).toEqual([
      'do do so so la la so',
      'fa fa mi mi re re do',
      'so so fa fa mi mi re',
      'so so fa fa mi mi re',
      'do do so so la la so',
      'fa fa mi mi re re do',
    ])
    expect(VERSE.flat().every((n) => n.degree >= 0 && n.degree <= 5)).toBe(true)
  })

  it('prints its syllables as the score joins them, the hyphen kept where the word goes on', () => {
    // Act
    const printed = VERSE.map((line) => line.map((n) => n.printed).join(' '))

    // Assert
    expect(printed).toEqual([
      'Twin- kle, twin- kle, lit- tle star,',
      'How I won- der what you are!',
      'Up a- bove the world so high,',
      'like a dia- mond in the sky.',
      'Twin- kle, twin- kle, lit- tle star,',
      'How I won- der what you are!',
    ])
    // the spoken syllable is the printed one without its hyphen or stop
    for (const note of VERSE.flat())
      expect(note.printed.replace(/[-,.!]/g, '').toLowerCase()).toBe(
        note.syllable.toLowerCase(),
      )
  })

  it('takes the chords one a minim, I I IV I, IV I V I, I IV I V twice, then the first two again', () => {
    // Assert
    expect(VERSE_CHORDS.map((c) => c.join(' '))).toEqual([
      'I I IV I',
      'IV I V I',
      'I IV I V',
      'I IV I V',
      'I I IV I',
      'IV I V I',
    ])
  })

  it('sets every melody note over a chord that holds it', () => {
    // Arrange
    const pitchClass = (s: number): number => ((s % 12) + 12) % 12

    for (const [i, line] of VERSE.entries()) {
      // Act: the chord sounding at each note, a minim each
      const beats = lineBeats(line)
      const held = line.every((note, k) => {
        const chord = VERSE_CHORDS[i][Math.floor(beats[k].from / 2)]
        const tones = CHORD_STEPS[chord].map(pitchClass)
        return tones.includes(pitchClass(MAJOR_DEGREES[note.degree]))
      })

      // Assert
      expect(held, `line ${i + 1}`).toBe(true)
    }
  })

  it('builds I on do, IV on fa and V on so as major triads', () => {
    // Assert: a major third then a minor third, on degrees 1, 4 and 5
    expect(CHORD_STEPS.I).toEqual([0, 4, 7])
    expect(CHORD_STEPS.IV).toEqual([5, 9, 12])
    expect(CHORD_STEPS.V).toEqual([7, 11, 14])
  })

  it('lasts 36 s at 80 beats a minute, a line 6 s, with a breath mark 0.3 s before each line after the first', () => {
    // Assert
    expect(BEAT_SEC).toBe(0.75)
    expect(LINE_SEC).toBe(6)
    expect(VERSE_SEC).toBe(36)
    expect(BREATH_SEC).toBe(0.3)
    expect(VERSE_BREATHS).toEqual([5.7, 11.7, 17.7, 23.7, 29.7])
  })

  it('gives Lesson 6 its first two lines unchanged', () => {
    // Assert
    expect(TWINKLE).toEqual(VERSE.slice(0, 2))
    expect(TWINKLE.flat().map((n) => n.syllable)).toEqual([
      'twin',
      'kle',
      'twin',
      'kle',
      'lit',
      'tle',
      'star',
      'How',
      'I',
      'won',
      'der',
      'what',
      'you',
      'are',
    ])
  })
})
