// ============================================================
// Word letters — grapheme boundaries and split-point editing
// ============================================================
//
// The pure layer under sub-word precision. A boundary index is the join
// between two graphemes, so index 0 is the word's onset and index n its end;
// everything here exists to keep those two coordinate systems — boundary
// index and sweep progress — from drifting apart.

import { describe, expect, it } from 'vitest'
import type { WordSweepPoint } from '@/features/stem-mixer/types'
import { removeSplitPoint, retimeWordEnd, retimeWordStart, setSplitPoint, } from '@/lib/lyric-sweep'
import { computeActiveWord } from '@/lib/lyrics-service'
import { letterBoundaryCount, letterForProgress, letterSplitTimes, progressForLetter, splitGraphemes, } from '@/lib/word-letters'

describe('splitGraphemes', () => {
  it('splits a plain word into its letters', () => {
    expect(splitGraphemes('soul')).toEqual(['s', 'o', 'u', 'l'])
  })

  it('treats an apostrophe as its own boundary', () => {
    // "I'll" is two syllables around the apostrophe, so the split has to be
    // reachable — but the glyphs must stay whole either side of it.
    expect(splitGraphemes("I'll")).toEqual(['I', "'", 'l', 'l'])
  })

  it('keeps a combining mark with the letter it modifies', () => {
    // e + U+0301. Two code points, one thing you can see and sing.
    expect(splitGraphemes('café')).toEqual(['c', 'a', 'f', 'é'])
  })

  it('keeps an astral character whole', () => {
    expect(splitGraphemes('a\u{1D11E}b')).toEqual(['a', '\u{1D11E}', 'b'])
  })

  it('has no boundaries in an empty word', () => {
    expect(splitGraphemes('')).toEqual([])
    expect(letterBoundaryCount('')).toBe(0)
  })
})

describe('progressForLetter', () => {
  it('puts the word onset at 0 and its end at 1', () => {
    expect(progressForLetter('soul', 0)).toBe(0)
    expect(progressForLetter('soul', 4)).toBe(1)
  })

  it('divides the word evenly between them', () => {
    expect(progressForLetter('soul', 1)).toBe(0.25)
    expect(progressForLetter('soul', 2)).toBe(0.5)
  })

  it('clamps an index past either edge', () => {
    expect(progressForLetter('soul', -3)).toBe(0)
    expect(progressForLetter('soul', 99)).toBe(1)
  })

  it('counts graphemes, not code units', () => {
    // Four visible letters, five code points: a naive .length would put the
    // split a quarter of the way into the wrong glyph.
    expect(progressForLetter('café', 2)).toBe(0.5)
  })

  it('has nowhere to split an empty word', () => {
    expect(progressForLetter('', 1)).toBe(0)
  })
})

describe('letterForProgress', () => {
  it('inverts progressForLetter exactly', () => {
    for (const word of ['soul', "I'll", 'café', 'a']) {
      for (let i = 0; i <= letterBoundaryCount(word); i++) {
        expect(letterForProgress(word, progressForLetter(word, i))).toBe(i)
      }
    }
  })

  it('snaps a progress between boundaries to the nearest one', () => {
    // 0.3 of "soul" is inside the second letter; its nearest join is 1.
    expect(letterForProgress('soul', 0.3)).toBe(1)
    expect(letterForProgress('soul', 0.4)).toBe(2)
  })

  it('clamps out-of-range progress to a real boundary', () => {
    expect(letterForProgress('soul', -1)).toBe(0)
    expect(letterForProgress('soul', 5)).toBe(4)
  })

  it('survives a word with no graphemes', () => {
    expect(letterForProgress('', 0.5)).toBe(0)
  })
})

