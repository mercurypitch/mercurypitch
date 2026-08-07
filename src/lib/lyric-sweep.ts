// ============================================================
// Lyric sweep timing — pure helpers for marker-authored karaoke curves
// ============================================================

import type { LyricsTimingExtension, WordSweepPoint, WordSweepTimingsMap, } from '@/features/stem-mixer/types'
import { sameProgress } from './word-letters'

const roundMillis = (value: number): number => Math.round(value * 1000) / 1000
const clampProgress = (value: number): number => Math.max(0, Math.min(1, value))

/**
 * Smallest gap the curve can represent. It is the rounding granularity, so two
 * boundaries closer than this are the same millisecond once stored.
 */
const SPLIT_EPSILON = 0.001

/**
 * Add one marker sample while preserving a forward-only, compact curve.
 *
 * Repeated positions are intentionally retained at 100ms intervals. They
 * encode a dwell: the marker can sit on a vowel while playback keeps moving.
 */
export function appendSweepPoint(
  points: WordSweepPoint[],
  time: number,
  progress: number,
): WordSweepPoint[] {
  const roundedTime = roundMillis(Math.max(0, time))
  const last = points.at(-1)
  const nextProgress = Math.max(
    last?.progress ?? 0,
    roundMillis(clampProgress(progress)),
  )
  const next = { time: roundedTime, progress: nextProgress }

  if (!last) return [next]
  if (roundedTime < last.time) return points

  if (roundedTime === last.time) {
    if (nextProgress > last.progress) return [...points, next]
    return points
  }

  const timeDelta = roundedTime - last.time
  const progressDelta = nextProgress - last.progress
  if (timeDelta < 0.1 && progressDelta < 0.015) return points

  const result = [...points, next]
  // A pathological multi-minute hold should not grow without bound. Preserve
  // both endpoints and every second interior sample when compacting.
  if (result.length <= 512) return result
  return result.filter(
    (_point, index) =>
      index === 0 || index === result.length - 1 || index % 2 === 0,
  )
}

// ── Letter-level split points ────────────────────────────────────
//
// `appendSweepPoint` is for the live gesture: forward-only, append-only,
// deliberately lossy. Editing a split is the opposite — an insert at a known
// position in an already-finished curve — so it gets its own primitives rather
// than a mode flag on the recorder.
//
// Every one of them keeps the curve's invariant: progress and time both
// non-decreasing. A split that would break it is clamped between its
// neighbours, or refused when they leave no room. See src/lib/word-letters.ts.

/**
 * Place or move a split point at `progress`.
 *
 * Returns the input unchanged when the neighbouring boundaries are already
 * touching, because inventing a time inside a zero-width window would put a
 * split somewhere the user did not click.
 */
export function setSplitPoint(
  points: readonly WordSweepPoint[],
  time: number,
  progress: number,
): WordSweepPoint[] {
  const target = roundMillis(clampProgress(progress))
  const at = indexOfProgress(points, target)

  // Where the point ends up, and which neighbours therefore bound its time.
  const slot = at >= 0 ? at : nextIndexAbove(points, target)
  const before = points[slot - 1]
  const after = at >= 0 ? points[at + 1] : points[slot]

  const lo = before === undefined ? 0 : before.time + SPLIT_EPSILON
  const hi = after === undefined ? Infinity : after.time - SPLIT_EPSILON
  if (lo > hi) return [...points]

  const next = {
    time: roundMillis(Math.min(hi, Math.max(lo, time))),
    progress: target,
  }
  if (at >= 0) return points.map((point, i) => (i === at ? next : point))
  return [...points.slice(0, slot), next, ...points.slice(slot)]
}

/**
 * Drop the split at `progress`.
 *
 * The word's own onset and end are not splits, so they survive — removing one
 * would leave the word with no interval at all. They are identified by their
 * PROGRESS (0 and 1), never by their position in the array: a curve built
 * only from interior clicks has an interior split sitting at index 0, and the
 * index test this used to do refused to remove it. Clearing the only split in
 * a word was impossible, which is exactly the case the letter editor's
 * right-click and long-press are for.
 */
export function removeSplitPoint(
  points: readonly WordSweepPoint[],
  progress: number,
): WordSweepPoint[] {
  const target = roundMillis(clampProgress(progress))
  if (target <= 0 || target >= 1) return [...points]
  const at = indexOfProgress(points, target)
  if (at < 0) return [...points]
  return points.filter((_point, i) => i !== at)
}

