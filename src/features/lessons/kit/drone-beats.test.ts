// ============================================================
// Drone beats tests — the rates, the slide, the phases and the wave
// ============================================================
//
// Lesson 24 WEB-SPEC, Tests 1 and 2: the slide's schedule and its rates as
// it glides, and the top note left 12° to 14° from in phase at its end;
// the readout's rate for the piano's fifth and third above every drone the
// page sounds; the pure chord still and the piano's beating; the rate in
// Beat Hunt's words, "still" at none; the brightness swinging at the beat
// rate and holding still in tune; and under Step 4's wave, the envelope of
// E4's second harmonic and the drone's third, over 400 s of the schedule,
// its slow throb at most 40 % of the straight play's, with a flutter at the
// wave's rate and twice it (FACTS 11 to 28, 38, 44).

import { describe, expect, it } from 'vitest'
import type { Brightness } from './drone-beats'
import { beatRate, brightness, chordBeats, chordWords, nearPairs, phaseApart, rateWords, slide, steady, waved, } from './drone-beats'
import { MERC_PARTIALS } from './sound'

const A3 = 220
const SLIDE = slide({ from: 224, to: 220, hold: 1.5, glide: 6, after: 2.5 })

/** A note `semis` equal-tempered semitones above `hz`. */
const up = (hz: number, semis: number): number => hz * 2 ** (semis / 12)

describe("the cold open's slide", () => {
  it('holds 224 Hz for 1.5 s, glides exponentially to 220 over 6 s, holds 220 for 2.5 s: 10 s in all', () => {
    // Assert
    expect(SLIDE.dur).toBe(10)
    expect([SLIDE.hz(0), SLIDE.hz(1.5), SLIDE.hz(7.5), SLIDE.hz(10)]).toEqual([
      224, 224, 220, 220,
    ])
    // exponential: the halfway frequency is the geometric mean
    expect(SLIDE.hz(4.5)).toBeCloseTo(Math.sqrt(224 * 220), 9)
  })

  it('beats 4.00, 2.99, 1.99, 0.99 and 0 times a second at 0, 1.5, 3, 4.5 and 6 s into the glide', () => {
    // Act
    const rates = [0, 1.5, 3, 4.5, 6].map(
      (s) => Math.round((beatRate(SLIDE.hz(1.5 + s), A3) ?? 0) * 100) / 100,
    )

    // Assert: FACTS 44
    expect(rates).toEqual([4, 2.99, 1.99, 0.99, 0])
  })

  it('leaves the top note 12° to 14° from in phase with the drone at its end, the two started on one audio time', () => {
    // Act
    const apart = phaseApart(SLIDE, steady(A3, 10), 10)

    // Assert: 17.96 beats in all (FACTS 44)
    expect(apart).toBeGreaterThanOrEqual(12)
    expect(apart).toBeLessThanOrEqual(14)
  })
})

describe("the readout's rate", () => {
  it("is the gap of the ratio each interval nears: the piano's fifth and third above every drone the page sounds", () => {
    // Arrange: A3 for the steps, D3 and D4 for Sing it, G3 and G4 at Move do's highest
    const drones = [
      [A3, 0.745, 8.731],
      [146.83, 0.497, 5.827],
      [293.66, 0.994, 11.654],
      [196, 0.664, 7.778],
      [392, 1.327, 15.556],
    ] as const

    // Assert: FACTS 19, 20, 27
    for (const [drone, fifth, third] of drones) {
      expect(beatRate(up(drone, 7), drone)).toBeCloseTo(fifth, 2)
      expect(beatRate(up(drone, 4), drone)).toBeCloseTo(third, 2)
    }
  })

  it("is the difference for close notes, and the gap to the drone's second harmonic for the octave", () => {
    // Assert: FACTS 11, 15
    expect(beatRate(222, A3)).toBeCloseTo(2, 9)
    expect(beatRate(220.5, A3)).toBeCloseTo(0.5, 9)
    expect(beatRate(441, A3)).toBeCloseTo(1, 9)
    expect(beatRate(448, A3)).toBeCloseTo(8, 9)
  })

  it('says the rate in Beat Hunt\'s words, and "still" at none', () => {
    // Assert: FACTS 28
    expect(rateWords(beatRate(222, A3))).toBe('2 beats a second')
    expect(rateWords(beatRate(220.5, A3))).toBe('a beat every 2 s')
    expect(rateWords(beatRate(220, A3))).toBe('still')
    expect(rateWords(beatRate(330, A3))).toBe('still')
    expect(rateWords(null)).toBe('still')
  })
})

