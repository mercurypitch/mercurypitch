// ============================================================
// Lesson 22 sounds tests — every play's schedule, for its voice and its line
// ============================================================
//
// WEB-SPEC, Tests 1: every play on A3 in Merc's "ooh", its seconds, rate,
// extent and grow-in as FACTS 65 to 68 give them, every wave grown in over
// 0.3 s and Merc's default "ooh" over 0.35 s; Step 1's swell straight, its
// levels Lesson 14's; Drift's middle rising 50 cents over 3.0 s, out of the
// band at 2.1 s. The voice's contour and the chart's line come from the one
// schedule, and a slider moved during a play carries the line on from where
// its swing and its middle stood, at the middle of the voice's glide.

import { describe, expect, it } from 'vitest'
import { centsOn, middleOn } from '@/features/lessons/kit/band-chart-wave-scene'
import { HIT_TOLERANCE_CENTS } from '@/features/lessons/kit/band-words'
import { hz } from '@/features/lessons/kit/notes'
import { MERC_VIBRATO, VIBRATO_GLIDE } from '@/features/lessons/kit/sound'
import { SWELL_LEVEL } from '@/features/lessons/lesson-14/song'
import type { Play } from './sounds'
import { A3, answerOf, atRate, COLD, COLD_WAVE, contourOfPlay, levelAt, levelOf, lineOf, measure, OOH, playFor, retune, SIX, STRAIGHT, STRAIGHT_AT, SUNG, SWELL, SWELLED, TWO, WAVE, } from './sounds'

/** Every play the steps' toy makes, at the sliders' first values. */
const STEP_PLAYS: readonly Play[] = [
  STRAIGHT,
  WAVE,
  SWELLED,
  measure(6, 30),
  OOH,
  SIX,
  TWO,
  atRate(6, false),
  atRate(4, true),
  SUNG,
]

describe("the cold open's plays (FACTS 41, 62, 64)", () => {
  it("sings Merc's note on A3 for 3.0 s, six swings a second at ±50 cents, grown in over 0.3 s, as Step 3's six a second", () => {
    // Assert
    expect(COLD).toEqual({
      midi: A3,
      sec: 3,
      vibrato: { rate: 6, extent: 50, growIn: 0.3 },
    })
    expect(SIX).toBe(COLD)
  })

  it('answers with the wave for 2.0 s, 0.3 s of quiet, then the straight note for 2.0 s, 4.3 s in all', () => {
    // Act
    const top = answerOf(STRAIGHT_AT.top)
    const middle = answerOf(STRAIGHT_AT.middle)

    // Assert: the top 50 cents above A3, 226.45 Hz; the middle A3 itself; no vibrato on either
    expect(top.sec).toBeCloseTo(4.3, 9)
    expect(top.lines.map((l) => [l.t, l.vibrato])).toEqual([
      [0, COLD_WAVE],
      [expect.closeTo(2.3, 9) as number, null],
    ])
    expect(top.lines[0].points.map((p) => [p.t, p.hz])).toEqual([
      [0, hz(A3)],
      [2, hz(A3)],
    ])
    expect(top.lines[1].points.map((p) => p.hz)).toEqual([
      expect.closeTo(226.45, 2) as number,
      expect.closeTo(226.45, 2) as number,
    ])
    expect(middle.lines[1].points[0].hz).toBeCloseTo(220, 9)
  })

  it("draws the straight note's level line at its height, the top 15 cents above the band's top edge", () => {
    // Act
    const { line } = answerOf(STRAIGHT_AT.top)

    // Assert
    expect(line).toEqual([
      {
        kind: 'wave',
        from: 0,
        to: 2,
        rate: 6,
        extent: 50,
        growIn: 0.3,
        drift: 0,
      },
      { kind: 'level', from: 2.3, to: 4.3, c: 50 },
    ])
    expect(50 - HIT_TOLERANCE_CENTS).toBe(15)
  })

  it('swings past both edges of the band in 16 of its 18 swings', () => {
    // Arrange: each swing's top, six a second for 3.0 s, and the bottom a twelfth of a second after it
    const [wave] = lineOf(COLD)
    const tops = Array.from({ length: 18 }, (_, n) => (n + 0.25) / 6)

    // Assert: the two swings still growing in stay inside; the rest reach past both edges
    const past = tops.filter(
      (t) =>
        centsOn(wave, t) > HIT_TOLERANCE_CENTS &&
        centsOn(wave, t + 1 / 12) < -HIT_TOLERANCE_CENTS,
    )
    expect(past).toHaveLength(16)
  })
})

