import { describe, expect, it } from 'vitest'
import { createOctaveCorrector } from './octave-corrector'

describe('createOctaveCorrector', () => {
  it('snaps a single-frame octave-up spike back to the reference', () => {
    const c = createOctaveCorrector({ confirmFrames: 3 })
    const out = [57, 57, 57, 69, 57, 57].map((v) => c.correct(v))
    expect(out[3]).toBeCloseTo(57, 6)
  })

  it('snaps a single-frame octave-down spike back to the reference', () => {
    const c = createOctaveCorrector({ confirmFrames: 3 })
    const out = [57, 57, 57, 45, 57, 57].map((v) => c.correct(v))
    expect(out[3]).toBeCloseTo(57, 6)
  })

  it('snaps a two-octave spike back', () => {
    const c = createOctaveCorrector({ confirmFrames: 3 })
    const out = [60, 60, 60, 84, 60].map((v) => c.correct(v))
    expect(out[3]).toBeCloseTo(60, 6)
  })

  it('accepts a sustained octave leap after confirmFrames', () => {
    const c = createOctaveCorrector({ confirmFrames: 3 })
    const seq = [57, 57, 57, 69, 69, 69, 69, 69]
    const out = seq.map((v) => c.correct(v))
    // First two off-octave frames are held back, the third is accepted.
    expect(out[3]).toBeCloseTo(57, 6)
    expect(out[4]).toBeCloseTo(57, 6)
    expect(out[5]).toBeCloseTo(69, 6)
    expect(out[7]).toBeCloseTo(69, 6)
  })

  it('passes non-octave movement straight through', () => {
    const c = createOctaveCorrector()
    const out = [48, 48, 50, 52, 53].map((v) => c.correct(v))
    expect(out).toEqual([48, 48, 50, 52, 53])
  })

  it('does not treat a major seventh as an octave error', () => {
    const c = createOctaveCorrector({ confirmFrames: 3 })
    const out = [48, 48, 48, 59, 59].map((v) => c.correct(v))
    expect(out[3]).toBeCloseTo(59, 6) // 11 semitones is a real leap, not an octave
  })

  it('reset clears the reference', () => {
    const c = createOctaveCorrector()
    c.correct(57)
    c.reset()
    // After reset the first value becomes the new reference, untouched.
    expect(c.correct(69)).toBeCloseTo(69, 6)
  })
})
