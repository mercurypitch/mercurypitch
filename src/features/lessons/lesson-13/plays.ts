// ============================================================
// Lesson 13 plays — every sung line as a schedule, and the strip at any moment
// ============================================================
//
// A play is one sung line on one note: a vowel, vowels in turn with a change
// between them, or the source alone (FACTS 66). Its schedule gives the
// voice's contour points (every one on the note's frequency, so Merc's line
// is level because his note is exact, FACTS 43), its gain and each point's
// level (every vowel at the source's power, FACTS 67), and the resonators
// each point reaches; and, for the figure, the strip at any moment of it:
// the columns from the resonances part way through a change, sampled as the
// sound has them, with the caps on the vowel the change has left until it
// ends. The voice and the strip read the one schedule, so they cannot
// drift apart. Pure, for its tests.
//
// A change glides from one vowel to the next over `glide` seconds from the
// next vowel's cue: in the cold open, ‘ee’ for 2.0 s, a 0.5 s change and
// ‘ah’ for 2.0 s (4.5 s); in the five vowels, a vowel every 2.0 s, each
// glided into over its first 0.25 s (10.0 s, the cues at 0, 2, 4, 6 and 8).

import { hz } from '@/features/lessons/kit/notes'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import type { Peaks, Resonator, VoiceName, Vowel } from './vowels'
import { harmonicCount, levelBetween, levelsAt, power, rawLevels, reference, resonatorsBetween, resonatorsOf, response, segmentsFor, sourceSegments, TOP_HZ, vowelFactor, vowelStrip, } from './vowels'

/** Merc's gain, kit/sound.ts's for his "ooh": a play's starts from it. */
export const MERC_GAIN = 0.2

/** The lengths of every play, seconds (FACTS 66). */
export const VOWEL_SEC = 2
export const COLD_CHANGE_SEC = 0.5
export const RUN_CHANGE_SEC = 0.25
export const ADD_SEC = 1.5
export const ALL_SEC = 2
export const MOVE_SEC = 1

/** A vowel from its cue, glided into over `glide` seconds (0 for the first). */
export interface Stretch {
  readonly vowel: Vowel
  readonly at: number
  readonly glide: number
}

/** A sung line on one note: vowels in turn, or the first `n` harmonics of the source alone. */
export type Line =
  | {
      readonly kind: 'vowels'
      readonly voice: VoiceName
      readonly midi: number
      readonly stretches: readonly Stretch[]
      readonly end: number
    }
  | {
      readonly kind: 'source'
      readonly voice: VoiceName
      readonly midi: number
      readonly n: number
      readonly end: number
    }

/** One vowel held for `seconds`. */
export const oneVowel = (
  voice: VoiceName,
  midi: number,
  vowel: Vowel,
  seconds = VOWEL_SEC,
): Line => ({
  kind: 'vowels',
  voice,
  midi,
  stretches: [{ vowel, at: 0, glide: 0 }],
  end: seconds,
})

/** The cold open's ‘ee’, then ‘ah’: 2.0 s, a 0.5 s change, 2.0 s. */
export const eeThenAh = (voice: VoiceName, midi: number): Line => ({
  kind: 'vowels',
  voice,
  midi,
  stretches: [
    { vowel: 'ee', at: 0, glide: 0 },
    { vowel: 'ah', at: VOWEL_SEC, glide: COLD_CHANGE_SEC },
  ],
  end: 2 * VOWEL_SEC + COLD_CHANGE_SEC,
})

/** Vowels in turn, 2.0 s each, each glided into over its first 0.25 s: the five vowels are 10.0 s. */
export const vowelRun = (
  voice: VoiceName,
  midi: number,
  vowels: readonly Vowel[],
): Line => ({
  kind: 'vowels',
  voice,
  midi,
  stretches: vowels.map((vowel, i) => ({
    vowel,
    at: i * VOWEL_SEC,
    glide: i === 0 ? 0 : RUN_CHANGE_SEC,
  })),
  end: vowels.length * VOWEL_SEC,
})

/** The first `n` harmonics of the source together, through no resonance. */
export const sourceLine = (
  voice: VoiceName,
  midi: number,
  n: number,
  seconds: number,
): Line => ({ kind: 'source', voice, midi, n, end: seconds })

