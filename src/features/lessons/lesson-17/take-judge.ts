// ============================================================
// Lesson 17 take judge — the two written bars, tapped, lined up and read
// ============================================================
//
// Pure (WEB-SPEC, Toys 7, "The judge"; FACTS 32 to 36): the take is 20
// beats at 60 BPM counted from beat 0, the first count-in click. Beats 0
// to 3 count in; 4 to 11 are tapped on every beat, and line the take up;
// 12 to 19 are the two written bars, two quarters and a half note, then
// two eighths, a quarter, two eighths and a quarter, nine notes from beat
// 12. The kit's tap judge (kit/tap-judge.ts) lines the taps up with Drum
// Night's estimator and matches them with the Ear Lab's `judgeTake`,
// imported, never copied, its window 120 ms; this module reads its
// verdict: the line, the first that applies, and each tap's tick.
//
// The line says what can be said plainly: how many of the nine notes got
// a tap, a tap that fell on the half note's held beat, the notes on "and"
// that got none, and how many other taps fell between the notes. N sits
// after a colon, as in Lesson 8's "On 2 and 4: 6 of 8.", so no sentence
// starts with a digit; K starts its sentence, so it is a word
// (`tapsWord`). Early and late are drawn, never said: each lined-up tap is
// a tick where it fell, in beats from the written bars' first, gold when it
// met its note (FACTS 34).

import type { RhythmTick } from '@/features/lessons/kit/rhythm-draw'
import type { TapJudgement, TapTakeShape, } from '@/features/lessons/kit/tap-judge'
import { judgeTaps, TAP_WINDOW_MS, tapsWord, } from '@/features/lessons/kit/tap-judge'

/** The take's tempo, BPM, and its beat, ms. */
export const TAKE_BPM = 60
export const BEAT_MS = 60000 / TAKE_BPM

/** The take's beats, from beat 0: the count-in, the bars of every beat, the written bars (FACTS 36). */
export const TAKE = {
  countIn: 4,
  pulseFrom: 4,
  pulseTo: 11,
  judgedFrom: 12,
  beats: 20,
} as const

/** The written bars' nine notes, in beats from their first (FACTS 36). */
export const TAKE_ONSETS: readonly number[] = [0, 1, 2, 4, 4.5, 5, 6, 6.5, 7]

/** The notes on "and", by index: bar 2's 4.5 and 6.5. */
const AND_NOTES: readonly number[] = [4, 7]

/** Beat 4 of bar 1, where the half note holds, ms from the written bars' first beat. */
const HELD_MS = 3 * BEAT_MS

const SHAPE: TapTakeShape = {
  pulseFrom: TAKE.pulseFrom,
  pulseTo: TAKE.pulseTo,
  judgedFrom: TAKE.judgedFrom,
  onsets: TAKE_ONSETS,
}

/** "One more tap", "Two more taps": a count that starts its sentence, after the held beat's. */
const moreWord = (n: number): string =>
  tapsWord(n).replace(/ (taps?)$/, ' more $1')

/** The take's lines (WEB-SPEC, Toys 7, "The line"). */
export const LINES = {
  notLined:
    "We couldn't line your taps up with the beat that time. Tap every beat for the two bars after the count-in, then the written bars.",
  none: 'No taps came in the written bars. After the two bars of every beat, tap once for each note.',
  all: 'All 9 notes got a tap, and no tap fell between them.',
  count: (n: number): string => `Notes with a tap: ${n} of 9.`,
  held: 'One tap came on beat 4 of bar 1, where the half note holds.',
  bothAnd: 'The two notes on ‘and’ got none.',
  oneAnd: 'One note on ‘and’ got none.',
  between: (k: number): string => `${tapsWord(k)} fell between the notes.`,
  moreBetween: (k: number): string => `${moreWord(k)} fell between the notes.`,
} as const

export interface TakeResult {
  readonly line: string
  /** The estimate taken from every tap, ms, or null when the take was not lined up. */
  readonly latencyMs: number | null
  /** The notes that got a tap, of 9. */
  readonly met: number
  /** Each lined-up tap the judge took, where it fell in beats from the written bars' first, and whether it met its note. */
  readonly ticks: readonly RhythmTick[]
}

/** The line a judgement reads, the first that applies. */
export function takeLine(j: TapJudgement | null): string {
  if (j === null) return LINES.notLined
  const met = j.verdict.met.filter(Boolean).length
  const extras = j.verdict.extras
  if (met === 0 && extras.length === 0) return LINES.none
  if (met === TAKE_ONSETS.length && extras.length === 0) return LINES.all
  const parts: string[] = [LINES.count(met)]
  const held = extras.some((e) => Math.abs(e - HELD_MS) <= TAP_WINDOW_MS)
  if (held) parts.push(LINES.held)
  // with no note met, the clauses on "and" would only repeat the count
  if (met >= 1) {
    const missed = AND_NOTES.filter((i) => !j.verdict.met[i]).length
    if (missed === 2) parts.push(LINES.bothAnd)
    else if (missed === 1) parts.push(LINES.oneAnd)
  }
  const others = extras.length - (held ? 1 : 0)
  if (others > 0)
    parts.push(held ? LINES.moreBetween(others) : LINES.between(others))
  return parts.join(' ')
}

/** Judges a take from its taps (page ms) and beat 0's time (page ms). */
export function judgeBars(taps: readonly number[], beat0: number): TakeResult {
  const j = judgeTaps(taps, beat0, BEAT_MS, SHAPE)
  return {
    line: takeLine(j),
    latencyMs: j?.latencyMs ?? null,
    met: j === null ? 0 : j.verdict.met.filter(Boolean).length,
    ticks:
      j === null
        ? []
        : j.taps.map((t) => ({ beat: t.at / BEAT_MS, met: t.met })),
  }
}
