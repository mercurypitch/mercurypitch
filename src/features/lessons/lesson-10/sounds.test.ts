// ============================================================
// Lesson 10 sounds tests — every note, length and level the page plays
// ============================================================
//
// WEB-SPEC, Tests 3: every fixed sound's frequency is hz(m) for a note of
// FACTS 70; chord-c lasts 1.6 s and each move 3.1 s, its glide 0.4 s from
// 1.2 s in (FACTS 72, 73); the Four words last 1.55, 2.85, 3.2 and 4.05 s
// (FACTS 74); the pattern lasts 7.857 s slow, which the facts round to 7.9
// (PLAN section 6, item 15), and 4.0 s fast (FACTS 76); a scale 4.05 s
// (FACTS 77); Slow doubles every length; a chord's voices sound at 0.075
// each (FACTS 81). And the notes of each: Steps 1 and 2's third and triad
// (FACTS 75), the pattern's order and its quavers' nine tenths, the two
// scales, the moves' held notes and quick check question 2's chord.

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import type { RunNote } from '@/features/lessons/kit/run'
import { QUALITIES, ROOTS } from './chords'
import type { MoveSound, Tempo } from './sounds'
import { CHORD_C, CHORD_GAIN, gapSound, lengthOf, MOVE_IDS, moveLength, moveSound, PATTERN, patternSound, QUAVER, QUIZ_CHORD, scaleSound, SLOW, slow, thirdSound, triadSound, WORD_IDS, wordSounds, } from './sounds'

/** FACTS 70: every fixed example's note, MIDI to hertz, to two decimals. */
const FACTS_70: Readonly<Record<number, number>> = {
  52: 164.81,
  55: 196.0,
  56: 207.65,
  59: 246.94,
  60: 261.63,
  62: 293.66,
  63: 311.13,
  64: 329.63,
  65: 349.23,
  66: 369.99,
  67: 392.0,
  68: 415.3,
  69: 440.0,
  70: 466.16,
  71: 493.88,
  72: 523.25,
}

const TEMPOS: readonly Tempo[] = ['slow', 'fast']

const midis = (notes: readonly RunNote[]): number[] => notes.map((n) => n.midi)
const fixed = (xs: readonly number[]): string[] => xs.map((x) => x.toFixed(9))
const times = (notes: readonly RunNote[]): string[] =>
  fixed(notes.map((n) => n.t))
const lengths = (notes: readonly RunNote[]): string[] =>
  fixed(notes.map((n) => n.dur))

/** Every fixed sound the page plays from C4: the cold open's, Steps 1 to 5's, the words' and the quiz's. */
function fixedSounds(): RunNote[][] {
  return [
    [...CHORD_C],
    ...MOVE_IDS.map((m) => [...moveSound(m).held]),
    ...QUALITIES.flatMap((q) => [
      thirdSound(60, q),
      triadSound(60, q),
      scaleSound(60, q),
      ...TEMPOS.map((t) => patternSound(60, q, t)),
    ]),
    ...Object.values(wordSounds()),
    [...QUIZ_CHORD],
  ]
}

/** Every sound a toy can play on any root, free play's included, at speed. */
function everySound(): RunNote[][] {
  return [
    ...fixedSounds(),
    ...ROOTS.flatMap((r) =>
      QUALITIES.flatMap((q) => [
        thirdSound(r, q),
        triadSound(r, q),
        scaleSound(r, q),
        ...TEMPOS.map((t) => patternSound(r, q, t)),
        ...TEMPOS.map((t) => patternSound(r, q, t, 5)),
      ]),
    ),
  ]
}

/** A sound's notes grouped by onset. */
function byOnset(notes: readonly RunNote[]): RunNote[][] {
  const at = new Map<number, RunNote[]>()
  for (const n of notes) at.set(n.t, [...(at.get(n.t) ?? []), n])
  return [...at.values()]
}

