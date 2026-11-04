// ============================================================
// Lesson 12 tune play tests — one run for the chords and the tune, and the counts
// ============================================================
//
// WEB-SPEC, Toys 5, and FACTS 35 to 37, 68, 72 and 74: a tune play is the
// loop's chords at 0.05 a voice and Merc's "ooh" at 0.2 in one run, each
// note of the tune starting in the same task as the chord under it; the
// counts end on 11 of 15, 10 of 12 and 10 of 12; Slow doubles every length.

import { describe, expect, it } from 'vitest'
import type { TuneId } from './music'
import { TUNE_IDS, tuneOf } from './music'
import { lengthOf, MERC_GAIN, tune, UNDER_GAIN } from './sounds'
import { tallyOf, tuneIdOf, tuneSound } from './tune-play'

describe("Lesson 12's tune play", () => {
  it.each([
    ['tune-1', 11, 15],
    ['tune-2', 10, 12],
    ['even', 10, 12],
  ] as const)('counts %s on a corner %i times of %i', (id, on, of) => {
    // Arrange
    const notes = tuneOf(id, 'C')

    // Act
    const count = tallyOf(notes)

    // Assert
    expect(count).toEqual({ on, of })
  })

  it('counts only the notes that have begun: tune 1 is 4 of 5 after its fifth', () => {
    // Arrange
    const notes = tuneOf('tune-1', 'C')

    // Act
    const count = tallyOf(notes, 5)

    // Assert
    expect(count).toEqual({ on: 4, of: 5 })
  })

  it.each(TUNE_IDS)(
    'plays %s as one run: the chords soft at 0.05 a voice, Merc at 0.2',
    (id) => {
      // Arrange
      const s = tuneSound(id, 'C', false)

      // Act
      const chords = s.notes.filter((n) => n.kind === 'soft')
      const merc = s.notes.filter((n) => n.kind === 'merc')

      // Assert
      expect(s.notes).toEqual(tune(id, 'C'))
      expect(chords).toHaveLength(12)
      expect(chords.every((n) => n.gain === UNDER_GAIN)).toBe(true)
      expect(merc.map((n) => n.midi)).toEqual(
        tuneOf(id, 'C').map((n) => n.midi),
      )
      expect(merc.every((n) => n.gain === MERC_GAIN)).toBe(true)
      expect(lengthOf(s.notes)).toBeCloseTo(8, 6)
    },
  )

  it.each(TUNE_IDS)(
    "starts each note of %s in the same task as the chord under it, each bar's chord first",
    (id) => {
      // Arrange
      const s = tuneSound(id, 'C', false)
      const bars = [0, 2, 4, 6]

      // Act
      const tasks = bars.map((t) =>
        s.notes.flatMap((n, i) =>
          Math.abs(n.t - t) < 1e-9
            ? [s.sungAt(i) === null ? 'chord' : 'tune']
            : [],
        ),
      )

      // Assert
      for (const task of tasks)
        expect(task).toEqual(['chord', 'chord', 'chord', 'tune'])
    },
  )

  it('reads each of the run notes back: the tune note it is, or the chord it voices', () => {
    // Arrange
    const s = tuneSound('tune-1', 'C', false)

    // Act
    const sung = s.notes.map((_, i) => s.sungAt(i)).filter((k) => k !== null)
    const chords = s.notes.map((_, i) => s.chordAt(i)).filter((d) => d !== null)

    // Assert
    expect(sung).toEqual(tuneOf('tune-1', 'C').map((_, k) => k))
    expect(chords).toEqual([0, 0, 0, 4, 4, 4, 5, 5, 5, 3, 3, 3])
  })

  it.each(TUNE_IDS)('doubles every length of %s under Slow: 16.0 s', (id) => {
    // Arrange
    const plain = tuneSound(id, 'C', false)

    // Act
    const slowed = tuneSound(id, 'C', true)

    // Assert
    expect(slowed.by).toBe(2)
    expect(lengthOf(slowed.notes)).toBeCloseTo(16, 6)
    expect(slowed.notes.map((n) => [n.t, n.dur])).toEqual(
      plain.notes.map((n) => [n.t * 2, n.dur * 2]),
    )
    expect(slowed.notes.map((_, i) => slowed.chordAt(i))).toEqual(
      plain.notes.map((_, i) => plain.chordAt(i)),
    )
  })

  it('plays a tune five semitones lower in G, its count the same', () => {
    // Arrange
    const id: TuneId = 'tune-2'

    // Act
    const inG = tuneSound(id, 'G', false)

    // Assert
    expect(inG.notes.map((n) => n.midi)).toEqual(
      tuneSound(id, 'C', false).notes.map((n) => n.midi - 5),
    )
    expect(tallyOf(inG.tune)).toEqual({ on: 10, of: 12 })
  })

  it("names a tune by its button's data-tune, and nothing else", () => {
    // Arrange
    const names = ['tune-1', 'tune-2', 'even', 'tune-3', undefined]

    // Act
    const ids = names.map(tuneIdOf)

    // Assert
    expect(ids).toEqual(['tune-1', 'tune-2', 'even', null, null])
  })
})
