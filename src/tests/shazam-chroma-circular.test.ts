// ============================================================
// Chroma is a circle, not a line
// ============================================================
//
// Chroma is a note with its octave discarded: C is 0, C# is 1 … B is 11.
// The scale wraps, so B and C sit one semitone apart — but plain
// subtraction calls them eleven apart, the furthest two notes can be. That
// punished every melody crossing B→C in the one feature whose job is to be
// forgiving about how a person hums.
//
// The risk in fixing it is the mirror image: a distance that never exceeds
// six instead of eleven makes EVERY comparison cheaper, wrong songs
// included. Separation is therefore what these tests measure, not
// absolute scores.

import { describe, expect, it } from 'vitest'
import { circularDistance12, distanceToScore, dtwMatch, dtwMatchSubsequence, } from '@/lib/shazam/dtw'

describe('circularDistance12', () => {
  it('measures the short way round', () => {
    expect(circularDistance12(11, 0)).toBe(1)
    expect(circularDistance12(0, 11)).toBe(1)
    expect(circularDistance12(10, 1)).toBe(3)
  })

  it('agrees with plain distance inside the octave', () => {
    expect(circularDistance12(3, 5)).toBe(2)
    expect(circularDistance12(0, 4)).toBe(4)
  })

  it('is never further than half the circle', () => {
    for (let a = 0; a < 12; a++) {
      for (let b = 0; b < 12; b++) {
        expect(circularDistance12(a, b)).toBeLessThanOrEqual(6)
      }
    }
  })
})

/** Score a chroma query against a chroma reference, either way round. */
const score = (q: number[], r: number[], circular: boolean) =>
  distanceToScore(
    dtwMatchSubsequence(
      q,
      r,
      undefined,
      circular ? circularDistance12 : undefined,
    ).normalizedDistance,
  )

// A phrase that walks across the B→C boundary: B, C, C#, B, C, D.
const ACROSS_THE_WRAP = [11, 0, 1, 11, 0, 2]
const REFERENCE = [7, 9, 11, 0, 1, 11, 0, 2, 5, 4, 7, 9]
/** Same shape, a different set of pitch classes entirely. */
const DIFFERENT = [4, 6, 7, 4, 6, 9]

describe('a melody that crosses B to C', () => {
  it('is recognised once the wrap is understood', () => {
    const circular = score(ACROSS_THE_WRAP, REFERENCE, true)
    expect(circular).toBeGreaterThan(0.95)
  })

  it('separates a real match from a different one, still', () => {
    // The point of the whole exercise: the right phrase must stay clearly
    // ahead of the wrong one. A cheaper distance that lifted both equally
    // would be a regression dressed as a fix.
    const right = score(ACROSS_THE_WRAP, REFERENCE, true)
    const wrong = score(DIFFERENT, REFERENCE, true)
    expect(right - wrong).toBeGreaterThan(0.3)
  })
})

/**
 * Equal-length comparison with FIXED endpoints. Subsequence DTW cannot
 * show this: its open end simply realigns the offending note to whichever
 * reference column is cheapest, absorbing the very error under test.
 */
const scoreAligned = (q: number[], r: number[], circular: boolean) =>
  distanceToScore(
    dtwMatch(q, r, undefined, circular ? circularDistance12 : undefined)
      .normalizedDistance,
  )

describe('the same singing error costs the same wherever it lands', () => {
  // This is the defect stated precisely. An exact match costs nothing
  // either way — the wrap only shows when singer and recording DIFFER.
  // A voice a semitone off at B/C is exactly as wrong as a voice a
  // semitone off at D/D#, and the metric has to say so.
  const MID_REF = [5, 7, 9, 10, 2]
  const MID_OFF = [5, 7, 9, 10, 3] // last note a semitone sharp, mid-scale
  const WRAP_REF = [5, 7, 9, 10, 0]
  const WRAP_OFF = [5, 7, 9, 10, 11] // last note a semitone flat, at the wrap

  it('circular distance charges both errors alike', () => {
    const mid = scoreAligned(MID_OFF, MID_REF, true)
    const wrap = scoreAligned(WRAP_OFF, WRAP_REF, true)
    expect(wrap).toBeCloseTo(mid, 5)
  })

  it('plain subtraction charged the wrap error far more', () => {
    const mid = scoreAligned(MID_OFF, MID_REF, false)
    const wrap = scoreAligned(WRAP_OFF, WRAP_REF, false)
    // The bug, quantified: the identical mistake scored far worse purely
    // for happening between B and C.
    expect(mid - wrap).toBeGreaterThan(0.2)
  })
})

describe('an octave transposition', () => {
  it('is invisible to chroma either way — that part always worked', () => {
    // Chroma is already mod 12, so shifting a whole melody by an octave
    // changes nothing. The wrap bug was never about whole-melody
    // transposition; it was about individual notes near the boundary.
    const up = ACROSS_THE_WRAP.map((c) => (c + 12) % 12)
    expect(score(up, REFERENCE, true)).toBeCloseTo(
      score(ACROSS_THE_WRAP, REFERENCE, true),
      5,
    )
  })
})
