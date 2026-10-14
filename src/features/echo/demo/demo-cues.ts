// ============================================================
// The Echo demo's beats, tooltips and words
// ============================================================
//
// Every tooltip waits for the moment it explains: "I sing first" for the
// call, "wait for my last note" for the voice coming in over it, "flat"
// and "slid" for take 1's two misses, "its star lights" for take 2's first
// landing, "joins the sky" for its phrase ending, and the score for its
// result. The demo kit's driver (useExerciseDemo.ts, through
// useEchoDemo.ts) keys them to the moments the room really reaches, each
// on the first time it comes; `planEchoDemo` lays the same table out on
// the script's own replay, which is what the tests check and what the
// progress bar runs on.

import type { DemoCue as KitDemoCue, DemoMark as KitDemoMark, DemoTimeline, } from '@/components/demo-kit/demo-plan'
import { planDemo } from '@/components/demo-kit/demo-plan'
import type { EchoDemoMark, EchoDemoTake } from './demo-script'
import { demoTake } from './demo-script'

/**
 * What a tooltip points at: the call's rings, Merc, one ring of the
 * phrase (by note), the first star, the phrase's constellation, the
 * result's score, the mic.
 */
export type DemoTarget =
  | 'rings'
  | 'merc'
  | 'ring:1'
  | 'ring:2'
  | 'star:0'
  | 'phrase'
  | 'score'
  | 'mic'

export type DemoCueId =
  | 'call'
  | 'early'
  | 'flat'
  | 'slid'
  | 'lands'
  | 'joins'
  | 'score'

export type DemoMark = KitDemoMark<EchoDemoMark>

export type DemoCue = KitDemoCue<DemoCueId, EchoDemoMark, DemoTarget>

/** One tooltip at a time; each stays until the next beat clears it. */
export const DEMO_CUES: readonly DemoCue[] = [
  // Once the first two rings have come in with Merc's notes.
  {
    id: 'call',
    trigger: { take: 'off', mark: 'call' },
    delay: 1.0,
    target: 'rings',
  },
  {
    id: 'early',
    trigger: { take: 'off', mark: 'early' },
    delay: 0.1,
    target: 'merc',
  },
  {
    id: 'flat',
    trigger: { take: 'off', mark: 'miss:1' },
    delay: 0.2,
    target: 'ring:1',
  },
  {
    id: 'slid',
    trigger: { take: 'off', mark: 'miss:2' },
    delay: 0.15,
    target: 'ring:2',
  },
  {
    id: 'lands',
    trigger: { take: 'on', mark: 'land:0' },
    delay: 0.15,
    target: 'star:0',
  },
  {
    id: 'joins',
    trigger: { take: 'on', mark: 'phraseEnd' },
    delay: 0.3,
    target: 'phrase',
  },
  {
    id: 'score',
    trigger: { take: 'on', mark: 'result' },
    delay: 0.35,
    target: 'score',
  },
]

/** The beats between the takes, wall seconds. */
export const DEMO_BEATS = {
  /** Merc's "Watch me first", before take 1. */
  intro: 0.9,
  /** From a take's start to its clock's zero: the sound's head start. */
  lead: 0.12,
  /** Take 1's end to the reset: the "slid" tooltip's read. */
  afterOff: 1.6,
  /** The sky empties and the pill turns. */
  reset: 0.5,
  /** Take 2's end to the end card: its constellation (1.2 s), then the result. */
  afterOn: 3.0,
} as const

/** The demo's words. No em dashes; "practice", never "practise". */
export const DEMO_COPY = {
  watch: 'Watch me first.',
  off: 'Not like this',
  on: 'Like this',
  fast: '4x',
  fastLabel: 'Four times faster',
  skip: 'Skip',
  ask: 'How it works',
  cardTitle: 'See how it works',
  cardLine: 'Merc sings it first. Turn your sound on.',
  watchButton: 'Watch',
  notNow: 'Not now',
  endTitle: 'Your turn',
  tryIt: 'Try it',
  again: 'Watch again',
  // Merc's own line says what comes first: his phrase, or the singer's
  // easy note when the room has no root yet.
  micHint: 'Tap the mic to start.',
} as const

/** A tooltip's words: what the voice did, and what to do about it. */
export function demoCueText(id: DemoCueId): string {
  switch (id) {
    case 'call':
      return 'I sing the phrase first. Each ring is one note.'
    case 'early':
      return 'Too early. Wait for my last note.'
    case 'flat':
      return 'Flat, so its star stays dark. Sing it a little higher.'
    case 'slid':
      return 'Slid past it, so no star. Stop on each note.'
    case 'lands':
      return 'On the note: its star lights.'
    case 'joins':
      return 'Every note landed. The phrase joins the sky.'
    case 'score':
      return 'Each note you land counts.'
  }
}

export type EchoDemoPlan = DemoTimeline<DemoCueId, EchoDemoTake> & {
  readonly note: number
}

/** The whole demo on one wall clock, as the script plays it. */
export function planEchoDemo(root: number): EchoDemoPlan {
  const off = demoTake('off', root)
  const on = demoTake('on', root)
  return {
    note: root,
    ...planDemo('Echo', { off, on }, DEMO_CUES, DEMO_BEATS),
  }
}
