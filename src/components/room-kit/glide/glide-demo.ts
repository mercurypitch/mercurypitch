// ============================================================
// A glide room's demo: its beats, its words and its plan
// ============================================================
//
// What the "how it works" demo shares in both glide rooms (Lip roll's and
// Ng slides' demo-cues.ts): the beats between Merc's two takes, the demo's
// words, the least time a tooltip stays up, and the whole demo laid out on
// one wall clock (planGlideDemo), which is what the tests check and what
// the progress bar runs on. A room brings its two takes and its cues: what
// each tooltip waits for, what it points at and what it says.

import type { DemoCue, DemoTakeId, DemoTakeShape, DemoTimeline, } from '@/components/demo-kit/demo-plan'
import { planDemo } from '@/components/demo-kit/demo-plan'
import type { GlideDemoMark } from './glide-room-contract'

/** The least time a tooltip stays up, s: two short lines, read aloud. */
export const GLIDE_TIP_READ_SECONDS = 1.8

/** The beats between the takes, wall seconds. */
export const GLIDE_DEMO_BEATS = {
  /** Merc's "Watch me first", before take 1. */
  intro: 0.9,
  /** From a take's start to its clock's zero: the sound's head start. */
  lead: 0.12,
  /** Take 1's end to the reset: the dark arch, and the break's read. */
  afterOff: 1.6,
  /** The room empties and the pill turns. */
  reset: 0.5,
  /** Take 2's end to the end card: the lit arch, and the score's read. */
  afterOn: 2.4,
} as const

/** The demo's words. No em dashes; "practice", never "practise". */
export const GLIDE_DEMO_COPY = {
  watch: 'Watch me first.',
  off: 'Not like this',
  on: 'Like this',
  skip: 'Skip',
  ask: 'How it works',
  cardTitle: 'See how it works',
  cardLine: 'Merc sings it first. Turn your sound on.',
  watchButton: 'Watch',
  notNow: 'Not now',
  endTitle: 'Your turn',
  tryIt: 'Try it',
  again: 'Watch again',
  micHint: 'Tap the mic to start.',
} as const

/** A glide demo's take: its frames and the engine's events for them. */
export type GlideDemoTake = DemoTakeShape<GlideDemoMark>

/** The whole demo on one wall clock, and the note it is sung on. */
export type GlideDemoPlan<C extends string, Take> = DemoTimeline<C, Take> & {
  readonly note: number
}

/**
 * The demo on `root`, as the script plays it: the room's take 1 ("not
 * like this") and take 2 ("like this"), its cues, the glide beats.
 */
export function planGlideDemo<
  C extends string,
  T extends string,
  Take extends GlideDemoTake,
>(
  room: string,
  root: number,
  takeOn: (id: DemoTakeId, root: number) => Take,
  cues: readonly DemoCue<C, GlideDemoMark, T>[],
): GlideDemoPlan<C, Take> {
  const off = takeOn('off', root)
  const on = takeOn('on', root)
  return {
    note: root,
    ...planDemo(room, { off, on }, cues, GLIDE_DEMO_BEATS),
  }
}