describe("the steps' plays (FACTS 65 to 68)", () => {
  it("sounds every one on A3, 220 Hz, in Merc's voice", () => {
    // Assert
    expect(hz(A3)).toBeCloseTo(220, 6)
    for (const p of STEP_PLAYS) expect(p.midi).toBe(A3)
  })

  it('gives each its seconds, its rate, its extent and its grow-in', () => {
    // Assert
    const shape = (p: Play) => [p.sec, p.vibrato]
    expect(shape(STRAIGHT)).toEqual([3, null])
    expect(shape(WAVE)).toEqual([3, { rate: 6, extent: 40, growIn: 0.3 }])
    expect(shape(SWELLED)).toEqual([4, null])
    expect(shape(measure(7.5, 60))).toEqual([
      4,
      { rate: 7.5, extent: 60, growIn: 0.3 },
    ])
    expect(shape(SIX)).toEqual([3, { rate: 6, extent: 50, growIn: 0.3 }])
    expect(shape(TWO)).toEqual([3, { rate: 2, extent: 50, growIn: 0.3 }])
    expect(shape(atRate(3, false))).toEqual([
      3,
      { rate: 3, extent: 50, growIn: 0.3 },
    ])
    expect(shape(SUNG)).toEqual([2, { rate: 5.5, extent: 30, growIn: 0.3 }])
  })

  it('plays Merc\'s "ooh" in the kit\'s default voice: 5.5 swings a second at ±14, grown in over 0.35 s', () => {
    // Assert
    expect(OOH).toEqual({ midi: A3, sec: 2, vibrato: MERC_VIBRATO })
    expect(MERC_VIBRATO).toEqual({ rate: 5.5, extent: 14, growIn: 0.35 })
  })

  it('gives the sung wave its 11 swings in 2 seconds', () => {
    // Assert
    expect((SUNG.vibrato?.rate ?? 0) * SUNG.sec).toBe(11)
  })

  it("finds each key its play, at the sliders' values and with Drift as switched", () => {
    // Arrange
    const v = { rate2: 7, extent2: 20, rate3: 3, drift: true }

    // Assert
    expect(playFor('straight', v)).toBe(STRAIGHT)
    expect(playFor('measure', v).vibrato).toEqual({
      rate: 7,
      extent: 20,
      growIn: 0.3,
    })
    expect(playFor('at-rate', v)).toEqual(atRate(3, true))
    expect(playFor('six', v)).toBe(SIX)
    expect(playFor('two', v)).toBe(TWO)
    expect(playFor('sung', v)).toBe(SUNG)
  })
})

