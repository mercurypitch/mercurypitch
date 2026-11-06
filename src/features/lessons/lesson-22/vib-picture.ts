// ============================================================
// Lesson 22 band chart pictures — what the chart shows of a play, moment by moment
// ============================================================
//
// The toy's four states as data (WEB-SPEC, Toys 2), pure, so a test reads
// them without a canvas: given a state, a play, its line on the play's
// clock and how far it has sounded, the picture is Merc's line, its middle,
// the ruler and the level strip, with Step 2's counter and ruler readings.
// Step 1 draws a level line, a wave or the swell across 4.5 s; Step 2 a
// one-second window that sweeps, redrawn from its left edge each second so
// the chart never scrolls, its ruler on the first full swing the window
// has drawn of the line's latest stretch; Step 3 the wave across 3.5 s with
// its middle dashed as far as the play has gone; Step 4 the sung wave
// across 2.0 s. At rest, after the cold open's choice, each state but the
// first shows a still of its play (`stillOf`); before it, the band alone.

import type { LevelPoint } from '@/features/lessons/kit/band-chart-hold'
import type { MiddleLine, WaveLine, WaveRuler, WaveStretch, } from '@/features/lessons/kit/band-chart-wave-scene'
import { centsOn, middleOf, middleOn, phaseAt, } from '@/features/lessons/kit/band-chart-wave-scene'
import type { Play, PlayKey } from './sounds'
import { atRate, levelOf, lineOf, SUNG } from './sounds'

/** The toy's states: Steps 1 to 4. */
export type VibState = 1 | 2 | 3 | 4

/** The state each play draws in. */
export const PLAY_STATE: Readonly<Record<PlayKey, VibState>> = {
  straight: 1,
  wave: 1,
  swell: 1,
  measure: 2,
  ooh: 2,
  six: 3,
  two: 3,
  'at-rate': 3,
  sung: 4,
}

/** Seconds across the chart in each state (WEB-SPEC, Toys 2). */
export const WINDOW: Readonly<Record<VibState, number>> = {
  1: 4.5,
  2: 1,
  3: 3.5,
  4: 2,
}

/** What the chart shows, with Step 2's readings. */
export interface Picture {
  readonly wave: WaveLine | null
  readonly middle: MiddleLine | null
  readonly ruler: WaveRuler | null
  readonly level: LevelPoint[]
  /** Step 2's counter: the swings a second sounding; null elsewhere. */
  readonly rate: number | null
  /** Step 2's ruler: the extent of the swing it stands on; null until it stands. */
  readonly extent: number | null
  /** Swing tops passed so far, for the counter's pulse at each. */
  readonly peaks: number
}

/** The band alone: before the cold open's choice, and Step 1 at rest. */
export const BLANK: Picture = {
  wave: null,
  middle: null,
  ruler: null,
  level: [],
  rate: null,
  extent: null,
  peaks: 0,
}

/** A stretch moved `d` seconds along the clock, its swing and middle with it. */
const shift = (s: WaveStretch, d: number): WaveStretch => ({
  ...s,
  from: s.from + d,
  to: s.to + d,
})

/** The wave stretch sounding at `t`: the latest one begun by then. */
export function stretchAt(
  line: readonly WaveStretch[],
  t: number,
): Extract<WaveStretch, { kind: 'wave' }> | null {
  let found: Extract<WaveStretch, { kind: 'wave' }> | null = null
  for (const s of line)
    if (s.kind === 'wave' && (found === null || s.from <= t)) found = s
  return found
}

/** Swing tops passed by `t` on the play's clock; the swing's phase carries on from stretch to stretch. */
export function peaksBy(line: readonly WaveStretch[], t: number): number {
  const s = stretchAt(line, t)
  if (s === null || s.rate <= 0) return 0
  return Math.max(0, Math.floor(phaseAt(s, t) - 0.25) + 1)
}

/**
 * The ruler, on a line on the window's clock drawn up to `upTo`: from the
 * middle to the first full swing top the window has drawn of the latest
 * stretch that has one, so it stands still between changes and moves to
 * a slider's new swing once that swing is drawn.
 */
export function rulerOf(
  line: readonly WaveStretch[],
  upTo: number,
  window: number,
): WaveRuler | null {
  for (let i = line.length - 1; i >= 0; i--) {
    const s = line[i]
    if (s.kind !== 'wave' || s.rate <= 0 || s.extent <= 0) continue
    // the first top at full depth inside the window, if drawn yet
    const a = Math.max(0, s.from + s.growIn)
    const b = Math.min(upTo, s.to, window)
    if (b <= a) continue
    const n = Math.ceil(phaseAt(s, a) - 0.25 - 1e-9)
    const t = s.from + (n + 0.25 - (s.phase ?? 0)) / s.rate
    if (t > b) continue
    return { t, from: middleOn(s, t), to: centsOn(s, t), text: '' }
  }
  return null
}

/**
 * What the chart shows in state `n` of play `p`, whose line (on the play's
 * clock) has sounded for `el` seconds; `whole`, under reduced motion, lands
 * it whole: the whole play, or the whole second the sweep is in.
 */
export function pictureOf(
  n: VibState,
  p: Play,
  line: readonly WaveStretch[],
  el: number,
  whole = false,
): Picture {
  if (n === 2) {
    // the sweep: the second the play is in, on a one-second window
    const k = Math.max(0, Math.min(Math.floor(el), Math.ceil(p.sec) - 1))
    const stretches = line.map((s) => shift(s, -k))
    const upTo = whole ? WINDOW[2] : el - k
    const ruler = rulerOf(stretches, upTo, WINDOW[2])
    return {
      wave: { stretches, upTo },
      middle: null,
      ruler,
      level: levelOf(p, -k, upTo),
      rate: stretchAt(line, el)?.rate ?? null,
      extent: ruler === null ? null : ruler.to - ruler.from,
      peaks: peaksBy(line, el),
    }
  }
  const upTo = whole ? p.sec : el
  const wave: WaveLine = { stretches: line, upTo }
  return {
    wave,
    middle:
      n === 3
        ? {
            points: middleOf(wave),
            tone: 'merc',
            share: Math.min(1, upTo / p.sec),
          }
        : null,
    ruler: null,
    level: levelOf(p, 0, upTo),
    rate: null,
    extent: null,
    peaks: 0,
  }
}

/** The sliders' values a still is drawn from. */
export interface Settings {
  /** Step 2's Rate and Extent. */
  readonly rate2: number
  readonly extent2: number
  /** Step 3's Rate. */
  readonly rate3: number
}

/**
 * A state's still, after the cold open's choice and before a play: none
 * in Step 1; in Step 2 one second at the sliders' values, at full depth,
 * with its ruler; in Step 3 the wave at Rate's value, its middle whole; in
 * Step 4 the sung wave.
 */
export function stillOf(n: VibState, s: Settings): Picture {
  if (n === 1) return BLANK
  if (n === 2) {
    const line: WaveStretch[] = [
      {
        kind: 'wave',
        from: 0,
        to: WINDOW[2],
        rate: s.rate2,
        extent: s.extent2,
        growIn: 0,
      },
    ]
    const ruler = rulerOf(line, WINDOW[2], WINDOW[2])
    return {
      wave: { stretches: line, upTo: WINDOW[2] },
      middle: null,
      ruler,
      level: [],
      rate: s.rate2,
      extent: s.extent2,
      peaks: 0,
    }
  }
  const p = n === 3 ? atRate(s.rate3, false) : SUNG
  return { ...pictureOf(n, p, lineOf(p), p.sec), level: [] }
}
