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
  return lines
    .map((line, i) => {
      if (!line.trim()) return ''
      const words = line.split(/\s+/).filter((w) => w.length > 0)
      const lineWt = wordTimings[i]
      if (lineWt === undefined || lineWt.length === 0 || words.length === 0) {
        return `[00:00.00] ${line}`
      }
      return words
        .map((w, wi) => {
          const t = lineWt[wi]
          return t !== undefined ? `[${formatTimeLrc(t)}] ${w}` : w
        })
        .join(' ')
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
        return entry.words
          .map((w, wi) => {
            const t = lineWt[wi]
            return t !== undefined ? `[${formatTimeLrc(t)}] ${w}` : w
          })
          .join(' ')
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
