// ============================================================
// startRoomTour — a tab's tour, whichever kind it has
// ============================================================
//
// The one way the app starts a tab's tour: its Merc tour where it has one
// (COACH_TOURS), else its legacy spotlight tour. The tour chip, the plan's
// Start here after the showcase (enterStop) and First Light's Map all start
// tours through it, so a tab never gets the old tour from one door and Merc's
// from another.
//
// A Merc tour is named in coachActive() from this call, while its code loads,
// so an offer that comes due in the meantime (a pause lifting as First Light
// or the showcase leaves) waits for it rather than landing on it. Ended while
// it loads (a tab change, the legacy spotlight starting), it never shows.

import { coachActive, setCoachActive } from '@/lib/coach-state'
import { isNarrow } from '@/lib/use-viewport'
import { hasPageTour, startPageTour } from '@/stores'
import type { ActiveTab } from '@/types'
import { COACH_TOURS } from './coach-tours'

const importCoach = () => import('./coach/start')
let coach: ReturnType<typeof importCoach> | null = null

/**
 * The coach's start (start.ts), loaded with the first Merc tour: one import
 * for every ask, and a failed one is tried again by the next.
 */
function loadCoach(): ReturnType<typeof importCoach> {
  coach ??= importCoach().catch((error: unknown) => {
    coach = null
    throw error
  })
  return coach
}

let pending: object | null = null

/**
 * Starts `tab`'s tour. `still` says, once a Merc tour has loaded, whether it
 * is still wanted (the chip asks whether its tab is still on screen). False
 * when the tab has no tour of either kind.
 */
export function startRoomTour(
  tab: ActiveTab,
  still: () => boolean = () => true,
): boolean {
  const entry = COACH_TOURS[tab]
  if (entry === undefined) {
    if (!hasPageTour(tab)) return false
    startPageTour(tab)
    return true
  }
  const mine = {}
  pending = mine
  setCoachActive(entry.key)
  // Only the latest ask may let go of coachActive: a newer one owns it.
  const letGo = (): void => {
    if (pending !== mine) return
    pending = null
    if (coachActive() === entry.key) setCoachActive(null)
  }
  Promise.all([entry.load(), loadCoach()])
    .then(([tour, start]) => {
      // Ended (coachActive cleared), no longer wanted, or asked for again.
      if (pending !== mine) return
      if (coachActive() !== entry.key || !still()) {
        letGo()
        return
      }
      pending = null
      return start.startCoachTour(tour, { phone: isNarrow() })
    })
    // A chunk that did not arrive starts nothing, and the page stays as it was.
    .catch(letGo)
  return true
}
