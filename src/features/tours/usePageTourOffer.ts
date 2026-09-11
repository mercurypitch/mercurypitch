import { createEffect, on } from 'solid-js'
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
  // Only a tab change re-runs this. Reading the walkthrough flag or the
  // viewport inside a plain effect made it re-run on their changes too,
  // which removed the toast it had just shown and, with the "offered" key
  // already written, never offered again — a phone after a factory reset
  // saw no tour offer on any page. The key is written only once the toast
  // is really on screen.
  createEffect(
    on(activeTab, (tab) => {
      removeNotificationsByChannel(TOUR_OFFER_CHANNEL)
      if (!hasPageTour(tab)) return
      const key = `pitchperfect_page_tour_offered_${tab}`
      if (localStorage.getItem(key) === 'true') return
      if (walkthroughActive()) return
      localStorage.setItem(key, 'true')
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
    }),
  )
}
