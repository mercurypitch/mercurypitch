// ============================================================
// The Long note demo's beats, tooltips and words
// ============================================================
//
// Every tooltip waits for the engine event it explains: "it stops filling"
// for take 1's break, "the note is over" for its end, "the top fills by how
// steady you sing" for take 2's goal, and so on. The demo kit's driver
// (useExerciseDemo.ts, through useLongNoteDemo.ts) keys them to the events
// the room's engine really fires, each on the first time its event or mark
// comes; `planLongNoteDemo` lays the same table out on the script's own
// replay, which is what the tests check and what the progress bar runs on.

import type { DemoCue as KitDemoCue, DemoMark as KitDemoMark, DemoTimeline, } from '@/components/demo-kit/demo-plan'
import { demoMarkAt, planDemo } from '@/components/demo-kit/demo-plan'
import { DEMO_WORDS } from '@/components/demo-kit/demo-words'
import type { HoldEventType } from '@/lib/hold/hold-engine'
import type { DemoTake } from './demo-script'
import { demoTake } from './demo-script'

/**
 * What a tooltip points at: the target line, the light's surface, halfway
 * up the chimney (where the goal fills it), the top of the chimney (where
 * the brim is), the timer, the steadiness, the mic.
 */
export type DemoTarget =
  | 'line'
  | 'lantern'
  | 'half'
  | 'brim'
  | 'timer'
  | 'score'
  | 'mic'

export type DemoCueId =
  | 'line'
  | 'stops'
  | 'breath'
  | 'fills'
  | 'twelve'
  | 'steady'
  | 'score'

/**
 * A take's engine event, or `fast` and `slow`: one of take 2's
 * fast-forwards beginning and ending.
 */
export type DemoMark = KitDemoMark<HoldEventType>

export type DemoCue = KitDemoCue<DemoCueId, HoldEventType, DemoTarget>

/** One tooltip at a time; each stays until the next beat clears it. */
export const DEMO_CUES: readonly DemoCue[] = [
  { id: 'line', trigger: { take: 'intro' }, delay: 0.3, target: 'line' },
  {
    id: 'stops',
    trigger: { take: 'off', mark: 'break' },
    delay: 0.3,
    target: 'lantern',
  },
  {
    id: 'breath',
    trigger: { take: 'off', mark: 'end' },
    delay: 0.15,
    target: 'timer',
  },
  {
    id: 'fills',
    trigger: { take: 'on', mark: 'lock' },
    delay: 0.45,
    target: 'lantern',
  },
  {
    id: 'twelve',
    trigger: { take: 'on', mark: 'fast' },
    delay: 0.2,
    target: 'half',
  },
  // While Merc steps out of the glass, before the steady stretch's 4x.
  {
    id: 'steady',
    trigger: { take: 'on', mark: 'goal' },
    delay: 0.3,
    target: 'brim',
  },
  {
    id: 'score',
    trigger: { take: 'on', mark: 'end' },
    delay: 0.5,
    target: 'score',
  },
]

/** The beats between the takes, wall seconds. */
export const DEMO_BEATS = {
  /** The line and its note, before take 1. */
  intro: 1.6,
  /** From a take's start to its clock's zero: the sound's head start. */
  lead: 0.12,
  /** Take 1's end to the reset. */
  afterOff: 1.7,
  /** The light empties and the pill turns. */
  reset: 0.8,
  /** Take 2's end (the result) to the end card. */
  afterOn: 2.2,
} as const

/**
 * The demo's words: the kit's (demo-kit demo-words.ts), with the pill's
 * fast-forward and a mic hint of the room's own. No em dashes;
 * "practice", never "practise".
 */
export const DEMO_COPY = {
  ...DEMO_WORDS,
  fast: '4x',
  fastLabel: 'Four times faster',
  micHint: 'Tap the mic, then hold your note.',
} as const

/** A tooltip's words. `own` is false when the room has no note yet. */
export function demoCueText(id: DemoCueId, note: string, own: boolean): string {
  switch (id) {
    case 'line':
      return own
        ? `This line is your note: ${note}.`
        : `This line is the note: ${note}.`
    case 'stops':
      return 'Off the line, it stops filling.'
    // One line: under the timer it clears the lantern's handle at 360 px.
    case 'breath':
      return 'A breath ends the note.'
    case 'fills':
      return 'Stay on the line and it keeps filling.'
    case 'twelve':
      return '12 seconds on the line fill it halfway.'
    case 'steady':
      return 'Then the top fills by how steady you sing.'
    case 'score':
      return 'Steadier holds score higher.'
  }
}

export interface LongNoteDemoPlan extends DemoTimeline<DemoCueId, DemoTake> {
  readonly note: number
  /** When take 2's lantern is half full, at the goal. */
  readonly goal: number
  /** When take 2's lantern is full to the brim. */
  readonly brim: number
}

/** The whole demo on one wall clock, as the script plays it. */
export function planLongNoteDemo(note: number): LongNoteDemoPlan {
  const off = demoTake('off', note)
  const on = demoTake('on', note)
  const timeline = planDemo('Long note', { off, on }, DEMO_CUES, DEMO_BEATS)
  const onStart = timeline.takeStart.on
  const goal = demoMarkAt(on, 'goal') ?? on.length
  const brim = demoMarkAt(on, 'brim') ?? on.length
  return {
    note,
    ...timeline,
    goal: onStart + on.wallAt(goal),
    brim: onStart + on.wallAt(brim),
  }
}
