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
  const clockToleranceSeconds = 1e-6
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
