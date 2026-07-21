// ============================================================
// Whisper Hygiene & Alignment Selection Unit Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LrcLine } from '@/lib/lyrics-service'
import { filterWordSegments, splitMultiWordSegments, } from '@/lib/pitch-word-alignment'
import { deduplicateWhisperSegments, evaluateWhisperMatchQuality, MIN_WHISPER_MATCH_QUALITY, selectAlignmentSegments, } from '@/lib/transcription-alignment-utils'
import type { WhisperSegment } from '@/lib/whisper-service'

describe('Whisper Hygiene — Segment Filtering (REQ-WSP-001, REQ-WSP-002)', () => {
  it('drops zero-length and negative-duration segments', () => {
    const segments: WhisperSegment[] = [
      { text: 'zero-length', timestamp: [2.0, 2.0] },
      { text: 'negative-duration', timestamp: [3.5, 1.2] },
      { text: 'valid segment', timestamp: [1.0, 2.5] },
    ]
    const filtered = filterWordSegments(segments)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].text).toBe('valid segment')
  })

  it('drops empty and filler segments', () => {
    const segments: WhisperSegment[] = [
      { text: '   ', timestamp: [0, 1] },
      { text: '[Music]', timestamp: [1, 2] },
      { text: '(laughter)', timestamp: [2, 3] },
      { text: '...', timestamp: [3, 4] },
      { text: 'actual lyrics', timestamp: [4, 5] },
    ]
    const filtered = filterWordSegments(segments)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].text).toBe('actual lyrics')
  })

  it('deduplicates overlapping segments while dropping invalid timestamps', () => {
    const segments: WhisperSegment[] = [
      { text: 'invalid', timestamp: [1, 1] },
      { text: 'first', timestamp: [0, 5] },
      { text: 'overlap-dropped', timestamp: [1, 3] },
      { text: 'second', timestamp: [5.1, 10] },
    ]
    const deduped = deduplicateWhisperSegments(segments)
    expect(deduped).toHaveLength(2)
    expect(deduped[0].text).toBe('first')
    expect(deduped[1].text).toBe('second')
  })

  it('skips zero-length segments during multi-word splitting', () => {
    const segments: WhisperSegment[] = [
      { text: 'zero length multi word', timestamp: [5, 5] },
      { text: 'valid multi word', timestamp: [0, 2] },
    ]
    const split = splitMultiWordSegments(segments)
    expect(split).toHaveLength(3)
    expect(split.map((s) => s.text)).toEqual(['valid', 'multi', 'word'])
  })
})

describe('Whisper Match Quality Evaluation (REQ-WSP-003)', () => {
  const lrcLines: LrcLine[] = [
    { time: 0, text: 'Is this the real life' },
    { time: 5, text: 'Is this just fantasy' },
  ]

  it('returns 1.0 for perfect text match', () => {
    const whisper: WhisperSegment[] = [
      { text: 'Is this the real life', timestamp: [0, 4] },
      { text: 'Is this just fantasy', timestamp: [5, 9] },
    ]
    const score = evaluateWhisperMatchQuality(whisper, lrcLines)
    expect(score).toBe(1.0)
  })

  it('returns high score for partial text match', () => {
    const whisper: WhisperSegment[] = [
      { text: 'Is this real life', timestamp: [0, 4] },
      { text: 'Is this fantasy', timestamp: [5, 9] },
    ]
    const score = evaluateWhisperMatchQuality(whisper, lrcLines)
    expect(score).toBeGreaterThan(0.5)
  })

  it('returns 0.0 for completely hallucinated/unmatched text', () => {
    const whisper: WhisperSegment[] = [
      { text: 'la la la background guitar solo', timestamp: [0, 4] },
      { text: 'instrumental noise segment', timestamp: [5, 9] },
    ]
    const score = evaluateWhisperMatchQuality(whisper, lrcLines)
    expect(score).toBe(0.0)
  })

  it('returns 0.0 for empty inputs', () => {
    expect(evaluateWhisperMatchQuality([], lrcLines)).toBe(0.0)
    expect(
      evaluateWhisperMatchQuality([{ text: 'hello', timestamp: [0, 1] }], []),
    ).toBe(0.0)
  })
})

describe('Alignment Segment Selection (REQ-WSP-004, REQ-WSP-005)', () => {
  const lineOnlyLrc: LrcLine[] = [
    { time: 0, text: 'Someday I will fly away' },
    { time: 5, text: 'To a land far away' },
  ]

  const wordTimedLrc = [
    {
      time: 0,
      words: ['Someday', 'I', 'will'],
      wordTimes: [0, 1.2, 2.1],
    },
  ]

  it('prioritizes word-timed LRC over Whisper (REQ-WSP-005)', () => {
    const whisper: WhisperSegment[] = [
      { text: 'Someday I will fly away', timestamp: [0, 4] },
    ]
    const result = selectAlignmentSegments(whisper, wordTimedLrc)
    expect(result.wordSource).toBe('lrc-word')
    expect(result.segments).toHaveLength(3)
    expect(result.segments[0].text).toBe('Someday')
  })

  it('skips Whisper in favor of line-only LRC when Whisper match quality is bad (REQ-WSP-004)', () => {
    const hallucinatedWhisper: WhisperSegment[] = [
      { text: 'gibberish noise completely wrong words', timestamp: [0, 4] },
    ]
    const result = selectAlignmentSegments(hallucinatedWhisper, lineOnlyLrc)
    expect(result.wordSource).toBe('lrc-line')
    expect(result.matchQuality).toBeLessThan(MIN_WHISPER_MATCH_QUALITY)
    expect(result.segments.length).toBeGreaterThan(0)
  })

  it('uses Whisper over line-only LRC when Whisper match quality is good', () => {
    const goodWhisper: WhisperSegment[] = [
      { text: 'Someday I will fly away', timestamp: [0.2, 4.8] },
      { text: 'To a land far away', timestamp: [5.1, 9.8] },
    ]
    const result = selectAlignmentSegments(goodWhisper, lineOnlyLrc)
    expect(result.wordSource).toBe('whisper')
    expect(result.matchQuality).toBeGreaterThanOrEqual(
      MIN_WHISPER_MATCH_QUALITY,
    )
    expect(result.segments).toHaveLength(2)
  })

  it('falls back to line-only LRC when Whisper returns no valid segments', () => {
    const emptyWhisper: WhisperSegment[] = [
      { text: '[Music]', timestamp: [0, 5] },
      { text: 'zero', timestamp: [2, 2] },
    ]
    const result = selectAlignmentSegments(emptyWhisper, lineOnlyLrc)
    expect(result.wordSource).toBe('lrc-line')
  })

  it('uses sanitized Whisper when no LRC is available', () => {
    const whisper: WhisperSegment[] = [
      { text: '[Music]', timestamp: [0, 1] },
      { text: 'Hello world', timestamp: [1.2, 3.5] },
    ]
    const result = selectAlignmentSegments(whisper, [])
    expect(result.wordSource).toBe('whisper')
    expect(result.segments).toHaveLength(1)
    expect(result.segments[0].text).toBe('Hello world')
  })

  it('returns empty selection when no LRC or valid Whisper segments exist', () => {
    const result = selectAlignmentSegments([], [])
    expect(result.wordSource).toBe('none')
    expect(result.segments).toHaveLength(0)
  })
})
