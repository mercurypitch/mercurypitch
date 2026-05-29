/**
 * Shared transcription + alignment utilities.
 *
 * Extracted from StemMixer.tsx and PitchTestingTab.tsx to eliminate duplication.
 * Both components had near-identical whisper chunking, deduplication, alignment
 * pipeline, and debug-logging code.
 */

import type { MergedNote } from '@/lib/midi-generator'
import type { AlignmentResult } from '@/lib/pitch-word-alignment'
import { alignPitchToWords, filterWordSegments, splitMultiWordSegments, } from '@/lib/pitch-word-alignment'
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
 * previous segment (caused by chunk overlap).
 */
export function deduplicateWhisperSegments(
  segments: WhisperSegment[],
): WhisperSegment[] {
  return segments.filter((seg, i) => {
    if (i === 0) return true
    const prevEnd = segments[i - 1].timestamp[1]
    const mid = (seg.timestamp[0] + seg.timestamp[1]) / 2
    return mid > prevEnd
  })
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
