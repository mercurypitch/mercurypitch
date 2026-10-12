// ============================================================
// Sequence metrics — counts, accuracy, tendencies and rhythm
// ============================================================
//
// Outcomes are written by hand here; sequence-engine.test.ts drives the
// engine into them.

import { describe, expect, it } from 'vitest'
import type { LandedNote, MissedNote, NoteOutcome, Phrase, } from './sequence-engine'
import type { PhraseTake } from './sequence-metrics'
import { accuracyFromCents, phraseRhythm, sequenceMetrics, } from './sequence-metrics'

function landed(index: number, cents: number, onset = 0): LandedNote {
  return {
    index,
    landed: true,
    cents,
    onset,
    landedAt: onset + 0.3,
    timeToLandMs: 300,
  }
}

function missed(index: number): MissedNote {
  return {
    index,
    landed: false,
    missedAt: 9,
    cause: 'deadline',
    voiced: false,
    closest: null,
  }
}

/** Merc's notes, `seconds` apart. */
function phraseOf(midis: readonly number[], seconds = 0.45): Phrase {
  return {
    notes: midis.map((midi, i) => ({ midi, at: i * seconds, seconds })),
  }
}

const take = (phrase: Phrase, outcomes: NoteOutcome[]): PhraseTake => ({
  phrase,
  outcomes,
})

describe('sequenceMetrics', () => {
  it('counts the notes landed and missed, and scores the landed ones', () => {
    // Arrange: mean distance (10 + 20 + 30) / 3 = 20 cents.
    const outcomes = [landed(0, 10), landed(1, -20), missed(2), landed(3, 30)]

    // Act
    const metrics = sequenceMetrics(
      [take(phraseOf([60, 62, 64, 67]), outcomes)],
      null,
    )

    // Assert: 100 - 1.5 * 20.
    expect([metrics.notes, metrics.landed, metrics.missed]).toEqual([4, 3, 1])
    expect(metrics.accuracy).toBe(70)
  })

  it('adds the phrases of a run together', () => {
    // Arrange
    const first = take(phraseOf([60, 64, 67]), [
      landed(0, 0),
      landed(1, 0),
      missed(2),
    ])
    const second = take(phraseOf([62, 65, 69]), [
      missed(0),
      landed(1, 10),
      landed(2, 10),
    ])

    // Act
    const metrics = sequenceMetrics([first, second], null)

    // Assert: (0 + 0 + 10 + 10) / 4 = 5 cents.
    expect([metrics.notes, metrics.landed, metrics.missed]).toEqual([6, 4, 2])
    expect(metrics.accuracy).toBe(93)
  })
})

describe('accuracyFromCents', () => {
  it.each([
    [[0, 0], 100],
    [[10, -10], 85],
    [[50], 25],
    [[66], 1],
    [[90], 0],
  ])('scores %j as %i', (cents, accuracy) => {
    // Act
    const score = accuracyFromCents(cents)

    // Assert
    expect(score).toBe(accuracy)
  })

  it('gives no number when nothing landed', () => {
    // Act
    const score = accuracyFromCents([])

    // Assert
    expect(score).toBeNull()
  })
})

describe('sequenceMetrics, tendencies', () => {
  it('sorts landed notes into leaps up, steps down and last notes', () => {
    // Arrange: C E D G E. E is a leap up (+4), D a step down (-2), G a leap
    // up (+5); the last E falls a minor third, a leap down, and is missed.
    const phrase = phraseOf([60, 64, 62, 67, 64])
    const outcomes = [
      landed(0, 0),
      landed(1, -30),
      landed(2, 20),
      landed(3, -10),
      missed(4),
    ]

    // Act
    const { tendencies } = sequenceMetrics([take(phrase, outcomes)], null)

    // Assert
    expect(tendencies).toEqual({
      leapsUp: { notes: 2, landed: 2, meanCents: -20 },
      stepsDown: { notes: 1, landed: 1, meanCents: 20 },
      lastNotes: { notes: 1, landed: 0, meanCents: null },
    })
  })

  it('counts a semitone down as a step and a minor third up as a leap', () => {
    // Arrange: C B D: B is a semitone down, D a minor third up.
    const phrase = phraseOf([60, 59, 62])
    const outcomes = [landed(0, 0), landed(1, 12), landed(2, -8)]

    // Act
    const { tendencies } = sequenceMetrics([take(phrase, outcomes)], null)

    // Assert
    expect([
      tendencies.stepsDown.meanCents,
      tendencies.leapsUp.meanCents,
    ]).toEqual([12, -8])
  })
})

describe('phraseRhythm', () => {
  // Merc's onsets every 0.45 s; the singer starts at 1.0 s.
  const phrase = phraseOf([60, 67, 72, 67, 64])
  const sung = (onsets: readonly number[]): NoteOutcome[] =>
    onsets.map((onset, i) => landed(i, 0, onset))

  it('puts every onset on Merc spacing in time, wherever the singer starts', () => {
    // Act
    const score = phraseRhythm(
      take(phrase, sung([1, 1.45, 1.9, 2.35, 2.8])),
      120,
    )

    // Assert
    expect(score).toEqual({ inTime: 5, notes: 5 })
  })

  it('puts one late note out of time and leaves the rest on the grid', () => {
    // Act: the last note 200 ms late.
    const score = phraseRhythm(take(phrase, sung([1, 1.45, 1.9, 2.35, 3])), 120)

    // Assert
    expect(score).toEqual({ inTime: 4, notes: 5 })
  })

  it('takes a late first note as late, not the rest as early', () => {
    // Act: the first note 200 ms late, the rest on Merc's spacing.
    const score = phraseRhythm(
      take(phrase, sung([1.2, 1.45, 1.9, 2.35, 2.8])),
      120,
    )

    // Assert
    expect(score).toEqual({ inTime: 4, notes: 5 })
  })

  it('puts the ends of a slow echo out of time', () => {
    // Act: 0.55 s a note against Merc's 0.45: the gaps run -200 to +200 ms
    // around their median, and only the middle three are within 120.
    const score = phraseRhythm(
      take(phrase, sung([1, 1.55, 2.1, 2.65, 3.2])),
      120,
    )

    // Assert
    expect(score).toEqual({ inTime: 3, notes: 5 })
  })

  it('keeps an onset exactly at the tolerance in time', () => {
    // Act: the last note 120 ms late.
    const score = phraseRhythm(
      take(phrase, sung([1, 1.45, 1.9, 2.35, 2.92])),
      120,
    )

    // Assert
    expect(score).toEqual({ inTime: 5, notes: 5 })
  })

  it('never counts a missed note in time', () => {
    // Arrange
    const outcomes = [...sung([1, 1.45, 1.9, 2.35]), missed(4)]

    // Act
    const score = phraseRhythm(take(phrase, outcomes), 120)

    // Assert
    expect(score).toEqual({ inTime: 4, notes: 5 })
  })

  it('sums a run, and gives no rhythm where the level does not judge it', () => {
    // Arrange
    const takes = [
      take(phrase, sung([1, 1.45, 1.9, 2.35, 3])),
      take(phrase, sung([1, 1.55, 2.1, 2.65, 3.2])),
    ]

    // Act
    const judged = sequenceMetrics(takes, 120).rhythm
    const unjudged = sequenceMetrics(takes, null).rhythm

    // Assert
    expect(judged).toEqual({ inTime: 7, notes: 10 })
    expect(unjudged).toBeNull()
  })
})
