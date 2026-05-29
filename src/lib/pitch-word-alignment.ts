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

/** Minimal shape needed from LRC entries to extract word timings. */
export interface LrcWordEntry {
  time: number
  endTime?: number
  words: string[]
  wordTimes?: number[]
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

/**
 * Convert LRC canonical entries (with optional word-level timestamps)
 * into WhisperSegment-shaped objects for use with alignPitchToWords.
 * Skips rest entries.
 */
export function lrcEntriesToSegments(
  entries: LrcWordEntry[],
): WhisperSegment[] {
  const segments: WhisperSegment[] = []

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (entry.words.length === 0) continue

    const wordTimes = entry.wordTimes
    const lineEnd =
      entry.endTime ??
      (i + 1 < entries.length ? entries[i + 1].time : entry.time + 5)

    if (wordTimes && wordTimes.length > 0) {
      for (let j = 0; j < entry.words.length; j++) {
        const start = wordTimes[j] ?? entry.time
        const end =
          j + 1 < wordTimes.length
            ? wordTimes[j + 1]
            : j + 1 < entry.words.length
              ? lineEnd
              : lineEnd
        segments.push({
          text: entry.words[j],
          timestamp: [start, Math.max(start + 0.05, end)],
        })
      }
    } else {
      // No word-level timestamps — distribute evenly across line duration
      const duration = lineEnd - entry.time
      const wordDuration = Math.max(0.05, duration / entry.words.length)
      for (let j = 0; j < entry.words.length; j++) {
        const start = entry.time + j * wordDuration
        segments.push({
          text: entry.words[j],
          timestamp: [start, start + wordDuration],
        })
      }
    }
  }

  return segments
}
