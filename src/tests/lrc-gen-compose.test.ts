// ============================================================
// composeGenResult — what a finished mapping session saves
// ============================================================
//
// This is the step that decides what the singer keeps. Until it was extracted
// it lived inside `handleLrcGenFinish` and could only be reached by driving a
// whole controller, so the interesting cases — a partial session over an
// already-timed song, a rest row shifting the indices — were never asserted.
// Every test here is a claim about somebody's saved work surviving.

import { describe, expect, it } from 'vitest'
import { composeGenResult } from '@/features/stem-mixer/lrc-gen-engine'
import type { CanonicalLrcEntry, WordSweepTimingsMap, WordTimingsMap, } from '@/features/stem-mixer/types'

/** A line entry whose canonical and LRC indices agree. */
function line(index: number, time: number, text: string): CanonicalLrcEntry {
  return {
    type: 'line',
    lrcIndex: index,
    canonicalIndex: index,
    time,
    text,
    words: text.split(/\s+/).filter((word) => word.length > 0),
  }
}

/**
 * A synthetic rest row. It occupies a canonical index but has no LRC line, so
 * everything after it sits one index further along in canonical space than in
 * the file — the re-keying these tests care about.
 */
function rest(canonicalIndex: number, time: number): CanonicalLrcEntry {
  return {
    type: 'rest',
    lrcIndex: -1,
    canonicalIndex,
    time,
    text: '~Rest~',
    words: [],
  }
}

const SONG = [line(0, 1, 'hold on'), line(1, 5, 'soul mate')]
const TEXTS = SONG.map((entry) => entry.text)
const ALL_TOUCHED = new Set([0, 1])

function compose(over: Partial<Parameters<typeof composeGenResult>[0]> = {}) {
  return composeGenResult({
    canonical: SONG,
    lines: TEXTS,
    lineTimes: [1, 5],
    wordTimes: {},
    wordEnds: {},
    wordSweeps: {},
    touchedLines: ALL_TOUCHED,
    snapshot: null,
    duration: 30,
    ...over,
  })
}

describe('composeGenResult — a fully mapped session', () => {
  it('writes the session times into the LRC', () => {
    const result = compose({ lineTimes: [2.5, 8] })
    expect(result.lrcText).toContain('[00:02.50]')
    expect(result.lrcText).toContain('[00:08.00]')
  })

  it('keeps the session word maps as they are', () => {
    const wordTimes: WordTimingsMap = { 0: [1, 3], 1: [5, 7] }
    const result = compose({ wordTimes, wordEnds: { 0: [2.5, 4] } })
    expect(result.wordTimings).toEqual(wordTimes)
    expect(result.wordEndTimings).toEqual({ 0: [2.5, 4] })
  })

  it('still forces the times into order', () => {
    // A mis-tap that runs backwards would otherwise serialise a line that
    // starts before the one above it, which no player can follow.
    const result = compose({ lineTimes: [9, 4] })
    const times = [...result.lrcText.matchAll(/\[(\d+):(\d+\.\d+)]/g)].map(
      (match) => Number(match[1]) * 60 + Number(match[2]),
    )
    expect(times[1]).toBeGreaterThanOrEqual(times[0])
  })
})

describe('composeGenResult — a partial session', () => {
  it('leaves an untouched line on the time the song already had', () => {
    // The regression that made this function worth extracting: remap the last
    // line of a long song and the untouched ones used to serialise as 0:00.
    const result = compose({
      lineTimes: [undefined, 12],
      touchedLines: new Set([1]),
    })
    expect(result.lineTimes[0]).toBe(1)
  })

  it('keeps an untouched line word timings from before the session', () => {
    const result = compose({
      lineTimes: [undefined, 12],
      wordTimes: { 1: [12, 14] },
      touchedLines: new Set([1]),
      snapshot: { wordTimings: { 0: [1, 3], 1: [5, 7] } },
    })
    expect(result.wordTimings[0]).toEqual([1, 3])
    expect(result.wordTimings[1]).toEqual([12, 14])
  })

  it('does the same for word ends and sub-word splits', () => {
    const snapshotSweeps: WordSweepTimingsMap = {
      0: { 0: [{ time: 1, progress: 0 }] },
      1: { 0: [{ time: 5, progress: 0 }] },
    }
    const result = compose({
      lineTimes: [undefined, 12],
      wordEnds: { 1: [13, 15] },
      wordSweeps: { 1: { 0: [{ time: 12, progress: 0.5 }] } },
      touchedLines: new Set([1]),
      snapshot: {
        wordEndTimings: { 0: [2, 4], 1: [6, 8] },
        wordSweepTimings: snapshotSweeps,
      },
    })
    expect(result.wordEndTimings[0]).toEqual([2, 4])
    expect(result.wordEndTimings[1]).toEqual([13, 15])
    expect(result.wordSweepTimings[0]).toEqual({
      0: [{ time: 1, progress: 0 }],
    })
    expect(result.wordSweepTimings[1]).toEqual({
      0: [{ time: 12, progress: 0.5 }],
    })
  })

  it('copies the snapshot rather than aliasing it', () => {
    // The snapshot is the pre-session state the caller may still restore from.
    // Handing back the same nested objects would let a later edit rewrite it.
    const snapshot = {
      wordSweepTimings: { 0: { 0: [{ time: 1, progress: 0 }] } },
    }
    const result = compose({
      lineTimes: [undefined, 12],
      touchedLines: new Set([1]),
      snapshot,
    })
    result.wordSweepTimings[0][0][0].time = 99
    expect(snapshot.wordSweepTimings[0][0][0].time).toBe(1)
  })

  it('drops a snapshot entry whose line is gone', () => {
    // Lyrics edited between sessions: index 5 has no canonical row any more,
    // and carrying it forward would key a timing onto whatever moved into 5.
    const result = compose({
      lineTimes: [undefined, 12],
      touchedLines: new Set([1]),
      snapshot: { wordTimings: { 0: [1, 3], 5: [40, 42] } },
    })
    expect(Object.keys(result.wordTimings)).toEqual(['0'])
  })
})

