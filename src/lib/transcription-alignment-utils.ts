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
  return segments.filter((seg, i) => {
    if (!isValidSegmentTimestamp(seg.timestamp)) {
      return false
    }
    if (i === 0) return true
    const prevEnd = segments[i - 1].timestamp[1]
    const mid = (seg.timestamp[0] + seg.timestamp[1]) / 2
    return mid > prevEnd
  })
}

// ── Whisper Match Quality & Source Selection ───────────────────

export type WordSourceKind = 'lrc-word' | 'whisper' | 'lrc-line' | 'none'

export type LrcInputEntry = {
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

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Evaluates match quality (0 to 1) of Whisper transcription against reference LRC lyrics.
 */
export function evaluateWhisperMatchQuality(
  whisperSegments: WhisperSegment[],
  lrcLines: LrcInputEntry[],
): number {
  if (whisperSegments.length === 0 || lrcLines.length === 0) return 0

  const whisperText = whisperSegments.map((s) => s.text).join(' ')
  const lrcText = lrcLines
    .map((l) => l.text ?? (l.words !== undefined ? l.words.join(' ') : ''))
    .join(' ')

  const whisperNorm = normalizeText(whisperText)
  const lrcNorm = normalizeText(lrcText)

  if (whisperNorm.length === 0 || lrcNorm.length === 0) return 0

  const whisperWords = whisperNorm.split(' ').filter(Boolean)
  const lrcWords = lrcNorm.split(' ').filter(Boolean)

  if (whisperWords.length === 0 || lrcWords.length === 0) return 0

  const lrcSet = new Set(lrcWords)
  let overlapMatches = 0
  for (const w of whisperWords) {
    if (lrcSet.has(w)) overlapMatches++
  }

  const overlapRatio =
    overlapMatches / Math.max(whisperWords.length, lrcWords.length)

  return Math.min(1, Math.max(0, overlapRatio))
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
  const lrcHasWordTimes = lrcLines.some((e) => (e.wordTimes?.length ?? 0) > 0)

  let lrcSegments: WhisperSegment[] = []
  if (lrcLines.length > 0) {
    if (lrcHasWordTimes) {
      const wordEntries: LrcWordEntry[] = lrcLines.map((e) => ({
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
      const lineEntries: LrcLine[] = lrcLines.map((e) => ({
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
    const matchQuality = evaluateWhisperMatchQuality(sanitizedWhisper, lrcLines)
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
