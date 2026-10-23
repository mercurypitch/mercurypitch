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
  trackTour: vi.fn(),
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
    pageTourKey: (tab: string) =>
      tab === 'guitar' ? null : tab === 'home' ? 'home' : 'ear-lab',
    walkthroughActive,
    TOUR_OFFER_CHANNEL: 'page-tour-offer',
  }
})

vi.mock('@/lib/guide-funnel', () => ({
  trackTour: (...args: unknown[]) => store.trackTour(...args),
}))

import { usePageTourOffer } from './usePageTourOffer'

describe('usePageTourOffer', () => {
  beforeEach(() => {
    localStorage.clear()
    store.showActionNotification.mockClear()
    store.removeNotificationsByChannel.mockClear()
    store.trackTour.mockClear()
    store.setWalkthrough(false)
  })

  // Effects created inside createRoot run when the root settles, so every
  // assertion waits for the root to return.
  function mount(initial: ActiveTab, initiallyPaused = false) {
    const [tab, setTab] = createSignal<ActiveTab>(initial)
    const [paused, setPaused] = createSignal(initiallyPaused)
    const dispose = createRoot((d) => {
      usePageTourOffer(tab, paused)
      return d
    })
    return { setTab, setPaused, dispose }
  }

  // The offer that follows a lifted pause waits one microtask.
  const settle = () => Promise.resolve()

  it('offers a tab once, and marks it offered only when the toast is shown', () => {
    const { dispose } = mount('home' as ActiveTab)
    expect(store.showActionNotification).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('pitchperfect_page_tour_offered_home')).toBe(
      'true',
    )
    dispose()
  })

  it('reports an offer once, when the toast shows', () => {
    const { dispose } = mount('home' as ActiveTab)
    expect(store.trackTour).toHaveBeenCalledTimes(1)
    expect(store.trackTour).toHaveBeenCalledWith('tour_offer', 'home')
    dispose()
  })

  it('still shows the offer when the tab has no tour key to report', () => {
    const { dispose } = mount('guitar' as ActiveTab)
    expect(store.showActionNotification).toHaveBeenCalledTimes(1)
    expect(store.trackTour).not.toHaveBeenCalled()
    expect(localStorage.getItem('pitchperfect_page_tour_offered_guitar')).toBe(
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

  // A first visit got "New to Home?" on top of First Light's welcome screen.
  it('offers nothing and spends nothing while paused', async () => {
    const { setTab, dispose } = mount('home' as ActiveTab, true)
    setTab('ear-lab' as ActiveTab)
    await settle()
    expect(store.showActionNotification).not.toHaveBeenCalled()
    expect(localStorage.getItem('pitchperfect_page_tour_offered_home')).toBe(
      null,
    )
    expect(localStorage.getItem('pitchperfect_page_tour_offered_ear-lab')).toBe(
      null,
    )
    dispose()
  })

  it('offers the tab on screen once the pause lifts', async () => {
    const { setPaused, dispose } = mount('home' as ActiveTab, true)
    setPaused(false)
    await settle()
    expect(store.showActionNotification).toHaveBeenCalledTimes(1)
    expect(store.showActionNotification.mock.calls[0][0]).toBe(
      'New to Home? Take a quick tour.',
    )
    expect(localStorage.getItem('pitchperfect_page_tour_offered_home')).toBe(
      'true',
    )
    dispose()
  })

  // First Light's Map: switch tab, close the flow, start that room's tour,
  // all in one handler.
  it('stays out of a tour that starts as the pause lifts', async () => {
    const { setTab, setPaused, dispose } = mount('home' as ActiveTab, true)
    setTab('ear-lab' as ActiveTab)
    setPaused(false)
    store.setWalkthrough(true)
    await settle()
    expect(store.showActionNotification).not.toHaveBeenCalled()
    expect(localStorage.getItem('pitchperfect_page_tour_offered_ear-lab')).toBe(
      null,
    )
    dispose()
  })

  // App's pause asks the plan layer's host whether the layer is up, and the
  // host reads the plan store, which lands a moment after load: the pause is
  // read again then, and says what it said before (PR 1.3 gate fix, R83).
  it('keeps the toast when what the pause reads changes and the pause does not', () => {
    const [tab] = createSignal<ActiveTab>('home' as ActiveTab)
    const [storeLanded, setStoreLanded] = createSignal(false)
    const paused = (): boolean => {
      storeLanded()
      return false
    }
    const dispose = createRoot((d) => {
      usePageTourOffer(tab, paused)
      return d
    })
    expect(store.showActionNotification).toHaveBeenCalledTimes(1)
    store.removeNotificationsByChannel.mockClear()

    setStoreLanded(true)

    expect(store.removeNotificationsByChannel).not.toHaveBeenCalled()
    expect(store.showActionNotification).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('retires a shown offer when the pause returns', () => {
    const { setPaused, dispose } = mount('home' as ActiveTab)
    expect(store.showActionNotification).toHaveBeenCalledTimes(1)
    store.removeNotificationsByChannel.mockClear()
    setPaused(true)
    expect(store.removeNotificationsByChannel).toHaveBeenCalledWith(
      'page-tour-offer',
    )
    dispose()
  })
})
