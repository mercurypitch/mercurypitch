// ============================================================
// Frame-rate limiter — keeps expensive visual work independent
// from the browser's display refresh rate
// ============================================================

export interface FrameRateLimiter {
  shouldRun: (nowSeconds: number) => boolean
  reset: () => void
}

/**
 * A limiter whose cap follows the accessor on every frame.
 *
 * The night rooms feed the frame-health sampler that can DEMOTE the
 * device tier mid-session; a limiter built once from the fps at mount
 * never hears about it, so the very loop that detected the struggle
 * stays uncapped. A non-finite fps means uncapped: shouldRun is then
 * always true, and a later demotion picks up its cadence from the most
 * recent frame.
 */
export function createAdaptiveFrameRateLimiter(
  maxFramesPerSecond: () => number,
): FrameRateLimiter {
  let lastRunAt = Number.NEGATIVE_INFINITY

  return {
    shouldRun(nowSeconds: number): boolean {
      if (!Number.isFinite(nowSeconds)) return false
      const fps = maxFramesPerSecond()
      if (!Number.isFinite(fps) || fps <= 0) {
        lastRunAt = nowSeconds
        return true
      }
      const intervalSeconds = 1 / fps
      const clockToleranceSeconds = Math.min(0.001, intervalSeconds / 10)
      if (
        nowSeconds < lastRunAt ||
        nowSeconds - lastRunAt + clockToleranceSeconds >= intervalSeconds
      ) {
        lastRunAt = nowSeconds
        return true
      }
      return false
    },
    reset(): void {
      lastRunAt = Number.NEGATIVE_INFINITY
    },
  }
}

export function createFrameRateLimiter(
  maxFramesPerSecond: number,
): FrameRateLimiter {
  const safeFramesPerSecond =
    Number.isFinite(maxFramesPerSecond) && maxFramesPerSecond > 0
      ? maxFramesPerSecond
      : 1
  const intervalSeconds = 1 / safeFramesPerSecond
  // RAF timestamps are commonly rounded to 0.1 ms. Without a small tolerance,
  // a nominal 33.333 ms deadline can arrive as 33.3 ms and miss until the next
  // display frame, turning a requested 30 Hz cadence into an uneven ~20 Hz.
  const clockToleranceSeconds = Math.min(0.001, intervalSeconds / 10)
  let lastRunAt = Number.NEGATIVE_INFINITY

  return {
    shouldRun(nowSeconds: number): boolean {
      if (!Number.isFinite(nowSeconds)) return false
      if (
        nowSeconds < lastRunAt ||
        nowSeconds - lastRunAt + clockToleranceSeconds >= intervalSeconds
      ) {
        lastRunAt = nowSeconds
        return true
      }
      return false
    },
    reset(): void {
      lastRunAt = Number.NEGATIVE_INFINITY
    },
  }
}
