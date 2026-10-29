// ============================================================
// Merc's voice set: the sample and rate for every note it sings
// ============================================================

import { describe, expect, it } from 'vitest'
import { HIGHEST_MIDI, LOWEST_MIDI, MAX_SHIFT, MERC_SAMPLES, sampleFor, } from './merc-voice-set'

const SET = [41, 45, 49, 53, 57, 61, 65, 69, 73, 77]

/** The rule, written out the long way: nearest, a tie to the one above. */
function expected(midi: number): number {
  return [...SET].sort(
    (a, b) => Math.abs(midi - a) - Math.abs(midi - b) || b - a,
  )[0]
}

describe("Merc's voice set", () => {
  it('is ten notes, F2 to F5, a major third apart, each with its own file', () => {
    expect(MERC_SAMPLES.map((sample) => sample.midi)).toEqual(SET)
    const urls = MERC_SAMPLES.map((sample) => sample.url)
    expect(new Set(urls).size).toBe(10)
    for (const [i, url] of urls.entries()) {
      expect(url).toMatch(
        new RegExp(`echo-merc-ooh-${SET[i]}-[A-Za-z0-9]+\\.mp3`),
      )
    }
  })

  it('reaches D#2 to G5, two semitones past either end', () => {
    expect([LOWEST_MIDI, HIGHEST_MIDI]).toEqual([39, 79])
  })

  it('sings every note in reach on its nearest sample, shifted by its rate', () => {
    for (let midi = LOWEST_MIDI; midi <= HIGHEST_MIDI; midi++) {
      const pick = sampleFor(midi)
      const sample = expected(midi)
      expect(pick?.sample.midi, `MIDI ${midi}`).toBe(sample)
      expect(pick?.rate, `MIDI ${midi}`).toBeCloseTo(
        2 ** ((midi - sample) / 12),
        12,
      )
      expect(Math.abs(midi - sample)).toBeLessThanOrEqual(MAX_SHIFT)
    }
  })

  it('gives a tie to the sample above, played slower', () => {
    // B3 lies between A3 and C#4: C#4 at 0.891, as in the audition clip.
    expect(sampleFor(59)?.sample.midi).toBe(61)
    expect(sampleFor(59)?.rate).toBeCloseTo(0.8909, 4)
    expect(sampleFor(43)?.sample.midi).toBe(45)
  })

  it("sings a note between two of A440's where it is, on the nearest sample", () => {
    // A3 a third of a semitone sharp, a song tuned off A440: A3's sample.
    expect(sampleFor(57.35)?.sample.midi).toBe(57)
    expect(sampleFor(57.35)?.rate).toBeCloseTo(2 ** (0.35 / 12), 12)
  })

  it('plays the ends of its reach on the outer samples', () => {
    expect(sampleFor(39)).toMatchObject({ sample: { midi: 41 } })
    expect(sampleFor(39)?.rate).toBeCloseTo(0.8909, 4)
    expect(sampleFor(79)).toMatchObject({ sample: { midi: 77 } })
    expect(sampleFor(79)?.rate).toBeCloseTo(1.1225, 4)
  })

  it('has no sample for a note outside its reach', () => {
    expect(sampleFor(38)).toBeNull()
    expect(sampleFor(80)).toBeNull()
    expect(sampleFor(94)).toBeNull()
  })
})
