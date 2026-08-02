import { describe, expect, it } from 'vitest'
import { buildWordNoteIndex, glyphForWordTime, hasWordNotes, noteForWord, wordWindow, } from '@/features/stem-mixer/zen-note-glyphs'
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

// ── The line-only sheet ──────────────────────────────────────────
// The case that broke this twice. An uploaded or line-timed LRC carries
// line times and nothing per word, so `wordTimes` is undefined — and any
// lookup keyed on the display word's own start returns null for every
// word, no matter how wide its tolerance. The panel had always handled
// this by estimating a window and matching on overlap; the zen stage had
// not. Both call the same function now, and these are the tests that
// fail if anyone keys on start times again.

describe('noteForWord on a sheet with no per-word timing', () => {
  // "Now a shadow on a hill" over 12.0-16.0s: four words, 1s each.
  const line = {
    time: 12,
    endTime: 16,
    words: ['Now', 'a', 'shadow', 'on'],
  }

  const words: AlignedWord[] = [
    aligned(12.1, 'G4'),
    aligned(13.2, 'A4'),
    aligned(14.05, 'B4'),
    aligned(15.3, 'C5'),
  ]

  it('still finds a note for every word', () => {
    const notes = line.words.map(
      (_, i) => noteForWord(words, line, i)?.noteName ?? null,
    )
    expect(notes).toEqual(['G4', 'A4', 'B4', 'C5'])
  })

  it('estimates windows evenly across the line', () => {
    expect(wordWindow(line, 0)).toEqual({ startSec: 12, endSec: 13 })
    expect(wordWindow(line, 3)).toEqual({ startSec: 15, endSec: 16 })
  })

  it('prefers real per-word times when the sheet has them', () => {
    const timed = { ...line, wordTimes: [12.0, 13.2, 14.0, 15.3] }
    expect(wordWindow(timed, 1).startSec).toBe(13.2)
    expect(noteForWord(words, timed, 1)?.noteName).toBe('A4')
  })

  it('returns null when nothing overlaps the word at all', () => {
    // Alignment covers a different part of the song entirely.
    const elsewhere = [aligned(90, 'G4'), aligned(91, 'A4')]
    expect(noteForWord(elsewhere, line, 0)).toBeNull()
  })

  it('has nothing to say without an alignment', () => {
    expect(noteForWord([], line, 0)).toBeNull()
  })

  it('skips aligned words the analysis could not name', () => {
    expect(noteForWord([aligned(12.1, null)], line, 0)).toBeNull()
  })
})
