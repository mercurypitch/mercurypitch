// ============================================================
// Inversions — a chord turned over, its bottom note an octave up, and its position's name
// ============================================================
//
// Lesson 27's Turn over (WEB-SPEC, Toys 1, Step 4): a press moves the
// chord's lowest note up an octave, so the bass changes and the chord's
// notes, and its room on the ring, stay the same. A chord's positions run
// from root position through each inversion, three for a triad and four for
// a seventh chord, and the press after the last returns it to root position
// at its first pitches, so no number of presses climbs past them (FACTS 50).
// Pure: the page plays and draws what these give.

/** A chord's position by the note in its bass, root position first (FACTS 28, 29, 50). */
export const POSITION_NAMES = [
  'Root position',
  'First inversion',
  'Second inversion',
  'Third inversion',
] as const

export type PositionName = (typeof POSITION_NAMES)[number]

/** The chord turned over: its lowest note an octave up, the notes low to high. */
export function turnOver(notes: readonly number[]): number[] {
  const [low, ...rest] = [...notes].sort((a, b) => a - b)
  return [...rest, low + 12]
}

/**
 * A chord's positions, root position first, each the one before turned
 * over: one a note, so three for a triad and four for a seventh chord.
 */
export function positionsOf(rootPosition: readonly number[]): number[][] {
  const out = [[...rootPosition].sort((a, b) => a - b)]
  while (out.length < rootPosition.length)
    out.push(turnOver(out[out.length - 1]))
  return out
}

/** The position after `at` of a chord of `count` notes: the one after the last is root position again. */
export const nextPosition = (at: number, count: number): number =>
  (at + 1) % count
