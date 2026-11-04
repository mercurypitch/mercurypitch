// Merc's vowel model against verify13.py's numbers (Lesson 13 WEB-SPEC,
// Tests 1 to 3; FACTS 37 and 40 to 42, 52, 65 and 67).

import { describe, expect, it } from 'vitest'
import { hz } from '@/features/lessons/kit/notes'
import { VOCAL_RANGES } from '@/stores/settings-store'
import type { VoiceName } from './vowels'
import { harmonicCount, HOME, levelsAt, MEANS, peaksOf, powerFactor, resonatorsBetween, resonatorsOf, response, sourceSegments, vowelFactor, VOWELS, vowelStrip, } from './vowels'

/** Move's reach either side of the voice's A (Lesson 5's MAX_MOVE). */
const MOVE = 4

describe('the vowel model (FACTS 37, 40 to 42)', () => {
  it("holds Deterding's ten sets of means, and every vowel's resonators are its means over 80, 80 and 120 Hz", () => {
    // Act
    const ah = resonatorsOf('lower', 'ah')

    // Assert
    expect(MEANS.lower.ah).toEqual([645.4, 1155.5, 2490.3])
    expect(MEANS.higher.ah).toEqual([909.7, 1316.0, 2840.7])
    expect(MEANS.higher.oo).toEqual([327.8, 1437.1, 2674.1])
    expect(ah.map((r) => r.q)).toEqual([645.4 / 80, 1155.5 / 80, 2490.3 / 120])
  })

  it('draws 18 bars on A3, 9 on A4, 22 on F3 and 7 on C sharp 5', () => {
    // Act
    const counts = [57, 69, 53, 73].map((m) => harmonicCount(hz(m)))

    // Assert
    expect(counts).toEqual([18, 9, 22, 7])
  })

  it('marks the labelled peaks verify13.py gives, in both voices', () => {
    // Act
    const peaks = (voice: VoiceName) =>
      VOWELS.map((v) => vowelStrip(voice, HOME[voice], v).peaks)

    // Assert
    expect(peaks('lower')).toEqual([
      [1, 10],
      [2, 7],
      [3, 5],
      [2, null],
      [1, 5],
    ])
    expect(peaks('higher')).toEqual([
      [1, 6],
      [1, null],
      [2, null],
      [1, null],
      [1, 3],
    ])
  })

  it("lights 'ee' on A3 as 12, 7, 3 and 1, then dark to a lone 3 on the 10th; 'ah' fills its 3rd", () => {
    // Act
    const ee = vowelStrip('lower', 57, 'ee').segments
    const ah = vowelStrip('lower', 57, 'ah').segments

    // Assert
    expect(ee).toEqual([12, 7, 3, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(ah).toEqual([9, 9, 12, 7, 9, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(vowelStrip('higher', 69, 'ah').segments).toEqual([
      7, 12, 11, 1, 0, 0, 0, 0, 0,
    ])
  })

  it('lights the source alone from 12 on the 1st down to 4 on the 18th, never rising', () => {
    // Act
    const src = sourceSegments(18, 18)

    // Assert
    expect(src).toEqual([
      12, 10, 9, 8, 8, 7, 7, 6, 6, 6, 6, 5, 5, 5, 5, 4, 4, 4,
    ])
    expect(sourceSegments(3, 18).slice(0, 4)).toEqual([12, 10, 9, 0])
  })

  it("sets each labelled peak of 'ee' and 'ah' nearest the first or the second resonance", () => {
    for (const v of ['ee', 'ah'] as const) {
      // Arrange
      const [p1, p2] = vowelStrip('lower', 57, v).peaks
      const res = MEANS.lower[v]
      const nearest = (bar: number) =>
        res.reduce(
          (best, f, i) =>
            Math.abs(Math.log((bar * 220) / f)) <
            Math.abs(Math.log((bar * 220) / res[best]))
              ? i
              : best,
          0,
        )

      // Act / Assert
      expect([nearest(p1), nearest(p2 ?? 0)], v).toEqual([0, 1])
    }
  })

  it('gives every vowel the source power, by factors from 0.28 to 0.71 (lower) and 0.11 to 2.64 (higher) over Move', () => {
    for (const [voice, lo, hi] of [
      ['lower', 0.281, 0.71],
      ['higher', 0.109, 2.64],
    ] as const) {
      // Act
      const factors = []
      for (let m = HOME[voice] - MOVE; m <= HOME[voice] + MOVE; m++)
        for (const v of VOWELS) factors.push(vowelFactor(voice, m, v))

      // Assert
      expect(Math.min(...factors), voice).toBeCloseTo(lo, 3)
      expect(Math.max(...factors), voice).toBeCloseTo(hi, 2)
    }
  })

  it('scales a vowel to the power of the unfiltered source', () => {
    // Arrange
    const f0 = 220
    const res = resonatorsOf('lower', 'ah')

    // Act
    const levels = levelsAt(f0, res, powerFactor(f0, res))

    // Assert: unit power, as the source's own against itself
    expect(Math.hypot(...levels)).toBeCloseTo(1, 9)
  })

  it('peaks each resonator at about its Q, and passes the lowest frequencies whole', () => {
    // Arrange
    const r = { hz: 1000, q: 12.5 }

    // Act / Assert
    expect(response(1000, r)).toBeCloseTo(12.5, 9)
    expect(response(1, r)).toBeCloseTo(1, 4)
  })

  it('glides between two vowels with frequencies exponential and Q in decibels linear, landing on each end', () => {
    // Arrange
    const ee = resonatorsOf('lower', 'ee')
    const ah = resonatorsOf('lower', 'ah')

    // Act
    const mid = resonatorsBetween(ee, ah, 0.5)

    // Assert
    for (const [u, end] of [
      [0, ee],
      [1, ah],
    ] as const)
      resonatorsBetween(ee, ah, u).forEach((r, i) => {
        expect(r.hz).toBeCloseTo(end[i].hz, 9)
        expect(r.q).toBeCloseTo(end[i].q, 9)
      })
    expect(mid[0].hz).toBeCloseTo(Math.sqrt(ee[0].hz * ah[0].hz), 9)
    expect(mid[0].q).toBeCloseTo(Math.sqrt(ee[0].q * ah[0].q), 9)
  })

  it('takes the tallest bar first and keeps the earlier of two equal bars', () => {
    // Act / Assert
    expect(peaksOf([3, 3, 0, 2, 0])).toEqual([1, 4])
    expect(peaksOf([5, 2, 2, 2])).toEqual([1, null])
  })
})

describe("the note: the voice's A, moved up to four semitones either way (FACTS 52)", () => {
  it('reaches F3 to C sharp 4 and F4 to C sharp 5', () => {
    // Act
    const reach = (voice: VoiceName) => [HOME[voice] - MOVE, HOME[voice] + MOVE]

    // Assert
    expect(reach('lower')).toEqual([53, 61])
    expect(reach('higher')).toEqual([65, 73])
  })

  it("puts exactly one of A3 and A4 in the middle half of every one of the app's six presets", () => {
    // Arrange
    const presets = Object.values(VOCAL_RANGES)

    // Act
    const homes = presets.map((p) => {
      const quarter = (p.highMidi - p.lowMidi) / 4
      return [HOME.lower, HOME.higher].filter(
        (m) => m >= p.lowMidi + quarter && m <= p.highMidi - quarter,
      )
    })

    // Assert
    expect(presets).toHaveLength(6)
    for (const h of homes) expect(h).toHaveLength(1)
  })
})
