// ============================================================
// Letter splits — the mapping session's sub-word edits
// ============================================================
//
// The controller half of Phase 4. What the pure layer cannot check is the
// routing: boundary 0 is the word's onset and boundary n its end, so those two
// clicks have to land in `wordTimings` and `wordEndTimings` rather than in the
// sweep curve alone — while every boundary between them stays in the curve, and
// only for the words somebody actually split.

import { beforeEach, describe, expect, it } from 'vitest'
import { makeLrcGenHarness } from './helpers/lrc-gen-harness'

const LINES = ['hold on', 'soul mate']

const makeController = () =>
  makeLrcGenHarness({ lines: LINES, sessionId: 'letters-test' })

describe('setLetterSplit', () => {
  let harness: ReturnType<typeof makeController>

  beforeEach(() => {
    localStorage.clear()
    harness = makeController()
    harness.gen.startLrcGen()
    // The session ships with a 180 ms reaction correction. These are about
    // where an edit lands, not how far back it is nudged, so zero it out;
    // one test below covers the correction on its own.
    harness.gen.setLrcTimingOffsetMs(0)
  })

  it('routes boundary 0 to the word start, not just the curve', () => {
    // Boundary 0 is the word's onset. If it only landed in the sweep, the
    // exported LRC would keep the old timestamp and the edit would look like
    // it did nothing.
    harness.gen.setLetterSplit(0, 1, 0, 4.2)
    expect(harness.starts()[0]?.[1]).toBe(4.2)
    expect(harness.sweeps()[0]?.[1]?.[0]).toEqual({ time: 4.2, progress: 0 })
  })

  it('carries a first-word edit onto the line time', () => {
    harness.gen.setLetterSplit(0, 0, 0, 2.5)
    expect(harness.gen.lrcGenLineTimes()[0]).toBe(2.5)
  })

  it('routes the last boundary to the word end', () => {
    // "on" has two letters, so boundary 2 is its end.
    harness.gen.setLetterSplit(0, 1, 2, 6)
    expect(harness.ends()[0]?.[1]).toBe(6)
    expect(harness.sweeps()[0]?.[1]?.at(-1)).toEqual({ time: 6, progress: 1 })
  })

  it('keeps interior boundaries in the curve alone', () => {
    harness.gen.setLetterSplit(1, 0, 0, 10)
    harness.gen.setLetterSplit(1, 0, 4, 14)
    harness.gen.setLetterSplit(1, 0, 2, 12)
    expect(harness.sweeps()[1]?.[0]).toEqual([
      { time: 10, progress: 0 },
      { time: 12, progress: 0.5 },
      { time: 14, progress: 1 },
    ])
    // The word still starts and ends where it did — a split is inside it.
    expect(harness.starts()[1]?.[0]).toBe(10)
    expect(harness.ends()[1]?.[0]).toBe(14)
  })

  it('does not lose the splits when the word start is retimed', () => {
    harness.gen.setLetterSplit(1, 0, 0, 10)
    harness.gen.setLetterSplit(1, 0, 4, 14)
    harness.gen.setLetterSplit(1, 0, 2, 12)
    harness.gen.setLetterSplit(1, 0, 0, 9)
    expect(harness.sweeps()[1]?.[0]?.map((p) => p.time)).toEqual([9, 12, 14])
    expect(harness.starts()[1]?.[0]).toBe(9)
  })

  it('agrees with the curve when a retime gets clamped', () => {
    // Dragging the onset past the first split cannot succeed; the stored word
    // start has to take the clamped value or the two disagree forever.
    harness.gen.setLetterSplit(1, 0, 0, 10)
    harness.gen.setLetterSplit(1, 0, 2, 12)
    harness.gen.setLetterSplit(1, 0, 0, 13)
    expect(harness.starts()[1]?.[0]).toBe(11.999)
    expect(harness.sweeps()[1]?.[0]?.[0].time).toBe(11.999)
  })

  it('applies the same reaction correction as every other input', () => {
    harness.gen.setLrcTimingOffsetMs(200)
    harness.gen.setLetterSplit(0, 1, 0, 5)
    expect(harness.starts()[0]?.[1]).toBe(4.8)
  })

  it('marks the line as work done in this sitting', () => {
    expect(harness.gen.isLineTouched(1)).toBe(false)
    harness.gen.setLetterSplit(1, 0, 2, 12)
    expect(harness.gen.isLineTouched(1)).toBe(true)
  })

  it('ignores a word that is not there', () => {
    harness.gen.setLetterSplit(0, 9, 1, 5)
    harness.gen.setLetterSplit(9, 0, 1, 5)
    expect(harness.sweeps()[0]?.[9]).toBeUndefined()
    expect(harness.sweeps()[9]).toBeUndefined()
  })

  it('stores nothing for the words nobody split', () => {
    // The sparse invariant. A song mapped by tapping and then refined on two
    // syllables must not carry a curve for every word in it.
    harness.gen.handleNextWord()
    harness.gen.handleNextWord()
    harness.gen.handleNextWord()
    expect(harness.sweeps()).toEqual({})

    harness.gen.setLetterSplit(1, 0, 2, 12)
    expect(Object.keys(harness.sweeps())).toEqual(['1'])
    expect(Object.keys(harness.sweeps()[1])).toEqual(['0'])
  })
})

