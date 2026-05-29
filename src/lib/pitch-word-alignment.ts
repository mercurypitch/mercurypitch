// ============================================================
// Pitch-Word Alignment — map whisper segments to detected notes
// ============================================================

import type { MergedNote } from './midi-generator'
import type { WhisperSegment } from './whisper-service'

export interface AlignedWord {
  word: string
  startSec: number
  endSec: number
  midi: number | null
  noteName: string | null
  confidence: number // 0–1, overlap ratio
}

export interface AlignmentResult {
  alignedWords: AlignedWord[]
  totalWords: number
  mappedWords: number
  unmappedWords: number
  accuracy: number
}

/**
 * Map whisper-timestamped word segments to detected pitch notes
 * by temporal overlap. Each word is assigned to the note with the
 * highest overlap ratio within its time bracket.
 *
 * Confidence = overlap duration / word duration.
 * Words with no overlapping note (silence/breath) get midi=null.
 */
export function alignPitchToWords(
  notes: MergedNote[],
  segments: WhisperSegment[],
): AlignmentResult {
  const alignedWords: AlignedWord[] = []
  let mappedWords = 0
  let unmappedWords = 0

  for (const seg of segments) {
    const [wordStart, wordEnd] = seg.timestamp
    const wordDuration = Math.max(0.001, wordEnd - wordStart)

    let bestNote: MergedNote | null = null
    let bestOverlap = 0

    for (const note of notes) {
      const overlapStart = Math.max(wordStart, note.startSec)
      const overlapEnd = Math.min(wordEnd, note.endSec)
      if (overlapEnd <= overlapStart) continue

      const overlapDuration = overlapEnd - overlapStart
      const overlapRatio = overlapDuration / wordDuration

      if (overlapRatio >= bestOverlap) {
        bestOverlap = overlapRatio
        bestNote = note
      }
    }

    if (bestNote && bestOverlap > 0) {
      alignedWords.push({
        word: seg.text.trim(),
        startSec: wordStart,
        endSec: wordEnd,
        midi: bestNote.midi,
        noteName: bestNote.noteName,
        confidence: Math.round(bestOverlap * 100) / 100,
      })
      mappedWords++
    } else {
      alignedWords.push({
        word: seg.text.trim(),
        startSec: wordStart,
        endSec: wordEnd,
        midi: null,
        noteName: null,
        confidence: 0,
      })
      unmappedWords++
    }
  }

  const totalWords = alignedWords.length
  const accuracy = totalWords > 0 ? mappedWords / totalWords : 0

  return { alignedWords, totalWords, mappedWords, unmappedWords, accuracy }
}

/**
 * Filter segments to only those containing actual words,
 * stripping empty/filler entries.
 */
export function filterWordSegments(
  segments: WhisperSegment[],
): WhisperSegment[] {
  return segments.filter((s) => {
    const text = s.text.trim()
    return (
      text.length > 0 && text !== '.' && text !== '...' && text !== '[Music]'
    )
  })
}
