// ============================================================
// Lyric sweep timing — pure helpers for marker-authored karaoke curves
// ============================================================

import type { LyricsTimingExtension, WordSweepPoint, WordSweepTimingsMap, } from '@/features/stem-mixer/types'

const roundMillis = (value: number): number => Math.round(value * 1000) / 1000
const clampProgress = (value: number): number => Math.max(0, Math.min(1, value))

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
