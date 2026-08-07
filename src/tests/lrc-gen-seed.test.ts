// ============================================================
// Starting a mapping session on a song that is already timed
// ============================================================
//
// Upload and fetch both clear the session's word-timings map on purpose, so an
// LRC's per-word stamps survive only on the canonical entries. The mapper used
// to read the map alone, which meant opening it on a fully timed song reported
// every line unmapped: no timestamps in the rows, no ticks on the overview,
// and a second pass with nothing to refine.

import { beforeEach, describe, expect, it } from 'vitest'
import { makeLrcGenHarness } from './helpers/lrc-gen-harness'

const LINES = ['hold on', 'soul mate']

describe('startLrcGen seeds from the song it opens on', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('picks up per-word stamps the LRC already carries', () => {
    const harness = makeLrcGenHarness({
      lines: LINES,
      lineTimes: [2, 11],
      wordTimes: { 0: [2, 6], 1: [11, 16] },
      sessionId: 'seed-worded',
    })
    harness.gen.startLrcGen()

    expect(harness.starts()).toEqual({ 0: [2, 6], 1: [11, 16] })
    expect(harness.gen.lrcGenLineTimes()).toEqual([2, 11])
    // Which is what puts ticks on the overview at all.
    expect(harness.gen.wordMarkers().map((m) => m.time)).toEqual([2, 6, 11, 16])
  })

  it('still opens a plain LRC with line starts and nothing else', () => {
    const harness = makeLrcGenHarness({
      lines: LINES,
      lineTimes: [2, 11],
      sessionId: 'seed-lines-only',
    })
    harness.gen.startLrcGen()

    expect(harness.gen.lrcGenLineTimes()).toEqual([2, 11])
    // No stamps to inherit, so pass 2 has real work rather than fake timings.
    expect(harness.starts()).toEqual({})
    expect(harness.gen.wordMarkers()).toEqual([])
  })

  it('does not treat inherited timings as work done in this sitting', () => {
    // Everything inherited must stay untouched, or finishing would rewrite
    // lines the user never looked at.
    const harness = makeLrcGenHarness({
      lines: LINES,
      lineTimes: [2, 11],
      wordTimes: { 0: [2, 6], 1: [11, 16] },
      sessionId: 'seed-untouched',
    })
    harness.gen.startLrcGen()

    expect(harness.gen.isLineTouched(0)).toBe(false)
    expect(harness.gen.isLineTouched(1)).toBe(false)
  })

  it('lets a mapped word override the stamp it inherited', () => {
    const harness = makeLrcGenHarness({
      lines: LINES,
      lineTimes: [2, 11],
      wordTimes: { 0: [2, 6], 1: [11, 16] },
      sessionId: 'seed-override',
    })
    harness.gen.startLrcGen()
    harness.gen.moveWordStart(0, 1, 5)

    expect(harness.starts()[0]).toEqual([2, 5])
    expect(harness.gen.isLineTouched(0)).toBe(true)
    expect(harness.gen.isLineTouched(1)).toBe(false)
  })
})
