// ============================================================
// Frame meter — how the stage's frames are going on this device
// ============================================================
//
// The spike's first stop sign (P6, step 6.0): "stop here if the stage cannot
// hold its frame cap or its memory on the older Chromecast with Google TV".
// The meter keeps the last few seconds of the display's frame times and
// says how many a second, how even, how many came late, and how much of
// the JavaScript heap the page holds where the browser tells
// (`performance.memory`, Chromium only). The receiver answers a `probe`
// with it and draws it over the stage with `diagnostics` on (control.ts).
//
// Tests: src/lib/cast-receiver/frame-meter.test.ts.

/** How many frame intervals the meter keeps: four seconds at 60 a second. */
export const FRAME_METER_SPAN = 240

/** An interval this much longer than the typical one is a late frame. */
const LATE_FACTOR = 1.5

export interface FrameMeterReading {
  /** Frames a second over the span, 0 before two frames. */
  readonly fps: number
  /** The middle interval and the 95th percentile one, in ms. */
  readonly medianMs: number
  readonly p95Ms: number
  /** Intervals over half again the median: frames the display skipped. */
  readonly late: number
  readonly frames: number
  /** The page's JavaScript heap in MB, where the browser reports it. */
  readonly heapMb: number | null
  readonly heapLimitMb: number | null
}

export interface FrameMeter {
  /** One frame of the display, at its timestamp in ms. */
  tick(timeMs: number): void
  reading(): FrameMeterReading
}

/** Chromium's non-standard heap figures. */
export interface HeapSource {
  readonly memory?: {
    readonly usedJSHeapSize: number
    readonly jsHeapSizeLimit: number
  }
}

const mb = (bytes: number): number => Math.round((bytes / 1048576) * 10) / 10

function percentile(sorted: readonly number[], share: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.floor(share * sorted.length))
  return sorted[index]
}

export function createFrameMeter(
  heap: HeapSource = {},
  span: number = FRAME_METER_SPAN,
): FrameMeter {
  const intervals: number[] = []
  let last: number | null = null
  return {
    tick(timeMs) {
      if (last !== null && timeMs > last) {
        intervals.push(timeMs - last)
        if (intervals.length > span) intervals.shift()
      }
      last = timeMs
    },
    reading() {
      const sorted = [...intervals].sort((a, b) => a - b)
      const total = intervals.reduce((sum, interval) => sum + interval, 0)
      const medianMs = percentile(sorted, 0.5)
      const memory = heap.memory
      return {
        fps:
          total > 0 ? Math.round((intervals.length * 10_000) / total) / 10 : 0,
        medianMs: Math.round(medianMs * 10) / 10,
        p95Ms: Math.round(percentile(sorted, 0.95) * 10) / 10,
        late: intervals.filter((interval) => interval > medianMs * LATE_FACTOR)
          .length,
        frames: intervals.length,
        heapMb: memory === undefined ? null : mb(memory.usedJSHeapSize),
        heapLimitMb: memory === undefined ? null : mb(memory.jsHeapSizeLimit),
      }
    },
  }
}
