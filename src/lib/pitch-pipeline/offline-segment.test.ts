import { describe, expect, it } from 'vitest'
import { midiFloatToFreq } from './log-pitch'
import type { OfflineSegmentSecondsFrame, RawPitchFrame, } from './offline-segment'
import { segmentContourToMelody, segmentSecondsContourToMelody, } from './offline-segment'

/** Build frames at 100 fps (bpm 120 => 0.02 beats/frame) holding a pitch. */
function hold(
  midi: number | null,
  n: number,
  startIdx: number,
): RawPitchFrame[] {
  return Array.from({ length: n }, (_, k) => {
    const i = startIdx + k
    return {
      beat: i * 0.02,
      timeSec: i * 0.01,
      freq: midi === null ? null : midiFloatToFreq(midi),
      clarity: midi === null ? 0 : 0.9,
    }
  })
}

const OPTS = { bpm: 120, key: 'C', scaleType: 'major' }

describe('segmentContourToMelody', () => {
  it('returns nothing for an empty contour', () => {
    expect(segmentContourToMelody([], { ...OPTS, cleanupAmount: 0.5 })).toEqual(
      [],
    )
  })

  it('at amount 0 reproduces the live result (no key-snap, no quantize)', () => {
    // A slightly-sharp A3 (57.6) rounds to A#3 (58), which is off-scale in C.
    const frames = [...hold(57.6, 40, 0), ...hold(null, 12, 40)]
    const notes = segmentContourToMelody(frames, { ...OPTS, cleanupAmount: 0 })
    expect(notes.length).toBe(1)
    expect(notes[0].note.midi).toBe(58) // left as the accidental — not snapped
  })

  it('at amount 1 snaps a sharp accidental into the key', () => {
    const frames = [...hold(57.6, 40, 0), ...hold(null, 12, 40)]
    const notes = segmentContourToMelody(frames, { ...OPTS, cleanupAmount: 1 })
    expect(notes.length).toBe(1)
    expect(notes[0].note.midi).toBe(57) // A3, the nearest in-key degree
  })

  it('leaves an in-key note alone at every cleanup level', () => {
    const frames = [...hold(60, 40, 0), ...hold(null, 12, 40)] // C4
    for (const amount of [0, 0.5, 1]) {
      const notes = segmentContourToMelody(frames, {
        ...OPTS,
        cleanupAmount: amount,
      })
      expect(notes.map((n) => n.note.midi)).toEqual([60])
    }
  })

  it('quantizes the onset toward the grid as amount increases', () => {
    // Start the note off-grid at beat ~0.26 (13 frames * 0.02).
    const frames = [...hold(60, 40, 13), ...hold(null, 12, 53)]
    const raw = segmentContourToMelody(frames, { ...OPTS, cleanupAmount: 0 })
    const clean = segmentContourToMelody(frames, { ...OPTS, cleanupAmount: 1 })
    // Strong cleanup pulls the onset closer to a grid line (0 or 0.5).
    const gridDist = (b: number) => Math.abs(b - Math.round(b / 0.5) * 0.5)
    expect(gridDist(clean[0].startBeat)).toBeLessThan(
      gridDist(raw[0].startBeat),
    )
  })

  it('merges a spurious accidental blip between two in-key notes at high amount', () => {
    // A3, a brief sharp blip that snaps back to A3, then A3 again.
    const frames = [
      ...hold(57, 20, 0),
      ...hold(57.6, 6, 20), // blip that rounds to A#3 but snaps to A3
      ...hold(57, 20, 26),
      ...hold(null, 12, 46),
    ]
    const clean = segmentContourToMelody(frames, { ...OPTS, cleanupAmount: 1 })
    expect(clean.every((n) => n.note.midi === 57)).toBe(true)
    // The three same-pitch segments collapse to a single sustained A3.
    expect(clean.length).toBe(1)
  })
})

describe('segmentSecondsContourToMelody', () => {
  /** Seconds-native frames at a coarse 100ms hop (stem-mixer style). */
  function holdSec(
    midi: number | null,
    n: number,
    startIdx: number,
    stepSec = 0.1,
  ): OfflineSegmentSecondsFrame[] {
    return Array.from({ length: n }, (_, k) => ({
      timeSec: (startIdx + k) * stepSec,
      freq: midi === null ? null : midiFloatToFreq(midi),
      clarity: midi === null ? 0 : 0.9,
    }))
  }

  // Coarse-hop tuning: thresholds in frames must shrink for 100ms steps.
  const COARSE = {
    pipeline: {
      note: { debounceFrames: 1, offsetFrames: 2, minHoldSec: 0.1 },
      octave: { confirmFrames: 2 },
    },
  }

  it('segments a seconds contour and maps time to beats via bpm', () => {
    const frames = [...holdSec(57, 8, 0), ...holdSec(null, 4, 8)]
    const notes = segmentSecondsContourToMelody(frames, {
      bpm: 120,
      key: 'C',
      scaleType: 'major',
      cleanupAmount: 0,
      ...COARSE,
    })
    expect(notes.length).toBe(1)
    expect(notes[0].note.midi).toBe(57)
    // 120 bpm => 2 beats/sec; the note starts at ~t=0.
    expect(notes[0].startBeat).toBeLessThan(0.5)
  })

  it('key-snaps an accidental at full cleanup', () => {
    const frames = [...holdSec(57.6, 8, 0), ...holdSec(null, 4, 8)]
    const raw = segmentSecondsContourToMelody(frames, {
      bpm: 120,
      key: 'C',
      scaleType: 'major',
      cleanupAmount: 0,
      ...COARSE,
    })
    const clean = segmentSecondsContourToMelody(frames, {
      bpm: 120,
      key: 'C',
      scaleType: 'major',
      cleanupAmount: 1,
      ...COARSE,
    })
    expect(raw[0].note.midi).toBe(58) // A#3, off-scale
    expect(clean[0].note.midi).toBe(57) // snapped to A3
  })
})
