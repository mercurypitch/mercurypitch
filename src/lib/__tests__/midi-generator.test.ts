import { describe, expect, it } from 'vitest'
import { mergeConsecutiveNotes } from '../midi-generator'
import type { PitchDetection } from '../midi-generator'

/** Build a pitch detection at the given time and MIDI value. */
function d(timeSec: number, midi: number, noteName?: string): PitchDetection {
  return {
    midi,
    noteName: noteName ?? `N${midi}`,
    timeSec,
  }
}

/** Generate evenly-spaced detections at 0.1s intervals. */
function sustained(
  midi: number,
  startTime: number,
  count: number,
  step = 0.1,
): PitchDetection[] {
  const dets: PitchDetection[] = []
  for (let i = 0; i < count; i++) {
    dets.push(d(startTime + i * step, midi))
  }
  return dets
}

describe('mergeConsecutiveNotes', () => {
  // ---------- basic merging ----------
  it('returns empty array for empty input', () => {
    expect(mergeConsecutiveNotes([])).toEqual([])
  })

  it('merges consecutive same-pitch detections into one note', () => {
    const dets = sustained(60, 0, 5) // 5 detections of MIDI 60 at 0.1s intervals
    const result = mergeConsecutiveNotes(dets)
    expect(result).toHaveLength(1)
    expect(result[0].midi).toBe(60)
    expect(result[0].startSec).toBe(0)
  })

  it('splits on gap larger than maxGapSec', () => {
    const dets = [
      ...sustained(60, 0, 3),
      ...sustained(60, 0.5, 3), // 0.2s gap from last detection at 0.2s to 0.5s
    ]
    const result = mergeConsecutiveNotes(dets, 0.12) // maxGap=0.12 < 0.2 gap
    expect(result).toHaveLength(2)
  })

  it('drops notes shorter than minDurationSec', () => {
    const dets = sustained(60, 0, 1) // single detection → ~0.1s duration
    const result = mergeConsecutiveNotes(dets, 0.2, 0.08)
    // Single detection: end time = 0 + WINDOW_STEP_SEC (0.1) → duration = 0.1
    // 0.1 >= 0.08 so it should be kept
    expect(result).toHaveLength(1)
  })

  it('drops notes exactly at minDuration boundary correctly', () => {
    // 2 detections at 0.1s intervals → duration = 0.1 + 0.1 = 0.2s
    const dets = sustained(60, 0, 2)
    // minDuration = 0.25 → should be dropped
    const result = mergeConsecutiveNotes(dets, 0.2, 0.25)
    expect(result).toHaveLength(0)
  })

  // ---------- Fix #7: tolerance-based merging ----------
  it('merges adjacent MIDI values (±1) into one note', () => {
    // Alternating MIDI 60 and 61 — should merge into one note
    const dets: PitchDetection[] = [
      d(0, 60),
      d(0.1, 61),
      d(0.2, 60),
      d(0.3, 61),
      d(0.4, 60),
    ]
    const result = mergeConsecutiveNotes(dets)
    expect(result).toHaveLength(1)
    // The averaged MIDI should be 60 or 61 (rounds to whichever is more frequent)
    expect(Math.abs(result[0].midi - 60)).toBeLessThanOrEqual(1)
  })

  it('splits when MIDI difference is > 1', () => {
    const dets: PitchDetection[] = [
      ...sustained(60, 0, 3), // MIDI 60
      ...sustained(62, 0.35, 3), // MIDI 62 — 2 semitones away
    ]
    const result = mergeConsecutiveNotes(dets)
    expect(result).toHaveLength(2)
    expect(result[0].midi).toBe(60)
    expect(result[1].midi).toBe(62)
  })

  it('splits on MIDI diff > 1 even with small gap', () => {
    const dets: PitchDetection[] = [
      d(0, 60),
      d(0.05, 62), // only 0.05s gap but 2 semitones apart
      d(0.1, 60),
    ]
    const result = mergeConsecutiveNotes(dets, 0.2)
    expect(result).toHaveLength(3)
  })

  it('averages MIDI within merged tolerance groups', () => {
    // 3 × MIDI 60 + 2 × MIDI 59 → average = (180+118)/5 = 59.6 → rounds to 60
    const dets: PitchDetection[] = [
      d(0, 60),
      d(0.1, 59),
      d(0.2, 60),
      d(0.3, 59),
      d(0.4, 60),
    ]
    const result = mergeConsecutiveNotes(dets)
    expect(result).toHaveLength(1)
    expect(result[0].midi).toBe(60) // avg ≈ 59.6 → rounds to 60
  })

  it('noteName reflects the averaged MIDI', () => {
    const dets: PitchDetection[] = [
      d(0, 60, 'C4'),
      d(0.1, 60, 'C4'),
      d(0.2, 60, 'C4'),
    ]
    const result = mergeConsecutiveNotes(dets)
    expect(result).toHaveLength(1)
    // The noteName should be computed from midiToNote(60) → C4
    expect(result[0].noteName).toBe('C4')
  })

  it('handles single detection', () => {
    const dets = [d(0, 60, 'C4')]
    const result = mergeConsecutiveNotes(dets)
    expect(result).toHaveLength(1)
    expect(result[0].midi).toBe(60)
    expect(result[0].noteName).toBe('C4')
  })

  it('merges all same-pitch notes in a long sequence', () => {
    const dets = sustained(72, 0, 20, 0.05) // 20 detections, 50ms apart → ~1.0s
    const result = mergeConsecutiveNotes(dets, 0.1)
    expect(result).toHaveLength(1)
    expect(result[0].midi).toBe(72)
  })

  it('splits three different notes correctly with tolerance', () => {
    const dets: PitchDetection[] = [
      ...sustained(60, 0, 3),
      // MIDI 61 is within tolerance of 60, but this gap is large enough to split
      ...sustained(67, 0.5, 3),
      ...sustained(72, 1.0, 3),
    ]
    const result = mergeConsecutiveNotes(dets)
    expect(result).toHaveLength(3)
  })
})
