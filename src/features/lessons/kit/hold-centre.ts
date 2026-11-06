// ============================================================
// Centre-line reading — a held note read on the middle of its line
// ============================================================
//
// Lesson 22's reader (WEB-SPEC, Toys 6, "The centre-line reader"; What the
// kit and the app still need, item 6), beside the hold reader in
// hold-take.ts and as pure, so every case is tested on synthetic frames
// (hold-centre.test.ts). A note held with a vibrato swings past both edges
// of the band six times a second while its middle sits in it: read frame
// by frame, half of it is outside. This reader finds the vibrato window by
// window and reads the hold on the line's middle instead, by the hold
// reader's own rules, so the score stays the time the line spends in the
// band and nothing scores the vibrato itself (FACTS 43, 44, 46).
//
// The windows are 3.0 s long, the first at the hold's trimmed start (0.4 s
// in, as Voice Mirror's steadiness trims) and one every 0.5 s, the last
// ending at the trimmed end (0.2 s before the last frame); a trimmed span
// of 3.0 s or less is one window. Each is judged by Voice Mirror's own rule
// (`findVibrato`), so the two judge a stretch of frames alike. A finding
// window covers its own span, and one at the trimmed start or end reaches
// on to the hold's first or last frame. Inside the spans covered, each
// frame's distance becomes the line's mean over exactly one swing centred
// on it, at the rate of the covering window whose middle is nearest: a
// running mean one swing long takes out a sine of that rate whatever its
// phase and passes a straight drift unchanged, so a middle that drifts
// still leaves the band. Each frame holds its value for the time it stands
// for, and the swing never reaches across a gap of more than a voiced
// run's 0.12 s, a stall among them, or past the hold's ends: there it
// keeps its length, shifted inside. Outside the covered spans the raw
// distance stands; where nothing is found, the reading is the hold
// reader's own, frame for frame.
//
// Loaded after first paint, as hold-take.ts is: it reaches Voice Mirror's
// scorer.

import type { F0Frame } from '@/lib/mirror/metrics'
import { findVibrato, foldCents, HOLD_TRIM_END_SEC, HOLD_TRIM_START_SEC, median, VIBRATO_MIN_CENTS, } from '@/lib/mirror/metrics'
import { DEFAULT_VOICED_RUN_GAP_SEC } from '@/lib/pitch-measurements'
import type { HeldRun, HoldReading } from './hold-take'
import { fmtSeconds, readHold } from './hold-take'

/** Seconds each window of the hold is judged over. */
export const WINDOW_SEC = 3
/** Seconds from one window's start to the next. */
export const WINDOW_STEP_SEC = 0.5

/** A vibrato found in a hold: swings a second, to 0.1, and whole cents either side. */
export interface HoldVibrato {
  readonly rate: number
  readonly extent: number
}

/** A point of the middle line: a frame's time, on the take's clock, and the middle's distance from Merc's note, folded. */
export interface MiddlePoint {
  readonly t: number
  readonly cents: number
}

export interface CentredReading extends HoldReading {
  /** The middle line the hold was read on, a point a frame of the hold; null when no vibrato was found. */
  readonly middle: readonly MiddlePoint[] | null
  /** The vibrato found, for the vibrato line; null when none was. */
  readonly vibrato: HoldVibrato | null
}

/** The middle line over a held run, one distance a frame, and the vibrato it took out. */
export interface Centre {
  readonly line: readonly number[]
  readonly vibrato: HoldVibrato
}

/** A window that found a vibrato: the span it covers, its own middle and its rate. */
interface Finding {
  readonly from: number
  readonly to: number
  readonly mid: number
  readonly rate: number
}

/**
 * Where each window over a trimmed span starts: at `lo`, then every 0.5 s,
 * the last one ending at `hi`; a span of 3.0 s or less is one window.
 */
export function windowStarts(lo: number, hi: number): number[] {
  if (hi - lo <= WINDOW_SEC) return [lo]
  const last = hi - WINDOW_SEC
  const starts: number[] = []
  for (let k = 0; lo + k * WINDOW_STEP_SEC <= last + 1e-9; k++)
    starts.push(lo + k * WINDOW_STEP_SEC)
  if (starts[starts.length - 1] < last - 1e-9) starts.push(last)
  return starts
}

/** The windows over a held run that find a vibrato by Voice Mirror's rule. */
function findings(run: HeldRun): Finding[] {
  const { frames } = run
  const first = frames[0].t
  const last = frames[frames.length - 1].t
  const lo = first + HOLD_TRIM_START_SEC
  const hi = last - HOLD_TRIM_END_SEC
  if (hi <= lo) return []
  const found: Finding[] = []
  for (const s of windowStarts(lo, hi)) {
    const e = Math.min(s + WINDOW_SEC, hi)
    const wave = findVibrato(frames.filter((f) => f.t >= s && f.t <= e))
    if (wave === null) continue
    found.push({
      from: s <= lo + 1e-9 ? first : s,
      to: e >= hi - 1e-9 ? last : e,
      mid: (s + e) / 2,
      rate: wave.rateHz,
    })
  }
  return found
}

