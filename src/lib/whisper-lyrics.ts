// ============================================================
// Whisper lyrics — build LRC text from recognized vocal segments,
// and rebuild LRC from the panel's text-edit rows
// ============================================================
//
// Pure data-in/data-out (no Solid, no DOM). Two producers of LRC text:
//
// - `segmentsToLrc`: the "From vocal" version — each Whisper segment
//   becomes one synced line, so a song with no lyrics gets an editable,
//   already-timed draft straight from the vocal stem.
// - `buildEditedLrc`: the lyrics text editor's save — untouched lines
//   keep their RAW text verbatim (preserving any word-level timestamps),
//   edited/new lines are re-emitted at line level, deleted rows vanish.
//
// Tests: src/tests/whisper-lyrics.test.ts

import { formatTimeLrc } from '@/lib/lrc-generator'
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

/**
 * Whisper segments → line-level LRC. Empty/whitespace segments are
 * dropped, times clamp monotonically non-decreasing (Whisper can emit
 * tiny overlaps), and text is single-line trimmed.
 */
export function segmentsToLrc(segments: readonly WhisperSegment[]): string {
  const lines: string[] = []
  let lastTime = 0
  for (const segment of segments) {
    const text = segment.text.replace(/\s+/g, ' ').trim()
    if (text === '') continue
    const start = Math.max(lastTime, Math.max(0, segment.timestamp[0]))
    lastTime = start
    lines.push(`[${formatTimeLrc(start)}]${text}`)
  }
  return lines.join('\n')
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
