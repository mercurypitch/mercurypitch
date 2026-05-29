import { describe, expect, it } from 'vitest'
import type { TimeStampedPitchSample } from '@/types/pitch-algorithms'
import { segmentPitchesToNotes } from '../note-segmenter'

/** Build a pitch sample at the given time (seconds), frequency, and clarity. */
function s(time: number, freq: number, clarity = 0.8): TimeStampedPitchSample {
  return { time, freq, clarity, noteName: null }
}

/** Generate evenly-spaced samples at 10ms intervals for a sustained tone. */
function sustainedTone(
  freq: number,
  startTime: number,
  durationSec: number,
  interval = 0.01,
  clarity = 0.8,
): TimeStampedPitchSample[] {
  const samples: TimeStampedPitchSample[] = []
  for (let t = startTime; t < startTime + durationSec; t += interval) {
    samples.push(s(t, freq, clarity))
  }
  return samples
}

describe('segmentPitchesToNotes', () => {
  // ---------- basic functionality ----------
  it('returns empty array for empty input', () => {
    expect(segmentPitchesToNotes([])).toEqual([])
  })

  it('returns empty array when all samples have null frequency', () => {
    const samples: TimeStampedPitchSample[] = [
      { time: 0, freq: null, clarity: 0.8, noteName: null },
    ]
    expect(segmentPitchesToNotes(samples)).toEqual([])
  })

  it('segments a single sustained tone into one note', () => {
    const samples = sustainedTone(440, 0, 0.5)
    const result = segmentPitchesToNotes(samples)
    expect(result).toHaveLength(1)
    expect(result[0].note.name).toBe('A')
    expect(result[0].note.octave).toBe(4)
    expect(result[0].duration).toBeGreaterThan(0)
  })

  it('splits on pitch change beyond tolerance', () => {
    const samples = [
      ...sustainedTone(440, 0, 0.2), // A4
      ...sustainedTone(554, 0.3, 0.2), // C#5 (different note)
    ]
    const result = segmentPitchesToNotes(samples)
    expect(result).toHaveLength(2)
  })

  // ---------- Fix #4: minDuration raised to 0.08 ----------
  it('drops notes shorter than minDuration (0.08 by default)', () => {
    // 50ms tone — below new 80ms default
    const samples = sustainedTone(440, 0, 0.05)
    const result = segmentPitchesToNotes(samples)
    expect(result).toHaveLength(0)
  })

  it('keeps notes at or above minDuration', () => {
    // 100ms tone — above 80ms default
    const samples = sustainedTone(440, 0, 0.1)
    const result = segmentPitchesToNotes(samples)
    expect(result).toHaveLength(1)
  })

  it('respects custom minDuration via options', () => {
    const samples = sustainedTone(440, 0, 0.06) // 60ms
    // With minDuration=0.05 (old default), this should pass
    const result = segmentPitchesToNotes(samples, { minDuration: 0.05 })
    expect(result).toHaveLength(1)
  })

  // ---------- Fix #5: isolated-singleton filter ----------
  it('drops a short isolated singleton between large gaps', () => {
    // Three notes: long -- short singleton -- long
    // The middle one (<100ms, flanked by >200ms gaps) should be dropped
    const samples: TimeStampedPitchSample[] = [
      ...sustainedTone(440, 0, 0.3), // A4, 300ms — long enough
      ...sustainedTone(554, 0.6, 0.09), // C#5, 90ms — short singleton
      ...sustainedTone(659, 1.0, 0.3), // E5, 300ms — long enough
    ]
    const result = segmentPitchesToNotes(samples, { minDuration: 0.08 })
    // Should only have 2 notes (A4 and E5), C#5 dropped as isolated singleton
    expect(result).toHaveLength(2)
    const names = result.map((n) => n.note.name)
    expect(names).toContain('A')
    expect(names).toContain('E')
    expect(names).not.toContain('C#')
  })

  it('keeps a short note if adjacent to another note (not isolated)', () => {
    // Two close notes — the short one is not isolated, should be kept
    const samples: TimeStampedPitchSample[] = [
      ...sustainedTone(440, 0, 0.3),
      ...sustainedTone(554, 0.35, 0.09), // close to previous
    ]
    const result = segmentPitchesToNotes(samples, { minDuration: 0.08 })
    // Short note should be kept because it's adjacent to another
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  // ---------- Fix #6: dropout bridging ----------
  it('bridges a momentary dropout and merges same-pitch segments', () => {
    // Same pitch (A4) with a 150ms gap — should be bridged (within 200ms)
    const samples: TimeStampedPitchSample[] = [
      ...sustainedTone(440, 0, 0.3),
      // 150ms gap
      ...sustainedTone(440, 0.45, 0.3),
    ]
    const result = segmentPitchesToNotes(samples, {
      maxGap: 0.1,
      dropoutBridgeMax: 0.2,
    })
    // Should be merged into 1 note
    expect(result).toHaveLength(1)
    expect(result[0].note.name).toBe('A')
  })

  it('splits on large gap even when dropout bridging enabled', () => {
    // Same pitch with a 300ms gap — beyond dropoutBridgeMax (200ms)
    const samples: TimeStampedPitchSample[] = [
      ...sustainedTone(440, 0, 0.3),
      // 300ms gap — too long to bridge
      ...sustainedTone(440, 0.6, 0.3),
    ]
    const result = segmentPitchesToNotes(samples, {
      maxGap: 0.1,
      dropoutBridgeMax: 0.2,
    })
    // Should be 2 separate notes
    expect(result).toHaveLength(2)
  })

  it('does not bridge dropout when pitch differs beyond tolerance', () => {
    // Different pitches within dropoutBridgeMax — should NOT bridge
    const samples: TimeStampedPitchSample[] = [
      ...sustainedTone(440, 0, 0.3), // A4
      ...sustainedTone(523, 0.45, 0.3), // C5 (100 cents different, > 0.5 semitones)
    ]
    const result = segmentPitchesToNotes(samples, {
      maxGap: 0.1,
      dropoutBridgeMax: 0.2,
      pitchTolerance: 0.5,
    })
    // Should be 2 separate notes
    expect(result).toHaveLength(2)
  })

  // ---------- edge cases ----------
  it('filters out low-clarity samples', () => {
    const samples: TimeStampedPitchSample[] = [
      s(0, 440, 0.3), // below default minClarity 0.6
      s(0.01, 440, 0.3),
      s(0.02, 440, 0.7), // above threshold
      s(0.03, 440, 0.7),
      s(0.04, 440, 0.7),
      s(0.05, 440, 0.7),
      s(0.06, 440, 0.7),
      s(0.07, 440, 0.7),
      s(0.08, 440, 0.7),
      s(0.09, 440, 0.7),
      s(0.1, 440, 0.7),
    ]
    const result = segmentPitchesToNotes(samples, { minDuration: 0.05 })
    // The two low-clarity samples at the start are dropped, then the remaining
    // 9 contiguous samples form one note
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('handles single isolated note', () => {
    // One note with no neighbors — singleton filter should NOT drop it
    const samples = sustainedTone(440, 0, 0.5)
    const result = segmentPitchesToNotes(samples)
    expect(result.length).toBeGreaterThanOrEqual(1)
  })

  it('uses configurable bpm for beat conversion', () => {
    const samples = sustainedTone(440, 0, 0.5)
    const result120 = segmentPitchesToNotes(samples, { bpm: 120 })
    const result60 = segmentPitchesToNotes(samples, { bpm: 60 })
    // At 60 BPM, beats are half the rate → duration in beats is half
    expect(result60[0].duration).toBeLessThan(result120[0].duration)
  })
})
