// ============================================================
// lrc-gen-passes — pure pass/cursor logic for two-pass LRC mapping
// ============================================================
//
// Mapping can run as one continuous stream of taps that fuses two different
// jobs: placing line starts and placing the words inside them. Line starts are
// the easy, usually-already-known half (LRCLib ships line-level LRC, and a
// line start is preceded by a breath); inner words are the dense, unforgiving
// half. Fusing them means a flubbed line boundary corrupts the words after it.
//
// So splitting the work is offered, not imposed — three modes:
//   All   — the original flow: every tap places the next word, and the first
//           word of a line places its start. Fastest when the song is slow or
//           the lyrics are short, and the only mode before the split existed.
//   Lines — line starts only, one tap per line, skippable when the fetched
//           LRC times already look right. Its real value is correction.
//   Words — line starts are frozen and become word 0. The cursor starts at
//           word 1 and single-word lines are skipped entirely, because they
//           are fully determined by their line start.
//
// Those modes differ in exactly one place at tap time — where the cursor goes
// once a line is finished — so that decision is `nextCursorAfterLine` here
// rather than a branch in the controller. It shipped broken as a branch.
//
// See docs/plans/lrc-per-word-mapping-research.md. Tests:
// src/tests/lrc-gen-passes.test.ts.

import type { WordTimingsMap } from './types'

export type LrcGenPass = 'all' | 'lines' | 'words'

/**
 * Coerce a persisted pass back into the union. Sessions saved before the split
 * have no pass at all, and the first version to write one used `1`/`2` — both
 * decode rather than dropping the operator into an unexpected mode.
 */
export function normalizePass(value: unknown): LrcGenPass {
  if (value === 'lines' || value === 1) return 'lines'
  if (value === 'words' || value === 2) return 'words'
  return 'all'
}

/** Seconds of run-in played before a line, so the operator hears it coming. */
export const PRE_ROLL_SEC = 1.5
/** Tail played after a line's last word before a preview stops or loops. */
export const PREVIEW_TAIL_SEC = 0.6
/** Fallback line length when nothing downstream bounds it. */
export const FALLBACK_LINE_SPAN_SEC = 3

/** Blank rows and synthetic `~Rest~` countdowns carry no timing to map. */
export function isMappableLine(line: string | undefined): boolean {
  if (line === undefined) return false
  const trimmed = line.trim()
  return trimmed.length > 0 && trimmed !== '~Rest~'
}

export function lineWordCount(line: string | undefined): number {
  if (!isMappableLine(line)) return 0
  return line!.split(/\s+/).filter((word) => word.length > 0).length
}

/**
 * Whether pass 2 has anything to do on this line. A single-word line is fully
 * determined by its line start, so stopping on it would ask the operator to
 * re-tap a time we already have.
 */
export function needsWordPass(line: string | undefined): boolean {
  return lineWordCount(line) > 1
}

/** First index at or after `from` that pass 2 should stop on. */
export function nextWordPassLine(lines: string[], from: number): number {
  for (let i = Math.max(0, from); i < lines.length; i++) {
    if (needsWordPass(lines[i])) return i
  }
  return lines.length
}

/** How many lines pass 2 will actually stop on — drives its progress readout. */
export function countWordPassLines(lines: string[]): number {
  let n = 0
  for (const line of lines) if (needsWordPass(line)) n++
  return n
}

/** How many of those are already behind the cursor. */
export function wordPassLinesBefore(lines: string[], index: number): number {
  let n = 0
  for (let i = 0; i < Math.min(index, lines.length); i++) {
    if (needsWordPass(lines[i])) n++
  }
  return n
}

/**
 * Where the mapping cursor sits next, and what the controller owes it to get
 * there: `finish` means the lyric ran out and the session should end, and
 * `preRoll` means the playhead should seek back to the line's run-in.
 */
export interface GenCursor {
  lineIdx: number
  wordIdx: number
  preRoll: boolean
  finish: boolean
}

/** Past the last line: the cursor parks at the end and the session ends. */
function finishedCursor(lines: string[]): GenCursor {
  return { lineIdx: lines.length, wordIdx: 0, preRoll: false, finish: true }
}

/**
 * Word-pass cursor for the first line at or after `from` with words to place.
 * It opens at word 1 — word 0 is the frozen line start — and pre-rolls, so the
 * line is heard from its run-in rather than picked up mid-phrase.
 */
export function wordPassCursorFrom(lines: string[], from: number): GenCursor {
  const next = nextWordPassLine(lines, from)
  if (next >= lines.length) return finishedCursor(lines)
  return { lineIdx: next, wordIdx: 1, preRoll: true, finish: false }
}

/**
 * Where the cursor goes once the line at `lineIdx` is finished — the one
 * decision that differs per pass, and the reason it lives here rather than
 * inline in the controller: picking the wrong branch is invisible to a test
 * that only exercises the helpers.
 *
 * Only the word pass may skip lines, open at word 1, or move the playhead. In
 * one continuous take the operator is mid-performance, so skipping a
 * single-word line leaves it unmapped and a pre-roll seeks the audio backwards
 * under them.
 */
export function nextCursorAfterLine(
  pass: LrcGenPass,
  lines: string[],
  lineIdx: number,
): GenCursor {
  if (pass === 'words') return wordPassCursorFrom(lines, lineIdx + 1)
  const next = lineIdx + 1
  if (next >= lines.length) return finishedCursor(lines)
  // Blanks and rests are stepped onto rather than skipped; the controller
  // clears them on the following tap.
  return { lineIdx: next, wordIdx: 0, preRoll: false, finish: false }
}

