// ============================================================
// Hold reading — one held note against Merc's band, over a fixed length
// ============================================================
//
// The voice lessons' second reader (Lesson 5 WEB-SPEC, Toys 6), beside the
// note reader in take.ts and as pure, so every line a hold can earn is
// tested on synthetic frames (hold-take.test.ts). A hold is the raw frames
// of one take that waited up to 6 s for the voice, then ran a fixed length
// (10 or 15 s) from its first voiced frame, or less when the voice stopped
// for more than a second. Its voiced frames come from Voice Mirror's own
// `preprocess`, its distance from Merc's note is folded into his octave
// with `foldCents`, and its octave count is the median of the unfolded
// difference, rounded to whole octaves, as take.ts reads a note; the band
// is Voice Mirror's 35 cents.
//
// What a hold reports is time: how long the line sat inside the band, out
// of the hold's length, rounded DOWN to 0.1 s, so it never reads the whole
// length while any of it was outside; and when it settled, the first moment
// from which it stayed in the band for half a second without a break. A
// voice continues across the gaps between the detector's frames up to
// Voice Mirror's own voiced-run gap (0.12 s), and across any stretch the
// page analysed nothing at all, where it stalled (the detector runs on the
// page's animation frames): a frame the page did not analyse is not a break
// in the voice, and a stalled stretch between two frames in the band counts
// as in the band. Only frames heard without a voice break it. Too little
// voice gives no reading at all, never a low one (REQ-GVC-031).
//
// The lines describe the recording and nothing else (REQ-GVC-045): no
// breath, airflow, lung, tiredness or health label (REQ-GVC-071), nothing
// about the kind of start (REQ-GVC-076), and nothing about length beyond the
// hold, no longest and no best (REQ-GVC-070). Loaded after first paint, as
// take.ts is: it reaches Voice Mirror's scorer.

import type { F0Frame, VoicedFrame } from '@/lib/mirror/metrics'
import { foldCents, HIT_TOLERANCE_CENTS, median, preprocess, } from '@/lib/mirror/metrics'
import { DEFAULT_VOICED_RUN_GAP_SEC, estimateFrameHop, } from '@/lib/pitch-measurements'
import { ATTACK_SEC, NOT_STEADY_LINE, octaveLine, readingLine, STEADY_SEC, } from './take'

/** Seconds a take waits for the first voiced frame. */
export const HOLD_WAIT_SEC = 6
/** Seconds of silence, once the voice has started, that end a hold early. */
export const HOLD_QUIET_SEC = 1
/** Seconds the line must stay in the band, unbroken, to have settled. */
export const SETTLE_SEC = 0.5
/** Beyond the band and up to here, a hold that never settled is "close". */
const CLOSE_CENTS = 60

export const NO_START_LINE =
  "We didn't hear you start that time. Breathe in, then sing as the ring turns."

/** 'silent': no voice came; 'unsteady': too little to read; 'read': a reading. */
export type HoldKind = 'silent' | 'unsteady' | 'read'

export interface HoldReading {
  readonly kind: HoldKind
  /** The hold's length, seconds: 10 or 15. */
  readonly length: number
  /** Seconds in the band, rounded down to 0.1 s; 0 unless read. */
  readonly inBand: number
  /** What `inBand` is out of: the length, or the sung length when the voice stopped early. */
  readonly of: number
  /** Where the voice stopped, seconds from its start to 0.1 s, when that was more than a second early; else null. */
  readonly stoppedAt: number | null
  /** When the line settled, seconds from its start, to 0.1 s; null when it never did. */
  readonly settled: number | null
  /** The median folded distance from Merc's note after the attack, cents; null unless read. */
  readonly d: number | null
  /** Whole octaves between the voice and Merc's note: −1 is an octave lower. */
  readonly octaves: number
  /** `inBand` over the hold's length, 0 to 1: Merc celebrates from 0.8, rule 15's line comes under 0.5. */
  readonly share: number
  /** The reading, as the page says it. */
  readonly line: string
  /** "You sang it an octave lower: same note.", only within 50 cents of Merc's note. */
  readonly octaveLine: string | null
}

