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
// The statistics live in @/lib/calibration-stats, shared with the mic latency
// wizard. What stays here is the domain: how the click track is laid out and
// how a reaction offset is clamped.
//
// See docs/plans/lrc-per-word-mapping-research.md. Tests:
// src/tests/tap-calibration.test.ts.

import { median, nearestEventDelta } from './calibration-stats'

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

/** Signed error of one tap against the nearest click, in seconds. */
export function nearestClickDelta(
  clickTimes: number[],
  tapTime: number,
  maxDistance: number = MAX_TAP_DISTANCE_SEC,
): number | null {
  return nearestEventDelta(clickTimes, tapTime, maxDistance)
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
