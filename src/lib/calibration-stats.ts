// ============================================================
// calibration-stats — the statistics both calibrations share
// ============================================================
//
// Two different measurements in this app play a series of clicks and ask how
// far something landed from each one: the LRC mapper's reaction calibration
// (@/lib/tap-calibration) matches finger taps, the mic latency wizard
// (@/lib/mic-latency) matches the clicks coming back through the microphone.
// The domain differs; the statistics do not, and they were worth extracting
// rather than writing twice.
//
// Median rather than mean throughout: one bad sample in ten should not move
// the result, and both samples are skewed with a long late tail.
//
// Tests: src/tests/tap-calibration.test.ts, src/lib/mic-latency.test.ts.

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
 * Signed error of one observation against the nearest scheduled event, in
 * seconds. Positive means the observation landed late, which is the normal
 * direction for both callers. Returns null when the observation is too far
 * from every event to be a response to one.
 */
export function nearestEventDelta(
  eventTimes: number[],
  observedTime: number,
  maxDistance: number,
): number | null {
  let best: number | null = null
  for (const event of eventTimes) {
    const delta = observedTime - event
    if (Math.abs(delta) > maxDistance) continue
    if (best === null || Math.abs(delta) < Math.abs(best)) best = delta
  }
  return best
}

/**
 * Interquartile spread of the sample in ms, as a confidence hint. A tight
 * spread means the median is a real constant; a wide one means the run was
 * noisy and is worth repeating.
 */
export function spreadMs(deltasSec: number[]): number | null {
  if (deltasSec.length < 2) return null
  const sorted = [...deltasSec].sort((a, b) => a - b)
  const lower = median(sorted.slice(0, Math.floor(sorted.length / 2)))
  const upper = median(sorted.slice(Math.ceil(sorted.length / 2)))
  if (lower === null || upper === null) return null
  return Math.round((upper - lower) * 1000)
}
