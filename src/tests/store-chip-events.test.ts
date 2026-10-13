// ============================================================
// Store chip clicks: GA4 sees them, Google Ads never does
// ============================================================
//
// createFunnel forwards every event to GA4 under its own name and fires an
// Ads conversion only for the names in a surface's `adConversions` map. The
// six store chip names are counted, never bid on (the owner's rule, 9 October
// 2026): while a store is not live its chip opens a video, not a listing.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as ConsentModule from '@/lib/consent'

const tags = vi.hoisted(() => ({
  trackAdConversion: vi.fn(),
  trackGa4Event: vi.fn(),
}))

vi.mock('@/lib/consent', async (importOriginal) => ({
  ...(await importOriginal<typeof ConsentModule>()),
  trackAdConversion: tags.trackAdConversion,
  trackGa4Event: tags.trackGa4Event,
}))

import { STORE_CHIP_EVENTS, trackFunnel } from '@/features/mirror/funnel'
import { MAP_STORE_EVENT, trackOnboarding } from '@/features/onboarding/funnel'

const MIRROR_NAMES = [
  ...Object.values(STORE_CHIP_EVENTS.results),
  ...Object.values(STORE_CHIP_EVENTS.freeSing),
]
const MAP_NAMES = Object.values(MAP_STORE_EVENT)

afterEach(() => {
  vi.clearAllMocks()
})

describe('store chip events and the Google tags', () => {
  it('names six events, one per surface and store', () => {
    expect(new Set([...MIRROR_NAMES, ...MAP_NAMES]).size).toBe(6)
  })

  it('sends each Mirror name to GA4 and none to Google Ads', () => {
    for (const name of MIRROR_NAMES) trackFunnel(name)
    expect(tags.trackGa4Event.mock.calls).toEqual(MIRROR_NAMES.map((n) => [n]))
    expect(tags.trackAdConversion).not.toHaveBeenCalled()
  })

  it('sends each Map name to GA4 and none to Google Ads', () => {
    for (const name of MAP_NAMES) trackOnboarding(name)
    expect(tags.trackGa4Event.mock.calls).toEqual(MAP_NAMES.map((n) => [n]))
    expect(tags.trackAdConversion).not.toHaveBeenCalled()
  })

  it('still fires a real conversion, so the spy is wired', () => {
    trackFunnel('results_view')
    expect(tags.trackAdConversion).toHaveBeenCalledTimes(1)
  })
})
