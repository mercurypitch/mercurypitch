// Every play as a schedule, and the strip at any moment of it (Lesson 13
// WEB-SPEC, Toys 1 and Audio; Tests 2 and 10; FACTS 43, 53, 65 to 67).

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import { contourLength } from '@/features/lessons/kit/sound'
import { curvesOf, eeThenAh, lineGain, linePoints, MERC_GAIN, oneVowel, partialsOf, sourceLine, stripAt, vowelRun, } from './plays'
import { resonatorsOf, VOWELS, vowelStrip } from './vowels'

const FIVE = vowelRun('lower', 57, VOWELS)

describe('the plays as schedules (WEB-SPEC, Tests 2 and 10)', () => {
  it("holds the note's own frequency at every point of every line, on each of FACTS 65's notes", () => {
    // Arrange
    const notes = [53, 54, 55, 56, 57, 58, 59, 60, 61, 65, 69, 73]

    // Act
    const off = notes.flatMap((m) =>
      [
        eeThenAh('lower', m),
        vowelRun(m < 65 ? 'lower' : 'higher', m, VOWELS),
        sourceLine('lower', m, 3, 1.5),
      ].flatMap((line) => linePoints(line).filter((p) => p.hz !== hz(m))),
    )

    // Assert
    expect(off).toEqual([])
    expect(hz(57)).toBe(220)
    expect(hz(73)).toBeCloseTo(554.37, 2)
  })

  it("plays the cold open's 'ee' for 2.0 s, a 0.5 s change and 'ah' for 2.0 s: 4.5 s", () => {
    // Act
    const points = linePoints(eeThenAh('lower', 57))

    // Assert
    expect(points.map((p) => p.t)).toEqual([0, 2, 2.5, 4.5])
    expect(points.map((p) => p.res[0].hz)).toEqual([279.8, 279.8, 645.4, 645.4])
    expect(contourLength(points)).toBe(4.5)
  })

  it('plays the five vowels 2.0 s each, glided into over 0.25 s, 10.0 s, their cues at 0, 2, 4, 6 and 8 s', () => {
    // Act
    const points = linePoints(FIVE)

    // Assert
    expect(points.map((p) => p.t)).toEqual([
      0, 2, 2.25, 4, 4.25, 6, 6.25, 8, 8.25, 10,
    ])
    if (FIVE.kind !== 'vowels') throw new Error('a vowel line')
    expect(FIVE.stretches.map((s) => [s.vowel, s.at])).toEqual([
      ['ee', 0],
      ['eh', 2],
      ['ah', 4],
      ['oh', 6],
      ['oo', 8],
    ])
  })

  it("reaches each vowel's means at its points, Q its frequency over 80, 80 and 120 Hz", () => {
    // Act
    const ah = linePoints(FIVE)[4].res

    // Assert
    expect(ah).toEqual(resonatorsOf('lower', 'ah'))
    expect(ah.map((r) => r.hz / r.q)).toEqual(
      [80, 80, 120].map((b) => expect.closeTo(b, 9)),
    )
  })

  it("starts each play's gain from Merc's 0.2 and keeps every point's level at 1 or under", () => {
    for (const line of [
      FIVE,
      eeThenAh('lower', 57),
      vowelRun('higher', 73, VOWELS),
      oneVowel('higher', 65, 'ah'),
      sourceLine('lower', 57, 18, 2),
      sourceLine('lower', 57, 1, 1.5),
    ]) {
      // Act
      const levels = linePoints(line).map((p) => p.level ?? 1)

      // Assert
      expect(Math.max(...levels)).toBeCloseTo(1, 9)
      expect(Math.min(...levels)).toBeGreaterThan(0)
      expect(lineGain(line)).toBeGreaterThan(MERC_GAIN * 0.1)
    }
    expect(lineGain(sourceLine('lower', 57, 18, 2))).toBeCloseTo(MERC_GAIN, 9)
  })

  it('sings the source to 4 kHz at 1/k, and the first n harmonics alone for Add a harmonic', () => {
    // Act / Assert
    expect(partialsOf(FIVE)).toHaveLength(18)
    expect(partialsOf(oneVowel('higher', 69, 'ah'))).toHaveLength(9)
    expect(partialsOf(sourceLine('lower', 57, 3, 1.5))).toEqual([
      1,
      1 / 2,
      1 / 3,
    ])
    expect(linePoints(sourceLine('lower', 57, 3, 1.5))[0].res).toEqual([])
  })
})

describe('the strip as a play sounds (WEB-SPEC, Toys 1, Changing vowel)', () => {
  it("shows 'ee' before the change, 'ah' after it, and keeps the caps on 'ee' while it glides", () => {
    // Arrange
    const line = eeThenAh('lower', 57)
    const ee = vowelStrip('lower', 57, 'ee')
    const ah = vowelStrip('lower', 57, 'ah')

    // Act
    const before = stripAt(line, 1)
    const during = stripAt(line, 2.25)
    const after = stripAt(line, 3)

    // Assert
    expect(before).toEqual({
      columns: ee.segments,
      peaks: ee.peaks,
      vowel: 'ee',
    })
    expect(during.peaks).toEqual(ee.peaks)
    expect(during.columns).not.toEqual(ee.segments)
    expect(during.columns).not.toEqual(ah.segments)
    expect(after).toEqual({
      columns: ah.segments,
      peaks: ah.peaks,
      vowel: 'ah',
    })
  })

  it('lands a change on its end at its cue under reduced motion', () => {
    // Act
    const during = stripAt(eeThenAh('lower', 57), 2.01, true)

    // Assert
    expect(during.peaks).toEqual([3, 5])
  })

  it('lights the source alone against its first bar, with no peak capped', () => {
    // Act
    const three = stripAt(sourceLine('lower', 57, 3, 1.5), 0.5)

    // Assert
    expect(three.columns.slice(0, 4)).toEqual([12, 10, 9, 0])
    expect(three.columns).toHaveLength(18)
    expect(three.peaks).toBeNull()
  })

  it("draws each resonance's curve from 0 dB at its frequency down to its foot", () => {
    // Act
    const [r1] = curvesOf(resonatorsOf('lower', 'ee'), 10)

    // Assert
    const top = r1.reduce((a, p) => (p.db > a.db ? p : a))
    expect(Math.abs(top.hz - 279.8)).toBeLessThanOrEqual(10)
    expect(top.db).toBeCloseTo(0, 1)
    expect(r1[r1.length - 1].db).toBeLessThan(-36)
  })
})