/** Seconds as the page prints them: "8.4", "10", "0.5". */
export function fmtSeconds(s: number): string {
  const r = Math.round(s * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

const down10 = (s: number): number => Math.floor(s * 10 + 1e-6) / 10
const round10 = (s: number): number => Math.round(s * 10) / 10

const blank = (
  kind: Exclude<HoldKind, 'read'>,
  length: number,
): HoldReading => ({
  kind,
  length,
  inBand: 0,
  of: length,
  stoppedAt: null,
  settled: null,
  d: null,
  octaves: 0,
  share: 0,
  line: kind === 'silent' ? NO_START_LINE : NOT_STEADY_LINE,
  octaveLine: null,
})

/**
 * Whether the page analysed nothing at all between two frames' times: they
 * are neighbours in the take's raw frames, so the page stalled there, and
 * nothing was heard, voiced or not.
 */
type Stalled = (a: number, b: number) => boolean

/** The stall test for a take's raw frames. */
function stallsIn(frames: readonly F0Frame[]): Stalled {
  const at = new Map<number, number>()
  frames.forEach((f, i) => at.set(f.t, i))
  return (a, b) => {
    const i = at.get(a)
    const j = at.get(b)
    return i !== undefined && j === i + 1
  }
}

/** The held voice: its frames from the first voiced one, up to a heard quiet gap or the hold's end. */
interface Run {
  readonly frames: readonly VoicedFrame[]
  /** When the run ends, on the frames' clock: the hold's end, or the last voiced frame before an early stop. */
  readonly end: number
  readonly early: boolean
}

function heldRun(
  voiced: readonly VoicedFrame[],
  length: number,
  stalled: Stalled,
): Run {
  const onset = voiced[0].t
  const close = onset + length
  const frames: VoicedFrame[] = []
  for (const [i, v] of voiced.entries()) {
    if (v.t > close) break
    frames.push(v)
    const next = voiced[i + 1]
    // a second heard without a voice ends the hold; a stalled page does not
    if (
      next !== undefined &&
      next.t - v.t > HOLD_QUIET_SEC &&
      !stalled(v.t, next.t)
    )
      return { frames, end: v.t, early: close - v.t > HOLD_QUIET_SEC }
  }
  const last = frames[frames.length - 1].t
  const early = close - last > HOLD_QUIET_SEC
  return { frames, end: early ? last : close, early }
}

/** The seconds each frame of the run stands for, and whether it stands across a stall. */
interface Spans {
  readonly span: readonly number[]
  readonly bridged: readonly boolean[]
}

/**
 * The seconds each frame of the run stands for: up to the next voiced frame
 * (the last, up to the run's end) while the voice is continuous, a gap no
 * wider than a voiced run's or a stall of the page up to a second;
 * otherwise the voice broke there, and the frame stands for one hop. A run
 * that ran its length adds up to the length exactly.
 */
function spansOf(
  run: Run,
  voiced: readonly VoicedFrame[],
  hop: number,
  stalled: Stalled,
): Spans {
  const span: number[] = []
  const bridged: boolean[] = []
  run.frames.forEach((v, i) => {
    const next = voiced[i + 1]
    const gap = Math.max(0, Math.min(next?.t ?? run.end, run.end) - v.t)
    const stall =
      next !== undefined &&
      gap > DEFAULT_VOICED_RUN_GAP_SEC &&
      next.t - v.t <= HOLD_QUIET_SEC &&
      stalled(v.t, next.t)
    bridged.push(stall)
    span.push(gap <= DEFAULT_VOICED_RUN_GAP_SEC || stall ? gap : hop)
  })
  return { span, bridged }
}

/**
 * The seconds each frame of the run holds in the band: its span while it is
 * in the band, but a stall only when the frames either side of it are; a
 * stall the note left the band across counts one hop.
 */
function bandSpans(
  s: Spans,
  inside: readonly boolean[],
  hop: number,
): number[] {
  return s.span.map((span, i) => {
    if (!inside[i]) return 0
    return s.bridged[i] && inside[i + 1] !== true ? Math.min(hop, span) : span
  })
}

/**
 * The first moment, seconds from the start, from which the line stays in the
 * band unbroken for half a second; `held` is what each frame holds in the
 * band (`bandSpans`).
 */
function settledAt(
  frames: readonly VoicedFrame[],
  inside: readonly boolean[],
  held: readonly number[],
): number | null {
  const onset = frames[0].t
  let from: number | null = null
  for (const [i, v] of frames.entries()) {
    if (!inside[i]) {
      from = null
      continue
    }
    from ??= v.t
    if (v.t + held[i] - from >= SETTLE_SEC - 1e-9) return from - onset
    // a break in the voice, or the band left across a stall, breaks the stretch
    if (held[i] < (frames[i + 1]?.t ?? v.t) - v.t) from = null
  }
  return null
}

/** The line for a hold that never settled: in short stretches, close, or nearer a different note. */
function unsettledLine(d: number, inBand: string, length: string): string {
  if (Math.abs(d) <= HIT_TOLERANCE_CENTS)
    return `In the band for ${inBand} of the ${length} seconds, in short stretches.`
  if (Math.abs(d) <= CLOSE_CENTS) {
    const n = Math.abs(Math.round(d))
    return d < 0
      ? `Your note sat about ${n} cents below Merc's, close to the band. Listen again, then aim a touch higher.`
      : `Your note sat about ${n} cents above Merc's, close to the band. Listen again, then aim a touch lower.`
  }
  return readingLine(d)
}

/** The reading's line, in WEB-SPEC's order: stopped early, all in the band, settled, then never settled. */
function holdLine(r: Omit<HoldReading, 'line' | 'octaveLine'>): string {
  const x = fmtSeconds(r.inBand)
  const l = fmtSeconds(r.length)
  if (r.stoppedAt !== null)
    return `You stopped after about ${fmtSeconds(r.stoppedAt)} seconds, in the band for ${x} of them. Stopping early is fine.`
  if (r.inBand >= r.length) return `In the band for all ${l} seconds.`
  if (r.settled !== null) {
    const when =
      r.settled < 0.05
        ? 'It settled straight away.'
        : `It settled after about ${fmtSeconds(r.settled)} seconds.`
    return `In the band for ${x} of the ${l} seconds. ${when}`
  }
  return unsettledLine(r.d ?? 0, x, l)
}

/**
 * Reads one hold: the raw frames of a take (time from the take opening)
 * against Merc's note (MIDI), for a hold of `length` seconds.
 */
export function readHold(
  frames: readonly F0Frame[],
  target: number,
  length: number,
): HoldReading {
  const voiced = preprocess(frames)
  const opened = frames[0]?.t ?? 0
  if (voiced.length === 0 || voiced[0].t - opened > HOLD_WAIT_SEC)
    return blank('silent', length)
  const stalled = stallsIn(frames)
  const run = heldRun(voiced, length, stalled)
  const hop = estimateFrameHop(run.frames)
  const spans = spansOf(run, voiced, hop, stalled)
  const { span } = spans
  const sung = span.reduce((a, b) => a + b, 0)
  if (sung < STEADY_SEC) return blank('unsteady', length)
  const onset = run.frames[0].t
  const diffs = run.frames.map((v) => v.cents - target * 100)
  const folded = diffs.map(foldCents)
  // the frame after the run too, which a stall at the hold's end reaches
  const inside = voiced
    .slice(0, run.frames.length + 1)
    .map(
      (v) => Math.abs(foldCents(v.cents - target * 100)) <= HIT_TOLERANCE_CENTS,
    )
  const held = bandSpans(spans, inside, hop)
  const inSeconds = held.reduce((a, b) => a + b, 0)
  const of = run.early ? round10(run.end - onset) : length
  const late = run.frames.flatMap((v, i) =>
    v.t >= onset + ATTACK_SEC ? [i] : [],
  )
  const middle = late.length > 0 ? late : run.frames.map((_, i) => i)
  const d = median(middle.map((i) => folded[i]))
  const octaves = Math.round(median(middle.map((i) => diffs[i])) / 1200)
  const settled = settledAt(run.frames, inside, held)
  const inBand = Math.min(of, down10(inSeconds))
  const reading = {
    kind: 'read' as const,
    length,
    inBand,
    of,
    stoppedAt: run.early ? of : null,
    settled: settled === null ? null : round10(settled),
    d,
    octaves: octaves === 0 ? 0 : octaves,
    share: inBand / length,
  }
  return {
    ...reading,
    line: holdLine(reading),
    octaveLine: octaveLine(d, octaves),
  }
}

/** A hold with a reading: one Again can replace, and the one each hold counts. */
export const hasReading = (r: HoldReading | null | undefined): boolean =>
  r?.kind === 'read'

/** Each hold counts its latest take with a reading; a take without one replaces nothing. */
export function countedTake(takes: readonly HoldReading[]): HoldReading | null {
  for (let i = takes.length - 1; i >= 0; i--)
    if (takes[i].kind === 'read') return takes[i]
  return null
}

/**
 * After the fifteen-second hold: "This time your line was in the band for
 * 8.4 of 10 seconds, then 12.9 of 15.", or the first alone while the second
 * has no reading; null without a first.
 */
export function holdSummary(
  first: HoldReading | null,
  second: HoldReading | null,
): string | null {
  if (first === null) return null
  const one = `This time your line was in the band for ${fmtSeconds(first.inBand)} of ${fmtSeconds(first.length)} seconds`
  if (second === null) return `${one}.`
  return `${one}, then ${fmtSeconds(second.inBand)} of ${fmtSeconds(second.length)}.`
}

/**
 * The chart's words after a hold (REQ-GVC-085): "Merc's note A3; your line
 * in the band for 8.4 of 10 seconds, settled after 0.5 seconds". `note` is
 * the note in words, as a screen reader says it ("A sharp 3").
 */
export function holdChartWords(note: string, r: HoldReading): string {
  const merc = `Merc's note ${note}`
  if (r.kind !== 'read') return `${merc}; no steady note heard`
  const of =
    r.stoppedAt === null
      ? `${fmtSeconds(r.of)} seconds`
      : `the ${fmtSeconds(r.of)} seconds sung`
  let settled = ''
  if (r.settled !== null)
    settled =
      r.settled < 0.05
        ? ', settled straight away'
        : `, settled after ${fmtSeconds(r.settled)} seconds`
  return `${merc}; your line in the band for ${fmtSeconds(r.inBand)} of ${of}${settled}`
}
