// ============================================================
// Lesson 22 sounds — every play, one schedule for its sound and its line
// ============================================================
//
// Every example is Merc's "ooh" on A3, for every learner (FACTS 8). Each
// play is one schedule, from which both its voice and its drawing come:
// its note, its seconds, its wave or none, the rise of its middle (Step 3's
// Drift) and its level along it (Step 1's swell, Lesson 14's shape). A wave
// is a pure sine on the pitch, its depth grown in linearly from 0 over
// 0.3 s, its phase 0 at the start; Merc's default "ooh" grows in over its
// own 0.35 s (FACTS 63). The voice sings the play's contour with its wave
// (`contourOfPlay`, kit/run.ts `playLine`), and a chart draws its line
// (`lineOf`) and its level (`levelOf`) from the same numbers, so the
// drawing and the sound share one clock (WEB-SPEC, Audio). A slider moved
// during a play glides the voice over 50 ms (kit/sound.ts `VIBRATO_GLIDE`);
// the line takes the change at the glide's middle, where the swing stood
// (`retune`), so it stays unbroken. The cold open's plays are FACTS 64's,
// the steps' FACTS 65 to 68's.

import type { LevelPoint } from '@/features/lessons/kit/band-chart-hold'
import type { WaveStretch } from '@/features/lessons/kit/band-chart-wave-scene'
import { middleOn, phaseAt } from '@/features/lessons/kit/band-chart-wave-scene'
import { hz } from '@/features/lessons/kit/notes'
import type { RunLine } from '@/features/lessons/kit/run'
import type { ContourPoint, Vibrato } from '@/features/lessons/kit/sound'
import { MERC_VIBRATO, VIBRATO_GLIDE } from '@/features/lessons/kit/sound'

/** Merc's note for every example, A3 (FACTS 8, 62). */
export const A3 = 57

/** Every wave's grow-in, seconds (FACTS 63). */
export const GROW_IN = 0.3

/** A wave of `rate` swings a second, `extent` cents either side, grown in over 0.3 s. */
export const waveOf = (rate: number, extent: number): Vibrato => ({
  rate,
  extent,
  growIn: GROW_IN,
})

/** One play: what its voice sings, and what its line draws. */
export interface Play {
  readonly midi: number
  readonly sec: number
  /** Its wave, or null: a straight note, with no modulator at all. */
  readonly vibrato: Vibrato | null
  /** Cents its middle rises over the play, Step 3's Drift: 0 unless set. */
  readonly rise?: number
  /** Its level along the play, 0 to 1 of the voice's own, Step 1's swell: 1 throughout unless set. */
  readonly level?: readonly LevelPoint[]
}

/** The cold open's wave, which Step 3's Play: six a second plays again: six swings a second at ±50 cents (FACTS 64, 67). */
export const COLD_WAVE = waveOf(6, 50)

// ---------------------------------------------------------------- the cold open

/** The cold open's note: Merc's wave on A3 for 3.0 s, which Step 3's Play: six a second plays again (FACTS 64, 67). */
export const COLD: Play = { midi: A3, sec: 3, vibrato: COLD_WAVE }

/** The straight notes the cold open asks about, cents above A3: the top, 226.45 Hz, and the middle, A3 itself (FACTS 41, 62). */
export const STRAIGHT_AT = { top: 50, middle: 0 } as const

/** An answering play's parts, seconds: the wave, the quiet after it, then the straight note (FACTS 64). */
export const ANSWER = { wave: 2, gap: 0.3, straight: 2 } as const

/** An answering play: its seconds, its two voices, and its line on the chart's clock. */
export interface Answer {
  readonly sec: number
  /** Merc's wave, then the straight note, each a voice of its own (kit/run.ts `playLines`). */
  readonly lines: readonly RunLine[]
  readonly line: readonly WaveStretch[]
}

