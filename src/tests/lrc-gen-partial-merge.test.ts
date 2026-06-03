// ============================================================
// LRC Gen Partial Merge — Unit Tests
// ============================================================
//
// Tests the pure merge functions extracted into lrc-gen-engine.ts.
// Covers the partial mapping bug where untouched lines lost their
// original timings when the user only mapped a subset of lines.

import { describe, expect, it } from 'vitest'
import { buildFinalPartialTimes, enforceMonotonicTimes, interpolateGaps, mergePartialLineTimes, mergePartialWordTimings, } from '@/features/stem-mixer/lrc-gen-engine'
import type { CanonicalLrcEntry } from '@/features/stem-mixer/types'
import type { WordTimingsMap } from '@/features/stem-mixer/types'

// ── Helpers ──────────────────────────────────────────────────────

/** Create a minimal CanonicalLrcEntry for testing. */
function makeCanonical(
  index: number,
  time: number,
  text: string,
): CanonicalLrcEntry {
  return {
    type: text.trim() === '' || text === '~Rest~' ? 'rest' : 'line',
    lrcIndex: index,
    canonicalIndex: index,
    time,
    text,
    words: text.split(/\s+/).filter((w) => w.length > 0),
  }
}

// ── mergePartialLineTimes ────────────────────────────────────────

describe('mergePartialLineTimes', () => {
  it('uses new time for touched lines', () => {
    const lines = ['Hello', 'World', 'Foo']
    const lineTimes = [10, 20, undefined]
    const touched = new Set([0, 1])
    const canonical = [
      makeCanonical(0, 5, 'Hello'),
      makeCanonical(1, 15, 'World'),
      makeCanonical(2, 25, 'Foo'),
    ]
    const result = mergePartialLineTimes(
      lines,
      lineTimes,
      touched,
      undefined,
      canonical,
    )
    expect(result[0]).toBe(10)
    expect(result[1]).toBe(20)
  })

  it('falls back to origWtCanon for untouched lines with word timings', () => {
    const lines = ['Hello', 'World', 'Foo']
    const lineTimes = [10, undefined, undefined]
    const touched = new Set([0])
    const origWtCanon: WordTimingsMap = {
      1: [15.5, 16.0],
      2: [25.0, 26.0],
    }
    const canonical = [
      makeCanonical(0, 5, 'Hello'),
      makeCanonical(1, 15, 'World'),
      makeCanonical(2, 25, 'Foo'),
    ]
    const result = mergePartialLineTimes(
      lines,
      lineTimes,
      touched,
      origWtCanon,
      canonical,
    )
    expect(result[0]).toBe(10) // touched
    expect(result[1]).toBe(15.5) // first word time from origWtCanon
    expect(result[2]).toBe(25.0) // first word time from origWtCanon
  })

  it('falls back to canonical time when no word timings exist (THE BUG FIX)', () => {
    // This is the exact scenario that was broken: line-level LRC has
    // canonical entries with times but no word timings. Without the
    // canonical fallback, untouched lines become undefined.
    const lines = [
      'Line one',
      'Line two',
      'Line three',
      'Line four',
      'Line five',
    ]
    const lineTimes = [undefined, undefined, 30, 40, undefined]
    const touched = new Set([2, 3]) // user mapped lines 2-3 only

    // No word timings at all (line-level LRC)
    const origWtCanon: WordTimingsMap | undefined = undefined

    const canonical = [
      makeCanonical(0, 5, 'Line one'),
      makeCanonical(1, 15, 'Line two'),
      makeCanonical(2, 25, 'Line three'),
      makeCanonical(3, 35, 'Line four'),
      makeCanonical(4, 45, 'Line five'),
    ]

    const result = mergePartialLineTimes(
      lines,
      lineTimes,
      touched,
      origWtCanon,
      canonical,
    )

    // Touched lines get new times
    expect(result[2]).toBe(30)
    expect(result[3]).toBe(40)

    // Untouched lines MUST preserve canonical times (this was the bug)
    expect(result[0]).toBe(5)
    expect(result[1]).toBe(15)
    expect(result[4]).toBe(45)
  })

  it('prefers origWtCanon over canonical when both exist', () => {
    const lines = ['Hello']
    const lineTimes = [undefined]
    const touched = new Set<number>()
    const origWtCanon: WordTimingsMap = { 0: [12.5] }
    const canonical = [makeCanonical(0, 10, 'Hello')]

    const result = mergePartialLineTimes(
      lines,
      lineTimes,
      touched,
      origWtCanon,
      canonical,
    )
    expect(result[0]).toBe(12.5) // origWtCanon wins over canonical
  })

  it('returns undefined when no source has a time', () => {
    const lines = ['Hello', 'World']
    const lineTimes = [undefined, undefined]
    const touched = new Set<number>()
    // canonical has fewer entries than lines
    const canonical = [makeCanonical(0, 5, 'Hello')]

    const result = mergePartialLineTimes(
      lines,
      lineTimes,
      touched,
      undefined,
      canonical,
    )
    expect(result[0]).toBe(5) // canonical
    expect(result[1]).toBeUndefined() // no source
  })
})

