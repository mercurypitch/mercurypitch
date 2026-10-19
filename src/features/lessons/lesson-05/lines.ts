// ============================================================
// Lesson 5 lines — the cold open's two takes and the hold demo, by hand
// ============================================================
//
// Illustrations, not recordings and not data (FACTS, Illustrations): each
// line is set by hand from the rule it shows, with sizes chosen to be seen.
//
// The cold open's takes (FACTS 72), 4 s each on A3 against Merc's band:
// "sung easily" starts 40 cents low, glides to the band's middle by 0.5 s
// and holds; "pushing harder" does the same for a second, then over the
// last three rises 6 dB in level and 60 cents in pitch, its centre leaving
// the 35-cent band at 2.75 s (1.0 + 3.0 × 35 / 60). Air pressure mainly
// sets loudness and nudges the pitch up (FACTS 7, 8): one push, both moved.
//
// The hold demo (FACTS 76), 10 s on A3, the first hold's length: the line
// starts 60 cents low and rises on hand-set points that waver up to 25
// cents either side of a straight rise, and from 0.9 s holds the band's
// middle with a small, regular wave, the 5.5 Hz, ±14-cent vibrato of
// Merc's "ooh" (FACTS 42). Its "settled" and "in the band" readouts are
// never set here: the checkpoint's own reader computes them from frames of
// this line (toy-hold.ts), so the demo shows exactly what a take would read.

import { hz } from '@/features/lessons/kit/notes'
import type { ContourPoint } from '@/features/lessons/kit/sound'

export type Take = 'easy' | 'pushed'

/** Seconds of each cold-open take. */
export const TAKE_SEC = 4
/** The level both takes start at, as a share of the strip's height; 6 dB more doubles it. */
export const BASE_LEVEL = 0.5

/** Cents from Merc's note `t` seconds into a take: a glide in from 40 low, then, pushed, a climb of 60. */
export function takeCents(take: Take, t: number): number {
  if (t < 0.5) return -40 * (1 - Math.max(0, t) / 0.5)
  if (take === 'easy' || t <= 1) return 0
  return 60 * Math.min(1, (t - 1) / 3)
}

/** Decibels above the start `t` seconds into a take: none for the easy one, up to 6 for the pushed. */
export function takeDb(take: Take, t: number): number {
  if (take === 'easy' || t <= 1) return 0
  return 6 * Math.min(1, (t - 1) / 3)
}

/** The take's level as a share of the strip's height: 0.5, or up to 1 (6 dB louder). */
export const takeLevel = (take: Take, t: number): number =>
  BASE_LEVEL * 10 ** (takeDb(take, t) / 20)

/** A take as the kit's voice sings it: its pitch and level points, A3 at `midi` (57). */
export function takeContour(take: Take, midi: number): ContourPoint[] {
  const f = (cents: number): number => hz(midi) * 2 ** (cents / 1200)
  const easy: ContourPoint[] = [
    { t: 0, hz: f(-40), level: BASE_LEVEL },
    { t: 0.5, hz: f(0), level: BASE_LEVEL },
  ]
  if (take === 'easy')
    return [...easy, { t: TAKE_SEC, hz: f(0), level: BASE_LEVEL }]
  return [
    ...easy,
    { t: 1, hz: f(0), level: BASE_LEVEL },
    { t: TAKE_SEC, hz: f(60), level: takeLevel('pushed', TAKE_SEC) },
  ]
}

/** Seconds of the hold demo: the first hold's length. */
export const DEMO_SEC = 10
/** When the demo's line reaches the band's middle and its wave begins. */
export const DEMO_STEADY_AT = 0.9

/** The hand-set rise: seconds, cents from Merc's note (FACTS 76). */
const RISE: readonly (readonly [number, number])[] = [
  [0, -60],
  [0.18, -38],
  [0.34, -52],
  [0.5, -22],
  [0.66, -38],
  [0.8, -10],
  [DEMO_STEADY_AT, 0],
]

const smooth = (u: number): number => u * u * (3 - 2 * u)

/** The demo's line without its wave: the hand-set rise, then the band's middle. */
export function demoRise(t: number): number {
  if (t >= DEMO_STEADY_AT) return 0
  for (let i = 1; i < RISE.length; i++) {
    const [t1, c1] = RISE[i]
    if (t > t1) continue
    const [t0, c0] = RISE[i - 1]
    return c0 + (c1 - c0) * smooth((Math.max(t, t0) - t0) / (t1 - t0))
  }
  return 0
}

/** The vibrato of Merc's "ooh": 5.5 Hz, ±14 cents, grown in over 0.35 s. */
export const VIBRATO = { hz: 5.5, cents: 14, grow: 0.35 } as const

/** The demo's line, cents from Merc's note `t` seconds in: the rise, then the band's middle with a small, regular wave. */
export function demoCents(t: number): number {
  if (t < DEMO_STEADY_AT) return demoRise(t)
  const s = t - DEMO_STEADY_AT
  const depth = VIBRATO.cents * Math.min(1, s / VIBRATO.grow)
  return depth * Math.sin(2 * Math.PI * VIBRATO.hz * s)
}

/** The demo as the F0 stream would hand it over: a frame every 16 ms, its first at the voice's start. */
export function demoFrames(
  midi: number,
  hop = 0.016,
): { t: number; f0: number; conf: number }[] {
  const frames: { t: number; f0: number; conf: number }[] = []
  for (let k = 0; k * hop <= DEMO_SEC + 1e-9; k++) {
    const t = k * hop
    frames.push({ t, f0: hz(midi) * 2 ** (demoCents(t) / 1200), conf: 0.95 })
  }
  return frames
}
