// ============================================================
// The Lip roll demo's beats, tooltips and words
// ============================================================
//
// Every tooltip waits for the engine event it explains (DESIGN-lip-roll.md
// 4): take 1's first `offPath`, Merc stopping short ("the top stays
// dark"), and its `break` ("the light stops"); take 2's `onPath` ("ride it
// all the way"), its `top` ("turn at the top") and its `archEnd`, the
// wave lit ("your score").
//
// Each stays up at least TIP_READ_SECONDS before the next replaces it or
// the take moves on (demo-script.test.ts holds the plan to it), and each
// take's moment happens while its tooltip is up: the top passes dark, the
// buzz is still silent, the voice turns at the top. The demo kit's driver
// (useExerciseDemo.ts, through useLipDemo.ts) keys them to the events the
// room really fires, each on the first time it comes; `planLipDemo` lays
// the same table out on the script's own replay, which is what the tests
// check and what the progress bar runs on.

import type { DemoCue as KitDemoCue, DemoMark as KitDemoMark, DemoTimeline, } from '@/components/demo-kit/demo-plan'
import { planDemo } from '@/components/demo-kit/demo-plan'
import type { LipDemoMark, LipDemoTake } from './demo-script'
import { demoTake } from './demo-script'

/**
 * What a tooltip points at: the wave's top, the water just sung behind the
 * voice (the light, the break), the whole wave, the mic.
 */
export type DemoTarget = 'top' | 'voice' | 'wave' | 'mic'

export type DemoCueId = 'short' | 'break' | 'ride' | 'turn' | 'score'

export type DemoMark = KitDemoMark<LipDemoMark>

export type DemoCue = KitDemoCue<DemoCueId, LipDemoMark, DemoTarget>

/** The least time a tooltip stays up, s: Echo's and Ng slides' rule. */
export const TIP_READ_SECONDS = 1.8

/** One tooltip at a time; each stays until the next beat clears it. */
export const DEMO_CUES: readonly DemoCue[] = [
  // Merc has stopped short and the crest has left him: the top ahead stays
  // dark as it passes.
  {
    id: 'short',
    trigger: { take: 'off', mark: 'offPath' },
    delay: 0.15,
    target: 'top',
  },
  // The buzz stops on the way down, and the light with it, behind Merc.
  // Up while the buzz is still silent.
  {
    id: 'break',
    trigger: { take: 'off', mark: 'break' },
    delay: 0.05,
    target: 'voice',
  },
  // Take 2 lights from its first moment. It points at the wave he rides:
  // the water behind him is still a sliver, and he climbs into the sky
  // over it while the tooltip is up. The whole wave, not its top: the
  // arrow is aimed once, and the camera carries the top a quarter of the
  // screen to the left before it stands, so an arrow on the top would be
  // left pointing at the sky.
  {
    id: 'ride',
    trigger: { take: 'on', mark: 'onPath' },
    delay: 0.15,
    target: 'wave',
  },
  // The top reached; up before the voice turns for home.
  {
    id: 'turn',
    trigger: { take: 'on', mark: 'top' },
    delay: 0.1,
    target: 'top',
  },
  {
    id: 'score',
    trigger: { take: 'on', mark: 'archEnd' },
    delay: 0.3,
    target: 'wave',
  },
]

/** The beats between the takes, wall seconds: Ng slides' own. */
export const DEMO_BEATS = {
  /** Merc's "Watch me first", before take 1. */
  intro: 0.9,
  /** From a take's start to its clock's zero: the sound's head start. */
  lead: 0.12,
  /** Take 1's end to the reset: the dark top, and the break's read. */
  afterOff: 1.6,
  /** The bay empties and the pill turns. */
  reset: 0.5,
  /** Take 2's end to the end card: the lit wave, and the score's read. */
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
    case 'short':
      return 'Stop short and the top stays dark.'
    case 'break':
      return 'When the sound stops, the light stops.'
    case 'ride':
      return 'Ride it all the way up and back.'
    case 'turn':
      return 'Turn at the top.'
    case 'score':
      return 'Your score is how much of the bay you light.'
  }
}

export type LipDemoPlan = DemoTimeline<DemoCueId, LipDemoTake> & {
  readonly note: number
}

/** The whole demo on one wall clock, as the script plays it. */
export function planLipDemo(root: number): LipDemoPlan {
  const off = demoTake('off', root)
  const on = demoTake('on', root)
  return {
    note: root,
    ...planDemo('Lip roll', { off, on }, DEMO_CUES, DEMO_BEATS),
  }
}
