// ============================================================
// enterStop: one way into a stop of the plan
// ============================================================
//
// A stop is a room: a tab of the app, or a page of its own. The plan layer and
// Home's card open one the same way, so there is one copy of how: a tab is
// switched to, a page is navigated to, and the room's spotlight tour starts
// only when the person asked for it ("Show me around") and the room has one.
// A page is not the app, so a tour cannot spotlight it, and none is started
// for it.
//
// First Light keeps a path of its own (goTo, in FirstLight.tsx): its stops
// have to close the flow as well, so that Back from a page does not land
// inside onboarding.

import { hasPageTour, startPageTour } from '@/stores/app-store'
import { setActiveTab } from '@/stores/ui-store'
import type { PlanStop } from './build-plan'
import { PLAN_DESTS } from './build-plan'

/**
 * Opens a stop's room. `tour` asks for the room's spotlight tour as well; a
 * room without one is simply entered.
 */
export function enterStop(stop: PlanStop, tour = false): void {
  const { target } = PLAN_DESTS[stop.dest]
  if (target.kind === 'page') {
    window.location.href = target.href
    return
  }
  setActiveTab(target.tab)
  if (tour && hasPageTour(target.tab)) startPageTour(target.tab)
}
