// ============================================================
// The Harmony demo's beats, tooltips and words
// ============================================================
//
// Every tooltip waits for the moment it explains: "my line first" for
// Merc's call, "yours, a third above" for the voice landing the first gold
// lamp, "my note, not yours" for take 1's line decided on its miss (as Merc
// starts singing his note and the third from it), and "every gold lamp"
// for take 2's last note landing.
//
// Each stays up at least TIP_READ_SECONDS before the next replaces it or
// the take moves on (demo-script.test.ts holds the plan to it). The demo
// kit's driver (useExerciseDemo.ts, through useHarmonyDemo.ts) keys them to
// the moments the room really reaches, each on the first time it comes;
// `planHarmonyDemo` lays the same table out on the script's own replay,
// which is what the tests check and what the progress bar runs on.

import type { DemoCue as KitDemoCue, DemoMark as KitDemoMark, DemoTimeline, } from '@/components/demo-kit/demo-plan'
import { planDemo } from '@/components/demo-kit/demo-plan'
import { DEMO_WORDS } from '@/components/demo-kit/demo-words'
import type { HarmonyDemoMark, HarmonyDemoTake } from './demo-script'
import { demoTake } from './demo-script'

/**
 * What a tooltip points at: Merc on the jetty, the harmony's gold lamps,
 * the one that missed, the mic.
 */
export type DemoTarget = 'merc' | 'lamps' | 'missed' | 'mic'

export type DemoCueId = 'call' | 'yours' | 'unison' | 'harmony'

export type DemoMark = KitDemoMark<HarmonyDemoMark>

export type DemoCue = KitDemoCue<DemoCueId, HarmonyDemoMark, DemoTarget>

/** The least time a tooltip stays up, s: two short lines, read aloud. */
export const TIP_READ_SECONDS = 1.8

/** The demo's line is three notes: the last one's landing ends take 2. */
const LAST_NOTE = 2

/** One tooltip at a time; each stays until the next beat clears it. */
export const DEMO_CUES: readonly DemoCue[] = [
  // Once his line is sounding.
  {
    id: 'call',
    trigger: { take: 'off', mark: 'call' },
    delay: 0.4,
    target: 'merc',
  },
  // The first gold lamp lit: where the voice goes, a third over his.
  {
    id: 'yours',
    trigger: { take: 'off', mark: 'land:0' },
    delay: 0.15,
    target: 'lamps',
  },
  // His own note sung for the second: that lamp missed, and the line is
  // decided once the silence after it ends the turn. He sings the pair.
  {
    id: 'unison',
    trigger: { take: 'off', mark: 'outcome' },
    delay: 0.15,
    target: 'missed',
  },
  {
    id: 'harmony',
    trigger: { take: 'on', mark: `land:${LAST_NOTE}` },
    delay: 0.15,
    target: 'lamps',
  },
]

/** The beats between the takes, wall seconds. */
export const DEMO_BEATS = {
  /** Merc's "Watch me first", before take 1. */
  intro: 0.9,
  /** From a take's start to its clock's zero: the sound's head start. */
  lead: 0.12,
  /**
   * Take 1's end (its outcome) to the reset: Merc singing his note and the
   * third from it, and the "my note, not yours" tooltip's read.
   */
  afterOff: 2.7,
  /** The room empties and the pill turns. */
  reset: 0.5,
  /** Take 2's end (its last landing) to the end card: the lit lamps' read. */
  afterOn: 2.4,
} as const

/** The demo's words: the kit's (demo-kit demo-words.ts), its mic hint too. */
export const DEMO_COPY = DEMO_WORDS

/** A tooltip's words: what the voice did, and what to do about it. */
export function demoCueText(id: DemoCueId): string {
  switch (id) {
    case 'call':
      return 'I sing my line first: the teal lamps.'
    case 'yours':
      return 'Then sing yours, a third above mine: the gold lamps.'
    case 'unison':
      return 'That was my note, not yours. Listen: my note, then the third above it.'
    case 'harmony':
      return 'A third above all the way: every gold lamp lights.'
  }
}

export type HarmonyDemoPlan = DemoTimeline<DemoCueId, HarmonyDemoTake> & {
  /** The harmony's first note: the one both takes start on, and the voice is sung from. */
  readonly note: number
}

/** The whole demo on one wall clock, as the script plays it. */
export function planHarmonyDemo(note: number): HarmonyDemoPlan {
  const off = demoTake('off', note)
  const on = demoTake('on', note)
  return {
    note: off.line.harmony[0],
    ...planDemo('Harmony', { off, on }, DEMO_CUES, DEMO_BEATS),
  }
}
