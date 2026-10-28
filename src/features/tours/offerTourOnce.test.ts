// @vitest-environment jsdom
// ============================================================
// offerTourOnce — the contextual offer asks for the chip, once
// ============================================================
//
// The chip host records the offer and reports it as the chip shows
// (TourChipHost.test.tsx); this holds what offerTourOnce asks for.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WalkthroughStep } from '@/stores'
import type { TourChipRequest } from './TourChipHost'

const store = vi.hoisted(() => ({
  startTour: vi.fn(),
  requestTourChip: vi.fn((_req: unknown) => undefined),
  toursAvailable: true,
}))
vi.mock('@/stores', () => ({
  startTour: (...args: unknown[]) => store.startTour(...args),
  get TOURS_AVAILABLE() {
    return store.toursAvailable
  },
}))
vi.mock('./TourChipHost', () => ({
  QUICK_TOUR_SHORT: 'Quick tour',
  requestTourChip: (req: unknown) => store.requestTourChip(req),
}))

import { offerTourOnce } from './offerTourOnce'

const STEPS: WalkthroughStep[] = [
  { title: 'One', description: 'A step.', targetSelector: 'body' },
]

const asked = (): TourChipRequest =>
  store.requestTourChip.mock.calls[0][0] as TourChipRequest

describe('offerTourOnce', () => {
  beforeEach(() => {
    localStorage.clear()
    store.startTour.mockClear()
    store.requestTourChip.mockClear()
    store.toursAvailable = true
  })

  it('asks for the chip with its line, its short one, its key and where to record it', () => {
    offerTourOnce('offered-key', 'New here?', STEPS, 'mixer')

    expect(store.requestTourChip).toHaveBeenCalledTimes(1)
    expect(asked()).toMatchObject({
      key: 'mixer',
      storageKey: 'offered-key',
      line: 'New here?',
      short: 'Quick tour',
    })
    // The chip host records it as the chip shows, not before.
    expect(localStorage.getItem('offered-key')).toBe(null)
  })

  it('asks nothing for an offer that was already made', () => {
    localStorage.setItem('offered-key', 'true')
    offerTourOnce('offered-key', 'New here?', STEPS, 'mixer')

    expect(store.requestTourChip).not.toHaveBeenCalled()
  })

  it('asks nothing in a build with no spotlight tours', () => {
    store.toursAvailable = false
    offerTourOnce('offered-key', 'New here?', STEPS, 'mixer')

    expect(store.requestTourChip).not.toHaveBeenCalled()
  })

  it('starts the tour under the same key when the chip is tapped', () => {
    offerTourOnce('offered-key', 'New here?', STEPS, 'mixer')
    asked().onStart()

    expect(store.startTour.mock.calls).toEqual([[STEPS, 'mixer']])
  })
})
