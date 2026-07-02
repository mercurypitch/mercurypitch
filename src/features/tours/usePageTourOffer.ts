import { createEffect } from 'solid-js'
import { tabLabel } from '@/features/tabs/constants'
import { hasPageTour, removeNotification, removeNotificationsByChannel, showActionNotification, startPageTour, TOUR_OFFER_CHANNEL, walkthroughActive, } from '@/stores'
import type { ActiveTab } from '@/types'

/**
 * Offer a page's spotlight tour once, the first time the user visits a tab that
 * has one. Shows a dismissible "Start tour" toast (auto-dismisses); the choice
 * is remembered in localStorage so it never nags again. The tour is always
 * re-startable from the manual guide control.
 *
 * Only ever one offer toast is on screen: every tab change retires the previous
 * offer, and all offers share TOUR_OFFER_CHANNEL so a new one replaces the old.
 * A first-time user hopping across tabs no longer stacks a toast per page.
 */
export function usePageTourOffer(activeTab: () => ActiveTab): void {
  createEffect(() => {
    const tab = activeTab()

    // Leaving a tab (or arriving at one without a tour) retires the standing
    // offer so toasts never pile up — only the current page's offer shows.
    removeNotificationsByChannel(TOUR_OFFER_CHANNEL)

    if (!hasPageTour(tab)) return

    const key = `pitchperfect_page_tour_offered_${tab}`
    if (localStorage.getItem(key) === 'true') return
    localStorage.setItem(key, 'true')

    // A running spotlight tour is what switched us to this tab (page tours
    // navigate via requiredTab): the user is already touring it, so popping
    // a "take a quick tour" toast on top would be noise. Count it as offered.
    if (walkthroughActive()) return

    const id = showActionNotification(
      `New to ${tabLabel(tab)}? Take a quick tour.`,
      'info',
      {
        label: 'Start tour',
        onClick: () => {
          removeNotification(id)
          startPageTour(tab)
        },
      },
      { channel: TOUR_OFFER_CHANNEL },
    )
  })
}