describe('composeGenResult — rest rows', () => {
  // The rest sits at canonical 1 and has no line in the file, so the second
  // sung line is canonical 2 but LRC 1 — the offset the re-keying exists for.
  const withRest = [
    line(0, 1, 'hold on'),
    rest(1, 3),
    { ...line(1, 5, 'soul mate'), canonicalIndex: 2 },
  ]

  it('re-keys the output from canonical indices back to LRC ones', () => {
    // The second sung line is canonical 2 but LRC 1. Getting this backwards
    // puts the second line's timings on the first line's words.
    const result = composeGenResult({
      canonical: withRest,
      lines: withRest.map((entry) => entry.text),
      lineTimes: [1, 3, 5],
      wordTimes: { 0: [1, 2], 2: [5, 6] },
      wordEnds: {},
      wordSweeps: {},
      touchedLines: new Set([0, 1, 2]),
      snapshot: null,
      duration: 30,
    })
    expect(result.wordTimings).toEqual({ 0: [1, 2], 1: [5, 6] })
  })

  it('writes no LRC entry for the rest itself', () => {
    const result = composeGenResult({
      canonical: withRest,
      lines: withRest.map((entry) => entry.text),
      lineTimes: [1, 3, 5],
      wordTimes: {},
      wordEnds: {},
      wordSweeps: {},
      touchedLines: new Set([0, 1, 2]),
      snapshot: null,
      duration: 30,
    })
    expect(result.lrcText).not.toContain('~Rest~')
  })
})

describe('composeGenResult — plain-text lyrics', () => {
  const lines = ['hold on', 'soul mate']

  function plain(over: Partial<Parameters<typeof composeGenResult>[0]> = {}) {
    return composeGenResult({
      canonical: [],
      lines,
      lineTimes: [1, 5],
      wordTimes: {},
      wordEnds: {},
      wordSweeps: {},
      touchedLines: new Set([0, 1]),
      snapshot: null,
      duration: 30,
      ...over,
    })
  }

  it('stamps every word on a line that has word times', () => {
    expect(plain({ wordTimes: { 0: [1, 2.5] } }).lrcText.split('\n')[0]).toBe(
      '[00:01.00] hold [00:02.50] on',
    )
  })

  it('stamps the line only, when it has no word times', () => {
    expect(plain().lrcText.split('\n')[1]).toBe('[00:05.00] soul mate')
  })

  it('leaves a word unstamped rather than inventing a time for it', () => {
    expect(plain({ wordTimes: { 0: [1] } }).lrcText.split('\n')[0]).toBe(
      '[00:01.00] hold on',
    )
  })

  it('drops blank lines instead of emitting a stamped empty row', () => {
    const result = composeGenResult({
      canonical: [],
      lines: ['hold on', '   ', 'soul mate'],
      lineTimes: [1, 3, 5],
      wordTimes: {},
      wordEnds: {},
      wordSweeps: {},
      touchedLines: new Set([0, 1, 2]),
      snapshot: null,
      duration: 30,
    })
    expect(result.lrcText.split('\n')).toHaveLength(2)
  })

  it('keeps the session indices, since there is nothing to re-key against', () => {
    const result = plain({ wordTimes: { 1: [5, 6] } })
    expect(result.wordTimings).toEqual({ 1: [5, 6] })
  })
})

describe('composeGenResult — a song with no duration yet', () => {
  it('does not spread unmapped lines across a duration it does not know', () => {
    // Metadata can still be loading. Estimating against 0 would collapse the
    // whole song onto 0:00.
    const result = compose({ duration: 0, lineTimes: [1, undefined] })
    expect(result.lineTimes[1]).toBeUndefined()
  })
})