/**
 * The point naming this boundary, or -1.
 *
 * Progress is stored rounded, so callers must hand in a rounded value too —
 * `progressForLetter` returns thirds and sevenths that no epsilon this small
 * would otherwise match.
 */
function indexOfProgress(
  points: readonly WordSweepPoint[],
  progress: number,
): number {
  return points.findIndex((point) => sameProgress(point.progress, progress))
}

/** Insertion slot for a new boundary: the first point past it, else the end. */
function nextIndexAbove(
  points: readonly WordSweepPoint[],
  progress: number,
): number {
  const idx = points.findIndex((point) => point.progress > progress)
  return idx < 0 ? points.length : idx
}

/**
 * Retime a word's onset, keeping the splits inside it.
 *
 * `beginWordSweep` resets the curve, which is right when the gesture restarts
 * a word and wrong when the edit is only its start time.
 */
export function retimeWordStart(
  points: readonly WordSweepPoint[],
  time: number,
): WordSweepPoint[] {
  const next = points[1]
  const bounded = roundMillis(
    Math.max(
      0,
      next === undefined ? time : Math.min(time, next.time - SPLIT_EPSILON),
    ),
  )
  if (points.length === 0) return [{ time: bounded, progress: 0 }]
  if (points[0].progress > 0) return [{ time: bounded, progress: 0 }, ...points]
  return points.map((point, i) =>
    i === 0 ? { ...point, time: bounded } : point,
  )
}

/** Retime a word's end, keeping the splits inside it. See retimeWordStart. */
export function retimeWordEnd(
  points: readonly WordSweepPoint[],
  time: number,
): WordSweepPoint[] {
  const prev = points.at(-2)
  const bounded = roundMillis(
    Math.max(
      0,
      prev === undefined ? time : Math.max(time, prev.time + SPLIT_EPSILON),
    ),
  )
  if (points.length === 0) return [{ time: bounded, progress: 1 }]
  const last = points[points.length - 1]
  if (last.progress < 1) return [...points, { time: bounded, progress: 1 }]
  return points.map((point, i) =>
    i === points.length - 1 ? { ...point, time: bounded } : point,
  )
}

/** Start one word without cloning unrelated song lines or words. */
export function beginWordSweep(
  timings: WordSweepTimingsMap,
  lineIdx: number,
  wordIdx: number,
  time: number,
): WordSweepTimingsMap {
  return {
    ...timings,
    [lineIdx]: {
      ...(timings[lineIdx] ?? {}),
      [wordIdx]: [{ time, progress: 0 }],
    },
  }
}

/** Append one sample with structural sharing outside the active word. */
export function appendWordSweepSample(
  timings: WordSweepTimingsMap,
  lineIdx: number,
  wordIdx: number,
  time: number,
  progress: number,
): WordSweepTimingsMap {
  const previousLine = timings[lineIdx] ?? {}
  const previousPoints = previousLine[wordIdx] ?? []
  const nextPoints = appendSweepPoint(previousPoints, time, progress)
  if (nextPoints === previousPoints) return timings
  return {
    ...timings,
    [lineIdx]: {
      ...previousLine,
      [wordIdx]: nextPoints,
    },
  }
}

/** Resolve highlight position at `elapsed` from a marker-authored curve. */
export function interpolateSweepProgress(
  points: readonly WordSweepPoint[] | undefined,
  elapsed: number,
  fallback: number,
): number {
  if (!points || points.length === 0) return clampProgress(fallback)
  if (elapsed <= points[0].time) return clampProgress(points[0].progress)

  for (let i = 1; i < points.length; i++) {
    const next = points[i]
    if (elapsed > next.time) continue
    const prev = points[i - 1]
    const span = next.time - prev.time
    if (span <= 0) return clampProgress(next.progress)
    const ratio = (elapsed - prev.time) / span
    return clampProgress(
      prev.progress + (next.progress - prev.progress) * ratio,
    )
  }

  return clampProgress(points.at(-1)?.progress ?? fallback)
}

export function hasTimingExtension(extension: LyricsTimingExtension): boolean {
  return (
    Object.keys(extension.wordEndTimings).length > 0 ||
    Object.keys(extension.wordSweepTimings).length > 0
  )
}
