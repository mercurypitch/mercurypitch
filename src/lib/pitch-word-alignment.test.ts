// ============================================================
// Pitch-Word Alignment Unit Tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { PITCH_WORD_TEST_CASES, validateAlignment, } from '@/data/pitch-word-test-cases'
import type { MergedNote } from './midi-generator'
import { alignPitchToWords, filterWordSegments } from './pitch-word-alignment'
import type { WhisperSegment } from './whisper-service'

describe('alignPitchToWords', () => {
  // ── Test each test case ────────────────────────────────────
  for (const tc of PITCH_WORD_TEST_CASES) {
    it(`${tc.id}: ${tc.description}`, () => {
      const result = alignPitchToWords(tc.melody, tc.lyrics)
      const { passed, failures } = validateAlignment(result, tc.expectedMapping)
      if (!passed) {
        console.error('Failures:', failures)
      }
      expect(passed).toBe(true)
    })
  }

  // ── Accuracy thresholds ────────────────────────────────────
  it('achieves 100% accuracy for perfectly aligned notes', () => {
    const notes: MergedNote[] = [
      { midi: 60, noteName: 'C4', startSec: 0, endSec: 0.5 },
      { midi: 64, noteName: 'E4', startSec: 0.5, endSec: 1.0 },
    ]
    const segments: WhisperSegment[] = [
      { text: 'do', timestamp: [0, 0.5] },
      { text: 're', timestamp: [0.5, 1.0] },
    ]
    const result = alignPitchToWords(notes, segments)
    expect(result.accuracy).toBe(1.0)
    expect(result.mappedWords).toBe(2)
    expect(result.unmappedWords).toBe(0)
  })

  it('marks words outside any note as unmapped', () => {
    const notes: MergedNote[] = [
      { midi: 60, noteName: 'C4', startSec: 1.0, endSec: 2.0 },
    ]
    const segments: WhisperSegment[] = [
      { text: 'before', timestamp: [0, 0.5] },
      { text: 'sing', timestamp: [1.0, 2.0] },
      { text: 'after', timestamp: [2.5, 3.0] },
    ]
    const result = alignPitchToWords(notes, segments)
    expect(result.totalWords).toBe(3)
    expect(result.mappedWords).toBe(1)
    expect(result.unmappedWords).toBe(2)
    expect(result.alignedWords[1].midi).toBe(60)
    expect(result.alignedWords[0].midi).toBeNull()
    expect(result.alignedWords[2].midi).toBeNull()
  })

  // ── Edge cases ─────────────────────────────────────────────
  it('handles empty inputs', () => {
    const empty = alignPitchToWords([], [])
    expect(empty.totalWords).toBe(0)
    expect(empty.mappedWords).toBe(0)
    expect(empty.accuracy).toBe(0)
  })

  it('handles notes with no words', () => {
    const notes: MergedNote[] = [
      { midi: 60, noteName: 'C4', startSec: 0, endSec: 1.0 },
    ]
    const result = alignPitchToWords(notes, [])
    expect(result.totalWords).toBe(0)
    expect(result.mappedWords).toBe(0)
  })

  it('handles words with no notes (all unmapped)', () => {
    const segments: WhisperSegment[] = [{ text: 'quiet', timestamp: [0, 1.0] }]
    const result = alignPitchToWords([], segments)
    expect(result.totalWords).toBe(1)
    expect(result.mappedWords).toBe(0)
    expect(result.unmappedWords).toBe(1)
    expect(result.alignedWords[0].midi).toBeNull()
    expect(result.accuracy).toBe(0)
  })

  it('picks best overlapping note when multiple candidates exist', () => {
    const notes: MergedNote[] = [
      { midi: 60, noteName: 'C4', startSec: 0, endSec: 0.3 },
      { midi: 64, noteName: 'E4', startSec: 0.2, endSec: 1.0 },
    ]
    const segments: WhisperSegment[] = [{ text: 'word', timestamp: [0, 1.0] }]
    const result = alignPitchToWords(notes, segments)
    // E4 covers 0.2-1.0 = 0.8s of the word; C4 covers 0-0.3 = 0.3s → E4 wins
    expect(result.alignedWords[0].midi).toBe(64)
    expect(result.alignedWords[0].noteName).toBe('E4')
  })

  it('computes confidence as overlap ratio', () => {
    const notes: MergedNote[] = [
      { midi: 60, noteName: 'C4', startSec: 0.25, endSec: 1.0 },
    ]
    const segments: WhisperSegment[] = [{ text: 'half', timestamp: [0, 0.5] }]
    const result = alignPitchToWords(notes, segments)
    // Word [0, 0.5] duration=0.5s; note overlaps [0.25, 0.5] = 0.25s → 0.5 ratio
    expect(result.alignedWords[0].confidence).toBeCloseTo(0.5, 2)
  })

  it('returns zero confidence for unmapped words', () => {
    const result = alignPitchToWords([], [{ text: 'nope', timestamp: [0, 1] }])
    expect(result.alignedWords[0].confidence).toBe(0)
    expect(result.alignedWords[0].midi).toBeNull()
    expect(result.alignedWords[0].noteName).toBeNull()
  })
})

describe('filterWordSegments', () => {
  it('removes empty and filler segments', () => {
    const segments: WhisperSegment[] = [
      { text: '', timestamp: [0, 0.1] },
      { text: 'hello', timestamp: [0.1, 0.5] },
      { text: '.', timestamp: [0.5, 0.6] },
      { text: '...', timestamp: [0.6, 0.7] },
      { text: '[Music]', timestamp: [0.7, 0.8] },
      { text: 'world', timestamp: [0.8, 1.2] },
    ]
    const filtered = filterWordSegments(segments)
    expect(filtered).toHaveLength(2)
    expect(filtered[0].text).toBe('hello')
    expect(filtered[1].text).toBe('world')
  })

  it('keeps whitespace-trimmable text', () => {
    const segments: WhisperSegment[] = [
      { text: '  word  ', timestamp: [0, 0.5] },
    ]
    const filtered = filterWordSegments(segments)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].text.trim()).toBe('word')
  })
})
