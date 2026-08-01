// ============================================================
// Zen note glyphs — word → target-note lookup
// ============================================================
//
// The zen stage annotates lyric words with the note the singer SHOULD
// sing, chord-chart style (glyph anchored over the word's start). The
// notes come from the pitch-word alignment — whose word times are NOT
// always the sheet's own LRC times: when Whisper wins the segment-source
// contest (or word windows are estimated from line-only LRC), the
// aligned starts drift from the display words by real fractions of a
// second. The old exact ±1 ms lookup then missed every word and the
// toggle showed nothing at all (owner testing, regression). The lookup
// is therefore exact-first with a bounded nearest-neighbour fallback —
// wide enough to absorb cross-source drift, narrow enough never to
// borrow a note across a silence gap.
//
// Pure data-in/data-out (no Solid, no DOM), mirroring zen-navigation.ts.

import type { AlignedWord } from '@/lib/pitch-word-alignment'

/** Key resolution for the exact index: 1 ms. */
const KEY_MS = 1000

/** Nearest-match ceiling — beyond this a word simply has no glyph. */
export const GLYPH_MATCH_TOLERANCE_SEC = 0.4

const keyOf = (timeSec: number): number => Math.round(timeSec * KEY_MS)

export interface WordNoteIndex {
  /** Exact ms-rounded start-time lookup. */
  byKey: ReadonlyMap<number, string>
  /** Aligned word starts, sorted ascending — nearest-match fallback. */
  times: readonly number[]
  /** Note names parallel to `times`. */
  notes: readonly string[]
}

/**
 * Index aligned words by their start time. Words the alignment could not
 * map (noteName null) are skipped so the glyph simply doesn't render
 * rather than showing an empty chip.
 */
export function buildWordNoteIndex(
  alignedWords: readonly AlignedWord[],
): WordNoteIndex {
  const byKey = new Map<number, string>()
  const pairs: Array<[number, string]> = []
  for (const word of alignedWords) {
    if (word.noteName === null || word.noteName === '') continue
    byKey.set(keyOf(word.startSec), word.noteName)
    pairs.push([word.startSec, word.noteName])
  }
  pairs.sort((a, b) => a[0] - b[0])
  return {
    byKey,
    times: pairs.map((p) => p[0]),
    notes: pairs.map((p) => p[1]),
  }
}

/** True when the index holds anything to draw. */
export function hasWordNotes(index: WordNoteIndex): boolean {
  return index.times.length > 0
}

/**
 * The note glyph for a word starting at `timeSec`, or null when the
 * alignment has nothing near it: exact ms key first, then the nearest
 * aligned word within GLYPH_MATCH_TOLERANCE_SEC.
 */
export function glyphForWordTime(
  index: WordNoteIndex,
  timeSec: number | undefined,
  toleranceSec = GLYPH_MATCH_TOLERANCE_SEC,
): string | null {
  if (timeSec === undefined || !Number.isFinite(timeSec)) return null
  const key = keyOf(timeSec)
  const exact =
    index.byKey.get(key) ?? index.byKey.get(key - 1) ?? index.byKey.get(key + 1)
  if (exact !== undefined) return exact

  const { times, notes } = index
  if (times.length === 0) return null
  // Binary search the insertion point, then compare both neighbours.
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (times[mid] < timeSec) lo = mid + 1
    else hi = mid
  }
  let best = -1
  let bestDist = Infinity
  for (const candidate of [lo - 1, lo]) {
    if (candidate < 0 || candidate >= times.length) continue
    const dist = Math.abs(times[candidate] - timeSec)
    if (dist < bestDist) {
      bestDist = dist
      best = candidate
    }
  }
  if (best === -1 || bestDist > toleranceSec) return null
  return notes[best]
}
