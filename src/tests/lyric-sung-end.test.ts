import { describe, expect, it } from 'vitest'
import { cappedEvenLineDuration, clampLineEndToVocal, SUNG_END_MIN_SPAN_SEC, SUNG_END_RELEASE_SEC, sungEndWithin, synthesizeLastWordEnd, } from '@/lib/lyric-sung-end'
import { computeActiveWord } from '@/lib/lyrics-service'

const note = (startBeat: number, endBeat: number) => ({ startBeat, endBeat })

describe('sungEndWithin', () => {
  it('returns the latest overlapping note end, clamped to the window', () => {
    const notes = [note(1, 2), note(2.5, 3.4), note(10, 12)]
    expect(sungEndWithin(notes, 0, 5)).toBeCloseTo(3.4, 5)
    expect(sungEndWithin(notes, 0, 11)).toBeCloseTo(11, 5)
  })

  it('returns null when nothing overlaps', () => {
    expect(sungEndWithin([note(1, 2)], 3, 6)).toBeNull()
    expect(sungEndWithin([], 0, 10)).toBeNull()
  })

  it('ignores notes touching only the window edges', () => {
    expect(sungEndWithin([note(0, 3)], 3, 6)).toBeNull()
    expect(sungEndWithin([note(6, 8)], 3, 6)).toBeNull()
  })
})

describe('clampLineEndToVocal', () => {
  // The reported case: "Valjda" at 39s, next line at 45s, vocal done ~40.2s.
  it('ends the line when the vocal ends, plus the release tail', () => {
    const end = clampLineEndToVocal(39, 45, [note(39.1, 40.2)])
    expect(end).toBeCloseTo(40.2 + SUNG_END_RELEASE_SEC, 5)
  })

  it('keeps the raw end without overlapping notes', () => {
    expect(clampLineEndToVocal(39, 45, [note(50, 51)])).toBe(45)
    expect(clampLineEndToVocal(39, 45, [])).toBe(45)
  })

  it('never clamps below the minimum span, never above the raw end', () => {
    expect(clampLineEndToVocal(39, 45, [note(39, 39.1)])).toBeCloseTo(
      39 + SUNG_END_MIN_SPAN_SEC,
      5,
    )
    expect(clampLineEndToVocal(39, 40, [note(39, 39.9)])).toBe(40)
  })
})

describe('synthesizeLastWordEnd', () => {
  it('gives a start-only mapped last word its vocal end', () => {
    const end = synthesizeLastWordEnd([39.2], 45, [note(39.1, 40.2)])
    expect(end).toBeCloseTo(40.2 + SUNG_END_RELEASE_SEC, 5)
  })

  it('stays undefined without word times or overlapping notes', () => {
    expect(synthesizeLastWordEnd(undefined, 45, [note(39, 40)])).toBeUndefined()
    expect(synthesizeLastWordEnd([], 45, [note(39, 40)])).toBeUndefined()
    expect(synthesizeLastWordEnd([39.2], 45, [note(50, 51)])).toBeUndefined()
  })

  it('rejects an end at or before the word start', () => {
    // Note fully before the last word's start-bounded window.
    expect(synthesizeLastWordEnd([41], 45, [note(39, 40.5)])).toBeUndefined()
  })
})

describe('cappedEvenLineDuration', () => {
  it('caps a single short word before a long gap', () => {
    const capped = cappedEvenLineDuration(['Valjda'], 6)
    expect(capped).toBeLessThan(1.5)
    expect(capped).toBeGreaterThanOrEqual(SUNG_END_MIN_SPAN_SEC)
  })

  it('never extends beyond the raw duration', () => {
    expect(cappedEvenLineDuration(['a'], 0.4)).toBe(0.4)
    const crowded = cappedEvenLineDuration(
      ['many', 'words', 'crammed', 'into', 'a', 'tight', 'phrase'],
      2,
    )
    expect(crowded).toBe(2)
  })
})

describe('computeActiveWord fallback with the cap', () => {
  // Single word, line span 39..45 (the screenshot case), no word times.
  it('completes a lone word quickly and dwells lit through the gap', () => {
    const early = computeActiveWord(['Valjda'], 39, 45, undefined, 39.4)
    expect(early.activeUpTo === 0 || early.fraction > 0.2).toBe(true)

    // Two seconds in — far past any plausible sung duration — fully lit.
    const later = computeActiveWord(['Valjda'], 39, 45, undefined, 41)
    expect(later.activeUpTo).toBe(0)
    expect(later.fraction).toBe(1)

    // …and still simply lit near the end of the gap, not mid-sweep.
    const nearNext = computeActiveWord(['Valjda'], 39, 45, undefined, 44.5)
    expect(nearNext.activeUpTo).toBe(0)
    expect(nearNext.fraction).toBe(1)
  })

  it('keeps normal pacing when the line span is already tight', () => {
    const mid = computeActiveWord(['two', 'words'], 10, 11.2, undefined, 10.6)
    expect(mid.activeUpTo).toBeLessThan(2)
  })
})