describe("Step 1's swell (FACTS 65)", () => {
  it("is straight and on pitch from its start, at Lesson 14's levels: 0.5, up to 1.0 at 2.5 s, 0.5 at 4.0 s", () => {
    // Assert
    expect(SWELL).toEqual(SWELL_LEVEL)
    expect(SWELLED.vibrato).toBeNull()
    expect(contourOfPlay(SWELLED)).toEqual([
      { t: 0, hz: hz(A3), level: 0.5 },
      { t: 1, hz: hz(A3), level: 0.5 },
      { t: 2.5, hz: hz(A3), level: 1 },
      { t: 4, hz: hz(A3), level: 0.5 },
    ])
  })

  it('reads its level between its points, and draws it under the line as far as the play has gone', () => {
    // Assert
    expect(levelAt(SWELLED, 1.75)).toBeCloseTo(0.75, 9)
    expect(levelAt(STRAIGHT, 2)).toBe(1)
    expect(levelOf(SWELLED, 0, 2)).toEqual([
      { t: 0, level: 0.5 },
      { t: 1, level: 0.5 },
      { t: 2, level: expect.closeTo(5 / 6, 9) as number },
    ])
  })

  it("starts a later second's level at the window's left edge, as the sweep does", () => {
    // Act: the play's third second on a one-second window
    const level = levelOf(SWELLED, -2, 0.5)

    // Assert
    expect(level).toEqual([
      { t: 0, level: expect.closeTo(5 / 6, 9) as number },
      { t: 0.5, level: expect.closeTo(1, 9) as number },
    ])
  })
})

describe("Step 3's Drift (FACTS 23, 67)", () => {
  it('raises the middle 50 cents over 3.0 s, the voice and the line together', () => {
    // Arrange
    const p = atRate(6, true)
    const [line] = lineOf(p)

    // Assert: the voice glides from A3 to 226.45 Hz; the line's middle rises with it
    expect(contourOfPlay(p).map((c) => c.hz)).toEqual([
      hz(A3),
      expect.closeTo(226.45, 2) as number,
    ])
    expect(middleOn(line, 3)).toBeCloseTo(50, 9)
  })

  it('takes the middle out of the band at 2.1 s', () => {
    // Arrange
    const [line] = lineOf(atRate(6, true))

    // Assert
    expect(middleOn(line, 2.09)).toBeLessThan(HIT_TOLERANCE_CENTS)
    expect(middleOn(line, 2.11)).toBeGreaterThan(HIT_TOLERANCE_CENTS)
  })

  it('leaves a play without it on its note', () => {
    // Assert
    expect(contourOfPlay(atRate(6, false)).map((c) => c.hz)).toEqual([
      hz(A3),
      hz(A3),
    ])
  })
})

describe("a play's line", () => {
  it('is a level note for a straight note, and a wave for one with a vibrato', () => {
    // Assert
    expect(lineOf(STRAIGHT)).toEqual([{ kind: 'level', from: 0, to: 3, c: 0 }])
    expect(lineOf(WAVE, 1)).toEqual([
      {
        kind: 'wave',
        from: 1,
        to: 4,
        rate: 6,
        extent: 40,
        growIn: 0.3,
        drift: 0,
      },
    ])
  })
})

describe('a slider moved during a play', () => {
  it("carries the line on from where its swing and its middle stood, at the middle of the voice's glide", () => {
    // Arrange: Drift's wave, Rate moved 1.2 s in
    const line = lineOf(atRate(6, true))
    const at = 1.2 + VIBRATO_GLIDE / 2

    // Act
    const moved = retune(line, 1.2, { rate: 3, extent: 50 })

    // Assert: the first wave stops there; the next goes on unbroken, at three swings a second
    expect(moved).toHaveLength(2)
    const [before, after] = moved
    expect(before.to).toBeCloseTo(at, 9)
    expect(after.from).toBeCloseTo(at, 9)
    expect(centsOn(after, at)).toBeCloseTo(centsOn(before, at), 9)
    expect(middleOn(after, 3)).toBeCloseTo(50, 9)
    expect(after).toMatchObject({ rate: 3, extent: 50, growIn: 0, to: 3 })
  })

  it("leaves a line that has ended, or a straight note's, as it was", () => {
    // Arrange
    const wave = lineOf(WAVE)
    const straight = lineOf(STRAIGHT)

    // Assert
    expect(retune(wave, 3, { rate: 7, extent: 20 })).toEqual(wave)
    expect(retune(straight, 1, { rate: 7, extent: 20 })).toEqual(straight)
  })
})
