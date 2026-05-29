// ============================================================
// Pitch-Word Alignment — map whisper segments to detected notes
// ============================================================

import type { LrcLine } from './lyrics-service'
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

/** Debug entry for a single word-to-note mapping (serializable for test fixtures) */
export interface AlignmentDebugEntry {
  idx: number
  word: string
  wordStart: number
  wordEnd: number
  mappedNote: string | null
  mappedMidi: number | null
  noteStart: number | null
  noteEnd: number | null
  overlapSec: number
  confidence: number
  /** For unmapped words: info about the nearest note */
  nearestNote: string | null
  nearestGapSec: number | null
}

export interface AlignmentResult {
  alignedWords: AlignedWord[]
  totalWords: number
  mappedWords: number
  unmappedWords: number
  accuracy: number
  /** Detailed per-word debug entries for logging/test fixtures */
  debugEntries: AlignmentDebugEntry[]
}

/** Minimal shape needed from LRC entries to extract word timings. */
export interface LrcWordEntry {
  time: number
  endTime?: number
  words: string[]
  wordTimes?: number[]
}

/** Tunable parameters for the alignment algorithm. All are optional with defaults. */
export interface AlignmentConfig {
  /**
   * Minimum overlap ratio (overlap / word duration) to count a word as "mapped".
   * Below this threshold the word is treated as unmapped even if it touches a note.
   * Default: 0.1 (10%)
   */
  minOverlapRatio?: number
}

/** Default alignment configuration. Exported so callers can inspect/override individual fields. */
export const DEFAULT_ALIGNMENT_CONFIG: Required<AlignmentConfig> = {
  minOverlapRatio: 0.1,
}

/**
 * Map whisper-timestamped word segments to detected pitch notes
 * by temporal overlap. Each word is assigned to the note with the
 * highest overlap ratio within its time bracket.
 *
 * Confidence = overlap duration / word duration.
 * Words with no overlapping note (silence/breath) get midi=null.
 *
 * Uses binary search to find the first potentially-overlapping note,
 * then scans forward. Requires `notes` sorted by startSec.
 */
export function alignPitchToWords(
  notes: MergedNote[],
  segments: WhisperSegment[],
  config: AlignmentConfig = {},
): AlignmentResult {
  const { minOverlapRatio } = { ...DEFAULT_ALIGNMENT_CONFIG, ...config }
  const alignedWords: AlignedWord[] = []
  const debugEntries: AlignmentDebugEntry[] = []
  let mappedWords = 0
  let unmappedWords = 0

  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si]
    const [wordStart, wordEnd] = seg.timestamp
    const wordDuration = Math.max(0.001, wordEnd - wordStart)

    let bestNote: MergedNote | null = null
    let bestOverlap = 0
    let bestOverlapDuration = 0

    // Binary search: find first note that could overlap this word
    // A note overlaps if note.endSec > wordStart, so find the first
    // note where endSec > wordStart
    let lo = 0
    let hi = notes.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (notes[mid].endSec <= wordStart) lo = mid + 1
      else hi = mid
    }

    // Scan forward from the binary search result
    for (let ni = lo; ni < notes.length; ni++) {
      const note = notes[ni]
      // Once notes start after the word ends, no more overlaps possible
      if (note.startSec >= wordEnd) break

      const overlapStart = Math.max(wordStart, note.startSec)
      const overlapEnd = Math.min(wordEnd, note.endSec)
      if (overlapEnd <= overlapStart) continue

      const overlapDuration = overlapEnd - overlapStart
      const overlapRatio = overlapDuration / wordDuration

      if (overlapRatio >= bestOverlap) {
        bestOverlap = overlapRatio
        bestOverlapDuration = overlapDuration
        bestNote = note
      }
    }

    // Apply minimum overlap threshold
    if (bestNote && bestOverlap >= minOverlapRatio) {
      alignedWords.push({
        word: seg.text.trim(),
        startSec: wordStart,
        endSec: wordEnd,
        midi: bestNote.midi,
        noteName: bestNote.noteName,
        confidence: Math.round(bestOverlap * 100) / 100,
      })
      debugEntries.push({
        idx: si,
        word: seg.text.trim(),
        wordStart,
        wordEnd,
        mappedNote: bestNote.noteName,
        mappedMidi: bestNote.midi,
        noteStart: bestNote.startSec,
        noteEnd: bestNote.endSec,
        overlapSec: Math.round(bestOverlapDuration * 1000) / 1000,
        confidence: Math.round(bestOverlap * 100) / 100,
        nearestNote: null,
        nearestGapSec: null,
      })
      mappedWords++
    } else {
      // Find nearest note for debug context
      let nearestNote: string | null = null
      let nearestGapSec: number | null = null
      if (notes.length > 0) {
        const wordMid = (wordStart + wordEnd) / 2
        let closestDist = Infinity
        // Check a few notes around the binary search position
        const searchStart = Math.max(0, lo - 2)
        const searchEnd = Math.min(notes.length, lo + 3)
        for (let ni = searchStart; ni < searchEnd; ni++) {
          const note = notes[ni]
          const dist = Math.min(
            Math.abs(note.startSec - wordMid),
            Math.abs(note.endSec - wordMid),
          )
          if (dist < closestDist) {
            closestDist = dist
            nearestNote = note.noteName
            nearestGapSec = Math.round(dist * 1000) / 1000
          }
        }
      }

      alignedWords.push({
        word: seg.text.trim(),
        startSec: wordStart,
        endSec: wordEnd,
        midi: null,
        noteName: null,
        confidence: 0,
      })
      debugEntries.push({
        idx: si,
        word: seg.text.trim(),
        wordStart,
        wordEnd,
        mappedNote: null,
        mappedMidi: null,
        noteStart: null,
        noteEnd: null,
        overlapSec: 0,
        confidence: 0,
        nearestNote,
        nearestGapSec,
      })
      unmappedWords++
    }
  }

  const totalWords = alignedWords.length
  const accuracy = totalWords > 0 ? mappedWords / totalWords : 0

  return {
    alignedWords,
    totalWords,
    mappedWords,
    unmappedWords,
    accuracy,
    debugEntries,
  }
}

