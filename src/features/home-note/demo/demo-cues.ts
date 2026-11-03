// ============================================================
// The Home note demo's beats, tooltips and words
// ============================================================
//
// Every tooltip waits for the moment it explains: "the band plays" for the
// intro's first chord, "sing home, on the beam" for the singer's turn
// opening, "the last chord's note, not home" for take 1's round decided on
// its miss (as Merc starts singing home over home's chord), and "home: the
// lamp lights" for take 2's landing.
//
// Each stays up at least TIP_READ_SECONDS before the next replaces it or
// the take moves on (demo-script.test.ts holds the plan to it). The demo
// kit's driver (useExerciseDemo.ts, through useHomeNoteDemo.ts) keys them
// to the moments the room really reaches, each on the first time it comes;
// `planHomeNoteDemo` lays the same table out on the script's own replay,
// which is what the tests check and what the progress bar runs on.

import type { DemoCue as KitDemoCue, DemoMark as KitDemoMark, DemoTimeline, } from '@/components/demo-kit/demo-plan'
import { planDemo } from '@/components/demo-kit/demo-plan'
import { DEMO_WORDS } from '@/components/demo-kit/demo-words'
import type { HomeNoteDemoMark, HomeNoteDemoTake } from './demo-script'
import { demoTake } from './demo-script'

/**
 * What a tooltip points at: the intro's chord lamps under the chip, the
 * lighthouse's beam (home's line), Merc on the pier, the lamp, the mic.
 */
export type DemoTarget = 'chords' | 'beam' | 'merc' | 'lamp' | 'mic'

export type DemoCueId = 'band' | 'turn' | 'chord' | 'home'

export type DemoMark = KitDemoMark<HomeNoteDemoMark>

export type DemoCue = KitDemoCue<DemoCueId, HomeNoteDemoMark, DemoTarget>

/** The least time a tooltip stays up, s: two short lines, read aloud. */
export const TIP_READ_SECONDS = 1.8

/** One tooltip at a time; each stays until the next beat clears it. */
export const DEMO_CUES: readonly DemoCue[] = [
  // Once the band is sounding: its chords light under the chip.
  {
    id: 'band',
    trigger: { take: 'off', mark: 'band' },
    delay: 0.4,
    target: 'chords',
  },
  // The band has stopped: the singer's turn, and where home is drawn.
  {
    id: 'turn',
    trigger: { take: 'off', mark: 'turn' },
    delay: 0.15,
    target: 'beam',
  },
  // The last chord's note held and let go: the round is decided when the
  // silence after it ends the turn, and Merc sings home.
  {
    id: 'chord',
    trigger: { take: 'off', mark: 'outcome' },
    delay: 0.15,
    target: 'merc',
  },
  {
    id: 'home',
    trigger: { take: 'on', mark: 'land:0' },
    delay: 0.15,
    target: 'lamp',
  },
]

/** The beats between the takes, wall seconds. */
export const DEMO_BEATS = {
  /** Merc's "Watch me first", before take 1. */
  intro: 0.9,
  /** From a take's start to its clock's zero: the sound's head start. */
  lead: 0.12,
  /**
   * Take 1's end (its miss) to the reset: home's chord with Merc singing
   * home over it, and the "not home" tooltip's read.
   */
  afterOff: 2.7,
  /** The room empties and the pill turns. */
  reset: 0.5,
  /** Take 2's end (its landing) to the end card: the lit lamp's read. */
  afterOn: 2.4,
} as const

/** The demo's words: the kit's (demo-kit demo-words.ts), its mic hint too. */
export const DEMO_COPY = DEMO_WORDS

/** A tooltip's words: what the voice did, and what to do about it. */
export function demoCueText(id: DemoCueId): string {
  switch (id) {
    case 'band':
      return 'The band plays a few chords in a key, then stops.'
    case 'turn':
      return 'Then sing the note that feels like home, on the beam.'
    case 'chord':
      return "That was the last chord's note, not home. Listen: home."
    case 'home':
      return 'Home, where the chords come to rest: the lamp lights.'
  }
}

export type HomeNoteDemoPlan = DemoTimeline<DemoCueId, HomeNoteDemoTake> & {
  /** Home: the note both takes are in the key of, and the voice is sung from. */
  readonly note: number
}

/** The whole demo on one wall clock, as the script plays it. */
export function planHomeNoteDemo(note: number): HomeNoteDemoPlan {
  const off = demoTake('off', note)
  const on = demoTake('on', note)
  return {
    note: off.round.home,
    ...planDemo('Home note', { off, on }, DEMO_CUES, DEMO_BEATS),
  }
}