describe('clearLetterSplit', () => {
  let harness: ReturnType<typeof makeController>

  beforeEach(() => {
    localStorage.clear()
    harness = makeController()
    harness.gen.startLrcGen()
    // The session ships with a 180 ms reaction correction. These are about
    // where an edit lands, not how far back it is nudged, so zero it out;
    // one test below covers the correction on its own.
    harness.gen.setLrcTimingOffsetMs(0)
    harness.gen.setLetterSplit(1, 0, 0, 10)
    harness.gen.setLetterSplit(1, 0, 4, 14)
    harness.gen.setLetterSplit(1, 0, 2, 12)
  })

  it('removes an interior split', () => {
    harness.gen.clearLetterSplit(1, 0, 2)
    expect(harness.sweeps()[1]?.[0]?.map((p) => p.time)).toEqual([10, 14])
  })

  it('refuses to remove the word edges', () => {
    harness.gen.clearLetterSplit(1, 0, 0)
    harness.gen.clearLetterSplit(1, 0, 4)
    expect(harness.sweeps()[1]?.[0]).toHaveLength(3)
    expect(harness.starts()[1]?.[0]).toBe(10)
    expect(harness.ends()[1]?.[0]).toBe(14)
  })
})

describe('letterSplits', () => {
  let harness: ReturnType<typeof makeController>

  beforeEach(() => {
    localStorage.clear()
    harness = makeController()
    harness.gen.startLrcGen()
    // The session ships with a 180 ms reaction correction. These are about
    // where an edit lands, not how far back it is nudged, so zero it out;
    // one test below covers the correction on its own.
    harness.gen.setLrcTimingOffsetMs(0)
  })

  it('reads a split curve back as boundary times', () => {
    harness.gen.setLetterSplit(1, 0, 0, 10)
    harness.gen.setLetterSplit(1, 0, 4, 14)
    harness.gen.setLetterSplit(1, 0, 2, 12)
    expect(harness.gen.letterSplits(1, 0)).toEqual({ 0: 10, 2: 12, 4: 14 })
  })

  it('shows the edges of a tap-mapped word, which has no curve', () => {
    // Tap mode never writes a sweep. Without this the editor would open on a
    // word it has already timed and show nothing at all.
    harness.setElapsed(3)
    harness.gen.handleNextWord()
    expect(harness.gen.letterSplits(0, 0)).toEqual({ 0: 3 })
  })

  it('has nothing to show for a word nobody has reached', () => {
    expect(harness.gen.letterSplits(1, 1)).toEqual({})
  })

  it('has nothing to show for a word that is not there', () => {
    expect(harness.gen.letterSplits(0, 9)).toEqual({})
  })
})

