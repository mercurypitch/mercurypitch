// ============================================================
// score-window tests — what part of a note the score is computed over
// ============================================================

import { describe, expect, it } from 'vitest'
import { isScoreMode, SCORE_MODES, SCORE_TRIM_FRACTION, scoreWindow, } from './score-window'

/** 0..n-1, so every assertion can name positions directly. */
const seq = (n: number): number[] => Array.from({ length: n }, (_, i) => i)

describe('scoreWindow', () => {
  it('keeps everything in full mode', () => {
    expect(scoreWindow(seq(20), 'full')).toEqual(seq(20))
  })

  it('drops the slide-in — the first 15% of frames — in settled mode', () => {
    // floor(20 * 0.15) = 3: frames 0-2 are the approach, 3-19 the note.
    expect(scoreWindow(seq(20), 'settled')).toEqual(seq(20).slice(3))
  })

  it('drops both the slide-in and the release in core mode', () => {
    expect(scoreWindow(seq(20), 'core')).toEqual(seq(20).slice(3, 17))
  })

  it('never trims a short note down to almost nothing', () => {
    // Below 1/SCORE_TRIM_FRACTION frames the floor is zero: a note this
    // brief has no meaningful slide to remove, and trimming it would score
    // it on a handful of frames.
    for (let n = 1; n <= 6; n++) {
      expect(scoreWindow(seq(n), 'settled')).toEqual(seq(n))
      expect(scoreWindow(seq(n), 'core')).toEqual(seq(n))
    }
  })

  it('starts trimming at the first length the fraction rounds to a frame', () => {
    expect(Math.floor(7 * SCORE_TRIM_FRACTION)).toBe(1)
    expect(scoreWindow(seq(7), 'settled')).toEqual([1, 2, 3, 4, 5, 6])
    expect(scoreWindow(seq(7), 'core')).toEqual([1, 2, 3, 4, 5])
  })

  it('always keeps at least 70% of the frames, so the window cannot be empty', () => {
    for (const n of [1, 7, 10, 33, 100, 999]) {
      const kept = scoreWindow(seq(n), 'core').length
      expect(kept).toBeGreaterThanOrEqual(Math.ceil(n * 0.7))
      expect(kept).toBeGreaterThan(0)
    }
  })

  it('preserves order and identity — it windows, it does not reorder', () => {
    const objs = seq(10).map((i) => ({ i }))
    const windowed = scoreWindow(objs, 'core')
    expect(windowed.map((o) => o.i)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    // Same objects, not copies: the engine averages the originals.
    expect(windowed[0]).toBe(objs[1])
  })

  it('returns a fresh array even in full mode, never the caller state', () => {
    const input = seq(5)
    const out = scoreWindow(input, 'full')
    expect(out).toEqual(input)
    expect(out).not.toBe(input)
  })

  it('survives an empty input in every mode', () => {
    for (const mode of SCORE_MODES) {
      expect(scoreWindow([], mode)).toEqual([])
    }
  })
})

describe('isScoreMode', () => {
  it('accepts exactly the three modes', () => {
    for (const mode of SCORE_MODES) expect(isScoreMode(mode)).toBe(true)
  })

  it('rejects anything a stale localStorage could hold', () => {
    for (const junk of ['strict', '', null, undefined, 15, {}]) {
      expect(isScoreMode(junk)).toBe(false)
    }
  })
})
