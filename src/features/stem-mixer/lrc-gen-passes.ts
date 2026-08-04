// ============================================================
// lrc-gen-passes — pure pass/cursor logic for two-pass LRC mapping
// ============================================================
//
// Mapping used to be one continuous stream of taps that fused two different
// jobs: placing line starts and placing the words inside them. Line starts are
// the easy, usually-already-known half (LRCLib ships line-level LRC, and a
// line start is preceded by a breath); inner words are the dense, unforgiving
// half. Fusing them means a flubbed line boundary corrupts the words after it.
//
// So the mapper runs two passes:
//   Pass 1 — line starts only, one tap per line, skippable when the fetched
//            LRC times already look right. Its real value is correction.
//   Pass 2 — line starts are frozen and become word 0. The cursor starts at
//            word 1 and single-word lines are skipped entirely, because they
//            are fully determined by their line start.
//
// See docs/plans/lrc-per-word-mapping-research.md. Tests:
// src/tests/lrc-gen-passes.test.ts.

import type { WordTimingsMap } from './types'

/** 1 = line starts, 2 = the words inside each line. */
export type LrcGenPass = 1 | 2

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

export interface PreviewWordHighlight {
  wordIdx: number
  /** 0 → 1 across the word, for the same sweep the runtime renderer uses. */
  progress: number
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

  const start = wordTimes[active]
  let end = wordEndTimes?.[active]
  if (typeof end !== 'number' || end <= start) {
    end = undefined
    for (let i = active + 1; i < wordTimes.length; i++) {
      const nextStart = wordTimes[i]
      if (typeof nextStart === 'number' && nextStart > start) {
        end = nextStart
        break
      }
    }
  }
  if (end === undefined) end = Math.max(lineEnd, start + 0.05)

  const span = Math.max(0.05, end - start)
  const progress = Math.max(0, Math.min(1, (time - start) / span))
  return { wordIdx: active, progress }
}