/** The cold open's answering play for the straight note `cents` above A3: the wave for 2.0 s, 0.3 s of quiet, the straight note for 2.0 s, 4.3 s in all. */
export function answerOf(cents: number): Answer {
  const f0 = hz(A3)
  const f = f0 * 2 ** (cents / 1200)
  const at = ANSWER.wave + ANSWER.gap
  return {
    sec: at + ANSWER.straight,
    lines: [
      {
        t: 0,
        points: [
          { t: 0, hz: f0 },
          { t: ANSWER.wave, hz: f0 },
        ],
        vibrato: COLD_WAVE,
      },
      {
        t: at,
        points: [
          { t: 0, hz: f },
          { t: ANSWER.straight, hz: f },
        ],
        vibrato: null,
      },
    ],
    line: [
      ...lineOf({ midi: A3, sec: ANSWER.wave, vibrato: COLD_WAVE }),
      { kind: 'level', from: at, to: at + ANSWER.straight, c: cents },
    ],
  }
}

// ---------------------------------------------------------------- the steps

/** Lesson 14's swell without its glide in: 0.5 for a second, up to 1.0 at 2.5 s, back to 0.5 at 4.0 s (FACTS 65). */
export const SWELL: readonly LevelPoint[] = [
  { t: 0, level: 0.5 },
  { t: 1, level: 0.5 },
  { t: 2.5, level: 1 },
  { t: 4, level: 0.5 },
]

/** Step 1: straight, with a wave of six swings a second at ±40 cents, and the swell (FACTS 65). */
export const STRAIGHT: Play = { midi: A3, sec: 3, vibrato: null }
export const WAVE: Play = { midi: A3, sec: 3, vibrato: waveOf(6, 40) }
export const SWELLED: Play = { midi: A3, sec: 4, vibrato: null, level: SWELL }

/** Step 2's sliders, where they start, and Play's seconds: Rate 5 to 8 by 0.5, Extent ±10 to ±60 by 10 (FACTS 66). */
export const MEASURE = { rate: 6, extent: 30, sec: 4 } as const

/** Step 2's Play, at the sliders' values (FACTS 66). */
export const measure = (rate: number, extent: number): Play => ({
  midi: A3,
  sec: MEASURE.sec,
  vibrato: waveOf(rate, extent),
})

/** Step 2's Play Merc's "ooh": the kit's default voice, 5.5 swings a second at ±14 over its own 0.35 s (FACTS 15, 66). */
export const OOH: Play = { midi: A3, sec: 2, vibrato: MERC_VIBRATO }

/** Step 3's Drift: the middle rises 50 cents over the play's 3.0 s, leaving the band at 2.1 s (FACTS 23, 67). */
export const DRIFT_CENTS = 50

/** Step 3's extent, cents either side: the cold open's (FACTS 67). */
export const WIDE = 50

/** Step 3: the cold open's wave, its slow version, and the wave at Rate's value, which Drift raises (FACTS 67). */
export const SIX: Play = COLD
export const TWO: Play = { midi: A3, sec: 3, vibrato: waveOf(2, WIDE) }
export const atRate = (rate: number, drift: boolean): Play => ({
  midi: A3,
  sec: 3,
  vibrato: waveOf(rate, WIDE),
  rise: drift ? DRIFT_CENTS : 0,
})

/** Step 4's sung wave: 5.5 swings a second at ±30 cents for 2.0 s, 11 swings (FACTS 68). */
export const SUNG: Play = { midi: A3, sec: 2, vibrato: waveOf(5.5, 30) }

/** The steps' and free play's plays, by their buttons' keys (`data-vib-play`, and Step 3's predict's `data-play`). */
export type PlayKey =
  | 'straight'
  | 'wave'
  | 'swell'
  | 'measure'
  | 'ooh'
  | 'six'
  | 'two'
  | 'at-rate'
  | 'sung'

