// ============================================================
// Hold reading — how the hold reads the voice, live and in the result
// ============================================================
//
// The hold engine (the band, the needle, the steady check that fills the
// lantern's top) and the result's steadiness read the voice through these
// and nothing else, so what the room showed and what the result scores
// cannot drift apart. They did once: the result read a 50 ms octave slip
// of the pitch tracker at its full 1200 cents while the room clamped it,
// and a take that filled the lantern to the brim scored 29 (review of
// PR 973, M1).
//
// A reading is a voiced frame's cents off the note, voiced by the Voice
// Mirror's rule (f0 > 0, confidence at least CONF_MIN), held to
// +-READING_CLAMP_CENTS. Past a semitone the voice is on another note and
// how far no longer matters, so a slip of the tracker costs no more than a
// semitone off the note would, while a real stretch off it still costs
// that much. Steadiness then smooths each voiced run with a median of five,
// as the Mirror does, which takes out a slip of one or two frames
// altogether; it never smooths across a breath.

import type { F0Frame } from '@/lib/pitch-measurements'
import { CONF_MIN, DEFAULT_VOICED_RUN_GAP_SEC, hzToCents, MEDIAN_WINDOW, medianFilter, } from '@/lib/pitch-measurements'

/** A voiced reading: seconds, and cents off the note. */
export interface PitchPoint {
  readonly t: number
  readonly cents: number
}

/** How far off the note one reading counts, either way, cents. */
export const READING_CLAMP_CENTS = 100

/** A frame's cents off the target note, or null when it is not voiced. */
export function offTarget(frame: F0Frame, targetMidi: number): number | null {
  return frame.f0 > 0 && frame.conf >= CONF_MIN
    ? hzToCents(frame.f0) - targetMidi * 100
    : null
}

/** One reading as the hold counts it: held to +-READING_CLAMP_CENTS. */
export function heldCents(offCents: number): number {
  return Math.max(-READING_CLAMP_CENTS, Math.min(READING_CLAMP_CENTS, offCents))
}

/** A take's voiced frames as readings off the target, oldest first. */
export function takeReadings(
  frames: readonly F0Frame[],
  targetMidi: number,
): PitchPoint[] {
  const points: PitchPoint[] = []
  for (const frame of frames) {
    const cents = offTarget(frame, targetMidi)
    if (cents !== null) points.push({ t: frame.t, cents })
  }
  return points
}

/**
 * Readings as both steadiness fits see them, the live check and the
 * result's: each held (heldCents), then a median of five along each voiced
 * run, a gap longer than the Mirror's voiced-run gap starting a new one.
 */
export function steadyReadings(points: readonly PitchPoint[]): PitchPoint[] {
  const out: PitchPoint[] = []
  let from = 0
  for (let i = 1; i <= points.length; i++) {
    const gap =
      i < points.length
        ? points[i].t - points[i - 1].t
        : Number.POSITIVE_INFINITY
    if (gap <= DEFAULT_VOICED_RUN_GAP_SEC) continue
    const run = points.slice(from, i)
    const smoothed = medianFilter(
      run.map((point) => heldCents(point.cents)),
      MEDIAN_WINDOW,
      'truncate-window',
    )
    run.forEach((point, k) => out.push({ t: point.t, cents: smoothed[k] }))
    from = i
  }
  return out
}
