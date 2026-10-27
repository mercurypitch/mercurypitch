// ============================================================
// planHandoff — what a finished Merc tour offers next: the plan's next stop
// ============================================================
//
// When a tab's Merc tour is done, the bubble can offer one thing more: "Next
// on your plan", with Go and Later. This is where that offer comes from. App
// hands `tabHandoff` to the tours (room-tour.ts, provideTourHandoff), which
// load this file with a tour, so it is in no first paint and not in the native
// build at all.
//
// - Which stop. The plan's first stop not done yet, in the order Start here,
//   Learn, Play, and never the room the tour just showed: someone who has just
//   been shown Sing is not sent back to Sing.
// - Which plan. Home's card's (homePlanCardState): rebuilt from the record with
//   the voiceprint it kept and the menu as it stands, so a room the menu hides
//   never gets a stop (R19), and offered only while that card would show it.
//   A plan out of its week, or hidden on this device (the store's
//   planCardHidden, which the card and Settings read too), offers nothing, nor
//   does a record that holds no answers.
// - Go opens the stop as a row of Home's card does: the funnel is told, the
//   stop marked opened, the menu made whole if it lacks the stop's room, and
//   the stop entered, with no tour (a tour is what "Show me around" asks for).
//   Today's session is the exception, as it is on the card: Go only opens
//   Home, whose card begins the session and tells the funnel then.

import { untrack } from 'solid-js'
import type { CoachHandoff } from '@/lib/coach-types'
import { trackGuide } from '@/lib/guide-funnel'
import { practiceScope, uiMode } from '@/stores/settings-store'
import type { ActiveTab } from '@/types'
import type { PlanDest, PlanStop, PlanView } from './build-plan'
import { PLAN_DESTS } from './build-plan'
import { enterStop, widenMenuFor } from './enter-stop'
import { homePlanCardState } from './plan-progress'
import { markStopOpened, planCardHidden, planRecord } from './plan-store'

/** Opens a stop as a row of Home's card does. */
function openStop(stop: PlanStop): void {
  if (stop.dest !== 'homeSession') {
    trackGuide(`plan_stop_${stop.kind}`)
    markStopOpened(stop.dest)
    widenMenuFor(stop)
  }
  enterStop(stop)
}

/**
 * The plan's next stop, as the end of a tour offers it: null without an
 * answered plan Home would show, or with no stop left but `current`.
 */
export function planHandoff(
  current: PlanDest | null,
  view: PlanView,
): CoachHandoff | null {
  const state = homePlanCardState({
    record: untrack(planRecord),
    dismissed: untrack(planCardHidden),
    now: Date.now(),
    view,
  })
  if (state?.kind !== 'plan') return null
  const next = state.stops.find(
    (row) => !row.done && row.stop.dest !== current,
  )?.stop
  if (next === undefined) return null
  return {
    title: 'Next on your plan',
    body: `${PLAN_DESTS[next.dest].room}: ${next.title}`,
    go: () => openStop(next),
  }
}

/** The plan's name for a tab's room, when a stop can go there. */
function destOf(tab: ActiveTab): PlanDest | null {
  for (const [dest, { target }] of Object.entries(PLAN_DESTS)) {
    if (target.kind === 'tab' && target.tab === tab) return dest as PlanDest
  }
  return null
}

/** What `tab`'s finished Merc tour offers next, read with the menu as it stands. */
export function tabHandoff(tab: ActiveTab): CoachHandoff | null {
  return planHandoff(destOf(tab), {
    scope: untrack(practiceScope),
    mode: untrack(uiMode),
  })
}
