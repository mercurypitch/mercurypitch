// ============================================================
// tap-calibration — pure helpers for measuring audio-to-motor reaction time
// ============================================================
//
// The LRC mapper subtracts a fixed "reaction" offset from every tap so marks
// land where the sound started rather than where the finger arrived. That
// offset used to be a number the operator guessed at (default 180 ms, a
// population average). These helpers turn it into a measurement: play a steady
// click, tap along, take the median signed error.
//
// Median rather than mean on purpose — one distracted tap in ten should not
// move the result, and reaction-time samples are skewed with a long late tail.
//
// See docs/plans/lrc-per-word-mapping-research.md. Tests:
// src/tests/tap-calibration.test.ts.

/** Clicks played in one calibration run. */
export const CALIBRATION_CLICK_COUNT = 10
/** Seconds between clicks — slow enough to reset between taps. */
export const CALIBRATION_INTERVAL_SEC = 1
/** Silence before the first click, so the operator can settle. */
export const CALIBRATION_LEAD_IN_SEC = 1.5
/** A tap further than this from any click is a mis-tap, not a data point. */
export const MAX_TAP_DISTANCE_SEC = 0.5
/** Below this many usable taps the median is not worth trusting. */
export const MIN_CALIBRATION_TAPS = 4
/** Matches the mapper's own clamp on the persisted offset. */
export const MAX_OFFSET_MS = 500

/** Absolute times (audio clock, seconds) at which each click will sound. */
export function buildClickSchedule(
  startTime: number,
  count: number = CALIBRATION_CLICK_COUNT,
  interval: number = CALIBRATION_INTERVAL_SEC,
): number[] {
  const times: number[] = []
  for (let i = 0; i < count; i++) times.push(startTime + i * interval)
  return times
}

/**
 * Signed error of one tap against the nearest click, in seconds. Positive
 * means the tap landed late, which is the normal direction. Returns null when
 * the tap is too far from every click to be a response to one.
 */
export function nearestClickDelta(
  clickTimes: number[],
  tapTime: number,
  maxDistance: number = MAX_TAP_DISTANCE_SEC,
): number | null {
  let best: number | null = null
  for (const click of clickTimes) {
    const delta = tapTime - click
    if (Math.abs(delta) > maxDistance) continue
    if (best === null || Math.abs(delta) < Math.abs(best)) best = delta
  }
  return best
}

/** Median of a numeric sample. Returns null for an empty sample. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/**
 * Reaction offset in whole milliseconds from a set of signed tap errors
 * (seconds). Clamped to the same range the mapper persists. Negative medians
 * clamp to 0: the offset only ever compensates *late* taps, and an operator
 * who anticipates the beat should not have their marks pushed later still.
 *
 * Returns null when too few taps landed near a click to be worth trusting.
 */
export function medianOffsetMs(
  deltasSec: number[],
  minTaps: number = MIN_CALIBRATION_TAPS,
): number | null {
  if (deltasSec.length < minTaps) return null
  const mid = median(deltasSec)
  if (mid === null) return null
  return Math.max(0, Math.min(MAX_OFFSET_MS, Math.round(mid * 1000)))
}

/**
 * Spread of the sample in ms, as a confidence hint for the operator. A tight
 * spread means the median is a real personal constant; a wide one means the
 * taps were guesswork and the run is worth repeating.
 */
export function spreadMs(deltasSec: number[]): number | null {
  if (deltasSec.length < 2) return null
  const sorted = [...deltasSec].sort((a, b) => a - b)
  const lower = median(sorted.slice(0, Math.floor(sorted.length / 2)))
  const upper = median(sorted.slice(Math.ceil(sorted.length / 2)))
  if (lower === null || upper === null) return null
  return Math.round((upper - lower) * 1000)
}
