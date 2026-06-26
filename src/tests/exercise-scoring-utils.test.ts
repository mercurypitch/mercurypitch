import { describe, expect, it } from 'vitest'
import { freqToExactMidi, trailingSamplesByTime, } from '@/features/exercises/exercise-scoring-utils'

describe('freqToExactMidi', () => {
  it('maps A4 to MIDI 69', () => {
    expect(freqToExactMidi(440)).toBeCloseTo(69, 5)
  })

  it('returns 0 for non-positive frequency', () => {
    expect(freqToExactMidi(0)).toBe(0)
    expect(freqToExactMidi(-10)).toBe(0)
  })
})

describe('trailingSamplesByTime', () => {
  it('selects by elapsed time, not sample count', () => {
    // Non-uniform spacing: a dense burst then a sparse tail. Selecting by a
    // guessed sample count (windowMs / 50) would pick the wrong samples.
    const history = [
      { time: 0.0 },
      { time: 0.1 },
      { time: 0.2 },
      { time: 5.0 },
      { time: 5.4 },
      { time: 5.8 },
    ]
    // Last 1s → only samples with time >= 4.8
    const recent = trailingSamplesByTime(history, 1000)
    expect(recent.map((s) => s.time)).toEqual([5.0, 5.4, 5.8])
  })

  it('returns all samples when the window covers the whole take', () => {
    const history = [{ time: 0 }, { time: 1 }, { time: 2 }]
    expect(trailingSamplesByTime(history, 10000)).toHaveLength(3)
  })

  it('returns empty for empty history', () => {
    expect(trailingSamplesByTime([], 1000)).toEqual([])
  })
})