/**
 * Split multi-word whisper segments into individual word segments
 * with evenly-distributed timestamps. Single-word segments pass through unchanged.
 * This handles whisper-tiny returning line-level chunks instead of word-level.
 */
export function splitMultiWordSegments(
  segments: WhisperSegment[],
): WhisperSegment[] {
  const result: WhisperSegment[] = []
  for (const seg of segments) {
    const words = seg.text.trim().split(/\s+/).filter(Boolean)
    if (words.length <= 1) {
      result.push(seg)
      continue
    }
    const [start, end] = seg.timestamp
    const duration = Math.max(0.001, end - start)
    const perWord = duration / words.length
    for (let i = 0; i < words.length; i++) {
      result.push({
        text: words[i],
        timestamp: [start + i * perWord, start + (i + 1) * perWord],
      })
    }
  }
  return result
}

/**
 * Filter segments to only those containing actual words,
 * stripping empty/filler entries.
 */
export function filterWordSegments(
  segments: WhisperSegment[],
): WhisperSegment[] {
  // Matches bracketed/parenthesized tags like [Music], (laughing),
  // punctuation-only strings, and unicode music symbols
  const FILLER_PATTERN = /^\[.*\]$|^\(.*\)$|^[.,;:!?…♪~\-–—]+$|^$/
  return segments.filter((s) => {
    const text = s.text.trim()
    return text.length > 0 && !FILLER_PATTERN.test(text)
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

/**
 * Convert simple LRC lines (from parseLrcFile) to whisper-compatible segments.
 * Each line is split into words and distributed evenly across the line's timespan.
 */
export function lrcLinesToSegments(lines: LrcLine[]): WhisperSegment[] {
  const segments: WhisperSegment[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const words = line.text.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue

    const lineEnd = i + 1 < lines.length ? lines[i + 1].time : line.time + 5
    const duration = lineEnd - line.time
    const wordDuration = Math.max(0.05, duration / words.length)

    for (let j = 0; j < words.length; j++) {
      const start = line.time + j * wordDuration
      segments.push({
        text: words[j],
        timestamp: [start, Math.min(lineEnd, start + wordDuration)],
      })
    }
  }

  return segments
}
