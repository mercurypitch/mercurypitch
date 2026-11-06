// ============================================================
// Rhythm words tests — a bar's name, its beats' and its lengths, in words
// ============================================================
//
// Lesson 17 WEB-SPEC, Toys 1 ("Keyboard and screen readers") and Toys 2:
// the figure named for what it shows, a pad by its beat and what it holds,
// and a play's lengths said once, the hero's first play in its own words.

import { describe, expect, it } from 'vitest'
import type { Bar, NoteValue, Written } from './rhythm-model'
import { placeBars, SIX_EIGHT } from './rhythm-model'
import { andList, figureWords, lengthsWords, padWords, secondsWords, symbolWords, } from './rhythm-words'

const note = (value: NoteValue, more: Partial<Written> = {}): Written => ({
  kind: 'note',
  value,
  ...more,
})
const rest = (value: NoteValue): Written => ({ kind: 'rest', value })
const times = (n: number, w: Written): Written[] =>
  Array.from({ length: n }, () => w)

describe('rhythm words', () => {
  it('names a figure for what it shows, as the spec writes it', () => {
    // Act
    const step2 = figureWords([[note(1), note(1), note(2)]], 'line')
    const step5 = figureWords(
      [
        [note(2), note(1), note(1, { tie: true })],
        [note(1), note(1), note(2)],
      ],
      'bass',
    )

    // Assert
    expect(step2).toBe(
      'One bar of 4/4: two quarter notes and a half note, on one line',
    )
    expect(step5).toBe(
      'Two bars of 4/4: a half note and two quarter notes, then two quarter notes and a half note, tied across the bar line, on the bass staff',
    )
    expect(
      figureWords([[note(2), note(1, { tie: true }), note(1)]], 'treble'),
    ).toBe(
      'One bar of 4/4: a half note and two quarter notes, with a tie, on the treble staff',
    )
    expect(figureWords([[note(1), note(1), note(2)]], 'lanes')).toBe(
      'One bar of 4/4: two quarter notes and a half note, on the pitch line',
    )
  })

  it('counts runs of equal symbols, dotted ones and rests by name, "an" before a vowel', () => {
    // Assert
    expect(symbolWords(times(16, note(0.25)))).toBe('sixteen sixteenth notes')
    expect(symbolWords([note(1, { dotted: true }), note(0.5), note(2)])).toBe(
      'a dotted quarter note, an eighth note and a half note',
    )
    expect(symbolWords([note(1), rest(1), rest(1), note(1)])).toBe(
      'a quarter note, two quarter rests and a quarter note',
    )
    expect(symbolWords([rest(4)])).toBe('a whole rest')
    expect(andList(['one', 'two', 'three'])).toBe('one, two and three')
  })

  it('names a pad by its beat and what it holds, or the note it holds over', () => {
    // Arrange
    const placed = placeBars([[note(0.5), note(0.5), rest(1), note(2)]])

    // Act
    const names = [0, 1, 2, 3].map((b) => padWords(placed, b))

    // Assert
    expect(names).toEqual([
      'Beat 1: two eighth notes',
      'Beat 2: a quarter rest',
      'Beat 3: a half note',
      'Beat 4: the half note, held',
    ])
    expect(padWords(placeBars([[rest(4)]]), 2)).toBe(
      'Beat 3: the whole rest, still silent',
    )
    expect(padWords(placeBars([times(4, note(1)), times(4, note(1))]), 5)).toBe(
      'Beat 2: a quarter note',
    )
  })

  it("says a play's lengths once, the hero's first play as the spec writes it", () => {
    // Act
    const hero = lengthsWords([times(4, note(1))], 60)
    const step2 = lengthsWords([[note(1), note(1), note(2)]], 90)
    const rests = lengthsWords([[note(1), rest(1), note(2)]], 60)

    // Assert (WEB-SPEC, Toys 2)
    expect(hero).toBe(
      'Four quarter notes at 60 beats per minute: 1 second each.',
    )
    expect(step2).toBe(
      'Two quarter notes and a half note at 90 beats per minute: 0.67 seconds each, then 1.33 seconds.',
    )
    expect(rests).toBe(
      'A quarter note, a quarter rest and a half note at 60 beats per minute: 1 second, then rest, 1 second, then 2 seconds.',
    )
  })

  it('says a tied pair as one length', () => {
    // Arrange
    const bars: Bar[] = [
      [note(2, { dotted: true }), note(1, { tie: true })],
      [note(1, { dotted: true }), note(0.5), note(2)],
    ]

    // Act
    const said = lengthsWords(bars, 60)

    // Assert
    expect(said).toContain(
      ': 3 seconds, then 2.5 seconds, then 0.5 seconds, then 2 seconds.',
    )
    expect(secondsWords(1, 60)).toBe('1 second')
    expect(secondsWords(1, 120)).toBe('0.5 seconds')
  })
})

describe('past 4/4', () => {
  it("names a figure in its metre, four bars of 6/8, and a triplet's notes as triplet eighths (Lesson 19 WEB-SPEC, Toys 1 and 5)", () => {
    // Arrange
    const e = { kind: 'note', value: 0.5 } as const
    const t = { ...e, triplet: true }
    const dq = { kind: 'note', value: 1, dotted: true } as const

    // Act
    const tune = figureWords(
      [
        [e, e, e, dq],
        [e, e, e, dq],
        [e, e, e, e, e, e],
        [{ kind: 'note', value: 2, dotted: true }],
      ],
      'bass',
      SIX_EIGHT,
    )
    const triplet = figureWords(
      [[{ kind: 'note', value: 1 }, e, e, t, t, t, { kind: 'note', value: 1 }]],
      'line',
    )

    // Assert
    expect(tune).toBe(
      'Four bars of 6/8: three eighth notes and a dotted quarter note, then three eighth notes and a dotted quarter note, then six eighth notes, then a dotted half note, on the bass staff',
    )
    expect(triplet).toBe(
      'One bar of 4/4: a quarter note, two eighth notes, three triplet eighth notes and a quarter note, on one line',
    )
  })
})