describe('letterSplitTimes', () => {
  const points: WordSweepPoint[] = [
    { time: 10, progress: 0 },
    { time: 10.4, progress: 0.5 },
    { time: 11, progress: 1 },
  ]

  it('reads a curve back as boundary times', () => {
    expect(letterSplitTimes('soul', points)).toEqual({ 0: 10, 2: 10.4, 4: 11 })
  })

  it('collapses a dense marker path onto boundaries', () => {
    // A drag records a sample per frame. Only the last inside each grapheme
    // is a boundary time — the rest are the path getting there.
    const dragged: WordSweepPoint[] = [
      { time: 10, progress: 0 },
      { time: 10.1, progress: 0.1 },
      { time: 10.2, progress: 0.2 },
      { time: 10.3, progress: 0.26 },
      { time: 11, progress: 1 },
    ]
    expect(letterSplitTimes('soul', dragged)).toEqual({
      0: 10.1,
      1: 10.3,
      4: 11,
    })
  })

  it('has nothing to report for an unsplit word', () => {
    expect(letterSplitTimes('soul', undefined)).toEqual({})
    expect(letterSplitTimes('soul', [])).toEqual({})
  })
})

describe('setSplitPoint', () => {
  const word: WordSweepPoint[] = [
    { time: 10, progress: 0 },
    { time: 12, progress: 1 },
  ]

  it('inserts a split in progress order', () => {
    expect(setSplitPoint(word, 11, 0.5)).toEqual([
      { time: 10, progress: 0 },
      { time: 11, progress: 0.5 },
      { time: 12, progress: 1 },
    ])
  })

  it('moves a split already at that boundary instead of doubling it', () => {
    const once = setSplitPoint(word, 11, 0.5)
    const twice = setSplitPoint(once, 11.5, 0.5)
    expect(twice).toHaveLength(3)
    expect(twice[1]).toEqual({ time: 11.5, progress: 0.5 })
  })

  it('clamps a split that would run before the boundary in front of it', () => {
    // Dropping a split at 9 s inside a word that starts at 10 s would make
    // the curve non-monotonic, and the renderer would sweep backwards.
    expect(setSplitPoint(word, 9, 0.5)[1]).toEqual({
      time: 10.001,
      progress: 0.5,
    })
  })

  it('clamps a split that would run past the boundary behind it', () => {
    expect(setSplitPoint(word, 99, 0.5)[1]).toEqual({
      time: 11.999,
      progress: 0.5,
    })
  })

  it('refuses a split with no room between its neighbours', () => {
    // Two boundaries a millisecond apart: any time here is invented, not
    // clicked, so the honest answer is to leave the curve alone.
    const tight: WordSweepPoint[] = [
      { time: 10, progress: 0 },
      { time: 10.001, progress: 1 },
    ]
    expect(setSplitPoint(tight, 10.0005, 0.5)).toEqual(tight)
  })

  it('keeps the curve sorted with several splits', () => {
    let points = word
    for (const [time, progress] of [
      [11.5, 0.75],
      [10.5, 0.25],
      [11, 0.5],
    ] as const) {
      points = setSplitPoint(points, time, progress)
    }
    expect(points.map((p) => p.progress)).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(points.map((p) => p.time)).toEqual([10, 10.5, 11, 11.5, 12])
  })

  it('opens a curve that has no points yet', () => {
    expect(setSplitPoint([], 5, 0.5)).toEqual([{ time: 5, progress: 0.5 }])
  })

  it('never mutates the curve it was handed', () => {
    const original = [...word]
    setSplitPoint(word, 11, 0.5)
    expect(word).toEqual(original)
  })

  it('round-trips a boundary computed by progressForLetter', () => {
    // Thirds do not survive storage exactly; the boundary index must anyway.
    const points = setSplitPoint(word, 11, progressForLetter('you', 1))
    expect(letterForProgress('you', points[1].progress)).toBe(1)
  })
})

describe('removeSplitPoint', () => {
  const points: WordSweepPoint[] = [
    { time: 10, progress: 0 },
    { time: 11, progress: 0.5 },
    { time: 12, progress: 1 },
  ]

  it('drops an interior split', () => {
    expect(removeSplitPoint(points, 0.5)).toEqual([points[0], points[2]])
  })

  it('keeps the word onset and end, which are not splits', () => {
    expect(removeSplitPoint(points, 0)).toEqual(points)
    expect(removeSplitPoint(points, 1)).toEqual(points)
  })

  it('ignores a boundary that was never split', () => {
    expect(removeSplitPoint(points, 0.75)).toEqual(points)
  })

  it('matches a boundary from progressForLetter despite rounding', () => {
    const split = setSplitPoint(points, 11.5, progressForLetter('you', 2))
    expect(split).toHaveLength(4)
    expect(removeSplitPoint(split, progressForLetter('you', 2))).toEqual(points)
  })
})

