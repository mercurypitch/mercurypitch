// ============================================================
// Run-trace view maths — reading a finished run back
// ============================================================
//
// last-run-trace.ts captures every run's contour and its target timeline. This
// turns that into the three things the result card needs: where the target was
// at any instant, how far the singer strayed at their worst, and the frequency
// window that frames both. Pure, so the drawing code stays a renderer and the
// judgement below stays testable.

import type { RunTrace, TracePoint } from './last-run-trace'

/** Never frame a run tighter than this, or a steady note fills the canvas. */
const MIN_SPAN_OCTAVES = 0.5
/** Breathing room above and below the extremes, in octaves. */
const PADDING_OCTAVES = 0.12

export interface WorstMoment {
  /** Seconds since the run started. */
  t: number
  /** What was sung, in Hz. */
  f: number
  /** What was asked for, in Hz. */
  target: number
  /** Signed distance in cents — positive is sharp. */
  cents: number
}

export interface TraceBounds {
  /** log2 Hz at the bottom of the plot. */
  logMin: number
  /** log2 Hz at the top of the plot. */
  logMax: number
  /** Seconds on the x axis. */
  duration: number
}

/**
 * The reference tone in force at `t`.
 *
 * The timeline records one point per CHANGE, so a target holds until the next
 * one — interpolating between them would invent a glide the drill never asked
 * for. Returns null before the first target: a run whose first note has not
 * been played yet is not off-pitch, it is unjudged.
 */
export function targetAt(
  targets: readonly TracePoint[],
  t: number,
): number | null {
  let held: number | null = null
  for (const point of targets) {
    if (point.t > t) break
    held = point.f
  }
  return held
}

/** Signed cents from `target` to `f` — positive is sharp. */
export function centsBetween(f: number, target: number): number {
  return 1200 * Math.log2(f / target)
}

/**
 * The moment the run went furthest off target.
 *
 * This is the one place on the result card that says WHERE it went wrong
 * rather than by how much overall — a score of 71 tells a singer nothing they
 * can practise, and "you were 90 cents flat four seconds in" does.
 */
export function worstMoment(trace: RunTrace): WorstMoment | null {
  if (trace.targets.length === 0) return null

  let worst: WorstMoment | null = null
  for (const sample of trace.samples) {
    if (!Number.isFinite(sample.f) || sample.f <= 0) continue
    const target = targetAt(trace.targets, sample.t)
    if (target === null || target <= 0) continue
    const cents = centsBetween(sample.f, target)
    if (worst === null || Math.abs(cents) > Math.abs(worst.cents)) {
      worst = { t: sample.t, f: sample.f, target, cents }
    }
  }
  return worst
}

/**
 * The frequency window that frames the run — both what was sung and what was
 * asked for, so a phrase the singer missed by an octave still shows the miss
 * rather than cropping the target out of the picture.
 */
export function traceBounds(trace: RunTrace): TraceBounds | null {
  const logs: number[] = []
  for (const point of [...trace.samples, ...trace.targets]) {
    if (Number.isFinite(point.f) && point.f > 0) logs.push(Math.log2(point.f))
  }
  if (logs.length === 0) return null

  let logMin = Math.min(...logs) - PADDING_OCTAVES
  let logMax = Math.max(...logs) + PADDING_OCTAVES
  const shortfall = MIN_SPAN_OCTAVES - (logMax - logMin)
  if (shortfall > 0) {
    logMin -= shortfall / 2
    logMax += shortfall / 2
  }

  // The x axis comes from the recorded duration, not the last sample: a run
  // that ended in silence still lasted as long as it lasted, and shrinking the
  // axis to the last sung note would stretch the contour to fill time that was
  // never sung.
  const duration = Math.max(trace.durationMs / 1000, 0.1)
  return { logMin, logMax, duration }
}
