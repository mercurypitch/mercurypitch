import { createEffect } from 'solid-js'
import { tabLabel } from '@/features/tabs/constants'
import { hasPageTour, removeNotification, showActionNotification, startPageTour, } from '@/stores'
import type { ActiveTab } from '@/types'

/**
 * Offer a page's spotlight tour once, the first time the user visits a tab that
 * has one. Shows a dismissible "Start tour" toast (auto-dismisses); the choice
 * is remembered in localStorage so it never nags again. The tour is always
 * re-startable from the manual guide control.
 */
export function usePageTourOffer(activeTab: () => ActiveTab): void {
  createEffect(() => {
    const tab = activeTab()
    if (!hasPageTour(tab)) return

    const key = `pitchperfect_page_tour_offered_${tab}`
    if (localStorage.getItem(key) === 'true') return
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
    )
  })
}
