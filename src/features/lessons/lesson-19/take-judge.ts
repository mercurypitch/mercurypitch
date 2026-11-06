// ============================================================
// Lesson 19 take judge — the beat of each tune, tapped, lined up and read
// ============================================================
//
// Pure (WEB-SPEC, Toys 7; FACTS 32 to 36): a take is counted in the
// tune's own beats from beat 0, the first count-in click, a dotted
// quarter of 1 s in the 6/8 tune and a quarter of 0.67 s in the 3/4. The
// 6/8 tune counts in on beats 0 and 1, plays with the click on beats 2 to
// 9, which line the take up, and again with the click stopped on beats 10
// to 17, which are judged; the 3/4 counts in on 0 to 2, lines up on 3 to
// 14 and is judged on 15 to 26. The beats are the onsets: the learner taps
// the beat, not the tune's notes. The kit's tap judge (kit/tap-judge.ts)
// lines the taps up with Drum Night's estimator and matches them with the
// Ear Lab's `judgeTake`, imported, never copied, its window 120 ms; this
// module reads its verdict: the line, the first that applies, and each
// tap's tick.
//
// The line counts the beats that got a tap, N after a colon, so no
// sentence starts with a digit, and then the taps that met no beat: where
// at least four of them, and at least two thirds, fell within the window
// of where the other metre's beats would be, it names that metre, since
// that is the grouping the learner tapped (FACTS 34); otherwise it says
// they fell between the beats. A count that starts its sentence is a word
// (`tapsWord`). Early and late are drawn, never said: each lined-up tap is
// a tick where it fell, in quarter notes from the judged pass's first
// beat, gold when it met its beat.

import type { RhythmTick } from '@/features/lessons/kit/rhythm-draw'
import type { TapJudgement, TapTakeShape, } from '@/features/lessons/kit/tap-judge'
import { judgeTaps, TAP_WINDOW_MS, tapsWord, } from '@/features/lessons/kit/tap-judge'
import type { MetreKey } from './rhythm-views'
import { SIX_BPM } from './rhythm-views'

/** A quarter note, ms, at the tunes' 90 BPM: the ticks' unit. */
export const QUARTER_MS = 60000 / SIX_BPM

/** The bars of each pass, and a bar's length, ms: 2 s in either tune (FACTS 17). */
export const PASS_BARS = 4
export const BAR_MS = 3 * QUARTER_MS

/** A take's frame in its tune's beats from beat 0, and where the other metre's beats would fall. */
export interface TakeFrame {
  /** The tune's beats in a bar: 6/8's two, 3/4's three. */
  readonly perBar: number
  /** The tune's beat, ms. */
  readonly beatMs: number
  readonly shape: TapTakeShape
  /** Where the other metre's beats would fall in each bar, ms after its beat 1. */
  readonly other: readonly number[]
  /** The clause for taps that fell there: "Eight taps fell where 3/4's beats would be." */
  readonly otherLine: (k: number) => string
}

/** The beats a pass holds, each an onset, from the pass's first. */
const passBeats = (perBar: number): number[] =>
  Array.from({ length: perBar * PASS_BARS }, (_, k) => k)

/** Each tune's frame (WEB-SPEC, Toys 7; FACTS 32 to 34). */
export const FRAMES: Readonly<Record<MetreKey, TakeFrame>> = {
  '6-8': {
    perBar: 2,
    beatMs: 1.5 * QUARTER_MS,
    shape: { pulseFrom: 2, pulseTo: 9, judgedFrom: 10, onsets: passBeats(2) },
    other: [QUARTER_MS, 2 * QUARTER_MS],
    otherLine: (k) => `${tapsWord(k)} fell where 3/4's beats would be.`,
  },
  '3-4': {
    perBar: 3,
    beatMs: QUARTER_MS,
    shape: { pulseFrom: 3, pulseTo: 14, judgedFrom: 15, onsets: passBeats(3) },
    other: [1.5 * QUARTER_MS],
    otherLine: (k) => `${tapsWord(k)} fell where 6/8's second beat would be.`,
  },
}

/** The take's lines (WEB-SPEC, Toys 7, "The line"; FACTS 34). */
export const LINES = {
  notLined:
    "We couldn't line your taps up with the beat that time. Tap with the click while the tune plays the first time, then keep going on your own.",
  none: 'No taps came once the click stopped. Keep tapping the beat while the tune plays again.',
  all: (n: number): string =>
    `All ${n} beats got a tap, and no tap fell between them.`,
  count: (met: number, n: number): string =>
    `Beats with a tap: ${met} of ${n}.`,
  between: (k: number): string => `${tapsWord(k)} fell between the beats.`,
} as const

export interface TakeResult {
  readonly line: string
  /** The estimate taken from the first pass's taps, ms, or null when the take was not lined up. */
  readonly latencyMs: number | null
  /** The beats that got a tap. */
  readonly met: number
  /** Each lined-up tap the judge took, where it fell in quarter notes from the judged pass's first beat, and whether it met its beat. */
  readonly ticks: readonly RhythmTick[]
}

/** Whether a tap that met no beat, ms from the judged pass's first beat, fell where the other metre's beats would be. */
export function atOther(frame: TakeFrame, at: number): boolean {
  return Array.from({ length: PASS_BARS }, (_, b) => b * BAR_MS).some((bar) =>
    frame.other.some((p) => Math.abs(at - (bar + p)) <= TAP_WINDOW_MS),
  )
}

/** The line a judgement reads, the first that applies. */
export function takeLine(frame: TakeFrame, j: TapJudgement | null): string {
  if (j === null) return LINES.notLined
  const n = frame.shape.onsets.length
  const met = j.verdict.met.filter(Boolean).length
  const extras = j.verdict.extras
  if (met === 0 && extras.length === 0) return LINES.none
  if (met === n && extras.length === 0) return LINES.all(n)
  const parts: string[] = [LINES.count(met, n)]
  if (extras.length > 0) {
    const there = extras.filter((e) => atOther(frame, e)).length
    parts.push(
      there >= 4 && there * 3 >= extras.length * 2
        ? frame.otherLine(there)
        : LINES.between(extras.length),
    )
  }
  return parts.join(' ')
}

/** Judges a take of tune `key` from its taps (page ms) and beat 0's time (page ms). */
export function judgeBeats(
  key: MetreKey,
  taps: readonly number[],
  beat0: number,
): TakeResult {
  const frame = FRAMES[key]
  const j = judgeTaps(taps, beat0, frame.beatMs, frame.shape)
  return {
    line: takeLine(frame, j),
    latencyMs: j?.latencyMs ?? null,
    met: j === null ? 0 : j.verdict.met.filter(Boolean).length,
    ticks:
      j === null
        ? []
        : j.taps.map((t) => ({ beat: t.at / QUARTER_MS, met: t.met })),
  }
}
