// ============================================================
// Lesson 22 band chart picture tests — the four states, moment by moment
// ============================================================
//
// WEB-SPEC, Toys 2: Step 1's line drawn as far as its play has gone, the
// swell's level under it; Step 2's one-second sweep, redrawn from its left
// edge each second, its counter reading the rate that sounds and its ruler
// standing from the middle to the first full swing top the window has
// drawn; Step 3's middle dashed as far as the play has gone; each state's
// still after the cold open's choice, and the band alone before it; under
// reduced motion a line whole as its play starts.

import { describe, expect, it } from 'vitest'
import { centsOn } from '@/features/lessons/kit/band-chart-wave-scene'
import { lineOf, measure, retune, SUNG, SWELLED, TWO, WAVE } from './sounds'
import { BLANK, drawnTo, peaksBy, pictureOf, rulerOf, stillOf, WINDOW, } from './vib-picture'

const SETTINGS = { rate2: 6, extent2: 30, rate3: 6 }

describe("Step 1's level line, wave and swell", () => {
  it('draws the wave as far as the play has sounded, across 4.5 s, with no middle and no ruler', () => {
    // Act
    const pic = pictureOf(1, WAVE, lineOf(WAVE), 1.25)

    // Assert
    expect(WINDOW[1]).toBe(4.5)
    expect(pic.wave?.upTo).toBe(1.25)
    expect(pic.middle).toBeNull()
    expect(pic.ruler).toBeNull()
  })

  it('grows the strip under a level line for the swell', () => {
    // Act
    const pic = pictureOf(1, SWELLED, lineOf(SWELLED), 2.5)

    // Assert
    expect(pic.wave?.stretches).toEqual([
      { kind: 'level', from: 0, to: 4, c: 0 },
    ])
    expect(pic.level.map((l) => l.level)).toEqual([0.5, 0.5, 1])
  })
})

describe("Step 2's sweep", () => {
  it('redraws one second at a time from its left edge, the play moved back by the seconds gone', () => {
    // Arrange
    const p = measure(6, 30)

    // Act
    const first = pictureOf(2, p, lineOf(p), 0.4)
    const third = pictureOf(2, p, lineOf(p), 2.4)

    // Assert
    expect(WINDOW[2]).toBe(1)
    expect(first.wave?.upTo).toBeCloseTo(0.4, 9)
    expect(third.wave?.upTo).toBeCloseTo(0.4, 9)
    expect(third.wave?.stretches[0]).toMatchObject({ from: -2, to: 2 })
  })

  it('keeps the last second showing once the play has ended', () => {
    // Arrange
    const p = measure(6, 30)

    // Act
    const pic = pictureOf(2, p, lineOf(p), 4)

    // Assert: the fourth second, drawn whole
    expect(pic.wave?.stretches[0]).toMatchObject({ from: -3 })
    expect(pic.wave?.upTo).toBeCloseTo(1, 9)
  })

  it('reads the rate that sounds, and stands the ruler on the first full swing top drawn, from the middle', () => {
    // Arrange: six swings a second; the first top at full depth is 0.375 s in
    const p = measure(6, 30)

    // Act
    const early = pictureOf(2, p, lineOf(p), 0.3)
    const pic = pictureOf(2, p, lineOf(p), 0.5)

    // Assert
    expect(early.ruler).toBeNull()
    expect(early.rate).toBe(6)
    expect(pic.ruler).toEqual({
      t: expect.closeTo(0.375, 9) as number,
      from: 0,
      to: expect.closeTo(30, 9) as number,
      text: '',
    })
    expect(pic.extent).toBeCloseTo(30, 9)
  })

  it('moves the ruler to a new extent once a swing of it is drawn, and the counter to the new rate at once', () => {
    // Arrange: Extent doubled 1.5 s in
    const p = measure(6, 30)
    const line = retune(lineOf(p), 1.5, { rate: 6, extent: 60 })

    // Act
    const before = pictureOf(2, p, line, 1.53)
    const after = pictureOf(2, p, line, 1.8)

    // Assert
    expect(before.extent).toBeCloseTo(30, 9)
    expect(after.extent).toBeCloseTo(60, 9)
    expect(after.rate).toBe(6)
  })

  it('counts the swing tops passed, on across a change of rate', () => {
    // Arrange: six a second for the first second, then eight
    const p = measure(6, 30)
    const line = retune(lineOf(p), 1 - 0.025, { rate: 8, extent: 30 })

    // Assert: six tops in the first second, then eight more in the next
    expect(peaksBy(line, 0.99)).toBe(6)
    expect(peaksBy(line, 1.99)).toBe(14)
  })
})

describe("Step 3's middle", () => {
  it('dashes the middle as far as the play has gone, across 3.5 s', () => {
    // Act
    const pic = pictureOf(3, TWO, lineOf(TWO), 1.5)

    // Assert
    expect(WINDOW[3]).toBe(3.5)
    expect(pic.middle).toEqual({
      points: [
        { t: 0, c: 0 },
        { t: 3, c: 0 },
      ],
      tone: 'merc',
      share: 0.5,
    })
  })
})

describe('stills and reduced motion', () => {
  it("shows the band alone in Step 1, and each other state's play whole", () => {
    // Act
    const two = stillOf(2, SETTINGS)
    const three = stillOf(3, { ...SETTINGS, rate3: 4 })
    const four = stillOf(4, SETTINGS)

    // Assert
    expect(stillOf(1, SETTINGS)).toEqual(BLANK)
    expect(two.wave?.upTo).toBe(1)
    expect(two.ruler?.t).toBeCloseTo(1 / 24, 9)
    expect(two.rate).toBe(6)
    expect(two.extent).toBe(30)
    expect(three.wave?.stretches[0]).toMatchObject({ rate: 4, extent: 50 })
    expect(three.middle?.share).toBe(1)
    expect(four.wave?.upTo).toBe(SUNG.sec)
    expect(four.level).toEqual([])
  })

  it('lands a line whole as its play starts, and the sweep the second it is in', () => {
    // Arrange
    const p = measure(6, 30)

    // Act
    const wave = pictureOf(1, WAVE, lineOf(WAVE), 0.2, true)
    const sweep = pictureOf(2, p, lineOf(p), 1.2, true)

    // Assert
    expect(wave.wave?.upTo).toBe(3)
    expect(sweep.wave?.upTo).toBe(1)
    expect(sweep.wave?.stretches[0]).toMatchObject({ from: -1 })
  })
})

describe('the ruler', () => {
  it("stands on a swing's top, the line's highest point there", () => {
    // Arrange
    const line = [
      { kind: 'wave' as const, from: 0, to: 1, rate: 5, extent: 40, growIn: 0 },
    ]

    // Act
    const r = rulerOf(line, 1, 1)

    // Assert
    expect(r?.t).toBeCloseTo(0.05, 9)
    expect(r?.to).toBeCloseTo(centsOn(line[0], 0.05), 9)
    expect(r?.to).toBeCloseTo(40, 9)
  })
})

describe('a play drawn on a figure of its own (the hero, the words)', () => {
  it('reaches as far as it has sounded, where it ended once it has, and whole under reduced motion', () => {
    // Arrange: a 3.0 s play started at 10 s
    const d = { sec: 3, t0: 10, ended: null }

    // Assert
    expect(drawnTo(d, 11.2, false)).toBeCloseTo(1.2, 9)
    expect(drawnTo(d, 14, false)).toBe(3)
    expect(drawnTo({ ...d, ended: 1.5 }, 14, false)).toBe(1.5)
    expect(drawnTo(d, 10, true)).toBe(3)
  })
})