describe('the cold open', () => {
  it('plays C4, E4 and G4 together for 1.6 s, each at a chord voice’s level', () => {
    // Act
    const notes = CHORD_C

    // Assert: FACTS 72 and 81
    expect(midis(notes)).toEqual([60, 64, 67])
    expect(notes.map((n) => n.t)).toEqual([0, 0, 0])
    expect(lengthOf(notes)).toBe(1.6)
    expect(notes.map((n) => n.gain)).toEqual([0.075, 0.075, 0.075])
  })

  it('moves mi from E4 to E♭4 and so from G4 to G♭4, the other two held for 3.1 s', () => {
    // Act
    const [mi, so] = MOVE_IDS.map(moveSound)

    // Assert: FACTS 73
    expect(midis(mi.held)).toEqual([60, 67])
    expect([mi.from, mi.to]).toEqual([64, 63])
    expect(midis(so.held)).toEqual([60, 64])
    expect([so.from, so.to]).toEqual([67, 66])
    for (const m of [mi, so]) {
      expect(m.held.map((n) => [n.t, n.gain])).toEqual([
        [0, CHORD_GAIN],
        [0, CHORD_GAIN],
      ])
      expect(lengthOf(m.held)).toBeCloseTo(3.1, 9)
      expect(m.gain).toBe(CHORD_GAIN)
    }
  })

  it("glides the moving note for 0.4 s from 1.2 s in, along FACTS 73's contour, 3.1 s in all", () => {
    for (const [move, a, b] of [
      ['mi', 329.63, 311.13],
      ['so', 392.0, 369.99],
    ] as const) {
      // Act
      const m: MoveSound = moveSound(move)

      // Assert
      expect(fixed(m.line.map((p) => p.t))).toEqual(fixed([0, 1.2, 1.6, 3.1]))
      expect(m.line.map((p) => p.hz.toFixed(2))).toEqual(
        [a, a, b, b].map((f) => f.toFixed(2)),
      )
      expect(m.line.map((p) => p.hz)).toEqual([
        hz(m.from),
        hz(m.from),
        hz(m.to),
        hz(m.to),
      ])
      expect(moveLength(m)).toBeCloseTo(3.1, 9)
    }
  })
})

describe('Steps 1 to 3', () => {
  it("plays Step 1's third as C4, then E4, 0.6 s each, then together for 1.0 s, and under Minor C4 and E♭4", () => {
    // Act
    const major = thirdSound(60, 'major')
    const minor = thirdSound(60, 'minor')

    // Assert: FACTS 75
    expect(midis(major)).toEqual([60, 64, 60, 64])
    expect(midis(minor)).toEqual([60, 63, 60, 63])
    expect(times(major)).toEqual(fixed([0, 0.6, 1.2, 1.2]))
    expect(lengths(major)).toEqual(fixed([0.6, 0.6, 1, 1]))
    expect(lengthOf(major)).toBeCloseTo(2.2, 9)
    expect(gapSound(64, 67)).toEqual(
      major.map((n) => ({ ...n, midi: n.midi === 60 ? 64 : 67 })),
    )
  })

  it("plays Step 2's triad at 0.55 s a note, then together for 1.2 s: 2.85 s", () => {
    // Act
    const notes = triadSound(60, 'major')

    // Assert: FACTS 75
    expect(midis(notes)).toEqual([60, 64, 67, 60, 64, 67])
    expect(times(notes)).toEqual(fixed([0, 0.55, 1.1, 1.65, 1.65, 1.65]))
    expect(lengths(notes)).toEqual(fixed([0.55, 0.55, 0.55, 1.2, 1.2, 1.2]))
    expect(lengthOf(notes)).toBeCloseTo(2.85, 9)
    expect(midis(triadSound(60, 'minor'))).toEqual([60, 63, 67, 60, 63, 67])
  })
})

describe("Step 4's pattern", () => {
  it('plays root, fifth, third, fifth, four times, then the chord', () => {
    // Act
    const notes = patternSound(60, 'minor', 'slow')

    // Assert: FACTS 42 and 76
    expect(PATTERN).toHaveLength(16)
    expect(midis(notes)).toEqual([
      ...[60, 67, 63, 67, 60, 67, 63, 67, 60, 67, 63, 67, 60, 67, 63, 67],
      60,
      63,
      67,
    ])
  })

  it('lasts 7.857 s slow, which the facts round to 7.9, and 4.0 s fast', () => {
    // Act
    const slowLength = lengthOf(patternSound(60, 'major', 'slow'))
    const fastLength = lengthOf(patternSound(60, 'major', 'fast'))

    // Assert: FACTS 76, 16 × 30/70 + 1.0 and 16 × 0.1875 + 1.0
    expect(slowLength).toBeCloseTo((16 * 30) / 70 + 1, 9)
    expect(slowLength).toBeCloseTo(7.9, 1)
    expect(fastLength).toBeCloseTo(4, 9)
    expect(QUAVER.fast).toBe(0.1875)
  })

  it('sounds each quaver for nine tenths of its length, and the chord for 1.0 s', () => {
    for (const tempo of TEMPOS) {
      // Act
      const notes = patternSound(60, 'major', tempo)
      const q = QUAVER[tempo]

      // Assert
      const quavers = notes.slice(0, 16)
      expect(times(quavers)).toEqual(fixed(quavers.map((_, i) => i * q)))
      expect(lengths(quavers)).toEqual(fixed(quavers.map(() => 0.9 * q)))
      expect(notes.slice(16).map((n) => [n.t, n.dur])).toEqual([
        [16 * q, 1],
        [16 * q, 1],
        [16 * q, 1],
      ])
    }
  })

  it('plays the rest from a later quaver, so a switch takes effect from the next one', () => {
    // Act: five quavers heard slow, then Fast and Minor from the sixth
    const rest = patternSound(60, 'minor', 'fast', 5)

    // Assert
    expect(midis(rest)).toEqual([
      ...[67, 63, 67, 60, 67, 63, 67, 60, 67, 63, 67],
      60,
      63,
      67,
    ])
    expect(rest[0].t).toBe(0)
    expect(lengthOf(rest)).toBeCloseTo(11 * 0.1875 + 1, 9)
  })
})

