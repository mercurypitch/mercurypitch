// ============================================================
// Drum pattern library tests — the catalog drift gate
// ============================================================
//
// A typo in a grid string is invisible on the page and silent at runtime, so
// these tests are the thing that catches it. Every catalog entry is parsed,
// projected into a real session document, and checked for musical sanity.

import { describe, expect, it } from 'vitest'
import { HUMANIZE_STYLE_PROFILES } from '../groove/groove-humanize'
import { createDrumPatternDocument, drumPatternDurationBeats, drumPatternHits, drumPatternIssues, } from './drum-pattern'
import { DRUM_PATTERN_STYLE_LABELS, DRUM_PATTERN_STYLE_ORDER, DRUM_PATTERNS, drumPatternsForStyle, findDrumPattern, } from './drum-pattern-library'

describe('DRUM_PATTERNS', () => {
  it('has unique ids', () => {
    const ids = DRUM_PATTERNS.map((pattern) => pattern.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('covers every humanize style with at least three grooves', () => {
    for (const style of DRUM_PATTERN_STYLE_ORDER) {
      expect(drumPatternsForStyle(style).length).toBeGreaterThanOrEqual(3)
    }
    expect(new Set(DRUM_PATTERN_STYLE_ORDER)).toEqual(
      new Set(Object.keys(HUMANIZE_STYLE_PROFILES)),
    )
    expect(Object.keys(DRUM_PATTERN_STYLE_LABELS).sort()).toEqual(
      [...DRUM_PATTERN_STYLE_ORDER].sort(),
    )
  })

  it.each(DRUM_PATTERNS.map((pattern) => [pattern.id, pattern] as const))(
    '%s parses with no structural issue',
    (_id, pattern) => {
      expect(drumPatternIssues(pattern)).toEqual([])
    },
  )

  it.each(DRUM_PATTERNS.map((pattern) => [pattern.id, pattern] as const))(
    '%s projects into a playable document',
    (_id, pattern) => {
      const document = createDrumPatternDocument(pattern)

      expect(document).not.toBeNull()
      expect(document?.hitCount).toBeGreaterThan(0)
      expect(document?.droppedHitCount).toBe(0)
      // A hit may hold past the final step; it must not start past the loop.
      const hits = drumPatternHits(pattern)
      const lastStart = hits.reduce(
        (latest, hit) => Math.max(latest, hit.startBeat),
        0,
      )
      expect(lastStart).toBeLessThan(drumPatternDurationBeats(pattern))
    },
  )

  it.each(DRUM_PATTERNS.map((pattern) => [pattern.id, pattern] as const))(
    '%s declares a tempo inside its own range',
    (_id, pattern) => {
      const [minimum, maximum] = pattern.tempoRange
      expect(minimum).toBeLessThan(maximum)
      expect(pattern.tempoBpm).toBeGreaterThanOrEqual(minimum)
      expect(pattern.tempoBpm).toBeLessThanOrEqual(maximum)
    },
  )

  it.each(DRUM_PATTERNS.map((pattern) => [pattern.id, pattern] as const))(
    '%s names its provenance',
    (_id, pattern) => {
      expect(pattern.provenance.attribution.length).toBeGreaterThan(0)
      expect(pattern.provenance.license.length).toBeGreaterThan(0)
      expect(pattern.description.length).toBeGreaterThan(20)
    },
  )
})

describe('findDrumPattern', () => {
  it('resolves a known id and refuses an unknown one', () => {
    expect(findDrumPattern('rock-straight-backbeat')?.style).toBe('rock')
    expect(findDrumPattern('no-such-pattern')).toBeNull()
  })
})
