// Guitar analysis cost — what the detection loop actually costs, per frame.
// ============================================================
//
// MPM is O(N²/2) on the main thread. At a 4096-sample window that is roughly
// 6.3 million inner iterations per detection, four times the 2048 cost, and the
// window had to grow to 4096 because low E sits under the shorter window's
// floor. Whether that trade is affordable is a question about a specific
// machine, so it is measured rather than argued about.
//
// Development only. Both the sampling and the reporting short-circuit on
// `import.meta.env.DEV`, so a production build pays nothing — not even the
// `performance.now()` calls.

import { createSignal } from 'solid-js'

const WINDOW = 120
const PUBLISH_INTERVAL_MS = 500

export interface GuitarAnalysisCost {
  /** Median milliseconds inside one pitch detection. */
  medianDetectMs: number
  /** Worst detection in the sampled window. */
  worstDetectMs: number
  /** Detections actually completed per second. */
  detectionsPerSecond: number
  /** Share of a 60 Hz frame budget one detection consumes. */
  frameBudgetShare: number
  samples: number
}

const [cost, setCost] = createSignal<GuitarAnalysisCost | null>(null)

export const guitarAnalysisCost = cost

const durations: number[] = []
let windowStartedAt = 0
let completed = 0
let lastPublishedAt = 0

/** Record one completed detection. Cheap enough to sit in the frame loop. */
export function recordGuitarDetectCost(
  durationMs: number,
  nowMs: number,
): void {
  if (!import.meta.env.DEV) return
  durations.push(durationMs)
  if (durations.length > WINDOW) durations.shift()
  completed += 1
  if (windowStartedAt === 0) {
    windowStartedAt = nowMs
    lastPublishedAt = nowMs
    return
  }
  if (nowMs - lastPublishedAt < PUBLISH_INTERVAL_MS) return

  const sorted = [...durations].sort((left, right) => left - right)
  const middle = sorted.length >> 1
  const median =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 1
        ? (sorted[middle] ?? 0)
        : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
  const elapsedSeconds = Math.max(0.001, (nowMs - windowStartedAt) / 1000)
  setCost({
    medianDetectMs: Math.round(median * 100) / 100,
    worstDetectMs: Math.round((sorted[sorted.length - 1] ?? 0) * 100) / 100,
    detectionsPerSecond: Math.round((completed / elapsedSeconds) * 10) / 10,
    frameBudgetShare: Math.round((median / 16.67) * 100) / 100,
    samples: sorted.length,
  })
  lastPublishedAt = nowMs
  windowStartedAt = nowMs
  completed = 0
}

export function resetGuitarAnalysisCost(): void {
  durations.length = 0
  windowStartedAt = 0
  lastPublishedAt = 0
  completed = 0
  setCost(null)
}
