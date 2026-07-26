// ============================================================
// Zen note glyphs — word → target-note lookup
// ============================================================
//
// The zen stage annotates lyric words with the note the singer SHOULD
// sing, chord-chart style (glyph anchored over the word's start). The
// notes come from the pitch-word alignment, which is built from the
// SAME LRC word timings the zen lines carry — so an exact lookup keyed
// by the word's start time is reliable; a small tolerance only absorbs
// float formatting drift, never re-maps words.
//
// Pure data-in/data-out (no Solid, no DOM), mirroring zen-navigation.ts.

import type { AlignedWord } from '@/lib/pitch-word-alignment'

/** Key resolution for the word-time index: 1 ms. */
const KEY_MS = 1000

const keyOf = (timeSec: number): number => Math.round(timeSec * KEY_MS)

/**
 * Index aligned words by their start time (ms-rounded). Words the alignment
 * could not map (noteName null) are skipped so the glyph simply doesn't
 * render rather than showing an empty chip.
 */
export function buildWordNoteIndex(
  alignedWords: readonly AlignedWord[],
): Map<number, string> {
  const index = new Map<number, string>()
  for (const word of alignedWords) {
    if (word.noteName === null || word.noteName === '') continue
    index.set(keyOf(word.startSec), word.noteName)
  }
  return index
}

/**
 * The note glyph for a word starting at `timeSec`, or null when the
 * alignment has nothing for it. Checks the exact ms key plus ±1 ms to
 * absorb rounding drift between the LRC parse and the alignment pass.
 */
export function glyphForWordTime(
  index: ReadonlyMap<number, string>,
  timeSec: number | undefined,
): string | null {
  if (timeSec === undefined || !Number.isFinite(timeSec)) return null
  const key = keyOf(timeSec)
  return index.get(key) ?? index.get(key - 1) ?? index.get(key + 1) ?? null
}
