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
// The kit's tap judge (kit/tap-judge.ts) lines the taps up from the two
// bars of every beat and matches them to the sixteen beats 12 to 27 with
// the Ear Lab's judge and its 120 ms window for taps on crotchets, from
// 120 ms before beat 12 to half a beat after beat 27. This module's own
// are the take's shape, its line, the first that applies, which describes
// the taps, never the person, and claims nothing it did not measure
// (FACTS 42, 44), and its ticks, gold on 2 and 4.

import type { StripTick } from '@/features/lessons/kit/beat-strip'
import type { TapTakeShape } from '@/features/lessons/kit/tap-judge'
import { judgeTaps, TAP_WINDOW_MS, tapsWord, } from '@/features/lessons/kit/tap-judge'

export { tapsWord }

/** The take's shape, in beats from beat 0. */
export const TAKE = {
  countIn: 4,
  pulseFrom: 4,
  pulseTo: 11,
  judgedFrom: 12,
  judgedTo: 27,
  beats: 28,
} as const

/** The take's shape as the kit's judge reads it: every beat from beat 12 a note. */
const SHAPE: TapTakeShape = {
  pulseFrom: TAKE.pulseFrom,
  pulseTo: TAKE.pulseTo,
  judgedFrom: TAKE.judgedFrom,
  onsets: Array.from(
    { length: TAKE.judgedTo - TAKE.judgedFrom + 1 },
    (_, i) => i,
  ),
}

/** A tap within this of a judged beat is on it, ms (TOLERANCE_MS.quarters). */
export const WINDOW_MS = TAP_WINDOW_MS

export const LINES = {
  notLined:
    "We couldn't line your taps up with the beat that time. Tap every beat for the first two bars, then 2 and 4.",
  none: 'No taps came in the last four bars. After the two bars of every beat, tap 2 and 4.',
  backbeat: 'All 8 landed on 2 and 4: a backbeat.',
} as const

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
  const j = judgeTaps(taps, beat0, beatMs, SHAPE)
  if (j === null)
    return {
      line: LINES.notLined,
      latencyMs: null,
      onBackbeat: 0,
      onOneThree: 0,
      matchedNone: 0,
      ticks: [[], [], [], []],
    }
  const { met, extras } = j.verdict
  // beat 12 is beat 1 of its bar, so an odd onset is beat 2 or 4
  const onBackbeat = met.filter((m, i) => m && i % 2 === 1).length
  const onOneThree = met.filter((m, i) => m && i % 2 === 0).length
  const matchedNone = extras.length
  return {
    line: takeLine(onBackbeat, onOneThree, matchedNone),
    latencyMs: j.latencyMs,
    onBackbeat,
    onOneThree,
    matchedNone,
    ticks: ticksOf(j.rel, beatMs, j.barMs),
  }
}
