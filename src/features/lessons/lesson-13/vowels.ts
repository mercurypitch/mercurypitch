// ============================================================
// Lesson 13 vowels — Merc's vowel model, the numbers the strip draws
// ============================================================
//
// Merc's vowels are a model, synthesised, never a recording (FACTS 40): a
// source with every harmonic of the note up to 4,000 Hz at 1/k of the first,
// through three resonances at the measured British means (FACTS 37: the
// men's for the lower voice, the women's for the higher), each a lowpass
// biquad at that frequency with Q its frequency over 80, 80 or 120 Hz, and
// every vowel scaled to the source's power. The 1/k slope, the bandwidths
// and the equal power are the page's modelling choices; the frequencies are
// measured. This module is pure, so the voice (vowel-voice.ts) and the strip
// (kit/spectrum-strip.ts) take their numbers from one place and cannot
// drift apart; its tests hold it to verify13.py's numbers.
//
// The strip's rule (FACTS 41, 42): one LED column a harmonic, 12 segments
// of 3 dB, measured from the loudest bar among the voice's five vowels on
// its note, so that bar fills its column and a bar 36 dB or more below it is
// dark; the labelled peaks are the tallest bar, then the tallest bar above
// it that stands at least one segment over both its neighbours.

import { A3, A4, hz } from '@/features/lessons/kit/notes'

/** The five vowels, in the hold's order, as the CURRICULUM card writes them. */
export const VOWELS = ['ee', 'eh', 'ah', 'oh', 'oo'] as const
export type Vowel = (typeof VOWELS)[number]

/** Merc's two voices: the lower on A3, the higher on A4. */
export type VoiceName = 'lower' | 'higher'
export const HOME: Readonly<Record<VoiceName, number>> = {
  lower: A3,
  higher: A4,
}

/** The first three formants' means, Hz: five men for the lower voice, five women for the higher (FACTS 37). */
export const MEANS: Readonly<
  Record<VoiceName, Readonly<Record<Vowel, readonly [number, number, number]>>>
> = {
  lower: {
    ee: [279.8, 2248.8, 2764.6],
    eh: [493.9, 1649.9, 2547.1],
    ah: [645.4, 1155.5, 2490.3],
    oh: [415.3, 827.7, 2619.5],
    oo: [315.9, 1191.1, 2407.6],
  },
  higher: {
    ee: [302.9, 2653.4, 3202.4],
    eh: [718.9, 2063.1, 2997.0],
    ah: [909.7, 1316.0, 2840.7],
    oh: [388.8, 888.1, 2795.9],
    oo: [327.8, 1437.1, 2674.1],
  },
}

/** The resonators' bandwidths, Hz: the page's modelling choice. */
export const BANDWIDTHS = [80, 80, 120] as const
/** The strip's top frequency, Hz: every harmonic up to it is a column. */
export const TOP_HZ = 4000
/** An LED column: 12 segments of 3 dB, 36 dB in all. */
export const SEGMENTS = 12
export const SEGMENT_DB = 3

/** One resonator: its frequency, Hz, and its Q as a ratio (the Web Audio filter takes 20 log10 of it, in dB). */
export interface Resonator {
  readonly hz: number
  readonly q: number
}

/** The labelled peaks, 1-based bar numbers: the tallest, then the second or null. */
export type Peaks = readonly [first: number, second: number | null]

/** The harmonics of a note up to 4,000 Hz: 18 on A3, 9 on A4. */
export const harmonicCount = (f0: number): number =>
  Math.floor(TOP_HZ / f0 + 1e-9)

/** A vowel's three resonators in a voice. */
export function resonatorsOf(voice: VoiceName, vowel: Vowel): Resonator[] {
  return MEANS[voice][vowel].map((f, i) => ({ hz: f, q: f / BANDWIDTHS[i] }))
}

/** One resonator's gain at `f`: the RBJ lowpass, 1 / sqrt((1 - x²)² + (x / q)²), x = f / F. */
export function response(f: number, r: Resonator): number {
  const x = f / r.hz
  return 1 / Math.sqrt((1 - x * x) ** 2 + (x / r.q) ** 2)
}

