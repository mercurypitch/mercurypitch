import { beforeEach, describe, expect, it, vi } from 'vitest'

// Spy on the ad-conversion fire; provide the send_to map the mapping reads.
const { trackAdConversion } = vi.hoisted(() => ({
  trackAdConversion: vi.fn(),
}))
vi.mock('@/lib/consent', () => ({
  AD_CONVERSIONS: {
    voiceprint_complete: 'AW-X/vc',
  },
  trackAdConversion,
  // Every funnel event is also mirrored into GA4; this suite is about the
  // Ads mapping, so the mirror only has to exist.
  trackGa4Event: vi.fn(),
}))

import { trackOnboarding } from '@/features/onboarding/funnel'

beforeEach(() => {
  trackAdConversion.mockClear()
  localStorage.clear()
})

describe('trackOnboarding -> Google Ads conversions', () => {
  it('fires voiceprint_complete when the twin beat is reached', () => {
    trackOnboarding('onboarding_twin')
    expect(trackAdConversion).toHaveBeenCalledTimes(1)
    expect(trackAdConversion).toHaveBeenCalledWith('AW-X/vc')
  })

  // The whole point of picking the twin beat over the voiceprint beat: beats
  // fire on ENTRY, so onboarding_voiceprint means "started singing". Bidding on
  // the start would buy visitors who never finish.
  it('does NOT fire when the voiceprint beat is merely entered', () => {
    trackOnboarding('onboarding_voiceprint')
    expect(trackAdConversion).not.toHaveBeenCalled()
  })

  it('does not fire for the other beats', () => {
    trackOnboarding('onboarding_sky')
    trackOnboarding('onboarding_first_light')
    trackOnboarding('onboarding_fork')
    trackOnboarding('onboarding_map')
    trackOnboarding('onboarding_keep')
    expect(trackAdConversion).not.toHaveBeenCalled()
  })

  it('does not fire for the skip and completion events', () => {
    trackOnboarding('onboarding_skipped')
    trackOnboarding('onboarding_done')
    expect(trackAdConversion).not.toHaveBeenCalled()
  })
})
