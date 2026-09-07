// @vitest-environment jsdom
import { createRoot, createSignal } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActiveTab } from '@/types'

const store = vi.hoisted(() => ({
  hasPageTour: vi.fn((_tab: string) => true),
  showActionNotification: vi.fn((..._args: unknown[]) => 1),
  removeNotification: vi.fn(),
  removeNotificationsByChannel: vi.fn(),
  startPageTour: vi.fn(),
  walkthrough: (() => false) as () => boolean,
  setWalkthrough: ((_v: boolean) => undefined) as (v: boolean) => void,
}))
vi.mock('@/stores', async () => {
  const { createSignal } = await import('solid-js')
  const [walkthroughActive, setWalkthroughActive] = createSignal(false)
  store.walkthrough = walkthroughActive
  store.setWalkthrough = setWalkthroughActive
  return {
    hasPageTour: (tab: string) => store.hasPageTour(tab),
    showActionNotification: (...args: unknown[]) =>
      store.showActionNotification(...args),
    removeNotification: (id: number) => store.removeNotification(id),
    removeNotificationsByChannel: (channel: string) =>
      store.removeNotificationsByChannel(channel),
    startPageTour: (tab: string) => store.startPageTour(tab),
    walkthroughActive,
    TOUR_OFFER_CHANNEL: 'page-tour-offer',
  }
})

import { usePageTourOffer } from './usePageTourOffer'

describe('usePageTourOffer', () => {
  beforeEach(() => {
    localStorage.clear()
    store.showActionNotification.mockClear()
    store.removeNotificationsByChannel.mockClear()
    store.setWalkthrough(false)
  })

  // Effects created inside createRoot run when the root settles, so every
  // assertion waits for the root to return.
  function mount(initial: ActiveTab) {
    const [tab, setTab] = createSignal<ActiveTab>(initial)
    const dispose = createRoot((d) => {
      usePageTourOffer(tab)
      return d
    })
    return { setTab, dispose }
  }

  it('offers a tab once, and marks it offered only when the toast is shown', () => {
    const { dispose } = mount('home' as ActiveTab)
    expect(store.showActionNotification).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('pitchperfect_page_tour_offered_home')).toBe(
      'true',
    )
    dispose()
  })

  it('keeps the toast when the walkthrough flag changes on the same tab', () => {
    const { dispose } = mount('home' as ActiveTab)
    store.removeNotificationsByChannel.mockClear()
    store.setWalkthrough(true)
    store.setWalkthrough(false)
    // A plain effect re-ran here, removed its own toast, and with the key
    // already written never offered again: no tour on any page.
    expect(store.removeNotificationsByChannel).not.toHaveBeenCalled()
    expect(store.showActionNotification).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('does not burn the offer while the walkthrough is up', () => {
    store.setWalkthrough(true)
    const { dispose } = mount('home' as ActiveTab)
    expect(store.showActionNotification).not.toHaveBeenCalled()
    expect(localStorage.getItem('pitchperfect_page_tour_offered_home')).toBe(
      null,
    )
    dispose()
  })

  it('clears the old offer and makes a new one when the tab changes', () => {
    const { setTab, dispose } = mount('home' as ActiveTab)
    setTab('ear-lab' as ActiveTab)
    expect(store.removeNotificationsByChannel).toHaveBeenCalledWith(
      'page-tour-offer',
    )
    expect(store.showActionNotification).toHaveBeenCalledTimes(2)
    dispose()
  })
})
