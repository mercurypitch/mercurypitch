// ============================================================
// Canonical LRC — pure functions for canonical entry construction
// and LRC↔canonical index mapping
// ============================================================

import type { CanonicalLrcEntry } from '@/features/stem-mixer/types'
import type { LrcLine } from './lyrics-service'
import { parseLrcWordTimings } from './lyrics-service'

/** Gaps longer than this (seconds) get a synthetic ~Rest~ countdown. */
export const REST_THRESHOLD_SEC = 20
/** Each rest countdown dot represents this many seconds. */
export const SECONDS_PER_REST_DOT = 5

function restDotCount(gapStart: number, gapEnd: number): number {
  return Math.max(1, Math.round((gapEnd - gapStart) / SECONDS_PER_REST_DOT))
}

/** First-word start of the next non-rest line after `afterIndex` (used to size
 *  an explicit rest's countdown); falls back to `fallback`. */
function nextLineStart(
  lrcLines: LrcLine[],
  afterIndex: number,
  fallback: number,
): number {
  for (let j = afterIndex + 1; j < lrcLines.length; j++) {
    if (lrcLines[j].text !== '~Rest~') return lrcLines[j].time
  }
  return fallback
}

/**
 * Build canonical entries, inserting a synthetic ~Rest~ for gaps > 20s.
 *
 * The gap is measured from when the previous line's singing actually *stopped*
 * (its last word start, for word-level LRC) to the next line's first word —
 * not from the previous line's first word, which would wrongly count its
 * singing as silence. For line-only LRC the end is unknown, so we keep the
 * midpoint heuristic (previous line stays active while likely still sung).
 * Rest entries carry `gapStart`/`gapEnd`/`dotCount` to drive the countdown.
 */
export function buildCanonicalEntries(
  lrcLines: LrcLine[],
): CanonicalLrcEntry[] {
  const result: CanonicalLrcEntry[] = []

  let prevEnd = 0
  let prevTime = 0
  let hasPrev = false

  for (let i = 0; i < lrcLines.length; i++) {
    const line = lrcLines[i]

    // Synthetic ~Rest~ when the silence before this entry is large.
    if (hasPrev) {
      const gap = line.time - prevEnd
      if (gap > REST_THRESHOLD_SEC) {
        const gapEnd = line.time
        const gapStart = prevEnd > prevTime ? prevEnd : prevTime + gap / 2
        result.push({
          type: 'rest',
          lrcIndex: -1,
          canonicalIndex: result.length,
          time: gapStart,
          text: '~Rest~',
          words: [],
          gapStart,
          gapEnd,
          dotCount: restDotCount(gapStart, gapEnd),
        })
      }
    }

    if (line.text === '~Rest~') {
      const gapEnd = nextLineStart(lrcLines, i, line.time)
      result.push({
        type: 'rest',
        lrcIndex: i,
        canonicalIndex: result.length,
        time: line.time,
        text: '~Rest~',
        words: [],
        gapStart: line.time,
        gapEnd,
        dotCount: restDotCount(line.time, gapEnd),
      })
      // The explicit rest itself marks the silence — measure the next gap from it.
      prevEnd = line.time
      prevTime = line.time
      hasPrev = true
      continue
    }

    const parsedWt = parseLrcWordTimings(line.text, line.time)
    const words = parsedWt
      ? parsedWt.words
      : line.text.split(/\s+/).filter((w: string) => w.length > 0)

    // When word-level timestamps were parsed, use the clean joined words
    // as text so embedded [mm:ss.xx] timestamps don't appear as literal text.
    const cleanText = parsedWt ? parsedWt.words.join(' ') : line.text

    result.push({
      type: 'line',
      lrcIndex: i,
      canonicalIndex: result.length,
      time: line.time,
      text: cleanText,
      words,
      wordTimes: parsedWt?.wordTimes,
    })

    prevTime = line.time
    prevEnd =
      parsedWt && parsedWt.wordTimes.length > 0
        ? parsedWt.wordTimes[parsedWt.wordTimes.length - 1]
        : line.time
    hasPrev = true
  }

  return result
}

export interface RestProgress {
  /** Fully-filled dots so far. */
  filledDots: number
  /** Fill fraction (0–1) of the dot currently filling. */
  currentDotFrac: number
}

/**
 * Per-dot countdown fill for a rest, given the current playback time. 0 filled
 * at `gapStart`, all filled at `gapEnd`, partial in between; clamps outside.
 */
export function computeRestProgress(
  gapStart: number,
  gapEnd: number,
  dotCount: number,
  elapsed: number,
): RestProgress {
  if (dotCount <= 0 || gapEnd <= gapStart || elapsed <= gapStart) {
    return { filledDots: 0, currentDotFrac: 0 }
  }
  if (elapsed >= gapEnd) {
    return { filledDots: dotCount, currentDotFrac: 0 }
  }
  const exact = ((elapsed - gapStart) / (gapEnd - gapStart)) * dotCount
  const filledDots = Math.min(dotCount, Math.floor(exact))
  return { filledDots, currentDotFrac: exact - filledDots }
}

export interface ActiveItem {
  index: number
  kind: 'none' | 'line' | 'rest'
  restProgress?: RestProgress
}

/**
 * Pick the active canonical entry for the current playback time — the last
 * entry whose `time` has passed. For a rest, also returns the countdown fill.
 * Pure extraction of the controller's per-frame active-line selection.
 */
export function selectActiveItem(
  canonical: CanonicalLrcEntry[],
  elapsed: number,
): ActiveItem {
  let index = -1
  for (let i = 0; i < canonical.length; i++) {
    if (canonical[i].time <= elapsed) index = i
  }
  if (index < 0) return { index: -1, kind: 'none' }
  const entry = canonical[index]
  if (entry.type === 'rest') {
    return {
      index,
      kind: 'rest',
      restProgress: computeRestProgress(
        entry.gapStart ?? entry.time,
        entry.gapEnd ?? entry.time,
        entry.dotCount ?? 1,
        elapsed,
      ),
    }
  }
  return { index, kind: 'line' }
}

/**
 * Build LRC index → canonical index map.
 * Only real LRC entries (lrcIndex >= 0) are mapped.
 * Synthetic ~Rest~ (lrcIndex = -1) are excluded.
 */
export function buildLrcToCanonicalMap(
  canonical: CanonicalLrcEntry[],
): Map<number, number> {
  const map = new Map<number, number>()
  for (const entry of canonical) {
    if (entry.lrcIndex >= 0) map.set(entry.lrcIndex, entry.canonicalIndex)
  }
  return map
}

/**
 * Build canonical index → LRC index map.
 * Only real LRC entries (lrcIndex >= 0) are mapped.
 * Synthetic ~Rest~ (lrcIndex = -1) are excluded.
 */
export function buildCanonicalToLrcMap(
  canonical: CanonicalLrcEntry[],
): Map<number, number> {
  const map = new Map<number, number>()
  for (const entry of canonical) {
    if (entry.lrcIndex >= 0) map.set(entry.canonicalIndex, entry.lrcIndex)
  }
  return map
}
