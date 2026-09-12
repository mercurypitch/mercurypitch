import type { WalkthroughStep } from '@/stores'
import { removeNotification, showActionNotification, startTour, TOUR_OFFER_CHANNEL, TOURS_AVAILABLE, } from '@/stores'

/**
 * Offer a contextual spotlight tour exactly once, the first time its host view
 * mounts. Shows a dismissible "Start tour" toast and remembers the choice in
 * localStorage so it never nags again. Unlike usePageTourOffer (keyed on the
 * active tab), this is for tours whose targets only exist in a sub-view — e.g.
 * the stem mixer, which is mounted only once a karaoke session is loaded.
 */
export function offerTourOnce(
  storageKey: string,
  message: string,
  steps: WalkthroughStep[],
): void {
  // Asked before the toast, not only before the tour. `startTour` already
  // refuses in a build with no spotlights, but a toast whose button does
  // nothing is worse than no toast — it is the Console tile all over again.
  if (!TOURS_AVAILABLE) return
  if (steps.length === 0) return
  try {
    if (localStorage.getItem(storageKey) === 'true') return
    localStorage.setItem(storageKey, 'true')
  } catch {
    // localStorage unavailable (private mode) — offer once per session instead.
  }

  const id = showActionNotification(
    message,
    'info',
    {
      label: 'Start tour',
      onClick: () => {
        removeNotification(id)
        startTour(steps)
      },
    },
    // Share the single tour-offer slot so a contextual (e.g. stem-mixer) offer
    // and a per-page offer never stack on top of each other.
    { channel: TOUR_OFFER_CHANNEL },
  )
}