describe('chords', () => {
  it('holds the pure chord still: no two of its harmonics under 20 Hz apart but those that meet exactly', () => {
    // Assert: FACTS 21
    expect(chordBeats([220, 275, 330])).toBe(false)
    expect(chordWords([220, 275, 330])).toBe('still')
  })

  it("beats in the piano's chord", () => {
    // Assert
    expect(chordBeats([A3, up(A3, 4), up(A3, 7)])).toBe(true)
    expect(chordWords([A3, up(A3, 4), up(A3, 7)])).toBe('beating')
  })

  it("finds the piano's chord's pairs FACTS 21 names: do and mi at 8.73, do and so at 0.75 and 1.49, mi and so at 14.96", () => {
    // Act
    const gaps = (top: number, low: number): number[] =>
      nearPairs(top, low).map((p) => p.gap)

    // Assert
    expect(gaps(up(A3, 4), A3)).toEqual([expect.closeTo(8.731, 3)])
    expect(gaps(up(A3, 7), A3)).toEqual([
      expect.closeTo(0.745, 3),
      expect.closeTo(1.49, 2),
    ])
    expect(gaps(up(A3, 7), up(A3, 4))).toEqual([expect.closeTo(14.96, 2)])
  })
})

describe('the brightness', () => {
  it('swings at the beat rate: bright in phase, dark half a beat later, the same a beat on', () => {
    // Arrange: 222 against 220, the fundamentals 2 Hz apart, their harmonics 4 to 16 Hz
    const pair = [steady(A3, 3), steady(222, 3)]
    const at = (t: number): Brightness => brightness(pair, t)

    // Assert: the fundamentals' pair is the slow part, the harmonics' the fast
    expect(at(0).slow).toBeCloseTo(1, 9)
    expect(at(0).fast).toBeCloseTo(1, 9)
    expect(at(0.25).slow).toBeCloseTo(0, 9)
    expect(at(0.5).slow).toBeCloseTo(1, 9)
    for (const t of [0.1, 0.37, 0.8]) {
      expect(at(t + 0.5).slow).toBeCloseTo(at(t).slow ?? NaN, 9)
      expect(at(t + 0.5).fast).toBeCloseTo(at(t).fast ?? NaN, 9)
    }
  })

  it("draws the hero's four beats a second as the fast part alone", () => {
    // Arrange: 224 against 220, every pair 4 Hz or more apart
    const pair = [steady(A3, 3), steady(224, 3)]

    // Assert
    expect(brightness(pair, 0.1).slow).toBeNull()
    expect(brightness(pair, 0).fast).toBeCloseTo(1, 9)
    expect(brightness(pair, 0.125).fast).toBeLessThan(0.5)
  })

  it('holds still in tune: a pure fifth, a unison and the pure chord', () => {
    // Arrange
    const plays = [
      [steady(A3, 4), steady(330, 4)],
      [steady(A3, 4), steady(A3, 4)],
      [steady(A3, 4), steady(275, 4), steady(330, 4)],
    ]

    // Assert
    for (const play of plays) {
      const values = [0, 0.37, 1.1, 2.9].map((t) => brightness(play, t))
      for (const v of values) {
        expect(v.fast).toBeNull()
        expect(v.slow).toBeCloseTo(values[0].slow ?? NaN, 9)
      }
    }
  })

  it("keeps a waved note's pair in the slow part however far the wave swings it", () => {
    // Arrange: Step 4's wave on the piano's fifth, whose second harmonic swings 19 Hz either side
    const play = [
      steady(A3, 4),
      waved(up(A3, 7), 4, { rate: 6, extent: 50, growIn: 0.3 }),
    ]

    // Assert: at the swing's top and bottom, and between
    for (const t of [1 + 1 / 24, 1 + 3 / 24, 1.5, 2.2]) {
      const b = brightness(play, t)
      expect(b.slow).not.toBeNull()
      expect(b.fast).toBeNull()
    }
  })

  it('has neither part when nothing pairs: the drone alone', () => {
    expect(brightness([steady(A3, 3)], 1)).toEqual({ slow: null, fast: null })
  })
})

