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
  /**
   * Median milliseconds inside one pitch detection that actually ran.
   *
   * `PitchDetector.detect` computes RMS first and returns before the
   * correlation when the frame is under `minAmplitude`, so on sparse playing
   * most calls cost nothing and a median over all of them reports ~0 while the
   * real work is several milliseconds. Measured on two takes: 0.00 ms across
   * isolated notes against 5.53 ms across continuous playing, from the same
   * detector at the same window size. Gated frames are excluded here so the
   * number means what it says.
   */
  medianDetectMs: number
  /** Worst detection in the sampled window. */
  worstDetectMs: number
  /** Detections actually completed per second, gated ones included. */
  detectionsPerSecond: number
  /** Share of frames that returned early under the amplitude gate. */
  gatedShare: number
  /** Share of a 60 Hz frame budget one detection consumes. */
  frameBudgetShare: number
  samples: number
}

const [cost, setCost] = createSignal<GuitarAnalysisCost | null>(null)

export const guitarAnalysisCost = cost

// Below this a call cannot have run the correlation — it is the amplitude
// gate returning, and averaging it in hides the cost of the work that did run.
const GATED_MS = 0.05

const durations: number[] = []
let windowStartedAt = 0
let completed = 0
let gated = 0
let lastPublishedAt = 0

/** Record one completed detection. Cheap enough to sit in the frame loop. */
export function recordGuitarDetectCost(
  durationMs: number,
  nowMs: number,
): void {
  if (!import.meta.env.DEV) return
  completed += 1
  if (durationMs < GATED_MS) {
    gated += 1
  } else {
    durations.push(durationMs)
    if (durations.length > WINDOW) durations.shift()
  }
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
    gatedShare:
      completed === 0 ? 0 : Math.round((gated / completed) * 100) / 100,
    frameBudgetShare: Math.round((median / 16.67) * 100) / 100,
    samples: sorted.length,
  })
  lastPublishedAt = nowMs
  windowStartedAt = nowMs
  completed = 0
  gated = 0
}

export function resetGuitarAnalysisCost(): void {
  durations.length = 0
  windowStartedAt = 0
  lastPublishedAt = 0
  completed = 0
  gated = 0
  setCost(null)
}
