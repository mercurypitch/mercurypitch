// ============================================================
// Whisper lyrics — build LRC text from recognized vocal segments,
// and rebuild LRC from the panel's text-edit rows
// ============================================================
//
// Pure data-in/data-out (no Solid, no DOM). Two producers of LRC text:
//
// - `segmentsToLrc`: the "From vocal" version — Whisper's words are grouped
//   into sung phrases and each phrase becomes one synced line, so a song with
//   no lyrics gets an editable, already-timed draft straight from the vocal
//   stem.
// - `buildEditedLrc`: the lyrics text editor's save — untouched lines
//   keep their RAW text verbatim (preserving any word-level timestamps),
//   edited/new lines are re-emitted at line level, deleted rows vanish.
//
// The grouping is the whole point of `segmentsToLrc`, not a nicety. The
// worker asks the model for `return_timestamps: 'word'`, so a WhisperSegment
// is ONE WORD, never a phrase — the pitch-canvas alignment consumes them that
// way (`filterWordSegments` / `splitMultiWordSegments`). Emitting one LRC line
// per segment therefore emitted one line per word, which is what made the
// "From vocal" draft unreadable while the same transcription looked correct on
// the pitch canvas.
//
// Tests: src/tests/whisper-lyrics.test.ts

import { formatTimeLrc } from '@/lib/lrc-generator'
import { filterWordSegments, splitMultiWordSegments, } from '@/lib/pitch-word-alignment'
import type { WhisperSegment } from '@/lib/whisper-service'

/** One row of the lyrics text editor. */
export interface LyricsEditRow {
  /** Line start (seconds) — kept for edited lines, midpoint for added.
   *  Null for plain-text lyrics that carry no timestamps at all. */
  time: number | null
  /** The clean, editable text shown in the row. */
  text: string
  /**
   * The line's raw LRC body when the row came from an existing line and
   * the text was NOT changed — emitted verbatim so word-level timestamps
   * survive an unrelated edit elsewhere. Null for edited or added rows.
   */
  rawText: string | null
  /** Index of the source line in the pre-edit lyrics (LRC or plain array);
   *  null for rows added in the editor. Lets the caller carry per-line word
   *  timings over to the line's new position. */
  originalIndex: number | null
}

/** A silence longer than this ends the sung phrase: the next word opens a new
 *  line. Words inside a phrase arrive back-to-back from the model, so the
 *  threshold only has to clear a breath. */
export const WHISPER_LINE_GAP_SEC = 0.8

/** Hard cap on a line's word count. A run of words with no audible pause (a
 *  held melisma, or the model failing to punctuate) would otherwise become one
 *  unreadable wall of text in the editor. */
export const WHISPER_LINE_MAX_WORDS = 10

/** Hard cap on a line's span, for the same reason as the word cap — a single
 *  line that scrolls past this is no longer a lyric the singer can follow. */
export const WHISPER_LINE_MAX_SEC = 8

/**
 * A line whose words carry less total voiced time than this is discarded.
 *
 * On an instrumental or near-silent stretch Whisper loops the decoder and
 * emits single-frame (~20ms) words seconds apart — the owner's report was 14
 * copies of "one." across a 40s intro. The whole-transcription hallucination
 * guard in useWhisperTranscription cannot see this: a few dozen junk words in
 * a 484-word song sit far below its dominant-text ratio, and the median
 * duration stays healthy. Per line, though, the junk is unmistakable, because
 * no sung phrase carries less than a sixth of a second of voice.
 */
export const WHISPER_LINE_MIN_VOICED_SEC = 0.15

/** One word of a generated lyric line, at its Whisper timestamp. */
export interface WhisperLyricWord {
  text: string
  startSec: number
  endSec: number
}

/** One generated lyric line: a phrase, plus the words that make it up. */
export interface WhisperLyricLine {
  startSec: number
  words: WhisperLyricWord[]
}

/** True when the word carries sentence-final punctuation, which Whisper
 *  attaches to the last word of an utterance. */
