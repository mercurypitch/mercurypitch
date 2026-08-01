import { describe, expect, it } from 'vitest'
import { buildWordNoteIndex, glyphForWordTime, hasWordNotes, } from '@/features/stem-mixer/zen-note-glyphs'
import type { AlignedWord } from '@/lib/pitch-word-alignment'

const aligned = (startSec: number, noteName: string | null): AlignedWord => ({
  word: 'la',
  startSec,
  endSec: startSec + 0.4,
  midi: noteName === null ? null : 60,
  noteName,
  confidence: 0.9,
})

describe('zen note glyphs — word→note lookup', () => {
  it('indexes aligned words by start time and looks them up exactly', () => {
    const index = buildWordNoteIndex([
      aligned(12.34, 'G4'),
      aligned(13.1, 'A4'),
    ])
    expect(hasWordNotes(index)).toBe(true)
    expect(index.times.length).toBe(2)
    expect(glyphForWordTime(index, 12.34)).toBe('G4')
    expect(glyphForWordTime(index, 13.1)).toBe('A4')
  })

  it('absorbs cross-source drift between display words and aligned words', () => {
    // The regression: when Whisper wins the segment-source contest the
    // aligned starts are Whisper's, the sheet's are the LRC's — real
    // drift of 100-300ms. The exact-only lookup showed no glyphs at all.
    const index = buildWordNoteIndex([aligned(5.0, 'C4')])
    expect(glyphForWordTime(index, 5.001)).toBe('C4')
    expect(glyphForWordTime(index, 4.999)).toBe('C4')
    expect(glyphForWordTime(index, 5.18)).toBe('C4')
    expect(glyphForWordTime(index, 4.72)).toBe('C4')
  })

  it('never borrows a note across a silence gap', () => {
    const index = buildWordNoteIndex([aligned(5.0, 'C4')])
    expect(glyphForWordTime(index, 5.6)).toBeNull()
    expect(glyphForWordTime(index, 3.9)).toBeNull()
  })

  it('nearest neighbour wins when two aligned words straddle the time', () => {
    const index = buildWordNoteIndex([aligned(5.0, 'C4'), aligned(5.5, 'E4')])
    expect(glyphForWordTime(index, 5.2)).toBe('C4')
    expect(glyphForWordTime(index, 5.35)).toBe('E4')
  })

  it('skips unmapped words so no empty chips render', () => {
    const index = buildWordNoteIndex([
      aligned(1, null),
      aligned(2, ''),
      aligned(3, 'E3'),
    ])
    expect(index.times.length).toBe(1)
    // 1s and 2s sit farther than the tolerance from the only mapped word.
    expect(glyphForWordTime(index, 1)).toBeNull()
    expect(glyphForWordTime(index, 3)).toBe('E3')
  })

  it('handles missing word times and empty alignments', () => {
    const index = buildWordNoteIndex([])
    expect(hasWordNotes(index)).toBe(false)
    expect(glyphForWordTime(index, undefined)).toBeNull()
    expect(glyphForWordTime(index, Number.NaN)).toBeNull()
    expect(glyphForWordTime(index, 0)).toBeNull()
  })
})
