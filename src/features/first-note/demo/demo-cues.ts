// ============================================================
// The First note demo's beats, tooltips and words
// ============================================================
//
// Every tooltip waits for the moment it explains: "the song plays up to
// where its singer comes in" once the band is sounding, "come in on the
// singer's first note" as the band stops, "a step under it" while take 1's
// entry is still sung (the chip that names an entry in a run is not up in
// the demo), "Merc sings it" for take 1's round decided on the silence
// after it, as Merc starts singing the note, and "it lands" for take 2's
// landing.
//
// Each stays up at least TIP_READ_SECONDS before the next replaces it or
// the take moves on (demo-script.test.ts holds the plan to it). The demo
// kit's driver (useExerciseDemo.ts, through useFirstNoteDemo.ts) keys them
// to the moments the room really reaches, each on the first time it comes;
// `planFirstNoteDemo` lays the same table out on the script's own replay,
// which is what the tests check and what the progress bar runs on.

import type { DemoCue as KitDemoCue, DemoMark as KitDemoMark, DemoTimeline, } from '@/components/demo-kit/demo-plan'
import { planDemo } from '@/components/demo-kit/demo-plan'
import { DEMO_WORDS } from '@/components/demo-kit/demo-words'
import { entryPitch } from '../first-note-songs'
import type { FirstNoteDemoMark, FirstNoteDemoTake } from './demo-script'
import { demoTake } from './demo-script'

/**
 * What a tooltip points at: the lead-in's countdown, the note's line (with
 * its band of light), Merc on the boards, the mic (the kit's hint at rest).
 */
export type DemoTarget = 'countdown' | 'line' | 'merc' | 'mic'

export type DemoCueId = 'band' | 'turn' | 'low' | 'sings' | 'lands'

export type DemoMark = KitDemoMark<FirstNoteDemoMark>

export type DemoCue = KitDemoCue<DemoCueId, FirstNoteDemoMark, DemoTarget>

/** The least time a tooltip stays up, s: two short lines, read aloud. */
export const TIP_READ_SECONDS = 1.8

/** One tooltip at a time; each stays until the next beat clears it. */
export const DEMO_CUES: readonly DemoCue[] = [
  // Once the band is sounding: its countdown runs toward the entry.
  {
    id: 'band',
    trigger: { take: 'off', mark: 'band' },
    delay: 0.4,
    target: 'countdown',
  },
  // The band has stopped where the singer comes in: the turn, over Merc,
  // who sings it (the take's pill stands over the mic).
  {
    id: 'turn',
    trigger: { take: 'off', mark: 'turn' },
    delay: 0.15,
    target: 'merc',
  },
  // Take 1's entry, read while it is still sung, the line now showing
  // over the voice under it.
  {
    id: 'low',
    trigger: { take: 'off', mark: 'entry' },
    delay: 1.5,
    target: 'line',
  },
  // The silence after it decides the round: Merc sings the note.
  {
    id: 'sings',
    trigger: { take: 'off', mark: 'outcome' },
    delay: 0.15,
    target: 'merc',
  },
  {
    id: 'lands',
    trigger: { take: 'on', mark: 'land:0' },
    delay: 0.15,
    target: 'line',
  },
]

/** The beats between the takes, wall seconds. */
export const DEMO_BEATS = {
  /** Merc's "Watch me first", before take 1. */
  intro: 0.9,
  /** From a take's start to its clock's zero: the sound's head start. */
  lead: 0.12,
  /**
   * Take 1's end (its miss) to the reset: Merc singing the note, and the
   * "Merc sings it" tooltip's read.
   */
  afterOff: 2.4,
  /** The room empties and the pill turns. */
  reset: 0.5,
  /** Take 2's end (its landing) to the end card: the lit line's read. */
  afterOn: 2.4,
} as const

/** The demo's words: the kit's (demo-kit demo-words.ts), its mic hint too. */
export const DEMO_COPY = DEMO_WORDS

/** A tooltip's words: what the voice did, and what to do about it. */
export function demoCueText(id: DemoCueId): string {
  switch (id) {
    case 'band':
      return 'The song plays up to where its singer comes in, counting the last four beats.'
    case 'turn':
      return "Then come in on the singer's first note, from the band alone."
    case 'low':
      return "That came in a step under the singer's first note."
    case 'sings':
      return 'It never landed on the note. Listen: Merc sings it.'
    case 'lands':
      return "On the singer's first note, held in the band of light: it lands."
  }
}

export type FirstNoteDemoPlan = DemoTimeline<DemoCueId, FirstNoteDemoTake> & {
  /**
   * The singer's first note as the band plays it, in the song's own tuning:
   * the note both takes come in on, or under, and the voice is sung from.
   */
  readonly note: number
}

/**
 * The whole demo on one wall clock, as the script plays it. The demo sings
 * its own song's entry, whatever note the room would give it.
 */
export function planFirstNoteDemo(): FirstNoteDemoPlan {
  const off = demoTake('off')
  const on = demoTake('on')
  return {
    note: entryPitch(off.round.entry),
    ...planDemo('First note', { off, on }, DEMO_CUES, DEMO_BEATS),
  }
}
