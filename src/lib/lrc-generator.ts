// ============================================================
// LRC Generator — pure functions for building LRC-formatted text
// Tests: src/tests/lrc-generator.test.ts
// ============================================================

import type { CanonicalLrcEntry } from '@/features/stem-mixer/types'

export interface LrcGenTimings {
  /** Per-line start times (undefined = unmapped) */
  lineTimes: (number | undefined)[]
  /** Per-line array of per-word start times */
  wordTimings: Record<number, (number | undefined)[]>
}

export interface LrcGenParams extends LrcGenTimings {
  /** Raw lyrics lines (plain text, split by \n) */
  lines: string[]
  /** Total song duration in seconds (used to estimate unmapped line times) */
  duration: number
  /** Filename for the generated LRC (used as metadata, not for LRC text itself) */
  filename?: string
}

/**
 * Format seconds as LRC timestamp [mm:ss.xx].
 */
export function formatTimeLrc(secs: number): string {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0')
  const s = (secs % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}

/**
 * One line of word-stamped LRC, guaranteed to open with a timestamp.
 *
 * Every builder that writes per-word stamps has to come through here. A line
 * body that starts with a bare word matches nothing in `LRC_LINE_RE`
 * (lyrics-service.ts), so `parseLrcFile` skips it outright — the line is not
 * mistimed, its text is lost — and that is what a line whose FIRST word has
 * no start of its own used to produce.
 *
 * So the first word is the only one that always carries a stamp, and the only
 * one that falls back to `lineTime`. Its stamp IS the line's: `parseLrcFile`
 * eats it as the line time, and `parseLrcWordTimings` then reads that word as
 * starting with the line. Writing a separate head stamp in front of it would
 * put a second SQUARE stamp at the head of the body, which is standard LRC
 * for "sung again at" and which the parser deliberately refuses to read as a
 * word time — the word would silently fall back to the line time instead.
 *
 * `lineTime` must be a time that keeps the line in source order. A line that
 * cannot name one is NOT free to claim `0`: `parseLrcFile` sorts by time, so
 * a zero head would move it to the front of the file. Callers carry the
 * previous line's time forward, and the sort is stable, so an equal time
 * leaves the line exactly where it was.
 */
export function stampedLrcLine(
  words: readonly string[],
  starts: readonly (number | undefined)[] | undefined,
  lineTime: number,
): string {
  return words
    .map((word, i) => {
      const start = starts?.[i]
      // The first word always carries a stamp, and it is the only one that
      // falls back to the line time. That stamp IS the line's — nothing
      // prepends a second one.
      if (i === 0) return `[${formatTimeLrc(start ?? lineTime)}] ${word}`
      return start === undefined ? word : `[${formatTimeLrc(start)}] ${word}`
    })
    .join(' ')
}

/**
 * Estimate timestamps for lines that weren't mapped during LRC gen.
 * Unmapped lines get proportional timing between the last mapped line and song end.
 */
export function estimateUnmappedTimes(
  lineTimes: (number | undefined)[],
  lines: string[],
  duration: number,
): (number | undefined)[] {
  const lastMappedIdx = lineTimes.reduce(
    (best, t, i) => (t !== undefined ? i : best),
    -1,
  ) as number
  const lastMappedTime = lastMappedIdx >= 0 ? lineTimes[lastMappedIdx]! : 0

  const unmapped: number[] = []
  for (let i = lastMappedIdx + 1; i < lines.length; i++) {
    if (lineTimes[i] === undefined) unmapped.push(i)
  }

  if (unmapped.length === 0) return lineTimes.slice()

  const songEnd = duration > 0 ? duration : lastMappedTime + unmapped.length * 4
  const gap = songEnd - lastMappedTime

  const result = lineTimes.slice()
  unmapped.forEach((lineIdx, pos) => {
    result[lineIdx] =
      Math.round(
        (lastMappedTime + gap * ((pos + 1) / (unmapped.length + 1))) * 1000,
      ) / 1000
  })

  return result
}

/**
 * Build LRC-formatted text from raw lines and recorded timings.
 *
 * Rules:
 * - Blank lines (no trimmed text) become `~Rest~` markers with timestamps
 * - Lines with timestamps get `[mm:ss.xx] text` format
 * - Lines without timestamps get `[00:00.00] text` as placeholder
 * - Completely unmapped blank lines are omitted
 */
export function buildLrcText(params: LrcGenParams): string {
  const { lines, lineTimes, duration } = params

  if (lines.length === 0) return ''

  const finalTimes = estimateUnmappedTimes(lineTimes, lines, duration)

  return lines
    .map((line, i) => {
      const lt = finalTimes[i]
      // Blank line → ~Rest~ marker (keeps line count for syncing)
      if (!line.trim()) {
        if (lt === undefined) return ''
        return `[${formatTimeLrc(lt)}] ~Rest~`
      }
      if (lt === undefined) return `[00:00.00] ${line}`
      return `[${formatTimeLrc(lt)}] ${line}`
    })
    .join('\n')
}

/**
 * Build word-level LRC text (one timestamp per word).
 * Each line becomes: [time] word [time] word ...
 * Blank lines and lines without timings are omitted.
 */
export function buildWordLevelLrc(
  lines: string[],
  wordTimings: Record<number, (number | undefined)[]>,
): string {
  // No line times reach this builder, so a line's own start is the earliest
  // word start it has. A line that has none inherits the previous line's,
  // which is what keeps it in source order — see `stampedLrcLine`.
  let carried = 0
  return lines
    .map((line, i) => {
      if (!line.trim()) return ''
      const words = line.split(/\s+/).filter((w) => w.length > 0)
      const lineWt = wordTimings[i]
      carried = lineWt?.find((t) => t !== undefined) ?? carried
      if (lineWt === undefined || lineWt.length === 0 || words.length === 0) {
        return `[${formatTimeLrc(carried)}] ${line}`
      }
      return stampedLrcLine(words, lineWt, carried)
    })
    .filter((l) => l !== '')
    .join('\n')
}

/**
 * Build LRC-formatted text from canonical entries.
 *
 * - Synthetic ~Rest~ entries (lrcIndex < 0) are always skipped.
 * - Explicit ~Rest~ entries and blank lines become `[time] ~Rest~`.
 * - If word timings are available, word-level output is produced
 *   (`[t1] word1 [t2] word2 ...`).
 * - If no word timings, line-level output (`[time] full text`).
 * - Falls back to entry.time when lineTimes entry is undefined.
 */
export function buildLrcTextFromCanonical(
  entries: CanonicalLrcEntry[],
  lineTimes?: (number | undefined)[],
  wordTimings?: Record<number, (number | undefined)[]>,
): string {
  return entries
    .map((entry) => {
      if (entry.lrcIndex < 0) return ''

      const time = lineTimes?.[entry.canonicalIndex] ?? entry.time
      const lrcIdx = entry.lrcIndex
      const lineWt = wordTimings?.[lrcIdx] ?? entry.wordTimes

      // Word-level output when per-word timestamps are available
      if (lineWt != null && lineWt.length > 0 && entry.words.length > 0) {
        return stampedLrcLine(entry.words, lineWt, time)
      }

      // Line-level output
      if (entry.type === 'rest' || !entry.text.trim()) {
        return `[${formatTimeLrc(time)}] ~Rest~`
      }
      return `[${formatTimeLrc(time)}] ${entry.text}`
    })
    .filter((l) => l !== '')
    .join('\n')
}
