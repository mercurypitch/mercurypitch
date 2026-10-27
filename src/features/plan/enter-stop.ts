// ============================================================
// enterStop and widenMenuFor: the two things a way into a stop does
// ============================================================
//
// A stop is a room: a tab of the app, or a page of its own. The plan layer,
// Home's card and the showcase's end open one the same way, so there is one
// copy of how: a tab is switched to, a page is navigated to, and the room's
// tour starts only when the person asked for it ("Show me around", whose
// showcase ends here) and the room has one. A tab's tour is its Merc tour
// where it has one, else its legacy spotlight tour, or for Singing, which
// never had one, the Guide's Singing section: the tours decide
// (startRoomTour), and the plan starts one through the room tour door
// (src/lib/room-tour-door.ts) rather than importing them. Of the pages,
// Karaoke Night runs a Merc tour of its own, opened by its address
// (`?tour=first`); the other pages have none and open plainly.
//
// Before that, a menu that hides the stop's room is made whole, and the person
// is told. That is `widenMenuFor`, a function of its own and not a part of
// `enterStop`, for two reasons: the plan layer must make the menu whole before
// its host hears of the stop (the controller calls it, then exits), and First
// Light's path bypasses enterStop altogether.
//
// First Light keeps a path of its own for a tapped card (goTo, in
// FirstLight.tsx): its stops have to close the flow as well, so that Back
// from a page does not land inside onboarding. Its "Show me around" leaves
// the flow before the showcase, which then ends here.

import { untrack } from 'solid-js'
import { isTabVisible } from '@/features/tabs/constants'
import { startTabTour } from '@/lib/room-tour-door'
import { showNotification } from '@/stores/notifications-store'
import { practiceScope, setPracticeScope, uiMode, } from '@/stores/settings-store'
import { setActiveTab } from '@/stores/ui-store'
import type { PlanStop } from './build-plan'
import { PLAN_DESTS } from './build-plan'
import { MENU_WHOLE } from './plan-copy'

/** The scope hides this stop's tab, and a whole menu would show it. */
function hiddenByScope(stop: PlanStop): boolean {
  const { target } = PLAN_DESTS[stop.dest]
  if (target.kind !== 'tab') return false
  const mode = untrack(uiMode)
  return (
    !isTabVisible(target.tab, untrack(practiceScope), mode) &&
    isTabVisible(target.tab, 'all', mode)
  )
}

/**
 * Makes the menu whole, and says so, when it hides the stop's room and a whole
 * menu would show it. A page is no room of the menu, and a room that only
 * Simple mode hides stays hidden whatever the scope, so neither is blamed on
 * the scope: the menu is left as it is and nothing is said. It goes nowhere
 * itself; the stop is for `enterStop` to open.
 */
export function widenMenuFor(stop: PlanStop): void {
  if (!hiddenByScope(stop)) return
  setPracticeScope('all')
  showNotification(MENU_WHOLE)
}

/** Karaoke Night's address for its first-visit tour, which it reads and strips. */
export const KARAOKE_TOUR_SEARCH = '?tour=first'

/**
 * Opens a stop's room. `tour` asks for the room's tour as well; a room
 * without one is simply entered.
 */
export function enterStop(stop: PlanStop, tour = false): void {
  const { target } = PLAN_DESTS[stop.dest]
  if (target.kind === 'page') {
    const toured = tour && stop.dest === 'karaokeNight'
    window.location.href = toured
      ? `${target.href}${KARAOKE_TOUR_SEARCH}`
      : target.href
    return
  }
  setActiveTab(target.tab)
  if (tour) startTabTour(target.tab)
}