function endsUtterance(text: string): boolean {
  return /[.!?]["')\]]?$/.test(text)
}

/**
 * Whisper's word segments → sung phrases.
 *
 * Reuses the alignment path's `filterWordSegments` / `splitMultiWordSegments`
 * so the lyric draft and the pitch canvas agree on what a word is — that
 * agreement is the fix for the two surfaces disagreeing about the same
 * transcription. Timestamps clamp monotonically non-decreasing (chunk overlap
 * can emit tiny inversions), and lines that are decoder noise rather than
 * singing are dropped (see WHISPER_LINE_MIN_VOICED_SEC).
 */
export function groupWhisperWordsIntoLines(
  segments: readonly WhisperSegment[],
): WhisperLyricLine[] {
  const words: WhisperLyricWord[] = []
  let lastStart = 0
  for (const segment of splitMultiWordSegments(
    filterWordSegments([...segments]),
  )) {
    const text = segment.text.replace(/\s+/g, ' ').trim()
    if (text === '') continue
    const start = Math.max(lastStart, Math.max(0, segment.timestamp[0]))
    lastStart = start
    words.push({
      text,
      startSec: start,
      endSec: Math.max(start, segment.timestamp[1]),
    })
  }

  const lines: WhisperLyricLine[] = []
  let current: WhisperLyricWord[] = []
  const flush = () => {
    if (current.length === 0) return
    const voiced = current.reduce((sum, w) => sum + (w.endSec - w.startSec), 0)
    if (voiced >= WHISPER_LINE_MIN_VOICED_SEC) {
      lines.push({ startSec: current[0].startSec, words: current })
    }
    current = []
  }

  for (const word of words) {
    if (current.length > 0) {
      const previous = current[current.length - 1]
      const breaks =
        word.startSec - previous.endSec > WHISPER_LINE_GAP_SEC ||
        current.length >= WHISPER_LINE_MAX_WORDS ||
        word.endSec - current[0].startSec > WHISPER_LINE_MAX_SEC ||
        endsUtterance(previous.text)
      if (breaks) flush()
    }
    current.push(word)
  }
  flush()

  return lines
}

/**
 * Whisper segments → LRC.
 *
 * Each line is a phrase (see `groupWhisperWordsIntoLines`) carrying its words'
 * own timestamps inline, the enhanced-LRC form `parseLrcWordTimings` reads
 * back. Keeping the word times means importing the draft does not throw away
 * the alignment the transcription just produced: the draft comes back as
 * `lrc-word`, the top-priority word source.
 */
export function segmentsToLrc(segments: readonly WhisperSegment[]): string {
  return groupWhisperWordsIntoLines(segments)
    .map((line) =>
      line.words
        .map((word) => `[${formatTimeLrc(word.startSec)}]${word.text}`)
        .join(' '),
    )
    .join('\n')
}

/**
 * Rebuild lyrics text from the editor's rows. Rows arrive in display order;
 * deleted rows are simply not passed in. Rows with a null time are plain-text
 * lyrics and are emitted bare (no [stamp]) — blank plain lines survive so
 * stanza breaks are kept. Timed rows whose body ends up empty are dropped.
 */
export function buildEditedLrc(rows: readonly LyricsEditRow[]): string {
  return rows
    .map((row) => {
      if (row.time === null) return row.text.replace(/\s+/g, ' ').trim()
      if (row.rawText !== null)
        return `[${formatTimeLrc(row.time)}]${row.rawText}`
      const text = row.text.replace(/\s+/g, ' ').trim()
      return `[${formatTimeLrc(row.time)}]${text}`
    })
    .filter((line) => !/\]\s*$/.test(line))
    .join('\n')
}

/** Matches one inline LRC timestamp (word-level `[mm:ss.xx]`) in a line body. */
const INLINE_STAMP_RE = /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g

/**
 * Remove inline word-level `[mm:ss.xx]` stamps from a raw LRC line body and
 * collapse whitespace — the clean text shown in the editor's inputs.
 */
export function stripInlineWordStamps(text: string): string {
  return text.replace(INLINE_STAMP_RE, ' ').replace(/\s+/g, ' ').trim()
}

/** A time for a line inserted after `prevTime`: halfway to the next line,
 *  or a small step when it is the last row. */
export function insertedLineTime(
  prevTime: number,
  nextTime: number | undefined,
  step = 2,
): number {
  if (nextTime !== undefined && nextTime > prevTime) {
    return prevTime + (nextTime - prevTime) / 2
  }
  return prevTime + step
}
