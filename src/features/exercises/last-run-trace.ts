// ============================================================
// Last-run trace — the pitch contour of the most recent exercise run
// ============================================================
//
// use-base-exercise publishes a compact snapshot of every finished run here
// (sung pitch samples + the target-pitch timeline). Consumers that need the
// contour right after completion — the challenge attempt path persisting a
// per-challenge best take, the upcoming pitch-race share video and
// duet-with-past-self — read it from this seam instead of threading the
// history through 18 exercise components.
//
// Plain module state, no reactivity: the write happens synchronously inside
// completeWithResult and the read happens in the same tick's completion
// handlers (recordExerciseResult → recordChallengeAttempt).

import type { ExerciseType } from './types'

export interface TracePoint {
  /** Seconds since the run started. */
  t: number
  /** Frequency in Hz (targets: the reference tone; samples: the voice). */
  f: number
}

export interface RunTrace {
  type: ExerciseType
  completedAt: number
  durationMs: number
  /** Sung pitch contour, downsampled to at most MAX_TRACE_POINTS. */
  samples: TracePoint[]
  /** Target-pitch timeline: one point per reference-tone change. */
  targets: TracePoint[]
}

/** Keeps stored traces small (~600 points ≈ 10s at 60fps after downsample). */
export const MAX_TRACE_POINTS = 600

let lastTrace: RunTrace | null = null

export function publishRunTrace(trace: RunTrace): void {
  lastTrace = trace
}

/** Read the most recent run's trace without consuming it. */
export function lastRunTrace(): RunTrace | null {
  return lastTrace
}

/**
 * Evenly downsample to at most MAX_TRACE_POINTS, always keeping the last
 * point (the contour's end matters for the race finish).
 */
export function downsampleTrace(points: TracePoint[]): TracePoint[] {
  if (points.length <= MAX_TRACE_POINTS) return points
  const stride = points.length / MAX_TRACE_POINTS
  const out: TracePoint[] = []
  for (let i = 0; i < MAX_TRACE_POINTS - 1; i++) {
    out.push(points[Math.floor(i * stride)])
  }
  out.push(points[points.length - 1])
  return out
}