describe('letter mode state', () => {
  let harness: ReturnType<typeof makeController>

  beforeEach(() => {
    localStorage.clear()
    harness = makeController()
    harness.gen.startLrcGen()
    // The session ships with a 180 ms reaction correction. These are about
    // where an edit lands, not how far back it is nudged, so zero it out;
    // one test below covers the correction on its own.
    harness.gen.setLrcTimingOffsetMs(0)
  })

  it('opens and closes a target word', () => {
    harness.gen.openLetterTarget(1, 1)
    expect(harness.gen.letterTarget()).toEqual({ lineIdx: 1, wordIdx: 1 })
    harness.gen.closeLetterTarget()
    expect(harness.gen.letterTarget()).toBeNull()
  })

  it('will not open a word that is not there', () => {
    harness.gen.openLetterTarget(0, 9)
    expect(harness.gen.letterTarget()).toBeNull()
  })

  it('drops the mode when the session is torn down', () => {
    harness.gen.setLetterMode(true)
    harness.gen.openLetterTarget(1, 1)
    harness.gen.resetGenState()
    expect(harness.gen.letterMode()).toBe(false)
    expect(harness.gen.letterTarget()).toBeNull()
  })
})

// ── The syllable pre-fill ────────────────────────────────────────
//
// It writes into the singer's mapping without being asked twice, so what
// matters is that it refuses when it would be guessing: no span to spread
// across means no suggestion, not a pile of splits on one timestamp.

describe('suggestSyllableSplits', () => {
  let harness: ReturnType<typeof makeController>

  const SYL_LINES = ['Josephine waits', 'hold on']

  /** Give a word both edges, which is what the suggestion spreads across. */
  const withSpan = (
    lineIdx: number,
    wordIdx: number,
    from: number,
    to: number,
  ) => {
    harness.gen.setLetterSplit(lineIdx, wordIdx, 0, from)
    const word = SYL_LINES[lineIdx].split(' ')[wordIdx]
    harness.gen.setLetterSplit(lineIdx, wordIdx, word.length, to)
  }

  beforeEach(() => {
    localStorage.clear()
    harness = makeLrcGenHarness({
      lines: SYL_LINES,
      sessionId: 'syllable-test',
    })
    harness.gen.startLrcGen()
    harness.gen.setLrcTimingOffsetMs(0)
  })

  it('places a split at every syllable of a timed word', () => {
    withSpan(0, 0, 10, 14)
    expect(harness.gen.suggestSyllableSplits(0, 0)).toBeGreaterThanOrEqual(2)
    const points = harness.sweeps()[0]?.[0] ?? []
    // The two edges plus the syllables between them.
    expect(points.length).toBeGreaterThanOrEqual(4)
  })

  it('spreads them across the span the word already occupies', () => {
    withSpan(0, 0, 10, 14)
    harness.gen.suggestSyllableSplits(0, 0)
    for (const point of harness.sweeps()[0]?.[0] ?? []) {
      expect(point.time).toBeGreaterThanOrEqual(10)
      expect(point.time).toBeLessThanOrEqual(14)
    }
  })

  it('keeps the word own start and end exactly where they were', () => {
    // The suggestion refines the inside of a word. Moving its edges would
    // silently retime the words either side of it.
    withSpan(0, 0, 10, 14)
    harness.gen.suggestSyllableSplits(0, 0)
    const points = harness.sweeps()[0]?.[0] ?? []
    expect(points[0].time).toBe(10)
    expect(points.at(-1)?.time).toBe(14)
  })

  it('leaves the times in order', () => {
    withSpan(0, 0, 10, 14)
    harness.gen.suggestSyllableSplits(0, 0)
    const times = (harness.sweeps()[0]?.[0] ?? []).map((p) => p.time)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('does nothing to a word with no end to spread across', () => {
    // Only a start means no span. Suggesting anyway would pile every
    // syllable onto one timestamp.
    harness.gen.setLetterSplit(0, 0, 0, 10)
    expect(harness.gen.suggestSyllableSplits(0, 0)).toBe(0)
  })

  it('does nothing to a word with no syllables to find', () => {
    withSpan(1, 0, 2, 3)
    expect(harness.gen.suggestSyllableSplits(1, 0)).toBe(0)
  })

  it('does nothing for a word that is not there', () => {
    expect(harness.gen.suggestSyllableSplits(0, 9)).toBe(0)
  })

  it('marks the line, so the suggestion survives finishing', () => {
    // Untouched lines fall back to their pre-session times on finish, which
    // would throw the whole suggestion away.
    withSpan(0, 0, 10, 14)
    harness.gen.suggestSyllableSplits(0, 0)
    expect(harness.gen.isLineTouched(0)).toBe(true)
  })
})
