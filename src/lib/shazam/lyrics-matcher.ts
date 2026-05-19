// ============================================================
// Lyrics Matcher — Match whisper transcript against LRC lyrics
//
// Given a Whisper transcription (with timestamps), find the best
// matching position in a song's synced LRC lyrics. This produces
// a time offset (seconds) into the song where the sung passage
// most likely begins.
// ============================================================

import type { LrcLine } from '@/lib/lyrics-service'
import { parseLrcFile } from '@/lib/lyrics-service'
import type { WhisperSegment } from '@/lib/whisper-service'

/** Result of a lyrics-based match against a single song */
export interface LyricsMatchResult {
  /** Song/session identifier */
  songId: string
  /** Display name of the matched song */
  songName: string
  /** 0-100 confidence in the lyrics match */
  confidence: number
  /** Offset in seconds from the start of the song where the match begins */
  matchOffsetSec: number
  /** The matched LRC line index */
  matchedLineIndex: number
  /** The matched transcript text (normalized) */
  matchedTranscript: string
  /** The matched lyric text (normalized) */
  matchedLyric: string
}

/** A song's lyrics data for matching */
export interface LyricsCatalogEntry {
  songId: string
  songName: string
  /** Raw LRC content (synced lyrics) */
  lrcContent: string
}

/**
 * Normalize text for fuzzy comparison:
 * lowercase, remove punctuation, collapse whitespace
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Compute a word-overlap similarity score between two normalized strings.
 * Returns 0-1 (1 = perfect match).
 */
function wordOverlapScore(a: string, b: string): number {
  const wordsA = a.split(' ').filter((w) => w.length > 0)
  const wordsB = b.split(' ').filter((w) => w.length > 0)
  if (wordsA.length === 0 || wordsB.length === 0) return 0

  const setB = new Set(wordsB)
  let matches = 0
  for (const word of wordsA) {
    if (setB.has(word)) matches++
  }

  // Jaccard-style: intersection / union
  const setA = new Set(wordsA)
  const union = new Set([...setA, ...setB])
  return matches / union.size
}

/**
 * Compute longest common subsequence ratio between two word arrays.
 * Returns 0-1 (1 = identical word sequence).
 */
function lcsRatio(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0

  const m = a.length
  const n = b.length
  // Use a 1D rolling array for memory efficiency
  let prev = new Uint16Array(n + 1)
  let curr = new Uint16Array(n + 1)

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1
      } else {
        curr[j] = Math.max(curr[j - 1], prev[j])
      }
    }
    ;[prev, curr] = [curr, prev]
    curr.fill(0)
  }

  const lcsLen = prev[n]
  return (2 * lcsLen) / (m + n)
}

/**
 * Find the best matching window of consecutive LRC lines for a given
 * transcript text. Tries sliding windows of 1-4 lines.
 */
function findBestLineWindow(
  lines: LrcLine[],
  transcriptNorm: string,
  transcriptWords: string[],
): { lineIndex: number; score: number; matchedText: string } {
  let bestScore = 0
  let bestIndex = 0
  let bestText = ''

  const maxWindow = Math.min(4, lines.length)

  for (let windowSize = 1; windowSize <= maxWindow; windowSize++) {
    for (let i = 0; i <= lines.length - windowSize; i++) {
      const windowText = lines
        .slice(i, i + windowSize)
        .map((l) => l.text)
        .join(' ')
      const windowNorm = normalize(windowText)
      if (windowNorm.length === 0) continue

      const windowWords = windowNorm.split(' ').filter((w) => w.length > 0)

      // Combined score: word overlap + sequence order (LCS)
      const overlap = wordOverlapScore(transcriptNorm, windowNorm)
      const seqScore = lcsRatio(transcriptWords, windowWords)
      const score = overlap * 0.4 + seqScore * 0.6

      if (score > bestScore) {
        bestScore = score
        bestIndex = i
        bestText = windowNorm
      }
    }
  }

  return { lineIndex: bestIndex, score: bestScore, matchedText: bestText }
}

/**
 * Match Whisper transcript segments against a catalog of songs with LRC lyrics.
 *
 * @param segments - Whisper output segments with timestamps
 * @param catalog - Array of songs with synced LRC lyrics
 * @param maxResults - Maximum number of results to return
 * @returns Sorted array of lyrics match results (best first)
 */
export function matchTranscriptToLyrics(
  segments: WhisperSegment[],
  catalog: LyricsCatalogEntry[],
  maxResults = 5,
): LyricsMatchResult[] {
  // Combine all transcript segments into one normalized string
  const fullTranscript = segments.map((s) => s.text).join(' ')
  const transcriptNorm = normalize(fullTranscript)
  if (transcriptNorm.length < 3) return []

  const transcriptWords = transcriptNorm.split(' ').filter((w) => w.length > 0)
  if (transcriptWords.length < 2) return []

  const results: LyricsMatchResult[] = []

  for (const entry of catalog) {
    const lines = parseLrcFile(entry.lrcContent)
    if (lines.length === 0) continue

    const { lineIndex, score, matchedText } = findBestLineWindow(
      lines,
      transcriptNorm,
      transcriptWords,
    )

    if (score < 0.15) continue // Too low to be meaningful

    // The match offset is the timestamp of the matched LRC line
    const matchOffsetSec = lines[lineIndex].time

    results.push({
      songId: entry.songId,
      songName: entry.songName,
      confidence: Math.round(score * 100),
      matchOffsetSec,
      matchedLineIndex: lineIndex,
      matchedTranscript: transcriptNorm,
      matchedLyric: matchedText,
    })
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence)
  return results.slice(0, maxResults)
}

/**
 * Combine melody DTW match confidence with lyrics match confidence
 * to decide the best seek position.
 *
 * @param melodyConfidence - 0-100 from DTW melody matching
 * @param melodyOffsetSec - seconds offset from DTW subsequence match
 * @param lyricsConfidence - 0-100 from lyrics matching
 * @param lyricsOffsetSec - seconds offset from LRC line timestamp
 * @returns The winning offset and source
 */
export function resolveSeekPosition(
  melodyConfidence: number,
  melodyOffsetSec: number | undefined,
  lyricsConfidence: number,
  lyricsOffsetSec: number | undefined,
): { offsetSec: number | undefined; source: 'melody' | 'lyrics' | 'none' } {
  const hasMelody = melodyOffsetSec !== undefined && melodyConfidence > 0
  const hasLyrics = lyricsOffsetSec !== undefined && lyricsConfidence > 0

  if (!hasMelody && !hasLyrics) {
    return { offsetSec: undefined, source: 'none' }
  }

  if (!hasLyrics) {
    return { offsetSec: melodyOffsetSec, source: 'melody' }
  }

  if (!hasMelody) {
    return { offsetSec: lyricsOffsetSec, source: 'lyrics' }
  }

  // Both available: pick whichever has higher confidence
  if (lyricsConfidence > melodyConfidence) {
    return { offsetSec: lyricsOffsetSec, source: 'lyrics' }
  }

  return { offsetSec: melodyOffsetSec, source: 'melody' }
}
