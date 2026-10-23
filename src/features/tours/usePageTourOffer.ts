import { createEffect, createMemo, on } from 'solid-js'
import { tabLabel } from '@/features/tabs/constants'
import { trackTour } from '@/lib/guide-funnel'
import { hasPageTour, pageTourKey, removeNotification, removeNotificationsByChannel, showActionNotification, startPageTour, TOUR_OFFER_CHANNEL, walkthroughActive, } from '@/stores'
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
 *
 * Nothing is offered while `paused()` is true, and nothing is spent: App
 * passes whatever has the screen here, or is still choosing what will (First
 * Light, the plan layer, What's New, and the opening takeover until it has
 * decided). A first visit used to get "New to Home? Take a quick tour." about
 * a second in, on top of the welcome screen, which also spent Home's only
 * offer where nobody could act on it. The tab on screen when the pause lifts
 * is offered then.
 */
export function usePageTourOffer(
  activeTab: () => ActiveTab,
  paused: () => boolean = () => false,
): void {
  // Only a tab change or the pause re-runs this. Reading the walkthrough flag
  // or the viewport inside a plain effect made it re-run on their changes too,
  // which removed the toast it had just shown and, with the "offered" key
  // already written, never offered again — a phone after a factory reset
  // saw no tour offer on any page. The key is written only once the toast
  // is really on screen. The pause is a memo for the same reason: App's
  // reads the plan layer's host, which reads the plan store, and the store
  // lands a moment after load with the pause unchanged.
  const pausedNow = createMemo(paused)
  createEffect(
    on([activeTab, pausedNow], ([tab, isPaused], prev) => {
      removeNotificationsByChannel(TOUR_OFFER_CHANNEL)
      if (isPaused) return
      // The pause has just lifted. First Light's Map closes the flow in
      // order to start a room's tour (switch tab, close, startPageTour, all
      // in one handler), so decide after that handler has run: otherwise
      // the offer lands on top of the tour it offers.
      if (prev?.[1] === true) queueMicrotask(() => offer(tab))
      else offer(tab)
    }),
  )

  function offer(tab: ActiveTab): void {
    // The microtask path can find the user elsewhere already.
    if (activeTab() !== tab || pausedNow()) return
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
    // The offer above does not depend on the key; only the report does.
    const tourKey = pageTourKey(tab)
    if (tourKey !== null) trackTour('tour_offer', tourKey)
  }
}
