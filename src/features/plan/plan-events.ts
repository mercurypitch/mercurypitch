// ============================================================
// Plan events — what the funnel is told about the questions and the plan
// ============================================================
//
// One event name for every option, because these events carry no metrics:
// which answer it was has to be in the name (`plan_q3_time`), the precedent
// the Map's doors set. The answers are reported once, when the flow ends,
// so Back and a changed pick never count twice. A question passed with
// nothing picked is named too (`plan_skipped_q2`), so an answer that is
// missing from a report is never mistaken for an event that was not sent.
//
// Two things are easy to break:
//
// - Every name is typed GuideFunnelEvent, which is the list in
//   src/lib/funnel-event-catalog.ts. A name built from an id the catalog
//   lacks is a type error here, and allPlanEventNames, read from the
//   questions, is held to that list by plan-events.test.ts. The catalog
//   cannot import this file (the worker imports the catalog), so it spells
//   the names out and this is where the two meet.
// - Nothing typed by the person is in an event. The names carry ids only.
//
// This file is pure: it imports no store.

import type { GuideFunnelEvent } from '@/lib/funnel-event-catalog'
import { PLAN_IDS } from './plan-record'
import type { PlanChoices, QuestionId } from './questions'

/** The questions in the order they are asked. */
const QUESTIONS: readonly QuestionId[] = ['q1', 'q2', 'q3', 'q4']

/** The names the flow sends besides the answers. */
const FLOW_EVENTS: readonly GuideFunnelEvent[] = [
  'plan_shown_new',
  'plan_shown_existing',
  'plan_shown_skipper',
  'plan_skipped_q1',
  'plan_skipped_q2',
  'plan_skipped_q3',
  'plan_skipped_q4',
  'plan_declined_q1',
  'plan_declined_q2',
  'plan_declined_q3',
  'plan_declined_q4',
  'plan_skipped_plan',
  'plan_done',
  'plan_rooms',
  'plan_stop_start',
  'plan_stop_learn',
  'plan_stop_play',
  'scope_offer_accept',
  'showcase_done',
  'showcase_skipped',
]

/** One question as it is reported: each pick in the order tapped, or that it was passed. */
const ANSWER_EVENTS: Record<
  QuestionId,
  (c: PlanChoices) => GuideFunnelEvent[]
> = {
  q1: (c) => [c.q1 === null ? 'plan_skipped_q1' : `plan_q1_${c.q1}`],
  q2: (c) => [c.q2 === null ? 'plan_skipped_q2' : `plan_q2_${c.q2}`],
  q3: (c) =>
    c.q3.length === 0
      ? ['plan_skipped_q3']
      : c.q3.map((id): GuideFunnelEvent => `plan_q3_${id}`),
  q4: (c) =>
    c.q4.length === 0
      ? ['plan_skipped_q4']
      : c.q4.map((id): GuideFunnelEvent => `plan_q4_${id}`),
}

/**
 * What a finished plan reports, picks and skips together in the order the
 * questions were asked, then `plan_done`. Q3 and Q4 picks are in the order
 * they were tapped. The choices are read as they are given, so the caller
 * passes them as the questions settled them.
 */
export function planDoneEvents(c: PlanChoices): GuideFunnelEvent[] {
  return [...QUESTIONS.flatMap((q) => ANSWER_EVENTS[q](c)), 'plan_done']
}

/**
 * What Not now reports on question `on`: each question before it as
 * planDoneEvents reports it, then `plan_declined_<on>`. The question it came
 * on is not reported as an answer, whatever was picked on it.
 */
export function planDeclinedEvents(
  c: PlanChoices,
  on: QuestionId,
): GuideFunnelEvent[] {
  const before = QUESTIONS.slice(0, QUESTIONS.indexOf(on))
  return [...before.flatMap((q) => ANSWER_EVENTS[q](c)), `plan_declined_${on}`]
}

/**
 * Every name the questions and the flow can send: an answer for each option
 * of every column, then the flow's own. The catalog lists the same names.
 */
export function allPlanEventNames(): string[] {
  return [
    ...PLAN_IDS.q1.map((id): GuideFunnelEvent => `plan_q1_${id}`),
    ...PLAN_IDS.q2.map((id): GuideFunnelEvent => `plan_q2_${id}`),
    ...PLAN_IDS.q3.map((id): GuideFunnelEvent => `plan_q3_${id}`),
    ...PLAN_IDS.q4.map((id): GuideFunnelEvent => `plan_q4_${id}`),
    ...FLOW_EVENTS,
  ]
}
