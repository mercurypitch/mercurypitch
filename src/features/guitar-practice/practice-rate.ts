// ============================================================
// Practice playback-rate math (pure, testable)
// ============================================================
//
// Speed-trainer rates for the A/B loop. Kept pure so the ramp/clamp behaviour
// can be unit-tested without driving the rAF game loop.

/** Slowest practice playback rate. */
export const MIN_RATE = 0.25
/** Fastest practice playback rate. */
export const MAX_RATE = 2

/** Clamp a playback rate into the supported range. */
export function clampRate(rate: number): number {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate))
}

/** Next rate after one loop pass when the speed ramp is on. */
export function rampedRate(rate: number, step: number): number {
  return clampRate(rate + step)
}
