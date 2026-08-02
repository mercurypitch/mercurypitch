// ============================================================
// Zen note glyphs — word → target-note lookup
// ============================================================
//
// The zen stage annotates lyric words with the note the singer SHOULD
// sing, chord-chart style (glyph anchored over the word's start). The
// notes come from the pitch-word alignment, whose word times are its
// own — not the sheet's.
//
// This has been fixed twice and come back twice, so the mechanism is
// worth stating. The first attempt keyed on the display word's start
// time exactly (±1ms); the second widened that to a 0.4s nearest match.
// Both kept the same false premise: that the DISPLAY word has a time at
// all. Uploaded and line-only LRC carry line times and nothing else, so
// `wordTimes` is undefined, every lookup returned null, and the toggle
// showed nothing however wide the tolerance got.
//
// Meanwhile the lyrics panel had been getting this right the whole time,
// forty lines away in another file: estimate a window for the word when
// the sheet has no per-word times, then match by time-range OVERLAP
// rather than by start proximity. That logic now lives here and both
// surfaces call it, so they cannot drift apart again — which is the
// actual bug behind all three reports.
//
// Pure data-in/data-out (no Solid, no DOM), mirroring zen-navigation.ts.

import type { AlignedWord } from '@/lib/pitch-word-alignment'

/** A lyric line as either surface holds it, with whatever timing it has. */
export interface LyricLineWindow {
  /** Line start (seconds) — always present; LRC is line-timed at minimum. */
  time: number
  /** Line end. The zen list derives it from the next entry's start. */
  endTime: number
  words: readonly string[]
  /** Per-word starts, when the sheet actually carries them. */
  wordTimes?: readonly number[] | undefined
  /** Per-word ends, rarer still. */
  wordEndTimes?: readonly number[] | undefined
}

/**
 * The time window a word occupies.
 *
 * Real per-word stamps when the sheet has them; otherwise the line's span
 * split evenly across its words. The estimate is crude and entirely
 * sufficient — it only has to be close enough to overlap the right aligned
 * word, and being crude is far better than the alternative of returning
 * nothing at all for every line-timed sheet.
 */
export function wordWindow(
  line: LyricLineWindow,
  wordIndex: number,
): { startSec: number; endSec: number } {
  const times = line.wordTimes
  if (
    times !== undefined &&
    times.length > 0 &&
    times[wordIndex] !== undefined
  ) {
    const startSec = times[wordIndex]!
    const endSec =
      line.wordEndTimes?.[wordIndex] ??
      (wordIndex + 1 < times.length ? times[wordIndex + 1]! : line.endTime)
    return { startSec, endSec }
  }
  const count = Math.max(1, line.words.length)
  const perWord = Math.max(0.05, (line.endTime - line.time) / count)
  const startSec = line.time + wordIndex * perWord
  return { startSec, endSec: startSec + perWord }
}

/**
 * The aligned word overlapping this window the most, or null when none
 * does. Overlap rather than nearest-start: a sung word and its aligned
 * counterpart share time even when their starts disagree, which is
 * exactly the cross-source drift the earlier fixes were chasing.
 */
export function noteForWindow(
  alignedWords: readonly AlignedWord[],
  startSec: number,
  endSec: number,
): { noteName: string; midi: number } | null {
  let best: { noteName: string; midi: number } | null = null
  let bestOverlap = 0
  for (const word of alignedWords) {
    if (word.midi == null || word.noteName == null || word.noteName === '') {
      continue
    }
    const overlap =
      Math.min(endSec, word.endSec) - Math.max(startSec, word.startSec)
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = { noteName: word.noteName, midi: word.midi }
    }
  }
  return best
}

/** The note for one word of one line — the whole lookup, both surfaces. */
export function noteForWord(
  alignedWords: readonly AlignedWord[],
  line: LyricLineWindow,
  wordIndex: number,
): { noteName: string; midi: number } | null {
  if (alignedWords.length === 0) return null
  const { startSec, endSec } = wordWindow(line, wordIndex)
  return noteForWindow(alignedWords, startSec, endSec)
}

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
