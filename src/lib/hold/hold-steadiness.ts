// ============================================================
// Hold steadiness — how still a held note stays, vibrato and all
// ============================================================
//
// The Long note's steadiness, scored the way the web Long note scores it
// (src/features/exercises/long-note/use-long-note-controller.ts): the
// standard deviation of the voice's cents around their own mean, and 100
// less twice that. A spread of 5 cents scores 90, one of 25 scores 50, and
// one of 50 scores nothing.
//
// The owner's call (11 Oct 2026): a vibrato is the opposite of steadiness
// here, and a fast one scores lower in Long note than in the vibrato
// exercises. Round 4 took a vibrato out of the score second by second,
// and a practised singer's 5.5 Hz, +-35 cent vibrato scored 96; its swing
// alone is a spread of 25 cents, and it scores about 50 now. A shake, a
// wobble, a sway and a drift along the take count the same way, as wide as
// they are, at any rate.
//
// The result scores the held part of the take, its onset and release
// trimmed as the Voice Mirror trims them. The room's live check (the hold
// engine's stretch, which fills the lantern's top) scores the last two
// seconds of the voice before the goal, and everything since the goal
// after it, with this same fit. Both read the voice the one way
// hold-reading.ts sets out: the tracker's slips dropped, each reading held
// to a semitone.
//
// The Voice Mirror keeps its own steadiness (src/lib/mirror/metrics.ts): a
// short hold's wobble around its own line, its vibrato left out.

import type { F0Frame, SteadinessResult } from '@/lib/mirror/metrics'
import { HOLD_TRIM_END_SEC, HOLD_TRIM_START_SEC } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { centsToMidi, estimateFrameHop, median } from '@/lib/pitch-measurements'
import type { PitchPoint } from './hold-reading'
import { keptReading, pastSlipReach, startsRun, steadyReadings, takeReadings, } from './hold-reading'

export type { PitchPoint } from './hold-reading'

export interface SteadinessFit {
  /** The spread of the readings around their mean, cents. */
  sdCents: number
  /** The take's slope, cents a second: reported; the spread counts it. */
  driftCentsPerSec: number
  /** 0-100: 100 less twice the spread. */
  score: number
}

/** The web Long note's score for a spread of `sdCents`: 100 less twice it. */
export function spreadScore(sdCents: number): number {
  return Math.round(Math.max(0, Math.min(100, 100 - 2 * sdCents)))
}

/** The least-squares slope through the points, cents a second. */
function slopeOf(points: readonly PitchPoint[]): number {
  const n = points.length
  let meanT = 0
  let meanC = 0
  for (const p of points) {
    meanT += p.t / n
    meanC += p.cents / n
  }
  let cov = 0
  let varT = 0
  for (const p of points) {
    cov += (p.t - meanT) * (p.cents - meanC)
    varT += (p.t - meanT) ** 2
  }
  return varT > 0 ? cov / varT : 0
}

/**
 * The steadiness of readings in time order: null with fewer than 5 of them
 * or under 0.3 s, as the Mirror's computeSteadiness.
 */
export function fitSteadiness(
  points: readonly PitchPoint[],
): SteadinessFit | null {
  const n = points.length
  if (n < 5 || points[n - 1].t - points[0].t < 0.3) return null
  let mean = 0
  for (const p of points) mean += p.cents / n
  let variance = 0
  for (const p of points) variance += (p.cents - mean) ** 2 / n
  const sdCents = Math.sqrt(variance)
  return {
    sdCents,
    driftCentsPerSec: slopeOf(points),
    score: spreadScore(sdCents),
  }
}

/**
 * The held part's steadiness, for the result: its frames read as the live
 * check reads them (steadyReadings, against the note held), the onset and
 * release trimmed as the Mirror trims them, then the fit above. The
 * Mirror's shape, its `wobbleSdCents` the spread; Long note names no
 * vibrato, which counts in the spread like any other swing.
 */
