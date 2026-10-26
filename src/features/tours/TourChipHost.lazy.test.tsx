// @vitest-environment jsdom
// ============================================================
// TourChipHost before its chip has loaded
// ============================================================
//
// The chip (src/components/coach/TourChip.tsx) loads with the first offer,
// not with the app, and the offer waits for it: a tab's offer is written, and
// reported, as the chip shows, and the offer of a tab left while the chip
// loaded is not made at all. TourChipHost.test.tsx holds the rest, with the
// chip loaded first.
//
// The fake chip's module waits until the case lets it load, and a file loads
// it once, so this file holds one case.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActiveTab } from '@/types'

const store = vi.hoisted(() => {
  let release = (): void => undefined
  const loaded = new Promise<void>((resolve) => {
    release = resolve
  })
  return { trackTour: vi.fn(), loaded, release: () => release() }
})
vi.mock('@/stores', async () => {
  const { createSignal } = await import('solid-js')
  const [walkthroughActive] = createSignal(false)
  const [tourOfferRetired] = createSignal(0)
  return {
    hasPageTour: () => true,
    startPageTour: vi.fn(),
    pageTourKey: (tab: string) => tab,
    walkthroughActive,
    tourOfferRetired,
  }
})
vi.mock('@/lib/guide-funnel', () => ({
  trackTour: (...args: unknown[]) => store.trackTour(...args),
}))
vi.mock('@/lib/use-viewport', () => ({ isNarrow: () => false }))
vi.mock('./coach-tours', () => ({ COACH_TOURS: {} }))
vi.mock('@/components/coach/TourChip', async () => {
  await store.loaded
  const { createEffect } = await import('solid-js')
  return {
    TourChip: (props: { line?: string; onSeen?: () => void }) => {
      const chip = document.createElement('div')
      chip.dataset.testid = 'tour-chip'
      // Its line, and seen as it mounts, as the real chip is where there is
      // no IntersectionObserver.
      createEffect(() => {
        chip.textContent = props.line ?? ''
        props.onSeen?.()
      })
      return chip
    },
  }
})

import { TourChipHost, warmTourChip } from './TourChipHost'

const KEY = (tab: string): string => `pitchperfect_page_tour_offered_${tab}`
const chip = (): HTMLElement | null => screen.queryByTestId('tour-chip')

afterEach(() => {
  cleanup()
})

describe('TourChipHost while its chip loads', () => {
  it('offers only once the chip can show, and only on the tab still open', async () => {
    // Arrange
    localStorage.clear()
    const [tab, setTab] = createSignal<ActiveTab>('home')
    const [paused] = createSignal(false)
    render(() => <TourChipHost tab={tab} paused={paused} />)

    // Assert: Home's offer waits for the chip; nothing is spent yet.
    expect(chip()).toBeNull()
    expect(localStorage.getItem(KEY('home'))).toBeNull()
    expect(store.trackTour).not.toHaveBeenCalled()

    // Act: the singer moves to Ear Lab, then the chip arrives.
    setTab('ear-lab')
    store.release()
    expect(await warmTourChip()).toBe(true)
    await vi.waitFor(() => expect(chip()).not.toBeNull())

    // Assert: Ear Lab is offered as its chip shows; Home never was.
    expect(chip()).toHaveTextContent('New to Ear Lab? Take a quick tour.')
    expect(localStorage.getItem(KEY('ear-lab'))).toBe('true')
    expect(localStorage.getItem(KEY('home'))).toBeNull()
    expect(store.trackTour.mock.calls).toEqual([['tour_offer', 'ear-lab']])
  })
})
