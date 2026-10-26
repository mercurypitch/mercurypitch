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
//
// Two more things every door gets here:
//
// - A tour that starts spends its tab's offer, so the chip never offers a
//   tour that was just shown (the showcase hands over to Start here's tour,
//   and the chip's offer would come due the moment Merc lets go). A Merc
//   tour spends it once the coach has it on screen: one whose coach did not
//   load leaves the offer for the next visit, and tells whoever asked
//   (`failed`), so the chip can hand back the offer it spent as it showed.
// - A finished Merc tour offers what comes next, as the app names it: the
//   plan's next stop (src/features/plan/plan-handoff.ts). The plan imports
//   this file (enter-stop.ts starts a stop's tour here), so the plan's half is
//   handed in by App (provideTourHandoff) rather than imported, which would
//   close a loop. It loads beside the tour and is read only at the tour's
//   end, so the tour never waits for it; one that has not loaded by then, or
//   never does, offers nothing.

import { coachActive, setCoachActive } from '@/lib/coach-state'
import type { CoachHandoff } from '@/lib/coach-types'
import { isNarrow } from '@/lib/use-viewport'
import { hasPageTour, startPageTour } from '@/stores'
import type { ActiveTab } from '@/types'
import { COACH_TOURS } from './coach-tours'

/** The tab's offer key, as the corner toast wrote it and the chip still does. */
export const tourOfferKey = (tab: ActiveTab): string =>
  `pitchperfect_page_tour_offered_${tab}`

/** Marks the tab's tour as offered; storage that will not take it changes nothing. */
function spendOffer(tab: ActiveTab): void {
  try {
    localStorage.setItem(tourOfferKey(tab), 'true')
  } catch {
    // The chip, finding no record, may offer the tour once more.
  }
}

/** What a tab's finished Merc tour offers next, or null for nothing. */
export type TourHandoff = (tab: ActiveTab) => CoachHandoff | null

let loadHandoff: (() => Promise<TourHandoff>) | null = null

/**
 * Names what a finished Merc tour offers next, loaded with each tour. App
 * gives the plan's next stop on the web and nothing in the native build.
 */
export function provideTourHandoff(
  load: (() => Promise<TourHandoff>) | null,
): void {
  loadHandoff = load
}

/** Starts loading what `tab`'s tour offers next, and reads it at the end. */
function handoffFor(
  tab: ActiveTab,
  load: () => Promise<TourHandoff>,
): () => CoachHandoff | null {
  let next: TourHandoff | null = null
  load().then(
    (loaded) => {
      next = loaded
    },
    () => undefined,
  )
  return () => next?.(tab) ?? null
}

const importCoach = () => import('@/components/coach/start')
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
 * is still wanted (the chip asks whether its tab is still on screen), and
 * `failed` hears of a Merc tour whose code did not arrive. False when the tab
 * has no tour of either kind.
 */
export function startRoomTour(
  tab: ActiveTab,
  still: () => boolean = () => true,
  failed?: () => void,
): boolean {
  const entry = COACH_TOURS[tab]
  if (entry === undefined) {
    if (!hasPageTour(tab)) return false
    spendOffer(tab)
    startPageTour(tab)
    return true
  }
  const mine = {}
  pending = mine
  setCoachActive(entry.key)
  const handoff = loadHandoff === null ? null : handoffFor(tab, loadHandoff)
  // Only the latest ask may let go of coachActive: a newer one owns it.
  const letGo = (): void => {
    if (pending !== mine) return
    pending = null
    if (coachActive() === entry.key) setCoachActive(null)
  }
  Promise.all([entry.load(), loadCoach()])
    .then(async ([tour, start]) => {
      // Ended (coachActive cleared), no longer wanted, or asked for again.
      if (pending !== mine) return
      if (coachActive() !== entry.key || !still()) {
        letGo()
        return
      }
      pending = null
      await start.startCoachTour(
        tour,
        handoff === null
          ? { phone: isNarrow() }
          : { phone: isNarrow(), handoff },
      )
      // Spent once the tour is on screen: a coach that did not load leaves
      // the offer for the next visit (start.ts lets go of coachActive).
      spendOffer(tab)
    })
    // A chunk that did not arrive starts nothing, and the page stays as it was.
    .catch(() => {
      letGo()
      failed?.()
    })
  return true
}
