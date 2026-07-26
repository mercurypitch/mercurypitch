import { describe, expect, it } from 'vitest'
import { buildWordNoteIndex, glyphForWordTime, } from '@/features/stem-mixer/zen-note-glyphs'
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
    expect(index.size).toBe(2)
    expect(glyphForWordTime(index, 12.34)).toBe('G4')
    expect(glyphForWordTime(index, 13.1)).toBe('A4')
  })

  it('absorbs 1ms float drift between the LRC parse and the alignment', () => {
    const index = buildWordNoteIndex([aligned(5.0, 'C4')])
    expect(glyphForWordTime(index, 5.001)).toBe('C4')
    expect(glyphForWordTime(index, 4.999)).toBe('C4')
    // …but never re-maps a genuinely different word time
    expect(glyphForWordTime(index, 5.01)).toBeNull()
  })

  it('skips unmapped words so no empty chips render', () => {
    const index = buildWordNoteIndex([
      aligned(1, null),
      aligned(2, ''),
      aligned(3, 'E3'),
    ])
    expect(index.size).toBe(1)
    expect(glyphForWordTime(index, 1)).toBeNull()
    expect(glyphForWordTime(index, 3)).toBe('E3')
  })

  it('handles missing word times and empty alignments', () => {
    const index = buildWordNoteIndex([])
    expect(glyphForWordTime(index, undefined)).toBeNull()
    expect(glyphForWordTime(index, Number.NaN)).toBeNull()
    expect(glyphForWordTime(index, 0)).toBeNull()
  })
})
