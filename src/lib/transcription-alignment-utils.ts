/**
 * Shared transcription + alignment utilities.
 *
 * Extracted from StemMixer.tsx and PitchTestingTab.tsx to eliminate duplication.
 * Both components had near-identical whisper chunking, deduplication, alignment
 * pipeline, and debug-logging code.
 */

import type { LrcLine } from '@/lib/lyrics-service'
import type { MergedNote } from '@/lib/midi-generator'
import type { AlignmentResult, LrcWordEntry } from '@/lib/pitch-word-alignment'
import { alignPitchToWords, filterWordSegments, isValidSegmentTimestamp, lrcEntriesToSegments, lrcLinesToSegments, splitMultiWordSegments, } from '@/lib/pitch-word-alignment'
import type { WhisperSegment } from '@/lib/whisper-service'

// ── Whisper Chunking ───────────────────────────────────────────

/** Default chunk length in seconds for whisper transcription */
export const WHISPER_CHUNK_SEC = 30
/** Default overlap between consecutive chunks in seconds */
export const WHISPER_OVERLAP_SEC = 5
/** Whisper expects 16 kHz audio */
export const WHISPER_SAMPLE_RATE = 16000

/**
 * Splits audio data into overlapping chunks suitable for whisper transcription.
 */
export function chunkAudioForWhisper(
  audioData: Float32Array,
  sampleRate: number = WHISPER_SAMPLE_RATE,
  chunkSec: number = WHISPER_CHUNK_SEC,
  overlapSec: number = WHISPER_OVERLAP_SEC,
): Float32Array[] {
  const chunkLen = chunkSec * sampleRate
  const stride = (chunkSec - overlapSec) * sampleRate
  const chunks: Float32Array[] = []
  for (let off = 0; off < audioData.length; off += stride) {
    chunks.push(
      audioData.slice(off, Math.min(off + chunkLen, audioData.length)),
    )
  }
  return chunks
}

// ── Whisper Deduplication ──────────────────────────────────────

/**
 * Deduplicates overlapping whisper segments.
 * Drops a segment if its temporal midpoint falls before the end of the
 * previous segment (caused by chunk overlap), or if zero-length/invalid.
 */
export function deduplicateWhisperSegments(
  segments: WhisperSegment[],
): WhisperSegment[] {
  const deduplicated: WhisperSegment[] = []
  let previousAcceptedEnd = Number.NEGATIVE_INFINITY
  for (const segment of segments) {
    if (!isValidSegmentTimestamp(segment.timestamp)) continue
    const midpoint = (segment.timestamp[0] + segment.timestamp[1]) / 2
    if (midpoint <= previousAcceptedEnd) continue
    deduplicated.push(segment)
    previousAcceptedEnd = segment.timestamp[1]
  }
  return deduplicated
}

// ── Whisper Match Quality & Source Selection ───────────────────

export type WordSourceKind = 'lrc-word' | 'whisper' | 'lrc-line' | 'none'

export type LrcInputEntry = {
  type?: 'line' | 'rest'
  time: number
  text?: string
  words?: string[]
  wordTimes?: number[]
  endTime?: number
}

export interface AlignmentSegmentSelection {
  segments: WhisperSegment[]
  wordSource: WordSourceKind
  matchQuality?: number
}

/** Minimum match quality threshold (0-1) required to prefer Whisper over line-only LRC */
export const MIN_WHISPER_MATCH_QUALITY = 0.25

function tokenizeLyrics(text: string): string[] {
  const normalized = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}+/gu, '')
  return (normalized.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).map(
    (token) => token.replace(/['’]/g, ''),
  )
}

function multisetDice(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) return 0
  const remaining = new Map<string, number>()
  for (const token of right) {
    remaining.set(token, (remaining.get(token) ?? 0) + 1)
  }
  let matches = 0
  for (const token of left) {
    const count = remaining.get(token) ?? 0
    if (count === 0) continue
    matches++
    remaining.set(token, count - 1)
  }
  return (2 * matches) / (left.length + right.length)
}

function adjacentPairs(tokens: string[]): string[] {
  const pairs: string[] = []
  for (let index = 1; index < tokens.length; index++) {
    pairs.push(`${tokens[index - 1]}\u0000${tokens[index]}`)
  }
  return pairs
}

