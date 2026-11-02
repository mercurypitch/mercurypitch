// ============================================================
// The Leap demo's beats, tooltips and words
// ============================================================
//
// Every tooltip waits for the moment it explains: "I sing my note first"
// for Merc's call, "sing it back, then leap" for the voice landing his
// note, "short" for take 1's miss, and "it lands" for take 2's landing.
//
// Each stays up at least TIP_READ_SECONDS before the next replaces it or
// the take moves on (demo-script.test.ts holds the plan to it). The demo
// kit's driver (useExerciseDemo.ts, through useLeapDemo.ts) keys them to
// the moments the room really reaches, each on the first time it comes;
// `planLeapDemo` lays the same table out on the script's own replay, which
// is what the tests check and what the progress bar runs on.

import type { DemoCue as KitDemoCue, DemoMark as KitDemoMark, DemoTimeline, } from '@/components/demo-kit/demo-plan'
import { planDemo } from '@/components/demo-kit/demo-plan'
import { DEMO_WORDS } from '@/components/demo-kit/demo-words'
import type { LeapDemoMark, LeapDemoTake } from './demo-script'
import { demoTake } from './demo-script'

/**
 * What a tooltip points at: Merc on his ledge, the band of light on the
 * far ledge, the lantern at its end, the mic.
 */
export type DemoTarget = 'merc' | 'band' | 'lantern' | 'mic'

export type DemoCueId = 'call' | 'leap' | 'short' | 'lands'

export type DemoMark = KitDemoMark<LeapDemoMark>

export type DemoCue = KitDemoCue<DemoCueId, LeapDemoMark, DemoTarget>

/** The least time a tooltip stays up, s: two short lines, read aloud. */
export const TIP_READ_SECONDS = 1.8

/** One tooltip at a time; each stays until the next beat clears it. */
export const DEMO_CUES: readonly DemoCue[] = [
  // Once his note is sounding.
  {
    id: 'call',
    trigger: { take: 'off', mark: 'call' },
    delay: 0.4,
    target: 'merc',
  },
  // His note sung back and landed: what comes next, before the leap.
  {
    id: 'leap',
    trigger: { take: 'off', mark: 'land:0' },
    delay: 0.95,
    target: 'band',
  },
  // The short leap misses when the silence after it ends the turn.
  {
    id: 'short',
    trigger: { take: 'off', mark: 'miss:1' },
    delay: 0.15,
    target: 'lantern',
  },
  {
    id: 'lands',
    trigger: { take: 'on', mark: 'land:1' },
    delay: 0.15,
    target: 'lantern',
  },
]

/** The beats between the takes, wall seconds. */
export const DEMO_BEATS = {
  /** Merc's "Watch me first", before take 1. */
  intro: 0.9,
  /** From a take's start to its clock's zero: the sound's head start. */
  lead: 0.12,
  /**
   * Take 1's end (its miss) to the reset: Merc singing both notes, and the
   * "short" tooltip's read.
   */
  afterOff: 2.7,
  /** The room empties and the pill turns. */
  reset: 0.5,
  /** Take 2's end (its landing) to the end card: the lit lantern's read. */
  afterOn: 2.4,
} as const

/** The demo's words: the kit's (demo-kit demo-words.ts), its mic hint too. */
export const DEMO_COPY = DEMO_WORDS

/** A tooltip's words: what the voice did, and what to do about it. */
export function demoCueText(id: DemoCueId): string {
  switch (id) {
    case 'call':
      return 'I sing my note first, on my ledge.'
    case 'leap':
      return 'Sing my note back, then leap up to the band of light.'
    case 'short':
      return 'Short, so the lantern stays dark. Listen: my note, then the leap.'
    case 'lands':
      return 'Held in the light: the leap lands, and the lantern lights.'
  }
}

export type LeapDemoPlan = DemoTimeline<DemoCueId, LeapDemoTake> & {
  /** Merc's note: the one both takes start on, and the voice is sung from. */
  readonly note: number
}

/** The whole demo on one wall clock, as the script plays it. */
export function planLeapDemo(note: number): LeapDemoPlan {
  const off = demoTake('off', note)
  const on = demoTake('on', note)
  return {
    note: off.round.from,
    ...planDemo('Leap', { off, on }, DEMO_CUES, DEMO_BEATS),
  }
}
