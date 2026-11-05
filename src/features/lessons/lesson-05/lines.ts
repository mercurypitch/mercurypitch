// ============================================================
// Lesson 5 lines — the cold open's two takes and the hold demo, by hand
// ============================================================
//
// Illustrations, not recordings and not data (FACTS, Illustrations): each
// line is set by hand from the rule it shows, with sizes chosen to be seen.
//
// The cold open's takes (FACTS 72), 4 s each on A3 against Merc's band,
// "sung easily" and "pushing harder", live in the kit (kit/push-take.ts),
// since Lesson 14's Step 3 plays the pushed one too; this module hands them
// on to the page.
//
// The hold demo (FACTS 76), 10 s on A3, the first hold's length: the line
// starts 60 cents low and rises on hand-set points that waver up to 25
// cents either side of a straight rise, and from 0.9 s holds the band's
// middle with a small, regular wave, the 5.5 Hz, ±14-cent vibrato of
// Merc's "ooh" (FACTS 42). Its "settled" and "in the band" readouts are
// never set here: the checkpoint's own reader computes them from frames of
// this line (toy-hold.ts), so the demo shows exactly what a take would read.

import { hz } from '@/features/lessons/kit/notes'

export type { Take } from '@/features/lessons/kit/push-take'
export {
  BASE_LEVEL,
  TAKE_SEC,
  takeCents,
  takeContour,
  takeDb,
  takeLevel,
} from '@/features/lessons/kit/push-take'

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
