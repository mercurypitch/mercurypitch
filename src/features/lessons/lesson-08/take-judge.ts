// ============================================================
// Lesson 8 take judge — the backbeat's taps, lined up and matched
// ============================================================
//
// Pure (WEB-SPEC, Toys 6; Tests 5): the taps' page-clock times, beat 0's
// time and the beat's length in, one line about the taps out. The take is
// 28 beats from beat 0, the first count-in click: a bar counted in (0 to
// 3), two bars of tapping every beat (4 to 11), four of tapping 2 and 4
// (12 to 27).
//
// 1. Lining up. Each tap whose nearest beat is one of the pulse bars' gives
//    a sample, its time less that beat's, and Drum Night's estimator
//    (src/lib/timing/input-latency.ts) takes their middle, outliers set
//    aside, between 0 and 250 ms. It needs five samples, and five of them
//    inside its outlier radius; with fewer, the take is not lined up.
// 2. Matching. Every tap less the estimate, measured from beat 12, goes to
//    the Ear Lab's judge (src/lib/ear/rhythm-take.ts), imported, never
//    copied: the sixteen beats 12 to 27 as onsets, its 120 ms window for
//    taps on crotchets, and the bar 15.5 beats less the window long, so it
//    takes taps from 120 ms before beat 12 to half a beat after beat 27.
// 3. The line, the first that applies, which describes the taps, never the
//    person, and claims nothing it did not measure (FACTS 42, 44).

import type { StripTick } from '@/features/lessons/kit/beat-strip'
import { judgeTake, TOLERANCE_MS } from '@/lib/ear/rhythm-take'
import { DRUM_LATENCY_MIN_SAMPLES, estimateDrumInputLatency, } from '@/lib/timing/input-latency'

/** The take's shape, in beats from beat 0. */
export const TAKE = {
  countIn: 4,
  pulseFrom: 4,
  pulseTo: 11,
  judgedFrom: 12,
  judgedTo: 27,
  beats: 28,
} as const

/** A tap within this of a judged beat is on it, ms (TOLERANCE_MS.quarters). */
export const WINDOW_MS = TOLERANCE_MS.quarters

export const LINES = {
  notLined:
    "We couldn't line your taps up with the beat that time. Tap every beat for the first two bars, then 2 and 4.",
  none: 'No taps came in the last four bars. After the two bars of every beat, tap 2 and 4.',
  backbeat: 'All 8 landed on 2 and 4: a backbeat.',
} as const

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

export interface TakeResult {
  readonly line: string
  /** The estimate taken from every tap, ms, or null when the take was not lined up. */
  readonly latencyMs: number | null
  readonly onBackbeat: number
  readonly onOneThree: number
  readonly matchedNone: number
  /** Where each lined-up tap of the last four bars fell, by bar (four rows), gold on 2 and 4. */
  readonly ticks: readonly (readonly StripTick[])[]
}

/** The pulse bars' samples: each tap's offset from its nearest beat, where that beat is one of beats 4 to 11. */
export function pulseSamples(
  taps: readonly number[],
  beat0: number,
  beatMs: number,
): number[] {
  return taps.flatMap((t) => {
    const nearest = Math.round((t - beat0) / beatMs)
    return nearest >= TAKE.pulseFrom && nearest <= TAKE.pulseTo
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

/** The line for the counts, the first that applies (WEB-SPEC, Toys 6). */
export function takeLine(
  onBackbeat: number,
  onOneThree: number,
  matchedNone: number,
): string {
  if (onBackbeat + onOneThree + matchedNone === 0) return LINES.none
  if (onBackbeat >= 6 && onOneThree >= 6)
    return `That's every beat: ${onBackbeat} on 2 and 4 and ${onOneThree} on 1 and 3. A backbeat is 2 and 4 only.`
  if (onBackbeat === 8 && onOneThree === 0 && matchedNone === 0)
    return LINES.backbeat
  const parts = [`On 2 and 4: ${onBackbeat} of 8.`]
  if (onOneThree > 0) parts.push(`${tapsWord(onOneThree)} landed on 1 or 3.`)
  if (matchedNone > 0) parts.push(`${tapsWord(matchedNone)} matched no beat.`)
  return parts.join(' ')
}

/** The lined-up taps of the last four bars as ticks, a row a bar. */
function ticksOf(
  rel: readonly number[],
  beatMs: number,
  barMs: number,
): StripTick[][] {
  const rows: StripTick[][] = [[], [], [], []]
  for (const t of rel) {
    if (t < -WINDOW_MS || t > barMs + WINDOW_MS) continue
    const pos = t / beatMs
    const nearest = Math.min(15, Math.max(0, Math.round(pos)))
    const row = Math.floor(nearest / 4)
    const near = Math.abs(t - nearest * beatMs) <= WINDOW_MS
    rows[row].push({ beat: pos - row * 4, gold: near && nearest % 2 === 1 })
  }
  return rows
}

/** Judges a take from its taps (page ms), beat 0's time (page ms) and the beat's length (ms). */
export function judgeBackbeat(
  taps: readonly number[],
  beat0: number,
  beatMs: number,
): TakeResult {
  const latency = lineUp(pulseSamples(taps, beat0, beatMs))
  const empty = [[], [], [], []]
  if (latency === null)
    return {
      line: LINES.notLined,
      latencyMs: null,
      onBackbeat: 0,
      onOneThree: 0,
      matchedNone: 0,
      ticks: empty,
    }
  const origin = beat0 + TAKE.judgedFrom * beatMs
  const rel = taps.map((t) => t - latency - origin)
  const onsets = Array.from(
    { length: TAKE.judgedTo - TAKE.judgedFrom + 1 },
    (_, i) => i * beatMs,
  )
  const barMs = 15.5 * beatMs - WINDOW_MS
  const v = judgeTake(rel, onsets, WINDOW_MS, barMs)
  // beat 12 is beat 1 of its bar, so an odd onset is beat 2 or 4
  const onBackbeat = v.met.filter((m, i) => m && i % 2 === 1).length
  const onOneThree = v.met.filter((m, i) => m && i % 2 === 0).length
  const matchedNone = v.extras.length
  return {
    line: takeLine(onBackbeat, onOneThree, matchedNone),
    latencyMs: latency,
    onBackbeat,
    onOneThree,
    matchedNone,
    ticks: ticksOf(rel, beatMs, barMs),
  }
}
