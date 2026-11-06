// ============================================================
// Band chart wave scene — Merc's own line, its middle and a ruler, as data
// ============================================================
//
// The scene a chart given band-chart-wave.ts's painter draws (BandScene
// `wave`, `middle` and `ruler`), Lesson 22's states of the chart (WEB-SPEC,
// Toys 1 and 2; What the kit and the app still need, item 5). Its own
// module, as the song's scene is, so the chart can name it without
// importing the painter that reads it.
//
// Where Lessons 3 to 14 keep Merc's line steady at the band's centre and
// leave his vibrato out, these draw the wave itself: Merc's line in his
// amber at its true pitch, from the same schedule his voice plays
// (sound.ts `Vibrato`: a sine whose depth grows in linearly from 0 at the
// play's start, its phase 0 there), so the drawing and the sound share one
// clock. A play is a run of stretches on the window's clock, each a wave or
// a level note; the controller says how far it has sounded.

import { TAU } from './dom'

/** One stretch of Merc's line: a wave, or a level note. */
export type WaveStretch =
  | {
      readonly kind: 'wave'
      /** Seconds on the window's clock where it starts and ends; it may start before the window, as a sweep's second does. */
      readonly from: number
      readonly to: number
      /** Swings a second, cents either side, and the seconds its depth grows in over from 0. */
      readonly rate: number
      readonly extent: number
      readonly growIn: number
      /** Its middle at its start, cents from Merc's note: 0 unless set. */
      readonly base?: number
      /** Cents its middle rises a second: Step 3's Drift; 0 unless set. */
      readonly drift?: number
    }
  | {
      readonly kind: 'level'
      readonly from: number
      readonly to: number
      /** Its height, cents from Merc's note. */
      readonly c: number
    }

/** Merc's line: its stretches, drawn up to `upTo` seconds on the window's clock. */
export interface WaveLine {
  readonly stretches: readonly WaveStretch[]
  /** How far the play has sounded; the window's length, or more, for a still. */
  readonly upTo: number
}

/** A point of a middle line: seconds across the window, cents from Merc's note. */
export interface MiddlePoint {
  readonly t: number
  readonly c: number
}

/** The dashed middle line, labelled "middle". */
export interface MiddleLine {
  readonly points: readonly MiddlePoint[]
  /** Amber from Merc's schedule, in the hero and the steps; violet from the centre-line reader, in Sing it. */
  readonly tone: 'merc' | 'singer'
  /** How much of it is drawn, left to right: 0 to 1. */
  readonly share: number
}

/** The ruler: an upright from the middle to the top of a swing, at a moment, with its reading. */
export interface WaveRuler {
  readonly t: number
  /** Its foot, the wave's middle, and its top, cents from Merc's note. */
  readonly from: number
  readonly to: number
  readonly text: string
}

/** The stretch's pitch at `t` seconds on the window's clock, cents from Merc's note. */
export function centsOn(s: WaveStretch, t: number): number {
  if (s.kind === 'level') return s.c
  const u = t - s.from
  const depth = s.growIn > 0 ? Math.min(1, Math.max(0, u / s.growIn)) : 1
  return middleOn(s, t) + s.extent * depth * Math.sin(TAU * s.rate * u)
}

/** The stretch's middle at `t`: a level note's height, or the wave's middle. */
export function middleOn(s: WaveStretch, t: number): number {
  if (s.kind === 'level') return s.c
  return (s.base ?? 0) + (s.drift ?? 0) * (t - s.from)
}

/** A wave's middle as a line, from its start to its end, two points a stretch. */
export function middleOf(line: WaveLine): MiddlePoint[] {
  return line.stretches.flatMap((s) =>
    s.kind === 'wave'
      ? [
          { t: s.from, c: middleOn(s, s.from) },
          { t: s.to, c: middleOn(s, s.to) },
        ]
      : [],
  )
}
