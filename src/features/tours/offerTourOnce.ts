import type { TourKey } from '@/lib/tour-ids'
import type { WalkthroughStep } from '@/stores'
import { startTour, TOURS_AVAILABLE } from '@/stores'
import { QUICK_TOUR_SHORT, requestTourChip } from './TourChipHost'

/**
 * Offer a contextual spotlight tour exactly once, the first time its host view
 * mounts. It asks for the tour chip by the page title (TourChipHost), which
 * records the offer under `storageKey` as the chip shows, so it never nags
 * again. Unlike a tab's own offer (keyed on the active tab), this is for tours
 * whose targets only exist in a sub-view — e.g. the stem mixer, which is
 * mounted only once a karaoke session is loaded.
 */
export function offerTourOnce(
  storageKey: string,
  message: string,
  steps: WalkthroughStep[],
  key: TourKey,
): void {
  // Asked before the chip, not only before the tour. `startTour` already
  // refuses in a build with no spotlights, but a chip whose tap does nothing
  // is worse than no chip — it is the Console tile all over again.
  if (!TOURS_AVAILABLE) return
  if (steps.length === 0) return
  try {
    if (localStorage.getItem(storageKey) === 'true') return
  } catch {
    // Storage that cannot be read cannot record the offer either; the chip
    // host makes no offer it cannot record.
    return
  }
  requestTourChip({
    key,
    storageKey,
    line: message,
    // Its one message is the toast's own (UvrPanel: "New to the mixer? Take
    // a quick tour."), so these are words of it.
    short: QUICK_TOUR_SHORT,
    onStart: () => startTour(steps, key),
  })
}
