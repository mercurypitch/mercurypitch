// ============================================================
// A staircase on the plate (docs/plans/ear-lab-native-look.md): the log
// scale its levels are drawn on, the grid lines that scale is read by,
// and the misses read off its way.
// ============================================================

import type { TracePoint } from '@/features/ear-lab/stage-room'

/** The ends of a log scale around `values`: at least a factor of four
 *  wide, so a run that barely moved still has a scale, and a little
 *  room past each end. */
export function logDomain(
  values: readonly number[],
): readonly [number, number] {
  const positive = values.filter((value) => value > 0)
  if (positive.length === 0) return [1, 10]
  const lo = Math.min(...positive)
  const hi = Math.max(...positive)
  const middle = Math.sqrt(lo * hi)
  const half = Math.sqrt(Math.max(hi / lo, 4)) * 1.15
  return [middle / half, middle * half]
}

/** Where `value` sits on the log scale from `lo` to `hi`: 0 at the
 *  bottom, 1 at the top. */
export function logPlace(value: number, lo: number, hi: number): number {
  const span = Math.log(hi) - Math.log(lo)
  if (span <= 0 || value <= 0) return 0
  return (Math.log(value) - Math.log(lo)) / span
}

/** The grid lines a log scale from `lo` to `hi` is read by: 1, 2 and 5
 *  of each power of ten between its ends, thinned to at most `most`,
 *  the largest kept. */
export function logTicks(lo: number, hi: number, most = 4): number[] {
  const ticks: number[] = []
  const first = Math.floor(Math.log10(Math.max(lo, 1e-6)))
  const last = Math.ceil(Math.log10(Math.max(hi, 1e-6)))
  for (let power = first; power <= last; power++) {
    for (const step of [1, 2, 5]) {
      const value = Number((step * 10 ** power).toPrecision(2))
      if (value >= lo && value <= hi) ticks.push(value)
    }
  }
  if (ticks.length <= most) return ticks
  const every = Math.ceil(ticks.length / most)
  const top = ticks.length - 1
  return ticks.filter((_, i) => (top - i) % every === 0)
}

/** A staircase's misses: how many, and the easiest level one came at,
 *  the largest where lower is better and the smallest where it is not. */
export function staircaseMisses(
  points: readonly TracePoint[],
  lowerIsBetter: boolean,
): { count: number; edge: number | null } {
  const missed = points
    .filter((point) => point.correct === false)
    .map((point) => point.level)
  if (missed.length === 0) return { count: 0, edge: null }
  return {
    count: missed.length,
    edge: lowerIsBetter ? Math.max(...missed) : Math.min(...missed),
  }
}

/** A calibration's points, track by track, in the order they were
 *  answered: `count` lists, empty for a track with none. */
export function byTrack(
  points: readonly TracePoint[],
  count: number,
): TracePoint[][] {
  const tracks: TracePoint[][] = Array.from({ length: count }, () => [])
  for (const point of points) {
    const track = point.track ?? 0
    if (track >= 0 && track < count) tracks[track].push(point)
  }
  return tracks
}