/** The source through the resonators (none: the source alone): one amplitude a harmonic, 1/k before them. */
export function rawLevels(
  f0: number,
  res: readonly Resonator[] = [],
  count = harmonicCount(f0),
): number[] {
  const out: number[] = []
  for (let k = 1; k <= count; k++) {
    let a = 1 / k
    for (const r of res) a *= response(k * f0, r)
    out.push(a)
  }
  return out
}

/** The square root of the sum of squares: a set of harmonics' power, as an amplitude. */
export const power = (xs: readonly number[]): number =>
  Math.sqrt(xs.reduce((s, x) => s + x * x, 0))

/** The level factor that gives the source through `res` the unfiltered source's power on `f0`. */
export const powerFactor = (f0: number, res: readonly Resonator[]): number =>
  power(rawLevels(f0)) / power(rawLevels(f0, res))

/** The amplitudes the sound has: the source through `res`, scaled by `factor`, against the source's power. */
export function levelsAt(
  f0: number,
  res: readonly Resonator[],
  factor: number,
): number[] {
  const src = power(rawLevels(f0))
  return rawLevels(f0, res).map((a) => (a * factor) / src)
}

/** Each vowel at one power: its amplitudes over their power. */
export const vowelLevels = (
  voice: VoiceName,
  midi: number,
  v: Vowel,
): number[] => {
  const raw = rawLevels(hz(midi), resonatorsOf(voice, v))
  const p = power(raw)
  return raw.map((a) => a / p)
}

/** The loudest bar among the voice's five vowels on `midi`: the top of every column. */
export const reference = (voice: VoiceName, midi: number): number =>
  Math.max(...VOWELS.map((v) => Math.max(...vowelLevels(voice, midi, v))))

/** Lit segments for an amplitude against `ref`: 12 at the reference, none at 36 dB or more below it. */
export function segmentsFor(a: number, ref: number): number {
  if (a <= 0) return 0
  const db = 20 * Math.log10(a / ref)
  return Math.max(
    0,
    Math.min(SEGMENTS, Math.ceil((db + SEGMENTS * SEGMENT_DB) / SEGMENT_DB)),
  )
}

/** The labelled peaks of a strip's segments (FACTS 42). */
export function peaksOf(segs: readonly number[]): Peaks {
  let first = 0
  segs.forEach((s, i) => {
    if (s > segs[first]) first = i
  })
  let second: number | null = null
  for (let i = first + 2; i < segs.length; i++) {
    const s = segs[i]
    const tall =
      s > 0 && s > segs[i - 1] && (i + 1 === segs.length || s > segs[i + 1])
    if (tall && (second === null || s > segs[second])) second = i
  }
  return [first + 1, second === null ? null : second + 1]
}

/** A vowel's strip in a voice on a note: its lit segments and its labelled peaks. */
export interface VowelStrip {
  readonly segments: readonly number[]
  readonly peaks: Peaks
}

export function vowelStrip(
  voice: VoiceName,
  midi: number,
  v: Vowel,
): VowelStrip {
  const ref = reference(voice, midi)
  const segments = vowelLevels(voice, midi, v).map((a) => segmentsFor(a, ref))
  return { segments, peaks: peaksOf(segments) }
}

/** The source alone, the first `n` harmonics of `count`: each against the 1st, which fills its column (Step 1). */
export function sourceSegments(n: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    i < n ? segmentsFor(1 / (i + 1), 1) : 0,
  )
}

/** The equal-power factor of each vowel on a note, and the largest, a play's gain over Merc's (FACTS 67). */
export const vowelFactor = (voice: VoiceName, midi: number, v: Vowel): number =>
  powerFactor(hz(midi), resonatorsOf(voice, v))

/**
 * The resonators part way through a change, `u` from 0 to 1: frequencies
 * glide exponentially and Q in decibels linearly, as the Web Audio
 * filters' ramps do.
 */
export function resonatorsBetween(
  a: readonly Resonator[],
  b: readonly Resonator[],
  u: number,
): Resonator[] {
  return a.map((ra, i) => {
    const rb = b[i]
    const qDb =
      20 * Math.log10(ra.q) +
      (20 * Math.log10(rb.q) - 20 * Math.log10(ra.q)) * u
    return { hz: ra.hz * (rb.hz / ra.hz) ** u, q: 10 ** (qDb / 20) }
  })
}

/** A level part way through an exponential glide, as the voice's level ramps. */
export const levelBetween = (a: number, b: number, u: number): number =>
  a * (b / a) ** u
