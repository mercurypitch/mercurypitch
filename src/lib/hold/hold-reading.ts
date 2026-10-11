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
// that much.
//
// Steadiness then drops the tracker's slips outright: a reading half an
// octave or more from the median of the readings within 0.1 s of it, on
// its own voiced run (never across a breath). A voice does not leave its
// note by a fifth or an octave and come back inside a tenth of a second; a
// tracker does, for a frame or a few. Nothing else is smoothed. The median
// of five the Mirror smooths with took a slip of one or two frames out as
// well, but it also took the top off every swing faster than about 6 Hz at
// 60 frames a second, so a fast shake read steadier than a slow one as
// deep (owner, 11 Oct 2026: a shake counts at any rate).

import type { F0Frame } from '@/lib/pitch-measurements'
import { CONF_MIN, DEFAULT_VOICED_RUN_GAP_SEC, hzToCents, median, } from '@/lib/pitch-measurements'

/** A voiced reading: seconds, and cents off the note. */
export interface PitchPoint {
  readonly t: number
  readonly cents: number
}

/** How far off the note one reading counts, either way, cents. */
export const READING_CLAMP_CENTS = 100

/**
 * A reading at least this far from the readings around it is the
 * tracker's slip (an octave, a fifth), not the voice: half an octave.
 */
export const SLIP_CENTS = 600

/** How far either side of a reading the readings around it reach, s. */
const SLIP_REACH_SEC = 0.1

/** Slack on the clock: frame times are float sums. */
const EPS = 1e-9

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
 * The reading at `index` of a voiced run as steadiness keeps it: held
 * (heldCents), or null when it is the tracker's slip (SLIP_CENTS from the
 * median of the run's readings within SLIP_REACH_SEC of it). Only the
 * readings within that reach decide, so a reading the voice has passed by
 * more than SLIP_REACH_SEC is settled for good (growSteadiness).
 */
export function keptReading(
  run: readonly PitchPoint[],
  index: number,
): PitchPoint | null {
  const point = run[index]
  let lo = index
  while (lo > 0 && run[lo - 1].t >= point.t - SLIP_REACH_SEC - EPS) lo--
  let hi = index + 1
  while (hi < run.length && run[hi].t <= point.t + SLIP_REACH_SEC + EPS) hi++
  const around = median(run.slice(lo, hi).map((near) => near.cents))
  return Math.abs(point.cents - around) < SLIP_CENTS
    ? { t: point.t, cents: heldCents(point.cents) }
    : null
}

/** Whether `other` is out of the reach of `point`'s slip check, either side. */
export function pastSlipReach(point: PitchPoint, other: PitchPoint): boolean {
  return Math.abs(other.t - point.t) > SLIP_REACH_SEC + EPS
}

/** Whether the gap from `previous` to `next` starts a new voiced run. */
export function startsRun(previous: PitchPoint, next: PitchPoint): boolean {
  return next.t - previous.t > DEFAULT_VOICED_RUN_GAP_SEC
}

/** One voiced run's readings onto `out`, as keptReading keeps them. */
function keepVoice(run: readonly PitchPoint[], out: PitchPoint[]): void {
  for (let i = 0; i < run.length; i++) {
    const kept = keptReading(run, i)
    if (kept !== null) out.push(kept)
  }
}

/**
 * Readings as both steadiness fits see them, the live check and the
 * result's: each voiced run (a gap longer than the Mirror's voiced-run gap
 * starts a new one) without the tracker's slips, each reading held.
 */
export function steadyReadings(points: readonly PitchPoint[]): PitchPoint[] {
  const out: PitchPoint[] = []
  let from = 0
  for (let i = 1; i <= points.length; i++) {
    if (i < points.length && !startsRun(points[i - 1], points[i])) continue
    keepVoice(points.slice(from, i), out)
    from = i
  }
  return out
}
