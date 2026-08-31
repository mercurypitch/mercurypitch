// ============================================================
// Causal running median — the cheap first line of defence against isolated
// pitch spikes (single-frame octave errors, consonant transients). Promoted
// from the local median in shazam/onset-detector.ts so both share one impl.
// ============================================================

/** Median of an array of numbers. More robust to outliers than the mean. */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

export interface RunningMedian {
  /** Push a value and return the median of the current window. */
  push(value: number): number
  reset(): void
  readonly size: number
}

/**
 * Sliding-window median. With an odd window of N, up to floor(N/2) consecutive
 * outliers are rejected, so a 5-tap median absorbs single- and double-frame
 * spikes while tracking sustained changes.
 */
export function createRunningMedian(window: number): RunningMedian {
  const win = Math.max(1, Math.floor(window))
  const buf: number[] = []
  return {
    push(value: number): number {
      buf.push(value)
      if (buf.length > win) buf.shift()
      return median(buf)
    },
    reset(): void {
      buf.length = 0
    },
    get size(): number {
      return buf.length
    },
  }
}
