// ============================================================
// Block fill — copying a mapped chorus onto its other instances
// ============================================================
//
// Map the chorus once and every later repeat of it gets the same shape, moved
// to where that repeat actually starts. This is the arithmetic for one such
// copy: take the template's lines, words, ends and sub-word splits, and shift
// all four by the same delta.
//
// It is worth having on its own because it writes four maps at once and runs
// without the singer watching. A delta applied to three of them and not the
// fourth does not look wrong on the row — it desynchronises the highlighter
// from the words underneath it, several minutes into the song.
//
// Tests: src/tests/block-fill.test.ts
// Plan: docs/plans/lrc-mapper-studio-plan.md (Phase 0).

import type { WordSweepTimingsMap, WordTimingsMap } from './types'

/** Timings are stored to the millisecond; anything finer is measurement noise. */
function shift(time: number, delta: number): number {
  return Math.round((time + delta) * 1000) / 1000
}

export interface BlockTimings {
  lineTimes: (number | undefined)[]
  wordTimings: WordTimingsMap
  wordEndTimings: WordTimingsMap
  wordSweepTimings: WordSweepTimingsMap
}

export interface BlockFillSpan {
  /** First line of the instance being copied from. */
  templateStart: number
  /** First line of the instance being written to. */
  instanceStart: number
  lineCount: number
  /** Seconds to add: where the instance starts, minus where the template does. */
  delta: number
}

/**
 * Return a copy of `timings` with the template's block written onto the
 * instance's lines, shifted by `delta`.
 *
 * A line the template never mapped is left alone rather than cleared — the
 * instance may already hold something better, and a half-mapped template
 * should not wipe it.
 */
export function fillBlockInstance(
  timings: BlockTimings,
  span: BlockFillSpan,
): BlockTimings {
  const { templateStart, instanceStart, lineCount, delta } = span

  const lineTimes = [...timings.lineTimes]
  const wordTimings: WordTimingsMap = {}
  for (const key of Object.keys(timings.wordTimings)) {
    wordTimings[+key] = [...timings.wordTimings[+key]]
  }
  const wordEndTimings = structuredClone(timings.wordEndTimings)
  const wordSweepTimings = structuredClone(timings.wordSweepTimings)

  for (let offset = 0; offset < lineCount; offset++) {
    const from = templateStart + offset
    const to = instanceStart + offset

    const lineTime = timings.lineTimes[from]
    if (lineTime !== undefined) lineTimes[to] = shift(lineTime, delta)

    const starts = timings.wordTimings[from]
    if (starts !== undefined && starts.length > 0) {
      wordTimings[to] = starts.map((time) => shift(time, delta))
    }

    const ends = timings.wordEndTimings[from]
    if (ends !== undefined && ends.length > 0) {
      wordEndTimings[to] = ends.map((time) => shift(time, delta))
    }

    const sweeps = timings.wordSweepTimings[from]
    if (sweeps !== undefined) {
      const moved: Record<number, { time: number; progress: number }[]> = {}
      for (const [wordIdx, points] of Object.entries(sweeps)) {
        moved[+wordIdx] = points.map((point) => ({
          ...point,
          time: shift(point.time, delta),
        }))
      }
      wordSweepTimings[to] = moved
    }
  }

  return { lineTimes, wordTimings, wordEndTimings, wordSweepTimings }
}
