// ============================================================
// Ear Lab sung-degree classification — octave folding, the wrap
// at the tonic, scoop tolerance, and the refusal cases.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { SungFrame } from './degree-detect'
import { detectSungDegree, MIN_VOICED_FRAMES } from './degree-detect'

const ROOT = 57 // A3

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** Frames of a steadily held pitch, in cents relative to a midi. */
function held(
  midi: number,
  centsOff: number,
  frames = 20,
  conf = 0.9,
): SungFrame[] {
  return Array.from({ length: frames }, () => ({
    f0: midiToFreq(midi + centsOff / 100),
    conf,
  }))
}

describe('detectSungDegree', () => {
  it('names a cleanly sung degree with its intonation error', () => {
    // Sol (degree 5, +7 semitones), sung 20 cents sharp.
    const result = detectSungDegree(held(ROOT + 7, 20), ROOT)
    expect(result?.degree.degree).toBe(5)
    expect(result?.centsOff).toBeGreaterThan(10)
    expect(result?.centsOff).toBeLessThan(30)
  })

  it('folds octaves: Sol sung an octave down is still Sol', () => {
    const below = detectSungDegree(held(ROOT + 7 - 12, 0), ROOT)
    const above = detectSungDegree(held(ROOT + 7 + 12, -15), ROOT)
    expect(below?.degree.degree).toBe(5)
    expect(above?.degree.degree).toBe(5)
    expect(above?.centsOff).toBeLessThan(0)
  })

  it('does not wrap a flat tonic around into Ti', () => {
    // Do sung 40 cents flat sits at rel 11.6 — circular distance must
    // read it as Do −40¢, not an impossibly sharp Ti.
    const result = detectSungDegree(held(ROOT, -40), ROOT)
    expect(result?.degree.degree).toBe(1)
    expect(result?.centsOff).toBeGreaterThan(-50)
    expect(result?.centsOff).toBeLessThan(-30)
  })

  it('survives a scooped onset by classifying the settled pitch', () => {
    // A third of the window scoops up from a semitone below, then the
    // note settles on Mi dead centre.
    const scoop = held(ROOT + 3, 0, 7)
    const settle = held(ROOT + 4, 5, 14)
    const result = detectSungDegree([...scoop, ...settle], ROOT)
    expect(result?.degree.degree).toBe(3)
    expect(Math.abs(result?.centsOff ?? 99)).toBeLessThan(15)
  })

  it('refuses a chromatic in-between rather than guessing', () => {
    // A pitch dead between Do and Re (Ra, 100¢ from both) is
    // nobody's diatonic answer.
    expect(detectSungDegree(held(ROOT + 1, 0), ROOT)).toBeNull()
  })

  it('accepts a badly sharp note as the nearest degree, with the error', () => {
    // 50¢ sharp of Fa still reads as Fa — that is the ear-vs-voice
    // split working: right degree, rough intonation.
    const result = detectSungDegree(held(ROOT + 5.5, 0), ROOT)
    expect(result?.degree.degree).toBe(4)
    expect(result?.centsOff).toBeGreaterThan(40)
  })

  it('refuses too little voicing (a cough is not an answer)', () => {
    expect(
      detectSungDegree(held(ROOT + 7, 0, MIN_VOICED_FRAMES - 1), ROOT),
    ).toBeNull()
  })

  it('refuses low-confidence frames', () => {
    expect(detectSungDegree(held(ROOT + 7, 0, 20, 0.2), ROOT)).toBeNull()
  })

  it('ignores unvoiced gaps mixed into the window', () => {
    const silence: SungFrame[] = Array.from({ length: 10 }, () => ({
      f0: 0,
      conf: 0,
    }))
    const result = detectSungDegree(
      [...silence, ...held(ROOT + 9, -10), ...silence],
      ROOT,
    )
    expect(result?.degree.degree).toBe(6)
  })

  it('classifies against the roved root, not absolute pitch', () => {
    // The same sung note is Sol in one key and Do in another.
    const sung = held(60, 0)
    expect(detectSungDegree(sung, 53)?.degree.degree).toBe(5)
    expect(detectSungDegree(sung, 60)?.degree.degree).toBe(1)
  })
})
