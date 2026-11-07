// ============================================================
// Drone beats — the arithmetic behind the drone chart
// ============================================================
//
// Lesson 24's drone chart draws every line from the schedule its play
// sounds, and every brightness from the same frequencies, so the drawing
// and the sound share one clock and nothing is analysed from the audio
// (its WEB-SPEC, Toys 2). A note's schedule gives its frequency and the
// cycles it has completed since the play began, every voice of a play
// starting on one audio time with each partial at phase 0 (kit/sound.ts,
// `build`), as the page's voices do.
//
// Two notes beat through the harmonics that nearly meet: the top note's
// n-th and the drone's m-th, under 20 Hz apart, beat at their gap (Lesson
// 24 FACTS 11 to 21). The readout's rate is the gap of the ratio the
// interval nears, the pair in lowest terms with the smallest gap: 1 to 1
// for close notes, 2 to 1 for the octave, 3 to 2 for a fifth, 5 to 4 for a
// major third (FACTS 27), said in Beat Hunt's words, "still" at none
// (FACTS 28). The brightness is the envelope of each pair that nearly
// meets, from the schedules' phases: each pair swings between the
// difference and the sum of its two levels, its swing weighted by its
// weaker harmonic's level, and a chord's pairs add up, so a pure chord,
// whose harmonics meet exactly, holds still (WEB-SPEC, Look). Pairs are
// found from the notes' middles, so a wave moves a pair's phase without
// moving it in or out of the sum, and the slow pairs, three beats a second
// or fewer, are summed apart from the fast ones, which the chart draws as a
// fine shimmer at the band's edges. The levels are Merc's "ooh" partials,
// the timbre every note on the page sounds in (FACTS 72).
//
// Pure. Nothing here plays a sound.

import { beatWord } from '@/lib/ear/beat'
import { TAU } from './dom'
import type { Vibrato } from './sound'
import { MERC_PARTIALS } from './sound'

/** Harmonics further apart than this do not beat: they are heard as roughness, or as two notes. */
export const BEAT_LIMIT_HZ = 20
/** Beats a second above which the chart draws a beat as a fine shimmer at the band's edges (WEB-SPEC, Look). */
export const SHIMMER_HZ = 3
/** A gap under this is no beat at all: exactly in tune. */
const STILL_HZ = 1e-6

/** A note over a play: its frequency, and its cycles since the play began, from phase 0. */
export interface Schedule {
  /** Seconds the play lasts. */
  readonly dur: number
  /** Hz at `t` seconds from the play's start, wave and all. */
  hz(t: number): number
  /** The note's middle at `t`, Hz: its frequency without a wave on it. */
  centre(t: number): number
  /** Cycles completed by `t`, from phase 0 at the start. */
  cycles(t: number): number
}

/** A note held at `hz` for `dur` seconds. */
export function steady(hz: number, dur: number): Schedule {
  return { dur, hz: () => hz, centre: () => hz, cycles: (t) => hz * t }
}

/** The cold open's slide: its parts, seconds and Hz (Lesson 24 FACTS 44). */
export interface SlideParts {
  readonly from: number
  readonly to: number
  readonly hold: number
  readonly glide: number
  readonly after: number
}

/** The slide's schedule: `from` held for `hold`, an exponential glide to `to` over `glide`, then `to` held for `after`. */
export function slide(p: SlideParts): Schedule {
  const k = Math.log(p.to / p.from)
  const end = p.hold + p.glide
  // the glide's cycles, `from` times the integral of exp(k s / glide) over its seconds
  const glided = (s: number): number =>
    k === 0
      ? p.from * s
      : ((p.from * p.glide) / k) * (Math.exp((k * s) / p.glide) - 1)
  const hz = (t: number): number => {
    if (t <= p.hold) return p.from
    if (t >= end) return p.to
    return p.from * Math.exp((k * (t - p.hold)) / p.glide)
  }
  const cycles = (t: number): number => {
    if (t <= p.hold) return p.from * t
    const head = p.from * p.hold
    if (t <= end) return head + glided(t - p.hold)
    return head + glided(p.glide) + p.to * (t - end)
  }
  return { dur: end + p.after, hz, centre: hz, cycles }
}

/** Seconds between the steps of a waved note's table of cycles. */
const WAVE_STEP = 1 / 4000

/**
 * A note with a singer's wave on it, as the kit's vibrato option sounds it:
 * `extent` cents either side at `rate` swings a second, its depth grown in
 * linearly over `growIn` from phase 0 at the start (kit/sound.ts,
 * `Vibrato`). Its cycles are summed from a table of the frequency, a
 * quarter of a millisecond apart.
 */
export function waved(hz: number, dur: number, v: Vibrato): Schedule {
  const at = (t: number): number => {
    const depth = v.growIn > 0 ? v.extent * Math.min(1, t / v.growIn) : v.extent
    return hz * 2 ** ((depth * Math.sin(TAU * v.rate * t)) / 1200)
  }
  const steps = Math.ceil(dur / WAVE_STEP) + 1
  const table = new Float64Array(steps + 1)
  for (let i = 1; i <= steps; i++) {
    const t0 = (i - 1) * WAVE_STEP
    table[i] = table[i - 1] + ((at(t0) + at(t0 + WAVE_STEP)) / 2) * WAVE_STEP
  }
  const cycles = (t: number): number => {
    if (t <= 0) return 0
    const x = Math.min(t / WAVE_STEP, steps)
    const i = Math.floor(x)
    const rest = x - i
    if (i >= steps) return table[steps]
    return table[i] + (table[i + 1] - table[i]) * rest
  }
  return { dur, hz: at, centre: () => hz, cycles }
}

