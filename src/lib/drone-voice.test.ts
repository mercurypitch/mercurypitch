// ============================================================
// The drone's partials: harmonics up to the eighth, at a tone's loudness
// ============================================================

import { describe, expect, it } from 'vitest'
import { DRONE_HARMONICS, DRONE_PARTIALS, droneLevel, droneWaveRms, droneWaveTerms, } from './drone-voice'

describe("the drone's partials", () => {
  it('carries every harmonic up to the sixth and beyond, none silent', () => {
    // A sung fifth meets the drone's third harmonic, a major third its
    // fifth, a minor third its sixth (6:5): all must be there to beat.
    expect(DRONE_HARMONICS).toBeGreaterThanOrEqual(6)
    expect(DRONE_PARTIALS.slice(0, 6).every((level) => level > 0)).toBe(true)
  })

  it("is Merc's ooh, harmonic for harmonic, falling as it climbs", () => {
    expect(DRONE_PARTIALS).toEqual([
      1, 0.62, 0.38, 0.24, 0.14, 0.08, 0.045, 0.025,
    ])
    DRONE_PARTIALS.slice(1).forEach((level, i) =>
      expect(level).toBeLessThan(DRONE_PARTIALS[i]),
    )
  })

  it("keeps the fifth's and the third's meeting harmonics within 18 dB of the first", () => {
    const db = (level: number) => 20 * Math.log10(level)
    expect(db(DRONE_PARTIALS[2])).toBeCloseTo(-8.4, 1)
    expect(db(DRONE_PARTIALS[4])).toBeCloseTo(-17.1, 1)
  })

  it('gives Web Audio sine terms only, the nth harmonic at index n', () => {
    const { real, imag } = droneWaveTerms()

    expect(real).toHaveLength(DRONE_HARMONICS + 1)
    expect(Array.from(real).every((term) => term === 0)).toBe(true)
    expect(imag[0]).toBe(0)
    expect(Array.from(imag.slice(1))).toEqual(
      DRONE_PARTIALS.map((level) => Math.fround(level)),
    )
  })

  it("sounds at the loudness of the engine's sine at the same setting", () => {
    // The normalised wave's RMS, scaled by the level, matches a sine of
    // peak 0.7, whose RMS is 0.7 / sqrt(2).
    expect(droneLevel(0.7) * droneWaveRms()).toBeCloseTo(0.7 * Math.SQRT1_2, 9)
    // A wave with harmonics peaks higher for its RMS than a sine does.
    expect(droneWaveRms()).toBeLessThan(Math.SQRT1_2)
  })
})
