import { describe, expect, it } from 'vitest'
import { LOW_NOTE_FADE_FROM_HZ, LOW_NOTE_FADE_FULL_HZ, lowNoteFade, lowNoteOctaveLevel, lowNotePeakBoost, normalizedFundamental, } from './low-note-reinforcement'

const C3 = 130.81
const D2 = 73.42

describe('the low-note reinforcement curve', () => {
  it('fades in across the span instead of switching on', () => {
    // Monotone across the fade, and clamped at both ends.
    expect(lowNotePeakBoost(C3)).toBe(1)
    expect(lowNotePeakBoost(200)).toBe(1)
    expect(lowNotePeakBoost(100)).toBeGreaterThan(1)
    expect(lowNotePeakBoost(D2)).toBeGreaterThan(lowNotePeakBoost(100))
    expect(lowNotePeakBoost(30)).toBeCloseTo(1.3, 5)
    expect(lowNoteOctaveLevel(C3)).toBe(0)
    expect(lowNoteOctaveLevel(D2)).toBeGreaterThan(0)
    expect(lowNoteOctaveLevel(30)).toBeCloseTo(0.5, 5)
  })

  it('runs from C3 down to B1, linear in between', () => {
    expect(LOW_NOTE_FADE_FROM_HZ).toBe(C3)
    expect(LOW_NOTE_FADE_FULL_HZ).toBe(61.74)
    expect(lowNoteFade(LOW_NOTE_FADE_FULL_HZ)).toBe(1)
    const middle = (LOW_NOTE_FADE_FROM_HZ + LOW_NOTE_FADE_FULL_HZ) / 2
    expect(lowNoteFade(middle)).toBeCloseTo(0.5, 9)
    expect(lowNoteOctaveLevel(middle)).toBeCloseTo(0.25, 9)
  })

  it('scales nothing for a missing or nonsense frequency', () => {
    expect(lowNotePeakBoost(undefined)).toBe(1)
    expect(lowNotePeakBoost(0)).toBe(1)
    expect(lowNoteOctaveLevel(undefined)).toBe(0)
    expect(lowNoteOctaveLevel(Number.NaN)).toBe(0)
    expect(lowNoteOctaveLevel(-50)).toBe(0)
  })
})

describe('normalizedFundamental', () => {
  it('is 1 for a bare sine', () => {
    expect(normalizedFundamental([0, 1])).toBeCloseTo(1, 6)
  })

  it('divides by the peak Web Audio scales the wave to', () => {
    // sin t + 0.5 sin 2t peaks at t = pi/3: sqrt(3)/2 * 1.5.
    expect(normalizedFundamental([0, 1, 0.5])).toBeCloseTo(
      1 / ((Math.sqrt(3) / 2) * 1.5),
      4,
    )
  })

  it('is 0 for a wave with no fundamental or no sound', () => {
    expect(normalizedFundamental([0, 0, 1])).toBe(0)
    expect(normalizedFundamental([0])).toBe(0)
  })
})
