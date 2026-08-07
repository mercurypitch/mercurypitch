// ============================================================
// Word letters — glyph boundaries inside a single word
// ============================================================
//
// The atom of the mapper is the word, which is too coarse for a held vowel:
// "sooooul" is one timestamp and four seconds of sound. This is the layer that
// lets a word be split at a letter boundary, so a syllable's start — which is
// also the previous syllable's end — can carry its own time.
//
// Two rules hold the model together:
//
//   1. A boundary index runs 0..n, not 0..n-1. Index 0 is the word's onset,
//      index n its end. Every index is a *boundary*, never a glyph, so one
//      gesture sets both sides of a split and there is no separate "end" edit.
//   2. Progress is measured in grapheme space, not pixels. `progressForLetter`
//      divides the word evenly by grapheme count, so a boundary is exact in
//      the data and approximate on screen — an 'i' and an 'm' get the same
//      share of the highlight fill. Measuring glyphs would be neither pure nor
//      storable, and the time is what a singer actually needs; the fill is
//      decoration.
//
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 4).

import type { WordSweepPoint } from '@/features/stem-mixer/types'

/** Progresses within this of each other name the same boundary. */
const PROGRESS_EPSILON = 1e-6

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

/**
 * The user-perceived characters of a word.
 *
 * Falls back to code points where `Intl.Segmenter` is missing — that still
 * never splits a surrogate pair, it only mis-splits combining marks.
 */
export function splitGraphemes(word: string): string[] {
  if (word === '') return []
  if (segmenter === null) return [...word]
  return [...segmenter.segment(word)].map((piece) => piece.segment)
}

/** How many split points a word offers, counting both of its edges. */
export function letterBoundaryCount(word: string): number {
  return splitGraphemes(word).length
}

/**
 * Highlight position at the left edge of grapheme `letterIdx`.
 *
 * Index 0 is the word's onset (0) and index n its end (1), so the two edges
 * are addressable in the same coordinates as any interior split.
 */
export function progressForLetter(word: string, letterIdx: number): number {
  const count = letterBoundaryCount(word)
  if (count <= 0) return 0
  return Math.max(0, Math.min(1, letterIdx / count))
}

/**
 * The boundary a progress value names — the exact inverse of
 * `progressForLetter` for values it produced, and a snap to the nearest
 * boundary for anything in between.
 */
export function letterForProgress(word: string, progress: number): number {
  const count = letterBoundaryCount(word)
  if (count <= 0) return 0
  const clamped = Math.max(0, Math.min(1, progress))
  return Math.max(0, Math.min(count, Math.round(clamped * count)))
}

/**
 * Where a word's stored curve has split points, keyed by boundary index.
 *
 * Marker mode writes a sample per pointer frame, so most points are path, not
 * boundaries. Collapsing them onto boundaries is what makes the curve
 * editable: several samples inside one grapheme are one split, and the last
 * one wins because it is the closest to that boundary in time.
 */
export function letterSplitTimes(
  word: string,
  points: readonly WordSweepPoint[] | undefined,
): Record<number, number> {
  const out: Record<number, number> = {}
  if (!points) return out
  for (const point of points) {
    out[letterForProgress(word, point.progress)] = point.time
  }
  return out
}

/** Whether two progress values name the same boundary. */
export function sameProgress(a: number, b: number): boolean {
  return Math.abs(a - b) <= PROGRESS_EPSILON
}