describe("Step 5's scales", () => {
  it('play C4 to C5 in C major and in C natural minor, 0.45 s a note, the last 0.9 s: 4.05 s', () => {
    // Act
    const major = scaleSound(60, 'major')
    const minor = scaleSound(60, 'minor')

    // Assert: FACTS 77
    expect(midis(major)).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
    expect(midis(minor)).toEqual([60, 62, 63, 65, 67, 68, 70, 72])
    for (const s of [major, minor]) {
      expect(times(s)).toEqual(fixed(s.map((_, i) => i * 0.45)))
      expect(lengths(s)).toEqual(fixed([...s.slice(1).map(() => 0.45), 0.9]))
      expect(lengthOf(s)).toBeCloseTo(4.05, 9)
    }
  })
})

describe('the Four words and the quiz', () => {
  it('last 1.55, 2.85, 3.2 and 4.05 s', () => {
    // Act
    const words = wordSounds()

    // Assert: FACTS 74
    expect(WORD_IDS.map((w) => lengthOf(words[w]).toFixed(9))).toEqual(
      fixed([1.55, 2.85, 3.2, 4.05]),
    )
  })

  it('play C4 then E4, C, E and G, C major then C minor, and C natural minor', () => {
    // Act
    const words = wordSounds()

    // Assert: FACTS 74
    expect(words.third).toEqual([
      { t: 0, midi: 60, dur: 0.6 },
      { t: 0.75, midi: 64, dur: 0.8 },
    ])
    expect(words.triad).toEqual(triadSound(60, 'major'))
    expect(midis(words.quality)).toEqual([60, 64, 67, 60, 63, 67])
    expect(times(words.quality)).toEqual(fixed([0, 0, 0, 1.8, 1.8, 1.8]))
    expect(words['natural-minor']).toEqual(scaleSound(60, 'minor'))
  })

  it("plays quick check question 2's chord as D4, F4 and A4 together for 1.4 s", () => {
    // Act
    const notes = QUIZ_CHORD

    // Assert: FACTS 79
    expect(midis(notes)).toEqual([62, 65, 69])
    expect(notes.map((n) => [n.t, n.dur, n.gain])).toEqual([
      [0, 1.4, CHORD_GAIN],
      [0, 1.4, CHORD_GAIN],
      [0, 1.4, CHORD_GAIN],
    ])
  })
})

describe('Slow', () => {
  it('doubles every onset and length of each sound it slows, and moves no pitch or level', () => {
    // Arrange: Steps 1, 2, 3 and 5 on every root, as free play slows them
    const sounds = ROOTS.flatMap((r) =>
      QUALITIES.flatMap((q) => [
        thirdSound(r, q),
        triadSound(r, q),
        scaleSound(r, q),
      ]),
    )

    for (const once of sounds) {
      // Act
      const slowed = slow(once)

      // Assert
      expect(midis(slowed)).toEqual(midis(once))
      expect(slowed.map((n) => n.gain)).toEqual(once.map((n) => n.gain))
      expect(times(slowed)).toEqual(fixed(once.map((n) => n.t * SLOW)))
      expect(lengths(slowed)).toEqual(fixed(once.map((n) => n.dur * SLOW)))
      expect(lengthOf(slowed)).toBeCloseTo(lengthOf(once) * 2, 9)
    }
  })
})

describe('every sound', () => {
  it("plays only FACTS 70's notes, each at hz(m), in the fixed sounds", () => {
    for (const notes of fixedSounds())
      for (const n of notes) {
        // Act
        const listed = FACTS_70[n.midi]

        // Assert
        expect(listed, `MIDI ${n.midi}`).toBeDefined()
        expect(hz(n.midi)).toBeCloseTo(listed, 2)
      }
  })

  it("sounds a chord's voices at 0.075 each, and a note on its own at the run's level", () => {
    for (const notes of everySound())
      for (const group of byOnset(notes)) {
        // Act
        const levels = group.map((n) => n.gain)

        // Assert: FACTS 81
        expect(levels).toEqual(
          group.map(() => (group.length > 1 ? CHORD_GAIN : undefined)),
        )
      }
  })
})
