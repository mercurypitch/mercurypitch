// ============================================================
// Tap judge — a tapped take, lined up and matched to its written notes
// ============================================================
//
// Pure: the taps' page-clock times, beat 0's time, the beat's length and the
// take's shape in, the lining-up and the Ear Lab's verdict out. A take is
// counted in beats from beat 0, the first count-in click: bars tapped on
// every beat, which line the taps up, then the written part, whose notes
// start at the shape's onsets. Lesson 8's backbeat and Lesson 17's two bars
// are two shapes (lesson-08/take-judge.ts; Lesson 17 WEB-SPEC, Toys 7).
// This is the tapped take's judge; kit/take.ts reads a sung one.
//
// 1. Lining up. Each tap whose nearest beat is one of the pulse beats gives
//    a sample, its time less that beat's, and Drum Night's estimator
//    (src/lib/timing/input-latency.ts) takes their middle, outliers set
//    aside, between 0 and 250 ms. It needs five samples, and five of them
//    inside its outlier radius; with fewer, the take is not lined up.
// 2. Matching. Every tap less the estimate, measured from the written
//    part's first beat, goes to the Ear Lab's judge
//    (src/lib/ear/rhythm-take.ts), imported, never copied: the notes'
//    starts as onsets, its 120 ms window for taps on crotchets, and the bar
//    half a beat past the last onset less the window long, so it takes taps
//    from 120 ms before the first onset to half a beat after the last.
//
// What a take's taps mean, its line and how its ticks are coloured, are the
// page's own rules, read from the judgement.

import type { TakeVerdict } from '@/lib/ear/rhythm-take'
import { judgeTake, TOLERANCE_MS } from '@/lib/ear/rhythm-take'
import { DRUM_LATENCY_MIN_SAMPLES, estimateDrumInputLatency, } from '@/lib/timing/input-latency'

/** A take's shape, in beats from beat 0. */
export interface TapTakeShape {
  /** The first beat tapped on every beat to line the take up. */
  readonly pulseFrom: number
  /** The last beat tapped on every beat to line the take up. */
  readonly pulseTo: number
  /** The written part's first beat: the judge's origin. */
  readonly judgedFrom: number
  /** The written notes' starts, in beats from `judgedFrom`, in order. */
  readonly onsets: readonly number[]
}

/** A tap within this of a note's start meets it, ms (TOLERANCE_MS.quarters). */
export const TAP_WINDOW_MS = TOLERANCE_MS.quarters

/** A tap the judge took, ms from the written part's first beat, and whether it met a note. */
export interface JudgedTap {
  readonly at: number
  readonly met: boolean
}

export interface TapJudgement {
  /** The lining-up's estimate, ms. */
  readonly latencyMs: number
  /** Every tap less the estimate, ms from the written part's first beat, as tapped. */
  readonly rel: readonly number[]
  /** The judge's bar, ms: half a beat past the last onset, less the window. */
  readonly barMs: number
  /** The Ear Lab's verdict: per note whether a tap met it and how far off it was, and the taps that met none. */
  readonly verdict: TakeVerdict
  /** The taps the judge took, in time order. */
  readonly taps: readonly JudgedTap[]
}

const WORDS = [
  'No',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
]

/** A count that starts a sentence: "One tap", "Two taps" to "Nine taps", then "10 taps". */
export function tapsWord(n: number): string {
  const count = n < WORDS.length ? WORDS[n] : String(n)
  return `${count} ${n === 1 ? 'tap' : 'taps'}`
}

/** The pulse beats' samples: each tap's offset from its nearest beat, where that beat is a pulse beat. */
export function pulseSamples(
  taps: readonly number[],
  beat0: number,
  beatMs: number,
  shape: TapTakeShape,
): number[] {
  return taps.flatMap((t) => {
    const nearest = Math.round((t - beat0) / beatMs)
    return nearest >= shape.pulseFrom && nearest <= shape.pulseTo
      ? [t - (beat0 + nearest * beatMs)]
      : []
  })
}

/** The estimate the lining-up takes, or null when too few samples agree. */
export function lineUp(samples: readonly number[]): number | null {
  const r = estimateDrumInputLatency(samples)
  if (r.status !== 'ready' || r.estimateMs === null) return null
  return r.inlierCount >= DRUM_LATENCY_MIN_SAMPLES ? r.estimateMs : null
}

/** Each tap the judge took, in time order, marked met unless the verdict lists it as one that met no note. */
function judgedTaps(
  rel: readonly number[],
  barMs: number,
  extras: readonly number[],
): JudgedTap[] {
  const left = new Map<number, number>()
  for (const e of extras) left.set(e, (left.get(e) ?? 0) + 1)
  return rel
    .filter((t) => t >= -TAP_WINDOW_MS && t <= barMs + TAP_WINDOW_MS)
    .sort((a, b) => a - b)
    .map((at) => {
      const n = left.get(at) ?? 0
      if (n === 0) return { at, met: true }
      left.set(at, n - 1)
      return { at, met: false }
    })
}

/**
 * Judges a take from its taps (page ms), beat 0's time (page ms), the
 * beat's length (ms) and its shape; null when the taps cannot be lined up.
 */
export function judgeTaps(
  taps: readonly number[],
  beat0: number,
  beatMs: number,
  shape: TapTakeShape,
): TapJudgement | null {
  const latencyMs = lineUp(pulseSamples(taps, beat0, beatMs, shape))
  if (latencyMs === null) return null
  const origin = beat0 + shape.judgedFrom * beatMs
  const rel = taps.map((t) => t - latencyMs - origin)
  const onsets = shape.onsets.map((b) => b * beatMs)
  const last = shape.onsets[shape.onsets.length - 1] ?? 0
  const barMs = (last + 0.5) * beatMs - TAP_WINDOW_MS
  const verdict = judgeTake(rel, onsets, TAP_WINDOW_MS, barMs)
  return {
    latencyMs,
    rel,
    barMs,
    verdict,
    taps: judgedTaps(rel, barMs, verdict.extras),
  }
}
