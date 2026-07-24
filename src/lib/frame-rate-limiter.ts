// ============================================================
// Frame-rate limiter — keeps expensive visual work independent
// from the browser's display refresh rate
// ============================================================

export interface FrameRateLimiter {
  shouldRun: (nowSeconds: number) => boolean
  reset: () => void
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