/** Two harmonics that nearly meet: the top note's `n`-th and the lower note's `m`-th, their gap, and the weaker one's level. */
export interface NearPair {
  readonly n: number
  readonly m: number
  readonly gap: number
  readonly weight: number
}

/** Every pair of harmonics of `top` and `low` under 20 Hz apart, in the timbre `partials` gives. */
export function nearPairs(
  top: number,
  low: number,
  partials: readonly number[] = MERC_PARTIALS,
): NearPair[] {
  const out: NearPair[] = []
  for (let n = 1; n <= partials.length; n++)
    for (let m = 1; m <= partials.length; m++) {
      const gap = Math.abs(n * top - m * low)
      if (gap < BEAT_LIMIT_HZ)
        out.push({
          n,
          m,
          gap,
          weight: Math.min(partials[n - 1], partials[m - 1]),
        })
    }
  return out
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/**
 * The readout's rate, beats a second: the gap of the ratio the interval
 * nears, the pair of harmonics in lowest terms that sit closest; null when
 * none sit under 20 Hz apart.
 */
export function beatRate(
  top: number,
  low: number,
  partials: readonly number[] = MERC_PARTIALS,
): number | null {
  let best: number | null = null
  for (const p of nearPairs(top, low, partials))
    if (gcd(p.n, p.m) === 1 && (best === null || p.gap < best)) best = p.gap
  return best
}

/** The rate in Beat Hunt's words, "2 beats a second" or "a beat every 2 s", and "still" at none. */
export const rateWords = (rate: number | null): string =>
  rate === null || rate < STILL_HZ ? 'still' : beatWord(rate)

/** Whether any two of a chord's notes beat: some pair of their harmonics under 20 Hz apart, and not exactly met. */
export function chordBeats(
  notes: readonly number[],
  partials: readonly number[] = MERC_PARTIALS,
): boolean {
  for (let i = 0; i < notes.length; i++)
    for (let j = i + 1; j < notes.length; j++) {
      const [top, low] =
        notes[i] >= notes[j] ? [notes[i], notes[j]] : [notes[j], notes[i]]
      if (nearPairs(top, low, partials).some((p) => p.gap >= STILL_HZ))
        return true
    }
  return false
}

/** A chord's readout: "beating" or "still". */
export const chordWords = (notes: readonly number[]): string =>
  chordBeats(notes) ? 'beating' : 'still'

/** How bright a play's beats are at a moment, 0 to 1: its slow beats' and its fast ones' apart, null where it has none. */
export interface Brightness {
  /** Pairs three beats a second apart or fewer, a still pair included. */
  readonly slow: number | null
  /** Pairs further apart, under 20 Hz: a fine shimmer at the band's edges. */
  readonly fast: number | null
}

/**
 * How bright a play's beats are at `t`: each pair of harmonics that nearly
 * meet, found from the notes' middles, at the phase the schedules have
 * reached, between the difference of its two levels (0) and their sum (1),
 * weighted by the weaker level and summed over every pair of the play's
 * notes, the slow pairs apart from the fast.
 */
export function brightness(
  notes: readonly Schedule[],
  t: number,
  partials: readonly number[] = MERC_PARTIALS,
): Brightness {
  const sum = { slow: 0, fast: 0 }
  const weights = { slow: 0, fast: 0 }
  for (let i = 0; i < notes.length; i++)
    for (let j = i + 1; j < notes.length; j++) {
      const a = notes[i]
      const b = notes[j]
      const [top, low] = a.centre(t) >= b.centre(t) ? [a, b] : [b, a]
      for (const p of nearPairs(top.centre(t), low.centre(t), partials)) {
        const big = Math.max(partials[p.n - 1], partials[p.m - 1])
        const small = p.weight
        const phase = TAU * (p.n * top.cycles(t) - p.m * low.cycles(t))
        const env = Math.sqrt(
          big * big + small * small + 2 * big * small * Math.cos(phase),
        )
        const k = p.gap > SHIMMER_HZ ? 'fast' : 'slow'
        // the weaker level times where the envelope stands between its ends
        sum[k] += (env - big + small) / 2
        weights[k] += small
      }
    }
  return {
    slow: weights.slow === 0 ? null : sum.slow / weights.slow,
    fast: weights.fast === 0 ? null : sum.fast / weights.fast,
  }
}

/** The phase between two notes' harmonics `n` and `m` at `t`, degrees from in phase, 0 to 180. */
export function phaseApart(
  top: Schedule,
  low: Schedule,
  t: number,
  n = 1,
  m = 1,
): number {
  const turns = n * top.cycles(t) - m * low.cycles(t)
  const frac = turns - Math.floor(turns)
  return Math.min(frac, 1 - frac) * 360
}