// ── mergePartialWordTimings ─────────────────────────────────────

describe('mergePartialWordTimings', () => {
  it('keeps original word timings for untouched lines', () => {
    const touched = new Set([1])
    const origWtCanon: WordTimingsMap = {
      0: [5, 6],
      1: [15, 16],
      2: [25, 26],
    }
    const newWordTimings: WordTimingsMap = {
      1: [20, 21],
    }

    const result = mergePartialWordTimings(touched, origWtCanon, newWordTimings)

    expect(result[0]).toEqual([5, 6]) // preserved
    expect(result[1]).toEqual([20, 21]) // new
    expect(result[2]).toEqual([25, 26]) // preserved
  })

  it('handles undefined origWtCanon gracefully', () => {
    const touched = new Set([0])
    const newWordTimings: WordTimingsMap = { 0: [10] }

    const result = mergePartialWordTimings(touched, undefined, newWordTimings)

    expect(result[0]).toEqual([10])
    expect(Object.keys(result)).toEqual(['0'])
  })

  it('only includes touched keys from new timings', () => {
    const touched = new Set([1])
    const newWordTimings: WordTimingsMap = {
      0: [5], // not touched, should not be included
      1: [20],
    }

    const result = mergePartialWordTimings(touched, undefined, newWordTimings)

    expect(result[0]).toBeUndefined()
    expect(result[1]).toEqual([20])
  })
})

// ── interpolateGaps ─────────────────────────────────────────────

describe('interpolateGaps', () => {
  it('interpolates undefined entries between touched lines', () => {
    const finalTimes = [10, undefined, undefined, 40, undefined]
    const touched = new Set([0, 3])

    const result = interpolateGaps(
      finalTimes as (number | undefined)[],
      touched,
      60,
    )

    // Lines 1 and 2 should be interpolated between 10 and 40
    expect(result[0]).toBe(10)
    expect(result[1]).toBe(20) // 10 + (40-10) * (1/3)
    expect(result[2]).toBe(30) // 10 + (40-10) * (2/3)
    expect(result[3]).toBe(40)
    // Line 4 is beyond lastTouched, not interpolated
    expect(result[4]).toBeUndefined()
  })

  it('does not modify lines beyond lastTouched', () => {
    const finalTimes = [10, 20, undefined, undefined]
    const touched = new Set([0, 1])

    const result = interpolateGaps(
      finalTimes as (number | undefined)[],
      touched,
      60,
    )

    expect(result[2]).toBeUndefined()
    expect(result[3]).toBeUndefined()
  })

  it('handles no touched lines', () => {
    const finalTimes = [undefined, undefined]
    const touched = new Set<number>()

    const result = interpolateGaps(
      finalTimes as (number | undefined)[],
      touched,
      60,
    )

    expect(result[0]).toBeUndefined()
    expect(result[1]).toBeUndefined()
  })

  it('preserves existing times between touched lines', () => {
    const finalTimes: (number | undefined)[] = [10, 15, undefined, 40]
    const touched = new Set([0, 3])

    const result = interpolateGaps(finalTimes, touched, 60)

    // Line 1 already has a time from canonical fallback -- interpolation
    // only fills `undefined` entries, so line 1 stays as-is.
    expect(result[1]).toBe(15)
    // Line 2 is undefined -> gets interpolated.
    // prevMappedIdx=0 (touched), prevMappedTime=10
    // nextMappedTime=40 (touched line 3), gap=30, posInGap=2, gapLen=3
    // = 10 + 30*(2/3) = 30
    expect(result[2]).toBeCloseTo(30, 1)
  })
})

// ── enforceMonotonicTimes ───────────────────────────────────────

describe('enforceMonotonicTimes', () => {
  it('clamps times to non-decreasing order', () => {
    const times = [10, 5, 20, 15, 30]
    const result = enforceMonotonicTimes(times)

    expect(result).toEqual([10, 10, 20, 20, 30])
  })

  it('preserves already monotonic times', () => {
    const times = [5, 10, 15, 20]
    const result = enforceMonotonicTimes(times)

    expect(result).toEqual([5, 10, 15, 20])
  })

  it('handles undefined entries', () => {
    const times: (number | undefined)[] = [10, undefined, 5, 20]
    const result = enforceMonotonicTimes(times)

    expect(result[0]).toBe(10)
    expect(result[1]).toBeUndefined()
    expect(result[2]).toBe(10) // clamped up from 5
    expect(result[3]).toBe(20)
  })
})