describe('retimeWordStart', () => {
  const points: WordSweepPoint[] = [
    { time: 10, progress: 0 },
    { time: 11, progress: 0.5 },
    { time: 12, progress: 1 },
  ]

  it('moves the onset and keeps the splits inside the word', () => {
    expect(retimeWordStart(points, 9.5)).toEqual([
      { time: 9.5, progress: 0 },
      points[1],
      points[2],
    ])
  })

  it('will not push the onset past the first split', () => {
    expect(retimeWordStart(points, 11.5)[0]).toEqual({
      time: 10.999,
      progress: 0,
    })
  })

  it('never goes negative', () => {
    expect(retimeWordStart(points, -5)[0].time).toBe(0)
  })

  it('opens a curve for a word that had none', () => {
    expect(retimeWordStart([], 4)).toEqual([{ time: 4, progress: 0 }])
  })

  it('prepends an onset when the curve starts mid-word', () => {
    const partial: WordSweepPoint[] = [{ time: 11, progress: 0.5 }]
    expect(retimeWordStart(partial, 10)).toEqual([
      { time: 10, progress: 0 },
      partial[0],
    ])
  })
})

describe('retimeWordEnd', () => {
  const points: WordSweepPoint[] = [
    { time: 10, progress: 0 },
    { time: 11, progress: 0.5 },
    { time: 12, progress: 1 },
  ]

  it('moves the end and keeps the splits inside the word', () => {
    expect(retimeWordEnd(points, 13)).toEqual([
      points[0],
      points[1],
      { time: 13, progress: 1 },
    ])
  })

  it('will not pull the end back before the last split', () => {
    expect(retimeWordEnd(points, 10.5).at(-1)).toEqual({
      time: 11.001,
      progress: 1,
    })
  })

  it('appends an end when the curve stops mid-word', () => {
    const partial: WordSweepPoint[] = [{ time: 10, progress: 0 }]
    expect(retimeWordEnd(partial, 12)).toEqual([
      partial[0],
      { time: 12, progress: 1 },
    ])
  })

  it('opens a curve for a word that had none', () => {
    expect(retimeWordEnd([], 4)).toEqual([{ time: 4, progress: 1 }])
  })
})

// ── The payoff ───────────────────────────────────────────────────

describe('a split changes what the singer sees', () => {
  // Without this, the whole phase is bookkeeping. "soul" held for four
  // seconds sweeps linearly by default, so the highlight sits on the "u"
  // while the singer is still on the vowel. One split says otherwise.
  const words = ['soul']
  const wordTimes = [10]
  const wordEndTimes = [14]

  const fractionAt = (
    elapsed: number,
    sweeps?: Record<number, WordSweepPoint[]>,
  ) =>
    computeActiveWord(words, 10, 20, wordTimes, elapsed, wordEndTimes, sweeps)
      .fraction

  it('sweeps evenly with no splits at all', () => {
    expect(fractionAt(11)).toBeCloseTo(0.25)
    expect(fractionAt(13)).toBeCloseTo(0.75)
  })

  it('holds the highlight on the vowel until the next letter lands', () => {
    // The "l" is sung at 13.5 s. Boundary 3 of "soul" is 0.75 of the way
    // through it, and the even sweep gets there at 13.0 s — half a second
    // early, which on a held vowel is exactly what the singer notices.
    let points: WordSweepPoint[] = [
      { time: 10, progress: 0 },
      { time: 14, progress: 1 },
    ]
    points = setSplitPoint(points, 13.5, progressForLetter('soul', 3))

    expect(fractionAt(13)).toBeCloseTo(0.75)
    expect(fractionAt(13, { 0: points })).toBeCloseTo(0.6429, 3)
    expect(fractionAt(13.5, { 0: points })).toBeCloseTo(0.75)
  })

  it('falls back to the even sweep for the words left unsplit', () => {
    // Sparse storage means most words have no curve; they must still render.
    expect(fractionAt(12, {})).toBeCloseTo(0.5)
  })
})