export function holdSteadiness(
  frames: readonly F0Frame[],
  targetMidi: number,
): SteadinessResult | null {
  const voiced = steadyReadings(takeReadings(frames, targetMidi))
  if (voiced.length === 0) return null
  const start = voiced[0].t + HOLD_TRIM_START_SEC
  const end = voiced[voiced.length - 1].t - HOLD_TRIM_END_SEC
  const kept = voiced.filter((f) => f.t >= start && f.t <= end)
  const fit = fitSteadiness(kept)
  if (fit === null) return null
  const referenceCents = targetMidi * 100 + median(kept.map((f) => f.cents))
  return {
    referenceCents,
    referenceNote: midiToNoteNameOctave(centsToMidi(referenceCents)),
    driftCentsPerSec: fit.driftCentsPerSec,
    wobbleSdCents: fit.sdCents,
    vibrato: null,
    score: fit.score,
    voicedSeconds: kept.length * estimateFrameHop(kept),
  }
}

/**
 * The live score of the last stretch of the voice (readings off the note,
 * as the engine took them), for the room while it listens: the result's
 * own reading and fit, so a slip of the tracker costs the room and the
 * result alike.
 */
export function liveSteadiness(points: readonly PitchPoint[]): number | null {
  return fitSteadiness(steadyReadings(points))?.score ?? null
}

// ── A window that only grows ───────────────────────────────────

/** Kept readings, summed as they come (Welford): the spread without them. */
interface SpreadSums {
  readonly count: number
  readonly mean: number
  /** The sum of squared deviations from the mean. */
  readonly squares: number
  readonly firstT: number | null
  readonly lastT: number | null
}

/**
 * liveSteadiness over a window that only grows (the lantern's top, judged
 * on everything since the goal), one reading at a time instead of the
 * whole window on every check. A reading is settled once the voice is past
 * its slip check's reach (keptReading), or its voiced run has ended: from
 * then on only its sum counts. The readings still open are checked as the
 * window stands, which is how steadyReadings reads the same window, so the
 * score is liveSteadiness over every reading in it.
 */
export interface GrowingSteadiness extends SpreadSums {
  /** The current voiced run, from the reach before its first open reading. */
  readonly run: readonly PitchPoint[]
  /** Where in `run` the open readings begin. */
  readonly open: number
}

export const EMPTY_GROWTH: GrowingSteadiness = {
  count: 0,
  mean: 0,
  squares: 0,
  firstT: null,
  lastT: null,
  run: [],
  open: 0,
}

function addKept(sums: SpreadSums, point: PitchPoint): SpreadSums {
  const count = sums.count + 1
  const delta = point.cents - sums.mean
  const mean = sums.mean + delta / count
  return {
    count,
    mean,
    squares: sums.squares + delta * (point.cents - mean),
    firstT: sums.firstT ?? point.t,
    lastT: point.t,
  }
}

/** The kept readings among `run[from..to)` added to the sums. */
function settle(
  sums: SpreadSums,
  run: readonly PitchPoint[],
  from: number,
  to: number,
): SpreadSums {
  let out = sums
  for (let i = from; i < to; i++) {
    const kept = keptReading(run, i)
    if (kept !== null) out = addKept(out, kept)
  }
  return out
}

/** The window with one more reading (cents off the note, as ticked). */
export function growSteadiness(
  growth: GrowingSteadiness,
  point: PitchPoint,
): GrowingSteadiness {
  let sums: SpreadSums = growth
  let run = growth.run
  let open = growth.open
  const last = run.at(-1)
  if (last !== undefined && startsRun(last, point)) {
    // A breath: the run is over, so its open readings are settled as is.
    sums = settle(sums, run, open, run.length)
    run = []
    open = 0
  }
  run = [...run, point]
  let settled = open
  while (settled < run.length - 1 && pastSlipReach(run[settled], point)) {
    settled++
  }
  sums = settle(sums, run, open, settled)
  // The open readings' own reach back is all the run still needs.
  let drop = 0
  while (drop < settled && pastSlipReach(run[drop], run[settled])) drop++
  return {
    count: sums.count,
    mean: sums.mean,
    squares: sums.squares,
    firstT: sums.firstT,
    lastT: sums.lastT,
    run: run.slice(drop),
    open: settled - drop,
  }
}

/** The window's score now, as liveSteadiness would score it. */
export function growingScore(growth: GrowingSteadiness): number | null {
  const sums = settle(growth, growth.run, growth.open, growth.run.length)
  if (sums.count < 5 || sums.firstT === null || sums.lastT === null) {
    return null
  }
  if (sums.lastT - sums.firstT < 0.3) return null
  return spreadScore(Math.sqrt(sums.squares / sums.count))
}