describe("Step 4's wave", () => {
  /** The envelope of E4's second harmonic and the drone's third, sampled `rate` times a second over `seconds`. */
  function envelope(
    top: ReturnType<typeof steady>,
    seconds: number,
    rate: number,
  ): Float64Array {
    const a = MERC_PARTIALS[1]
    const b = MERC_PARTIALS[2]
    const out = new Float64Array(Math.round(seconds * rate))
    for (let k = 0; k < out.length; k++) {
      const t = k / rate
      const phase = 2 * Math.PI * (2 * top.cycles(t) - 3 * A3 * t)
      out[k] = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(phase))
    }
    return out
  }

  /** The amplitude of the envelope's component at `f` Hz. */
  function component(x: Float64Array, rate: number, f: number): number {
    let re = 0
    let im = 0
    for (let k = 0; k < x.length; k++) {
      const w = (2 * Math.PI * f * k) / rate
      re += x[k] * Math.cos(w)
      im -= x[k] * Math.sin(w)
    }
    return (2 / x.length) * Math.hypot(re, im)
  }

  /** The strongest component between 0.05 and 2 Hz, and where it is. */
  function slowest(x: Float64Array, rate: number): { f: number; a: number } {
    let best = { f: 0, a: 0 }
    for (let f = 0.05; f < 2; f += 0.0025) {
      const a = component(x, rate, f)
      if (a > best.a) best = { f, a }
    }
    return best
  }

  it("leaves the fifth's slow throb at most 40 % of the straight play's, under a flutter at the wave's rate and twice it", () => {
    // Arrange: the piano's fifth over A3, 400 s of each schedule, sampled 100 times a second
    const RATE = 100
    const E4 = up(A3, 7)
    const straight = envelope(steady(E4, 400), 400, RATE)
    const wave = envelope(
      waved(E4, 400, { rate: 6, extent: 50, growIn: 0.3 }),
      400,
      RATE,
    )

    // Act
    const still = component(straight, RATE, 0.745)
    const slow = slowest(wave, RATE)

    // Assert: FACTS 38, 0.361 straight; with the wave about 0.113 near
    // 0.61 a second, and the flutter beside the wave's rate and twice it,
    // about 0.10 and 0.17, the slow beat's distance either side
    expect(still).toBeCloseTo(0.361, 2)
    expect(slow.f).toBeCloseTo(0.61, 1)
    expect(slow.a).toBeCloseTo(0.113, 2)
    expect(slow.a / still).toBeLessThanOrEqual(0.4)
    expect(component(wave, RATE, 6 + slow.f)).toBeCloseTo(0.1, 1)
    expect(component(wave, RATE, 12 + slow.f)).toBeCloseTo(0.17, 1)
  })

  it('sounds as the kit sounds it: no wave at the start, its full depth from the grow-in, six swings a second', () => {
    // Arrange
    const w = waved(330, 4, { rate: 6, extent: 50, growIn: 0.3 })

    // Assert: phase 0 at the start, 50 cents at the first peak after the grow-in
    expect(w.hz(0)).toBeCloseTo(330, 9)
    expect(1200 * Math.log2(w.hz(1 + 1 / 24) / 330)).toBeCloseTo(50, 6)
    expect(1200 * Math.log2(w.hz(1 + 3 / 24) / 330)).toBeCloseTo(-50, 6)
  })
})