/**
 * The stretches of a run: from each frame, the index of the first and last
 * frame of its stretch, broken wherever the voice left a gap wider than a
 * voiced run's, a stall of the page among them.
 */
function stretchesOf(t: readonly number[]): Array<readonly [number, number]> {
  const of: Array<readonly [number, number]> = []
  let start = 0
  for (let i = 1; i <= t.length; i++) {
    if (i < t.length && t[i] - t[i - 1] <= DEFAULT_VOICED_RUN_GAP_SEC) continue
    for (let j = start; j < i; j++) of.push([start, i - 1])
    start = i
  }
  return of
}

/**
 * The middle line over a held run, and the vibrato it took out; null when
 * no window finds one, or none of the line swings 10 cents either side once
 * its middle is taken out, so the hold reads as the hold reader reads it.
 */
export function centreOf(run: HeldRun): Centre | null {
  const found = findings(run)
  if (found.length === 0) return null
  const t = run.frames.map((f) => f.t)
  const raw = run.folded
  const n = t.length
  const stretch = stretchesOf(t)
  // the seconds each frame stands for: to the next frame in its stretch, or
  // one hop for a stretch's last frame
  const holds = t.map((ti, i) =>
    stretch[i][1] === i ? run.hop : t[i + 1] - ti,
  )
  const rateAt: Array<number | null> = t.map((ti) => {
    let near: Finding | null = null
    for (const f of found)
      if (ti >= f.from - 1e-9 && ti <= f.to + 1e-9)
        if (near === null || Math.abs(f.mid - ti) < Math.abs(near.mid - ti))
          near = f
    return near?.rate ?? null
  })
  const line = raw.map((d, i) => {
    const rate = rateAt[i]
    if (rate === null) return d
    const swing = 1 / rate
    const [s0, s1] = stretch[i]
    const lo = t[s0]
    const hi = t[s1] + holds[s1]
    let a = t[i] - swing / 2
    let b = t[i] + swing / 2
    if (a < lo) [a, b] = [lo, lo + swing]
    if (b > hi) [a, b] = [Math.max(lo, hi - swing), hi]
    // each frame holds its value for its time; one at the swing's edge
    // counts for its part inside, and the distances are taken from this
    // frame's, so a line near the fold, half an octave off, stays whole
    let sum = 0
    let weight = 0
    for (let j = s0; j <= s1; j++) {
      const w = Math.min(b, t[j] + holds[j]) - Math.max(a, t[j])
      if (w <= 0) continue
      sum += foldCents(raw[j] - d) * w
      weight += w
    }
    return weight > 0 ? foldCents(d + sum / weight) : d
  })
  // the extent: √2 times the RMS of the line less its middle, over the
  // frames whose own swing of that difference reaches 10/√2 cents; for a
  // sine, its swing either side
  const less = raw.map((d, i) => foldCents(d - line[i]))
  const inWave: number[] = []
  for (let i = 0; i < n; i++) {
    const rate = rateAt[i]
    if (rate === null) continue
    const half = 1 / rate / 2
    let squares = 0
    let count = 0
    for (let j = 0; j < n; j++)
      if (rateAt[j] !== null && Math.abs(t[j] - t[i]) <= half) {
        squares += less[j] ** 2
        count++
      }
    if (Math.sqrt(squares / count) >= VIBRATO_MIN_CENTS / Math.SQRT2)
      inWave.push(less[i])
  }
  if (inWave.length === 0) return null
  const rms = Math.sqrt(inWave.reduce((s, x) => s + x * x, 0) / inWave.length)
  const rate = median(found.map((f) => f.rate))
  return {
    line,
    vibrato: {
      rate: Math.round(rate * 10) / 10,
      extent: Math.round(Math.SQRT2 * rms),
    },
  }
}

/**
 * Reads one hold, as `readHold` does, on the middle of its line where a
 * window finds a vibrato: the raw frames of a take against Merc's note
 * (MIDI), for a hold of `length` seconds.
 */
export function readCentredHold(
  frames: readonly F0Frame[],
  target: number,
  length: number,
): CentredReading {
  const seen: { centre: Centre | null; run: HeldRun | null } = {
    centre: null,
    run: null,
  }
  const reading = readHold(frames, target, length, (run) => {
    seen.centre = centreOf(run)
    seen.run = run
    return seen.centre?.line ?? run.folded
  })
  const { centre, run } = seen
  if (centre === null || run === null)
    return { ...reading, middle: null, vibrato: null }
  return {
    ...reading,
    middle: run.frames.map((f, i) => ({ t: f.t, cents: centre.line[i] })),
    vibrato: centre.vibrato,
  }
}

/**
 * "The note had a wave: about 5.6 swings a second, ±38 cents.", the rate to
 * 0.1 as the page prints seconds. It describes the sound and scores
 * nothing: a wave wider than the band reads the same, with nothing added.
 */
export function vibratoLine(v: HoldVibrato): string {
  return `The note had a wave: about ${fmtSeconds(v.rate)} swings a second, ±${v.extent} cents.`
}
