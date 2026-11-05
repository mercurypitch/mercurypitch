// ============================================================
// Pushed take — Lesson 5's two takes on one note, easy and pushed
// ============================================================
//
// Illustrations, not recordings and not data (Lesson 5 FACTS,
// Illustrations): each line is set by hand from the rule it shows, with
// sizes chosen to be seen. Lesson 5's cold open plays them (FACTS 72), 4 s
// each against Merc's band: "sung easily" starts 40 cents low, glides to
// the band's middle by 0.5 s and holds; "pushing harder" does the same for
// a second, then over the last three rises 6 dB in level and 60 cents in
// pitch, its centre leaving the 35-cent band at 2.75 s (1.0 + 3.0 × 35 /
// 60). Air pressure mainly sets loudness and nudges the pitch up (FACTS 7,
// 8): one push, both moved. Lesson 14's Step 3 plays the pushed take beside
// its swell, as Lesson 5 plays it (Lesson 14 FACTS 39).

import { hz } from './notes'
import type { ContourPoint } from './sound'

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