/** The equal-power factor of each of a line's vowels, in its stretches' order; the source's for a source line. */
function factors(line: Line): number[] {
  if (line.kind === 'source') {
    const f0 = hz(line.midi)
    return [power(rawLevels(f0)) / power(rawLevels(f0, [], line.n))]
  }
  return line.stretches.map((s) => vowelFactor(line.voice, line.midi, s.vowel))
}

/** A play's gain: Merc's, times the largest factor among what it sings, so every point's level is at most 1. */
export const lineGain = (line: Line): number =>
  MERC_GAIN * Math.max(...factors(line))

/** The source's harmonic amplitudes, 1/k, up to the line's top harmonic: the voice's wave. */
export function partialsOf(line: Line): number[] {
  const count = line.kind === 'source' ? line.n : harmonicCount(hz(line.midi))
  return Array.from({ length: count }, (_, i) => 1 / (i + 1))
}

/** A point of the voice: the note's frequency, its level, and the resonators it reaches (none for the source). */
export interface VowelPoint extends ContourPoint {
  readonly res: readonly Resonator[]
}

/** The voice's contour: the note held throughout, each change a glide of the resonators and the level. */
export function linePoints(line: Line): VowelPoint[] {
  const f0 = hz(line.midi)
  const top = Math.max(...factors(line))
  if (line.kind === 'source')
    return [
      { t: 0, hz: f0, level: factors(line)[0] / top, res: [] },
      { t: line.end, hz: f0, level: factors(line)[0] / top, res: [] },
    ]
  const fs = factors(line)
  const point = (t: number, i: number): VowelPoint => ({
    t,
    hz: f0,
    level: fs[i] / top,
    res: resonatorsOf(line.voice, line.stretches[i].vowel),
  })
  const points: VowelPoint[] = [point(0, 0)]
  line.stretches.forEach((s, i) => {
    if (i === 0) return
    if (s.at > points[points.length - 1].t) points.push(point(s.at, i - 1))
    points.push(point(s.at + s.glide, i))
  })
  if (line.end > points[points.length - 1].t)
    points.push(point(line.end, line.stretches.length - 1))
  return points
}

/** The strip at a moment of a play: its columns, its capped bars, and the vowel whose cue has come. */
export interface StripNow {
  readonly columns: readonly number[]
  readonly peaks: Peaks | null
  readonly vowel: Vowel | null
}

/**
 * The strip `t` seconds into a play. During a change the columns follow
 * the resonances part way, as the sound has them, and the caps stay on the
 * vowel the change has left until it ends; under reduced motion a change
 * lands on its end at its cue.
 */
export function stripAt(line: Line, t: number, reduced = false): StripNow {
  if (line.kind === 'source')
    return {
      columns: sourceSegments(line.n, harmonicCount(hz(line.midi))),
      peaks: null,
      vowel: null,
    }
  const { voice, midi, stretches } = line
  let i = 0
  while (i + 1 < stretches.length && t >= stretches[i + 1].at) i++
  const s = stretches[i]
  const u = s.glide > 0 && !reduced ? Math.min(1, (t - s.at) / s.glide) : 1
  if (i === 0 || u >= 1) {
    const strip = vowelStrip(voice, midi, s.vowel)
    return { columns: strip.segments, peaks: strip.peaks, vowel: s.vowel }
  }
  const from = stretches[i - 1].vowel
  const f0 = hz(midi)
  const res = resonatorsBetween(
    resonatorsOf(voice, from),
    resonatorsOf(voice, s.vowel),
    u,
  )
  const factor = levelBetween(
    vowelFactor(voice, midi, from),
    vowelFactor(voice, midi, s.vowel),
    u,
  )
  const ref = reference(voice, midi)
  return {
    columns: levelsAt(f0, res, factor).map((a) => segmentsFor(a, ref)),
    peaks: vowelStrip(voice, midi, from).peaks,
    vowel: s.vowel,
  }
}

/**
 * The curves over the strip: each resonator's own response in decibels
 * from its peak, from 0 to 4,000 Hz, `step` Hz apart.
 */
export function curvesOf(
  res: readonly Resonator[],
  step = 20,
): { hz: number; db: number }[][] {
  return res.map((r) => {
    const out: { hz: number; db: number }[] = []
    // a resonator's gain at its frequency is its Q: the curve's peak
    for (let f = 0; f <= TOP_HZ; f += step)
      out.push({ hz: f, db: 20 * Math.log10(response(f, r) / r.q) })
    return out
  })
}
