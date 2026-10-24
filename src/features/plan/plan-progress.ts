// ============================================================
// Plan progress — when Home's card shows, and which stops it ticks
// ============================================================
//
// Home's card is the plan's way back to a person in their first week: the
// stops of the plan they answered, with a tick on the ones they have done, or,
// for someone who skipped the questions or turned them down, an invitation to
// answer them. This file decides which of the two, if either, and what a tick
// is made of. The card (HomePlanCard.tsx) draws what it says, and Plan 1B's
// hand-off asks it for the next stop.
//
// Three things are easy to break:
//
// - A stop is done by what its room gave the person, not by their having
//   looked in. A room with a first value (src/lib/first-value.ts: a saved
//   run, a scored song, a finished drill) is done when it has one, and opening
//   it from the plan ticks nothing. Only a room that has no first value (Jam,
//   the two lessons, Hear Yourself) is done by being opened from the plan,
//   because an opening is all it has to go on. The rules are a Record over
//   every destination (DONE_WHEN, in plan-card-rules.ts, which Home reads
//   before this file is loaded), so a destination added to the plan fails to
//   compile there until it says what finishes it. `stopDone` is reactive in
//   the opened stops only: the first values are read from the device as it is
//   asked, and a room that gives one is a room the person is in, which is not
//   Home.
// - The week is counted from the record's own date (`at`), for the plan and
//   for the ask alike, and it cannot run on for good. A date that does not read
//   gives no card. Neither does one more than a week ahead of the clock (a
//   device whose clock was wrong when it wrote the record), which would
//   otherwise hold the card until the clock caught up. A date a little ahead
//   is inside the week, as two devices that share a record never quite agree.
//   That rule, and which card a record asks for, are plan-card-rules.ts's:
//   Home reads them there before this file is loaded, to keep a slot for the
//   card, so they are written once, there.
// - The plan is rebuilt, never stored. The record keeps the answers and where
//   a voiceprint pointed, and buildPlan makes the rows from them for the menu
//   the person has now, so they are the rows the plan screen gave them except
//   that a room the menu hides gets none. The clock, the menu and the way to
//   tell a stop is done are all arguments, so each rule is tried on its own.

import type { Plan, PlanDest, PlanStop, PlanView } from './build-plan'
import { buildPlan, planStops } from './build-plan'
import { planCardKind, stopDoneBy } from './plan-card-rules'
import type { PlanRecordV1 } from './plan-record'
import { stopOpened } from './plan-store'

/**
 * Is this stop done: its room has given a first value, or, for a room with
 * none, it was opened. What finishes each stop is plan-card-rules.ts's
 * (DONE_WHEN); the stops opened are the store's, so this is reactive in them.
 */
export function stopDone(dest: PlanDest): boolean {
  return stopDoneBy(dest, stopOpened)
}

/** What Home's card shows: the plan's stops and which are done, the ask for the four questions, or nothing. */
export type HomePlanCardState =
  | { kind: 'plan'; stops: { stop: PlanStop; done: boolean }[] }
  | { kind: 'ask' }
  | null

interface HomePlanCardInput {
  /** The plan record, or null when there is none. */
  record: PlanRecordV1 | null
  /** Has the person hidden the card? */
  dismissed: boolean
  /** The clock, as epoch milliseconds. */
  now: number
  /** The menu the person has now; a whole menu when it is left out. */
  view?: PlanView
  /** Is this stop done? Reads the rooms and the stops opened when it is left out. */
  done?: (d: PlanDest) => boolean
}

/** The rows of an answered plan, rebuilt from what the record kept. */
function rowsOf(
  record: PlanRecordV1,
  view: PlanView | undefined,
  done: (d: PlanDest) => boolean,
): { stop: PlanStop; done: boolean }[] {
  const plan = buildPlan(record.choices, {
    voiceprint: record.voiceprint,
    view,
  })
  return planStops(plan).map((stop) => ({ stop, done: done(stop.dest) }))
}

/**
 * What Home's card shows. Which card, if either, is the week's rule
 * (planCardKind, in plan-card-rules.ts, which Home reads before this file
 * is loaded): nothing for a card that was hidden or a record out of its week,
 * the ask for a record that is shown or declined, the plan for an answered
 * one. The plan is shown only while a stop of it is not done.
 */
export function homePlanCardState(i: HomePlanCardInput): HomePlanCardState {
  const { record } = i
  const kind = planCardKind(i)
  if (kind === null || record === null) return null
  if (kind === 'ask') return { kind: 'ask' }
  const stops = rowsOf(record, i.view, i.done ?? stopDone)
  return stops.every((row) => row.done) ? null : { kind: 'plan', stops }
}

/** The first stop of the plan not yet done, in the order Start here, Learn, Play; null when all are. */
export function nextPlanStop(
  plan: Plan,
  done: (d: PlanDest) => boolean = stopDone,
): PlanStop | null {
  return planStops(plan).find((stop) => !done(stop.dest)) ?? null
}
