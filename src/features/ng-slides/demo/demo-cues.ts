// ============================================================
// The Ng slides demo's beats, tooltips and words
// ============================================================
//
// Every tooltip waits for the engine event it explains (DESIGN-ng-slides.md
// 4): take 1's first `jump` ("leaves gaps") and its `break` ("the light
// stops"); take 2's `onPath` ("it lights"), its `top` ("turn at the top")
// and its `archEnd`, the arch lit ("your score").
//
// Each stays up at least TIP_READ_SECONDS before the next replaces it or
// the take moves on (demo-script.test.ts holds the plan to it). The demo
// kit's driver (useExerciseDemo.ts, through useNgDemo.ts) keys them to the
// events the room really fires, each on the first time it comes;
// `planNgDemo` lays the same table out on the script's own replay, which
// is what the tests check and what the progress bar runs on.

import type { DemoCue as KitDemoCue, DemoMark as KitDemoMark, DemoTimeline, } from '@/components/demo-kit/demo-plan'
import { planDemo } from '@/components/demo-kit/demo-plan'
import type { NgDemoMark, NgDemoTake } from './demo-script'
import { demoTake } from './demo-script'

/**
 * What a tooltip points at: the glass sung so far (the gaps, the break,
 * the light), the arch's top, the whole arch, the mic.
 */
export type DemoTarget = 'sung' | 'playhead' | 'top' | 'arch' | 'mic'

export type DemoCueId = 'jump' | 'break' | 'lights' | 'turn' | 'score'

export type DemoMark = KitDemoMark<NgDemoMark>

export type DemoCue = KitDemoCue<DemoCueId, NgDemoMark, DemoTarget>

/** The least time a tooltip stays up, s: two short lines, read aloud. */
export const TIP_READ_SECONDS = 1.8

/** One tooltip at a time; each stays until the next beat clears it. */
export const DEMO_CUES: readonly DemoCue[] = [
  // The first step: the glass behind Merc has gone dark between two notes.
  {
    id: 'jump',
    trigger: { take: 'off', mark: 'jump' },
    delay: 0.1,
    target: 'sung',
  },
  // The hum stops on the way down, and the light with it, at Merc's feet.
  {
    id: 'break',
    trigger: { take: 'off', mark: 'break' },
    delay: 0.15,
    target: 'playhead',
  },
  // Take 2 lights from its first note; once a little glass has lit.
  {
    id: 'lights',
    trigger: { take: 'on', mark: 'onPath' },
    delay: 0.15,
    target: 'playhead',
  },
  // The top note reached; read as the voice turns for home.
  {
    id: 'turn',
    trigger: { take: 'on', mark: 'top' },
    delay: 0.4,
    target: 'top',
  },
  {
    id: 'score',
    trigger: { take: 'on', mark: 'archEnd' },
    delay: 0.3,
    target: 'arch',
  },
]

/** The beats between the takes, wall seconds. */
export const DEMO_BEATS = {
  /** Merc's "Watch me first", before take 1. */
  intro: 0.9,
  /** From a take's start to its clock's zero: the sound's head start. */
  lead: 0.12,
  /** Take 1's end to the reset: the dark arch, and the break's read. */
  afterOff: 1.6,
  /** The bridge empties and the pill turns. */
  reset: 0.5,
  /** Take 2's end to the end card: the lit arch, and the score's read. */
  afterOn: 2.4,
} as const

/** The demo's words. No em dashes; "practice", never "practise". */
export const DEMO_COPY = {
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

/** A tooltip's words: what the voice did, and what it does to the light. */
export function demoCueText(id: DemoCueId): string {
  switch (id) {
    case 'jump':
      return 'Jumping note to note leaves gaps.'
    case 'break':
      return 'When the hum stops, the light stops.'
    case 'lights':
      return 'Slide through every note and it lights.'
    case 'turn':
      return 'Turn at the top note.'
    case 'score':
      return 'Your score is how much of the bridge you light.'
  }
}

export type NgDemoPlan = DemoTimeline<DemoCueId, NgDemoTake> & {
  readonly note: number
}

/** The whole demo on one wall clock, as the script plays it. */
export function planNgDemo(root: number): NgDemoPlan {
  const off = demoTake('off', root)
  const on = demoTake('on', root)
  return {
    note: root,
    ...planDemo('Ng slides', { off, on }, DEMO_CUES, DEMO_BEATS),
  }
}
