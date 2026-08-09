// ============================================================
// Ear Lab — The Grid's stimulus (pure).
//
// Six clicks on a steady 500 ms lattice; exactly one of the last
// four is nudged off the grid by the staircase's current level,
// early or late at a coin flip. The first two clicks are never
// displaced — they establish the pulse the ear judges against.
//
// The click times are offsets for sample-accurate scheduling on
// the AudioContext clock (osc.start(t), never setTimeout): the
// whole drill measures milliseconds, so the stimulus must be
// jitter-free even when the main thread is not.
// ============================================================

export const GRID_CLICKS = 6
export const GRID_IOI_S = 0.5
/** 0-based positions eligible for displacement (3rd..6th click). */
export const GRID_ANSWER_POSITIONS = [2, 3, 4, 5] as const

export interface GridPattern {
  /** Click offsets in seconds from the pattern start. */
  clickTimes: number[]
  /** 0-based index of the displaced click. */
  displacedIndex: number
  /** Signed displacement in milliseconds (negative = early). */
  shiftMs: number
}

export function generateGridPattern(
  levelMs: number,
  random: () => number = Math.random,
): GridPattern {
  const displacedIndex =
    GRID_ANSWER_POSITIONS[Math.floor(random() * GRID_ANSWER_POSITIONS.length)]
  const shiftMs = (random() < 0.5 ? -1 : 1) * levelMs

  const clickTimes = Array.from({ length: GRID_CLICKS }, (_, i) => {
    const base = i * GRID_IOI_S
    return i === displacedIndex ? base + shiftMs / 1000 : base
  })

  return { clickTimes, displacedIndex, shiftMs }
}

/** Total stimulus length in seconds (for scheduling the answer
 *  phase after the last click has sounded). */
export function gridPatternDuration(pattern: GridPattern): number {
  return Math.max(...pattern.clickTimes)
}
