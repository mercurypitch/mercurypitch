import { beforeEach, describe, expect, it, vi } from 'vitest'

// Spy on the ad-conversion fire; provide the send_to map the mapping reads.
const { trackAdConversion, trackGa4Event } = vi.hoisted(() => ({
  trackAdConversion: vi.fn(),
  trackGa4Event: vi.fn(),
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
  trackGa4Event,
}))

import { trackFunnel } from '@/features/mirror/funnel'

beforeEach(() => {
  trackAdConversion.mockClear()
  trackGa4Event.mockClear()
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

  // The account ask's tap is counted first-party and in GA4, and bid on by
  // nothing: the campaigns' conversion map is not this PR's to change.
  it('keeps the account ask out of Ads, and in GA4', () => {
    trackFunnel('cta_account_click')
    expect(trackAdConversion).not.toHaveBeenCalled()
    expect(trackGa4Event).toHaveBeenCalledWith('cta_account_click')
  })
})
