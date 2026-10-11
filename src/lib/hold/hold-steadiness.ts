// ============================================================
// Hold steadiness — how still a held note stays, vibrato left out
// ============================================================
//
// The Long note's steadiness: the spread of the pitch around its own line
// (the take's linear trend; drift is reported, not scored), with the
// vibrato taken out, on the Voice Mirror's 0-100 scale (steadinessScore).
//
// The Mirror's computeSteadiness fits one sine to the whole hold, which
// suits its few seconds. Over a long note a real vibrato's rate breathes
// by a few tenths of a hertz, and its phase wanders off any single sine:
// a practised singer's 5.5 Hz, +-35 cent vibrato scored 68 there on a
// 24 s hold, against 97 for the same singer without it. Here the vibrato
// is fitted one second at a time, each second at its own rate (about six
// cycles, too short for the rate to move much), and only the sine is
// taken out, not the second's own level, so a slow wander still counts.
//
// Outside the vibrato band an unsteadiness scores as the Mirror scores it:
// a slow wobble or sway has no rate to fit and stays in, and a shake faster
// than the band is smoothed by the same median of five in both. A shake
// inside the band is not left in. Second by second it looks like a
// vibrato, each second's deepest sine takes most of it out, and the note
// scores steadier than it was: a random 4.5-6.5 Hz shake of 20 cents
// scores 92-95 here against 71-80 on the Mirror (review of PR 973, m5).
// That is how it scores for now; whether such a shake should count is
// still open.
//
// The room's live measure of steady singing (the hold engine's stretch)
// is this same fit over the last two seconds of the voice, and both read
// the voice the one way hold-reading.ts sets out: cents off the note, held
// to a semitone either side, a median of five along each voiced run.

import type { F0Frame, SteadinessResult, VibratoInfo, } from '@/lib/mirror/metrics'
import { HOLD_TRIM_END_SEC, HOLD_TRIM_START_SEC, steadinessScore, VIBRATO_MAX_HZ, VIBRATO_MIN_HZ, } from '@/lib/mirror/metrics'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import { centsToMidi, estimateFrameHop, median } from '@/lib/pitch-measurements'
import type { PitchPoint } from './hold-reading'
import { steadyReadings, takeReadings } from './hold-reading'

export type { PitchPoint } from './hold-reading'

export interface SteadinessFit {
  /** The spread around the take's own line with the vibrato out, cents. */
  wobbleSdCents: number
  /** The line's slope, cents a second: reported, not scored. */
  driftCentsPerSec: number
  /** The vibrato's usual rate and depth, when half the take had one. */
  vibrato: VibratoInfo | null
  /** 0-100 on the Voice Mirror's scale. */
  score: number
}

/** About how long each vibrato fit covers, s. */
const BLOCK_SECONDS = 1
/** A sine at least this deep (cents) is a vibrato, as the Mirror has it. */
const VIBRATO_MIN_CENTS = 10
/** The rate search: a coarse pass across the band, then a fine one. */
const COARSE_HZ = 0.25
const FINE_HZ = 0.05

interface SineFit {
  rateHz: number
  a: number
  b: number
  depth: number
}

/**
 * The least-squares fit of `r ~ c + a cos(wt) + b sin(wt)` over points
 * `from` to `to` (exclusive) at one rate; `c` absorbs the stretch's own
 * level and is left in.
 */
function fitSine(
  ts: readonly number[],
  rs: readonly number[],
  from: number,
  to: number,
  rateHz: number,
): SineFit {
  const w = 2 * Math.PI * rateHz
  let sc = 0
  let ss = 0
  let scc = 0
  let sss = 0
  let scs = 0
  let sr = 0
  let src = 0
  let srs = 0
  for (let i = from; i < to; i++) {
    const c = Math.cos(w * ts[i])
    const s = Math.sin(w * ts[i])
    sc += c
    ss += s
    scc += c * c
    sss += s * s
    scs += c * s
    sr += rs[i]
    src += rs[i] * c
    srs += rs[i] * s
  }
  // The constant eliminated: sums about the means.
  const n = to - from
  const cc = scc - (sc * sc) / n
  const s2 = sss - (ss * ss) / n
  const cs = scs - (sc * ss) / n
  const rc = src - (sr * sc) / n
  const rsn = srs - (sr * ss) / n
  const det = cc * s2 - cs * cs
  if (!(det > 1e-9)) return { rateHz, a: 0, b: 0, depth: 0 }
  const a = (rc * s2 - rsn * cs) / det
  const b = (rsn * cc - rc * cs) / det
  return { rateHz, a, b, depth: Math.hypot(a, b) }
}