// ── buildFinalPartialTimes (full pipeline) ──────────────────────

describe('buildFinalPartialTimes', () => {
  it('preserves untouched canonical times for line-level LRC (THE BUG SCENARIO)', () => {
    // Scenario: 20-line song with line-level LRC (no word timings).
    // User enters gen mode, maps lines 5-7, then stops.
    // Lines 0-4 and 8-19 must keep their original canonical times.

    const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`)
    const canonical = lines.map((text, i) =>
      makeCanonical(i, (i + 1) * 10, text),
    )

    const lineTimes: (number | undefined)[] = new Array(20).fill(undefined)
    lineTimes[5] = 55
    lineTimes[6] = 65
    lineTimes[7] = 75

    const touched = new Set([5, 6, 7])

    const result = buildFinalPartialTimes({
      lines,
      lineTimes,
      touchedLines: touched,
      origWtCanon: undefined, // no word timings (line-level LRC)
      canonical,
      duration: 210,
    })

    // Touched lines get their new times
    expect(result[5]).toBe(55)
    expect(result[6]).toBe(65)
    expect(result[7]).toBe(75)

    // Untouched lines before touched range preserve canonical times
    expect(result[0]).toBe(10)
    expect(result[1]).toBe(20)
    expect(result[2]).toBe(30)
    expect(result[3]).toBe(40)
    expect(result[4]).toBe(50)

    // Untouched lines after touched range preserve canonical times
    expect(result[8]).toBe(90)
    expect(result[9]).toBe(100)
    expect(result[19]).toBe(200)

    // All times should be defined
    for (let i = 0; i < 20; i++) {
      expect(result[i]).toBeDefined()
    }

    // All times should be monotonically non-decreasing
    for (let i = 1; i < 20; i++) {
      expect(result[i]!).toBeGreaterThanOrEqual(result[i - 1]!)
    }
  })

  it('handles touching only the first line', () => {
    const lines = ['A', 'B', 'C', 'D']
    const canonical = [
      makeCanonical(0, 5, 'A'),
      makeCanonical(1, 15, 'B'),
      makeCanonical(2, 25, 'C'),
      makeCanonical(3, 35, 'D'),
    ]
    const lineTimes: (number | undefined)[] = [
      8,
      undefined,
      undefined,
      undefined,
    ]
    const touched = new Set([0])

    const result = buildFinalPartialTimes({
      lines,
      lineTimes,
      touchedLines: touched,
      origWtCanon: undefined,
      canonical,
      duration: 40,
    })

    expect(result[0]).toBe(8) // touched
    expect(result[1]).toBe(15) // canonical
    expect(result[2]).toBe(25) // canonical
    expect(result[3]).toBe(35) // canonical
  })

  it('handles touching only the last line', () => {
    const lines = ['A', 'B', 'C', 'D']
    const canonical = [
      makeCanonical(0, 5, 'A'),
      makeCanonical(1, 15, 'B'),
      makeCanonical(2, 25, 'C'),
      makeCanonical(3, 35, 'D'),
    ]
    const lineTimes: (number | undefined)[] = [
      undefined,
      undefined,
      undefined,
      50,
    ]
    const touched = new Set([3])

    const result = buildFinalPartialTimes({
      lines,
      lineTimes,
      touchedLines: touched,
      origWtCanon: undefined,
      canonical,
      duration: 60,
    })

    expect(result[0]).toBe(5) // canonical
    expect(result[1]).toBe(15) // canonical
    expect(result[2]).toBe(25) // canonical
    expect(result[3]).toBe(50) // touched
  })

  it('handles word-level LRC with origWtCanon', () => {
    const lines = ['Hello World', 'Foo Bar', 'Baz Qux']
    const canonical = [
      makeCanonical(0, 5, 'Hello World'),
      makeCanonical(1, 15, 'Foo Bar'),
      makeCanonical(2, 25, 'Baz Qux'),
    ]
    const origWtCanon: WordTimingsMap = {
      0: [5, 6],
      1: [15, 16],
      2: [25, 26],
    }
    const lineTimes: (number | undefined)[] = [undefined, 20, undefined]
    const touched = new Set([1])

    const result = buildFinalPartialTimes({
      lines,
      lineTimes,
      touchedLines: touched,
      origWtCanon,
      canonical,
      duration: 30,
    })

    expect(result[0]).toBe(5) // origWtCanon[0][0]
    expect(result[1]).toBe(20) // touched
    expect(result[2]).toBe(25) // origWtCanon[2][0]
  })
})