function isLyricEntry(entry: LrcInputEntry): boolean {
  if (entry.type === 'rest' || entry.text?.trim() === '~Rest~') return false
  const text =
    entry.text ?? (entry.words !== undefined ? entry.words.join(' ') : '')
  return tokenizeLyrics(text).length > 0
}

/**
 * Evaluates match quality (0 to 1) of Whisper transcription against reference LRC lyrics.
 */
export function evaluateWhisperMatchQuality(
  whisperSegments: WhisperSegment[],
  lrcLines: LrcInputEntry[],
): number {
  if (whisperSegments.length === 0 || lrcLines.length === 0) return 0

  const whisperWords = tokenizeLyrics(
    whisperSegments.map((segment) => segment.text).join(' '),
  )
  const lrcWords = tokenizeLyrics(
    lrcLines
      .map((l) => l.text ?? (l.words !== undefined ? l.words.join(' ') : ''))
      .join(' '),
  )

  if (whisperWords.length === 0 || lrcWords.length === 0) return 0

  const wordOverlap = multisetDice(whisperWords, lrcWords)
  const whisperPairs = adjacentPairs(whisperWords)
  const lrcPairs = adjacentPairs(lrcWords)
  const sequenceOverlap =
    whisperPairs.length > 0 && lrcPairs.length > 0
      ? multisetDice(whisperPairs, lrcPairs)
      : wordOverlap
  // Token overlap establishes that the same vocabulary is present; adjacent
  // pairs then strongly reward the lyric order. The small floor keeps very
  // short transcriptions comparable without allowing a reordered word bag to
  // masquerade as a good match.
  return wordOverlap * (0.1 + sequenceOverlap * 0.9)
}

/**
 * Selects the optimal word segments and source for alignment based on source priority
 * and Whisper match quality against reference LRC lyrics.
 *
 * Priority:
 * 1. Word-timed LRC (`lrc-word`) — user tapped / enhanced word timestamps always win.
 * 2. Whisper (`whisper`) — used if match quality >= MIN_WHISPER_MATCH_QUALITY against line LRC, or if no LRC is available.
 * 3. Line-only LRC (`lrc-line`) — used if word-timed LRC is absent and Whisper is missing or has bad match quality.
 */
export function selectAlignmentSegments(
  whisperSegments: WhisperSegment[],
  lrcLines: LrcInputEntry[],
): AlignmentSegmentSelection {
  const sanitizedWhisper = filterWordSegments(whisperSegments)
  const lyricLines = lrcLines.filter(isLyricEntry)
  const lrcHasWordTimes = lyricLines.some(
    (entry) => (entry.wordTimes?.length ?? 0) > 0,
  )

  let lrcSegments: WhisperSegment[] = []
  if (lyricLines.length > 0) {
    if (lrcHasWordTimes) {
      const wordEntries: LrcWordEntry[] = lyricLines.map((e) => ({
        time: e.time,
        endTime: e.endTime,
        words:
          e.words ??
          (typeof e.text === 'string' && e.text.length > 0
            ? e.text.split(/\s+/).filter(Boolean)
            : []),
        wordTimes: e.wordTimes,
      }))
      lrcSegments = lrcEntriesToSegments(wordEntries)
    } else {
      const lineEntries: LrcLine[] = lyricLines.map((e) => ({
        time: e.time,
        text: e.text ?? (e.words !== undefined ? e.words.join(' ') : ''),
      }))
      lrcSegments = lrcLinesToSegments(lineEntries)
    }
  }

  // 1. Word-timed LRC beats everything
  if (lrcHasWordTimes && lrcSegments.length > 0) {
    return {
      segments: lrcSegments,
      wordSource: 'lrc-word',
    }
  }

  // 2. If line-only LRC is available, check Whisper match quality
  if (lrcSegments.length > 0) {
    if (sanitizedWhisper.length === 0) {
      return {
        segments: lrcSegments,
        wordSource: 'lrc-line',
      }
    }
    const matchQuality = evaluateWhisperMatchQuality(
      sanitizedWhisper,
      lyricLines,
    )
    if (matchQuality < MIN_WHISPER_MATCH_QUALITY) {
      return {
        segments: lrcSegments,
        wordSource: 'lrc-line',
        matchQuality,
      }
    }
    return {
      segments: sanitizedWhisper,
      wordSource: 'whisper',
      matchQuality,
    }
  }

  // 3. No LRC available: use sanitized Whisper segments if present
  if (sanitizedWhisper.length > 0) {
    return {
      segments: sanitizedWhisper,
      wordSource: 'whisper',
    }
  }

  return {
    segments: [],
    wordSource: 'none',
  }
}

