// @vitest-environment jsdom
// ============================================================
// offerTourOnce — the contextual offer reports itself, once
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalkthroughStep } from '@/stores'

const store = vi.hoisted(() => ({
  showActionNotification: vi.fn((..._args: unknown[]) => 7),
  removeNotification: vi.fn(),
  startTour: vi.fn(),
  trackTour: vi.fn(),
}))
vi.mock('@/stores', () => ({
  showActionNotification: (...args: unknown[]) =>
    store.showActionNotification(...args),
  removeNotification: (id: number) => store.removeNotification(id),
  startTour: (...args: unknown[]) => store.startTour(...args),
  TOUR_OFFER_CHANNEL: 'page-tour-offer',
  TOURS_AVAILABLE: true,
}))
vi.mock('@/lib/guide-funnel', () => ({
  trackTour: (...args: unknown[]) => store.trackTour(...args),
}))

import { offerTourOnce } from './offerTourOnce'

const STEPS: WalkthroughStep[] = [
  { title: 'One', description: 'A step.', targetSelector: 'body' },
]

describe('offerTourOnce', () => {
  beforeEach(() => {
    localStorage.clear()
    for (const fn of Object.values(store)) fn.mockClear()
  })

  it('reports the offer with the key it was given when the toast shows', () => {
    offerTourOnce('offered-key', 'New here?', STEPS, 'mixer')
    expect(store.showActionNotification).toHaveBeenCalledTimes(1)
    expect(store.trackTour.mock.calls).toEqual([['tour_offer', 'mixer']])
  })

  it('sends nothing for an offer that was already made', () => {
    localStorage.setItem('offered-key', 'true')
    offerTourOnce('offered-key', 'New here?', STEPS, 'mixer')
    expect(store.showActionNotification).not.toHaveBeenCalled()
    expect(store.trackTour).not.toHaveBeenCalled()
  })

  it('starts the tour under the same key when Start tour is clicked', () => {
    offerTourOnce('offered-key', 'New here?', STEPS, 'mixer')
    const action = store.showActionNotification.mock.calls[0][2] as {
      onClick: () => void
    }
    action.onClick()
    expect(store.startTour.mock.calls).toEqual([[STEPS, 'mixer']])
  })
})