/** The deepest sine in the vibrato band over points `from` to `to`. */
function deepestSine(
  ts: readonly number[],
  rs: readonly number[],
  from: number,
  to: number,
): SineFit {
  let best = fitSine(ts, rs, from, to, VIBRATO_MIN_HZ)
  const search = (lo: number, hi: number, step: number): void => {
    for (let rate = lo; rate <= hi + 1e-9; rate += step) {
      const fit = fitSine(ts, rs, from, to, rate)
      if (fit.depth > best.depth) best = fit
    }
  }
  search(VIBRATO_MIN_HZ, VIBRATO_MAX_HZ, COARSE_HZ)
  const around = best.rateHz
  search(
    Math.max(VIBRATO_MIN_HZ, around - COARSE_HZ),
    Math.min(VIBRATO_MAX_HZ, around + COARSE_HZ),
    FINE_HZ,
  )
  return best
}

/** The least-squares line through the points: slope, and what is left. */
function detrend(points: readonly PitchPoint[]): {
  slope: number
  residual: number[]
} {
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
  const slope = varT > 0 ? cov / varT : 0
  const residual = points.map((p) => p.cents - meanC - slope * (p.t - meanT))
  return { slope, residual }
}

/**
 * Take each block's vibrato out of `residual` in place: the take cut into
 * equal blocks of about BLOCK_SECONDS, each with the deepest sine in the
 * band taken out when it is deep enough to be a vibrato. The sines taken,
 * and how many blocks there were.
 */
function removeVibrato(
  ts: readonly number[],
  residual: number[],
): { fits: SineFit[]; blocks: number } {
  const n = ts.length
  const span = ts[n - 1] - ts[0]
  const blocks = Math.max(1, Math.round(span / BLOCK_SECONDS))
  const fits: SineFit[] = []
  let from = 0
  for (let k = 1; k <= blocks; k++) {
    const until = ts[0] + (span * k) / blocks
    let to = from
    while (to < n && (ts[to] < until || k === blocks)) to++
    const fit = to - from >= 5 ? deepestSine(ts, residual, from, to) : null
    if (fit !== null && fit.depth >= VIBRATO_MIN_CENTS) {
      const w = 2 * Math.PI * fit.rateHz
      for (let i = from; i < to; i++) {
        residual[i] -= fit.a * Math.cos(w * ts[i]) + fit.b * Math.sin(w * ts[i])
      }
      fits.push(fit)
    }
    from = to
  }
  return { fits, blocks }
}

/**
 * The steadiness of voiced points in time order: null with fewer than 5
 * of them or under 0.3 s, as the Mirror's computeSteadiness.
 */
export function fitSteadiness(
  points: readonly PitchPoint[],
): SteadinessFit | null {
  const n = points.length
  if (n < 5 || points[n - 1].t - points[0].t < 0.3) return null
  const { slope, residual } = detrend(points)
  // Times from the first point, so the sines' phases stay precise.
  const t0 = points[0].t
  const { fits, blocks } = removeVibrato(
    points.map((p) => p.t - t0),
    residual,
  )
  const wobble = Math.sqrt(residual.reduce((sum, r) => sum + r * r, 0) / n)
  // Named only when at least half the take had one.
  const vibrato =
    fits.length * 2 < blocks || fits.length === 0
      ? null
      : {
          rateHz: Math.round(median(fits.map((f) => f.rateHz)) * 10) / 10,
          extentCents: Math.round(median(fits.map((f) => f.depth))),
        }
  return {
    wobbleSdCents: wobble,
    driftCentsPerSec: slope,
    vibrato,
    score: Math.round(steadinessScore(wobble)),
  }
}

/**
 * The held part's steadiness, for the result: its frames read as the live
 * check reads them (steadyReadings, against the note held), the onset and
 * release trimmed as the Mirror trims them, then the fit above. The same
 * shape as the Mirror's result.
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
    wobbleSdCents: fit.wobbleSdCents,
    vibrato: fit.vibrato,
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
