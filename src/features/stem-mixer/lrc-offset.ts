// ============================================================
// lrc-offset — shift a whole mapping in time
// ============================================================
//
// "The whole song is 200 ms late" used to mean remapping every word. It is
// one number: every line start, word start, word end and sweep sample moves
// by the same amount, and nothing about the mapping's internal spacing
// changes.
//
// The lyricsfile 1.0 spec carries this as `metadata.offset_ms`, and standard
// LRC carries it as an `[offset:]` ID tag — see `parseLrcOffsetTag`. This
// module is the arithmetic both of those need.
//
// Tests: src/tests/lrc-offset.test.ts

import type { WordSweepTimingsMap, WordTimingsMap } from './types'

/** Everything a mapping session holds that is measured in seconds. */
export interface ShiftableTimings {
  lineTimes: readonly (number | undefined)[]
  wordTimings: WordTimingsMap
  wordEndTimings: WordTimingsMap
  wordSweepTimings: WordSweepTimingsMap
}

/** The earliest moment the mapping refers to, or null when it is empty. */
export function earliestTime(timings: ShiftableTimings): number | null {
  let earliest: number | null = null
  const consider = (time: number | undefined) => {
    if (time === undefined) return
    if (earliest === null || time < earliest) earliest = time
  }

  for (const time of timings.lineTimes) consider(time)
  for (const times of Object.values(timings.wordTimings)) {
    for (const time of times) consider(time)
  }
  for (const times of Object.values(timings.wordEndTimings)) {
    for (const time of times) consider(time)
  }
  for (const line of Object.values(timings.wordSweepTimings)) {
    for (const points of Object.values(line)) {
      for (const point of points) consider(point.time)
    }
  }
  return earliest
}

/**
 * The part of `deltaSec` that can actually be applied.
 *
 * A global offset that clamped individual times at zero would not be a global
 * offset any more: the words at the head of the song would bunch up against
 * 0:00 while the rest kept their spacing, quietly destroying the mapping it
 * was asked to move. Bounding the delta instead keeps every interval intact —
 * the shift just stops when the first word reaches the start of the track.
 */
export function clampShift(
  timings: ShiftableTimings,
  deltaSec: number,
): number {
  if (deltaSec >= 0) return deltaSec
  const earliest = earliestTime(timings)
  if (earliest === null) return 0
  return Math.max(deltaSec, -earliest)
}

/** Round to milliseconds — the resolution every stored timing uses. */
const toMs = (seconds: number) => Math.round(seconds * 1000) / 1000

/**
 * Move every timing by `deltaSec`, clamped by {@link clampShift}. Returns new
 * objects throughout; the input is left alone so a caller can diff or undo.
 */
export function shiftTimings(
  timings: ShiftableTimings,
  deltaSec: number,
): {
  timings: ShiftableTimings
  /** What was applied, which is not always what was asked for. */
  applied: number
} {
  const applied = clampShift(timings, deltaSec)
  if (applied === 0) {
    return {
      timings: {
        lineTimes: [...timings.lineTimes],
        wordTimings: { ...timings.wordTimings },
        wordEndTimings: { ...timings.wordEndTimings },
        wordSweepTimings: { ...timings.wordSweepTimings },
      },
      applied,
    }
  }

  const shiftMap = (map: WordTimingsMap): WordTimingsMap => {
    const next: WordTimingsMap = {}
    for (const [lineIdx, times] of Object.entries(map)) {
      // Sparse: a word with no time keeps not having one.
      const shifted: number[] = []
      for (let i = 0; i < times.length; i++) {
        if (times[i] !== undefined) shifted[i] = toMs(times[i] + applied)
      }
      next[+lineIdx] = shifted
    }
    return next
  }

  const wordSweepTimings: WordSweepTimingsMap = {}
  for (const [lineIdx, line] of Object.entries(timings.wordSweepTimings)) {
    const nextLine: Record<number, { time: number; progress: number }[]> = {}
    for (const [wordIdx, points] of Object.entries(line)) {
      nextLine[+wordIdx] = points.map((point) => ({
        ...point,
        time: toMs(point.time + applied),
      }))
    }
    wordSweepTimings[+lineIdx] = nextLine
  }

  return {
    timings: {
      lineTimes: timings.lineTimes.map((time) =>
        time === undefined ? undefined : toMs(time + applied),
      ),
      wordTimings: shiftMap(timings.wordTimings),
      wordEndTimings: shiftMap(timings.wordEndTimings),
      wordSweepTimings,
    },
    applied,
  }
}

// The `[offset:]` ID tag is LRC-format knowledge, so it lives with the rest
// of the LRC parsing in src/lib/lyrics-service.ts — importing a feature module
// from there would invert the dependency and risk a Vite chunk cycle.
export { parseLrcOffsetTag } from '@/lib/lyrics-service'