/**
 * Seed each mappable line's word 0 from its (now frozen) line start, so pass 2
 * can begin at word 1. Existing word timings win — a line already mapped in a
 * previous session keeps its data, and only its word 0 is re-anchored to the
 * line time, which is the value pass 1 just confirmed.
 */
export function seedWordPassTimings(
  lines: string[],
  lineTimes: (number | undefined)[],
  wordTimings: WordTimingsMap,
): WordTimingsMap {
  const next: WordTimingsMap = { ...wordTimings }
  for (let i = 0; i < lines.length; i++) {
    if (!isMappableLine(lines[i])) continue
    const lineTime = lineTimes[i]
    if (lineTime === undefined) continue
    const existing = next[i]
    const row = existing === undefined ? [] : [...existing]
    row[0] = lineTime
    next[i] = row
  }
  return next
}

/** Where playback should jump to so a line is heard with its run-in. */
export function preRollTarget(
  lineTime: number,
  preRoll: number = PRE_ROLL_SEC,
): number {
  return Math.max(0, lineTime - preRoll)
}

/**
 * When a line stops sounding: the next mappable line's start, else the last
 * mapped word plus a fallback span. Used to bound preview playback and loops.
 */
export function lineEndTime(
  lines: string[],
  lineTimes: (number | undefined)[],
  wordTimings: WordTimingsMap,
  index: number,
): number | null {
  const start = lineTimes[index]
  for (let i = index + 1; i < lines.length; i++) {
    if (!isMappableLine(lines[i])) continue
    const next = lineTimes[i]
    if (next !== undefined) return next
    break
  }
  const words = wordTimings[index]
  let last: number | undefined
  if (words !== undefined) {
    for (const value of Object.values(words)) {
      if (typeof value === 'number' && (last === undefined || value > last)) {
        last = value
      }
    }
  }
  const anchor = last ?? start
  if (anchor === undefined) return null
  return anchor + FALLBACK_LINE_SPAN_SEC
}

/**
 * The mapped line sounding at `time` — the last one whose start has passed, so
 * a line stays lit through the gap after it exactly as the runtime renderer
 * leaves it lit. Returns -1 before the first mapped line.
 *
 * Deliberately does not stop at the first future start: lines mapped out of
 * order (redo a line, jump back, correct a drift) leave the array briefly
 * non-monotonic, and an early exit there would blank the highlight instead of
 * just being slightly wrong for one line.
 */
export function activeLineAt(
  lines: string[],
  lineTimes: (number | undefined)[],
  time: number,
): number {
  let found = -1
  let bestStart = -Infinity
  for (let i = 0; i < lines.length; i++) {
    const start = lineTimes[i]
    if (start === undefined || start > time) continue
    if (!isMappableLine(lines[i])) continue
    if (start >= bestStart) {
      bestStart = start
      found = i
    }
  }
  return found
}

export interface PreviewWordHighlight {
  wordIdx: number
  /** 0 → 1 across the word, for the same sweep the runtime renderer uses. */
  progress: number
}

export interface WordSpan {
  start: number
  end: number
}

/**
 * When word `idx` starts and ends, from what has actually been mapped.
 *
 * An end is usually missing: the word pass records starts and nothing else,
 * and only Tap mode or sub-word editing ever writes one. So it falls back to
 * the next word that starts later, and then to the line's own end — the rule
 * the runtime highlighter has always used, which is why it lives here rather
 * than being re-derived by each caller.
 *
 * Never returns a zero-width span; callers divide by it.
 */
export function wordSpan(
  wordTimes: number[] | undefined,
  wordEndTimes: number[] | undefined,
  lineEnd: number,
  idx: number,
): WordSpan | null {
  const start = wordTimes?.[idx]
  if (typeof start !== 'number') return null

  let end = wordEndTimes?.[idx]
  if (typeof end !== 'number' || end <= start) {
    end = undefined
    for (let i = idx + 1; i < (wordTimes?.length ?? 0); i++) {
      const nextStart = wordTimes?.[i]
      if (typeof nextStart === 'number' && nextStart > start) {
        end = nextStart
        break
      }
    }
  }
  if (end === undefined) end = lineEnd

  return { start, end: Math.max(end, start + 0.05) }
}

/**
 * Which word is sounding at `time`, and how far through it we are.
 *
 * Mirrors the runtime highlighter: a word sweeps from its own start to its end
 * time when one was recorded, otherwise to the next word's start. Respecting
 * recorded ends is what stops a held note sweeping too slowly and a rest
 * mid-line smearing the highlight across the silence.
 *
 * Returns null before the line's first word, so preview shows nothing rather
 * than pinning the first word lit during the run-in.
 */
export function previewWordAt(
  wordTimes: number[] | undefined,
  wordEndTimes: number[] | undefined,
  lineEnd: number,
  time: number,
): PreviewWordHighlight | null {
  if (wordTimes === undefined) return null
  let active = -1
  for (let i = 0; i < wordTimes.length; i++) {
    const start = wordTimes[i]
    if (typeof start !== 'number') continue
    if (start <= time) active = i
    else break
  }
  if (active < 0) return null

  const span = wordSpan(wordTimes, wordEndTimes, lineEnd, active)
  if (span === null) return null

  const progress = Math.max(
    0,
    Math.min(1, (time - span.start) / (span.end - span.start)),
  )
  return { wordIdx: active, progress }
}