/** The play a key sounds, at the sliders' values and with Drift as it is switched. */
export function playFor(
  key: PlayKey,
  v: {
    readonly rate2: number
    readonly extent2: number
    readonly rate3: number
    readonly drift: boolean
  },
): Play {
  switch (key) {
    case 'straight':
      return STRAIGHT
    case 'wave':
      return WAVE
    case 'swell':
      return SWELLED
    case 'measure':
      return measure(v.rate2, v.extent2)
    case 'ooh':
      return OOH
    case 'six':
      return SIX
    case 'two':
      return TWO
    case 'at-rate':
      return atRate(v.rate3, v.drift)
    case 'sung':
      return SUNG
  }
}

/** The play's level at `t`, as a share of its voice's own, straight between its points. */
export function levelAt(p: Play, t: number): number {
  const pts = p.level ?? []
  if (pts.length === 0) return 1
  if (t <= pts[0].t) return pts[0].level
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    if (t <= b.t)
      return a.level + ((b.level - a.level) * (t - a.t)) / (b.t - a.t)
  }
  return pts[pts.length - 1].level
}

/** The voice's contour: its centre pitch along the play, the middle's rise included, and its level at each point. */
export function contourOfPlay(p: Play): ContourPoint[] {
  const f0 = hz(p.midi)
  const rise = p.rise ?? 0
  const times = [
    ...new Set([0, ...(p.level ?? []).map((l) => l.t), p.sec]),
  ].sort((a, b) => a - b)
  return times.map((t) => ({
    t,
    hz: f0 * 2 ** ((rise * t) / p.sec / 1200),
    level: levelAt(p, t),
  }))
}

/** The play's line on a chart's clock, the play starting `at` seconds across: a level note, or a wave and its rising middle. */
export function lineOf(p: Play, at = 0): WaveStretch[] {
  const rise = p.rise ?? 0
  if (p.vibrato === null && rise === 0)
    return [{ kind: 'level', from: at, to: at + p.sec, c: 0 }]
  return [
    {
      kind: 'wave',
      from: at,
      to: at + p.sec,
      rate: p.vibrato?.rate ?? 0,
      extent: p.vibrato?.extent ?? 0,
      growIn: p.vibrato?.growIn ?? 0,
      drift: rise / p.sec,
    },
  ]
}

/**
 * The play's level under its line on the chart's clock, the play starting
 * `at` seconds across (before the window, as a sweep's later second does),
 * from the window's left edge up to `upTo`.
 */
export function levelOf(p: Play, at: number, upTo: number): LevelPoint[] {
  const start = Math.max(0, at)
  const end = Math.min(upTo, at + p.sec)
  if (end <= start) return []
  const inner = (p.level ?? [])
    .filter((l) => at + l.t > start && at + l.t < end)
    .map((l) => ({ t: at + l.t, level: l.level }))
  return [
    { t: start, level: levelAt(p, start - at) },
    ...inner,
    { t: end, level: levelAt(p, end - at) },
  ]
}

/**
 * The line after a slider moved `t` seconds on the chart's clock: the last
 * wave stops at the middle of the voice's 50 ms glide, and a new one goes
 * on from where its swing and its middle stood, at the new rate and extent
 * and at full depth, as the voice's setter leaves it (kit/sound.ts
 * `setVibrato`). A line already ended, or a level note, is left as it is.
 */
export function retune(
  line: readonly WaveStretch[],
  t: number,
  to: { readonly rate: number; readonly extent: number },
): WaveStretch[] {
  const last = line.at(-1)
  if (last?.kind !== 'wave') return [...line]
  const at = Math.max(last.from, t + VIBRATO_GLIDE / 2)
  if (at >= last.to) return [...line]
  return [
    ...line.slice(0, -1),
    { ...last, to: at },
    {
      ...last,
      from: at,
      rate: to.rate,
      extent: to.extent,
      growIn: 0,
      phase: phaseAt(last, at),
      base: middleOn(last, at),
    },
  ]
}
