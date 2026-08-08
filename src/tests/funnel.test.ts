import { beforeEach, describe, expect, it, vi } from 'vitest'

// Spy on the ad-conversion fire; provide the send_to map the mapping reads.
const { trackAdConversion } = vi.hoisted(() => ({
  trackAdConversion: vi.fn(),
}))
vi.mock('@/lib/consent', () => ({
  AD_CONVERSIONS: {
    mirror_complete: 'AW-X/mc',
    credits_purchase: 'AW-X/cp',
    app_open: 'AW-X/ao',
    card_shared: 'AW-X/cs',
  },
  trackAdConversion,
  // Every funnel event is also mirrored into GA4; this suite is about the
  // Ads mapping, so the mirror only has to exist. Its own coverage lives in
  // src/lib/ga4-funnel-mirror.test.ts.
  trackGa4Event: vi.fn(),
}))

import { trackFunnel } from '@/features/mirror/funnel'

beforeEach(() => {
  trackAdConversion.mockClear()
  localStorage.clear()
})

describe('trackFunnel -> Google Ads conversions', () => {
  it('fires mirror_complete on results_view', () => {
    trackFunnel('results_view')
    expect(trackAdConversion).toHaveBeenCalledTimes(1)
    expect(trackAdConversion).toHaveBeenCalledWith('AW-X/mc')
  })

  it('fires app_open on cta_app_click', () => {
    trackFunnel('cta_app_click')
    expect(trackAdConversion).toHaveBeenCalledWith('AW-X/ao')
  })

  it('fires card_shared on card_shared', () => {
    trackFunnel('card_shared')
    expect(trackAdConversion).toHaveBeenCalledWith('AW-X/cs')
  })

  it('does not fire for non-conversion funnel events', () => {
    trackFunnel('mirror_view')
    trackFunnel('mic_granted')
    expect(trackAdConversion).not.toHaveBeenCalled()
  })
})