// ── Alignment Pipeline ─────────────────────────────────────────

/** Empty alignment result constant to avoid recreation */
const EMPTY_ALIGNMENT: AlignmentResult = {
  alignedWords: [],
  totalWords: 0,
  mappedWords: 0,
  unmappedWords: 0,
  accuracy: 0,
  debugEntries: [],
}

/**
 * Runs the full alignment pipeline: filter -> split -> align.
 * Returns EMPTY_ALIGNMENT if either input is empty.
 */
export function computeAlignment(
  notes: MergedNote[],
  wordSegments: WhisperSegment[],
): AlignmentResult {
  if (notes.length === 0 || wordSegments.length === 0) {
    return EMPTY_ALIGNMENT
  }
  const filtered = filterWordSegments(wordSegments)
  const split = splitMultiWordSegments(filtered)
  if (split.length === 0) {
    return EMPTY_ALIGNMENT
  }
  return alignPitchToWords(notes, split)
}

// ── Debug Logging ──────────────────────────────────────────────

/**
 * Formats and logs alignment debug entries to the console.
 * Used by both StemMixer and PitchTestingTab after transcription.
 */
export function formatAlignmentDebugLog(
  tag: string,
  result: AlignmentResult,
): void {
  console.log(
    `[${tag}] Word-to-note alignment: ${result.mappedWords}/${result.totalWords} mapped (${(result.accuracy * 100).toFixed(0)}%), ${result.unmappedWords} unmapped`,
  )

  if (result.debugEntries.length === 0) return

  const lines = result.debugEntries.map((e) => {
    const timeRange = `${e.wordStart.toFixed(2)}-${e.wordEnd.toFixed(2)}s`
    if (e.mappedNote != null) {
      return `  #${String(e.idx).padStart(3)} ${timeRange.padEnd(14)} ${JSON.stringify(e.word).padEnd(20)} -> ${e.mappedNote.padEnd(4)} (midi:${e.mappedMidi}) conf:${e.confidence} overlap:${e.overlapSec}s`
    }
    const nearest =
      e.nearestNote != null
        ? `(nearest: ${e.nearestNote} gap=${e.nearestGapSec}s)`
        : ''
    return `  #${String(e.idx).padStart(3)} ${timeRange.padEnd(14)} ${JSON.stringify(e.word).padEnd(20)} -> --  unmapped ${nearest}`
  })
  console.log(
    `[${tag}] Alignment map (${result.mappedWords}/${result.totalWords}):\n${lines.join('\n')}`,
  )
  console.log(
    `[${tag}] Alignment debug entries (JSON):`,
    JSON.stringify(result.debugEntries),
  )
}

/**
 * Runs alignment for both raw and denoised note sources and logs the comparison.
 * Allows easy A/B comparison of alignment quality between note sources.
 */
export function logAlignmentComparison(
  tag: string,
  rawNotes: MergedNote[],
  denoisedNotes: MergedNote[],
  wordSegments: WhisperSegment[],
): void {
  const filtered = filterWordSegments(wordSegments)
  const split = splitMultiWordSegments(filtered)

  if (rawNotes.length > 0 && split.length > 0) {
    const rawResult = alignPitchToWords(rawNotes, split)
    console.log(
      `[${tag}] RAW alignment: ${rawResult.mappedWords}/${rawResult.totalWords} mapped (${(rawResult.accuracy * 100).toFixed(0)}%) using ${rawNotes.length} raw notes`,
    )
  } else {
    console.log(
      `[${tag}] RAW alignment: skipped (${rawNotes.length} notes, ${split.length} words)`,
    )
  }

  if (denoisedNotes.length > 0 && split.length > 0) {
    const denoisedResult = alignPitchToWords(denoisedNotes, split)
    console.log(
      `[${tag}] DENOISED alignment: ${denoisedResult.mappedWords}/${denoisedResult.totalWords} mapped (${(denoisedResult.accuracy * 100).toFixed(0)}%) using ${denoisedNotes.length} denoised notes`,
    )
  } else {
    console.log(
      `[${tag}] DENOISED alignment: skipped (${denoisedNotes.length} notes, ${split.length} words)`,
    )
  }
}
