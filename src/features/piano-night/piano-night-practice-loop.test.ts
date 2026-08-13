// ============================================================
// Piano Night practice loop tests — zero-safe ranges and bounded passes
// ============================================================

import { describe, expect, it } from 'vitest'
import { clampPianoNightMasterVolume, clampPianoNightRepeatCount, isBeatInPianoNightPracticeRange, isPianoNightPracticeSpeed, normalizePianoNightPracticeRange, pianoNightPracticeRangeProgress, } from './piano-night-practice-loop'

describe('Piano Night practice loop', () => {
  it('keeps beat zero as a valid start and clamps the end to the piece', () => {
    expect(
      normalizePianoNightPracticeRange({ startBeat: 0, endBeat: 18 }, 16),
    ).toEqual({ startBeat: 0, endBeat: 16 })
  })

  it('rejects invalid and stutter-short ranges', () => {
    expect(
      normalizePianoNightPracticeRange({ startBeat: 4, endBeat: 4.249 }, 16),
    ).toBeNull()
    expect(
      normalizePianoNightPracticeRange(
        { startBeat: Number.NaN, endBeat: 8 },
        16,
      ),
    ).toBeNull()
  })

  it('uses half-open boundaries and bounded one-based progress', () => {
    const range = { startBeat: 4, endBeat: 8 }
    expect(isBeatInPianoNightPracticeRange(4, range)).toBe(true)
    expect(isBeatInPianoNightPracticeRange(8, range)).toBe(false)
    expect(pianoNightPracticeRangeProgress(2, range)).toBe(0)
    expect(pianoNightPracticeRangeProgress(6, range)).toBe(0.5)
    expect(pianoNightPracticeRangeProgress(10, range)).toBe(1)
  })

  it('clamps repeat counts to the legacy Piano practice range', () => {
    expect(clampPianoNightRepeatCount(1)).toBe(2)
    expect(clampPianoNightRepeatCount(7.6)).toBe(8)
    expect(clampPianoNightRepeatCount(101)).toBe(100)
    expect(clampPianoNightRepeatCount(Number.NaN)).toBe(5)
  })

  it('accepts intentional speed presets and clamps master volume', () => {
    expect(isPianoNightPracticeSpeed(0.75)).toBe(true)
    expect(isPianoNightPracticeSpeed(0.8)).toBe(false)
    expect(clampPianoNightMasterVolume(-1)).toBe(0)
    expect(clampPianoNightMasterVolume(0.64)).toBe(0.64)
    expect(clampPianoNightMasterVolume(4)).toBe(1)
    expect(clampPianoNightMasterVolume(Number.NaN)).toBe(0.82)
  })
})
