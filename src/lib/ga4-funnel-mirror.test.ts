// ============================================================
// Every funnel transport mirrors its events into GA4
// ============================================================
//
// The regression this prevents is the one the acquisition capture
// already hit once: four transports exist (the shared one, karaoke's,
// glass's and the app's), a cross-cutting concern was added to one of
// them, and the page Campaign E pays for silently missed it.
//
// The concern here is the GA4 mirror. Ads conversions and GA4 events are
// different systems: firing an Ads conversion writes nothing to GA4, so
// before this existed GA4 saw only its automatic events (page_view,
// session_start, scroll) and no product milestone at all. Ads bidding
// never needed GA4 — GA4 audiences for a future video campaign do.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const trackGa4Event = vi.fn()
const trackAdConversion = vi.fn()

vi.mock('@/lib/consent', () => ({
  trackGa4Event,
  trackAdConversion,
  AD_CONVERSIONS: {
    mirror_complete: 'AW-TEST/mirror',
    karaoke_demo_complete: 'AW-TEST/karaoke-demo',
    karaoke_song_staged: 'AW-TEST/karaoke-staged',
    glass_complete: 'AW-TEST/glass',
    card_shared: 'AW-TEST/shared',
    app_open: 'AW-TEST/app-open',
    credits_purchase: 'AW-TEST/purchase',
  },
}))

// No API configured: the beacon is a no-op, so these tests observe the
// tag side alone — which is the point.
vi.mock('@/lib/defaults', () => ({ API_BASE_URL: '', IS_TEST: true }))

const { trackFunnelTags } = await import('@/lib/funnel')
const { trackKaraoke } = await import('@/features/karaoke-night/funnel')
const { trackGlass } = await import('@/features/glass/funnel')
const { trackEvent } = await import('@/lib/analytics')
const { trackFunnel } = await import('@/features/mirror/funnel')

beforeEach(() => {
  trackGa4Event.mockClear()
  trackAdConversion.mockClear()
  localStorage.clear()
  sessionStorage.clear()
})

describe('trackFunnelTags', () => {
  it('mirrors into GA4 whether or not the event is an Ads conversion', () => {
    trackFunnelTags('mirror_view')
    expect(trackGa4Event).toHaveBeenCalledWith('mirror_view')
    expect(trackAdConversion).not.toHaveBeenCalled()

    trackFunnelTags('results_view', 'AW-TEST/mirror')
    expect(trackGa4Event).toHaveBeenCalledWith('results_view')
    expect(trackAdConversion).toHaveBeenCalledWith('AW-TEST/mirror')
  })

  it('sends the funnel event name verbatim — GA4 reports on that string', () => {
    // A renamed or prefixed event would land in GA4 as a different name
    // from the one our own database and the docs use, and no audience
    // built on it would ever match.
    for (const event of ['karaoke_song_staged', 'glass_results_view']) {
      trackGa4Event.mockClear()
      trackFunnelTags(event)
      expect(trackGa4Event).toHaveBeenCalledWith(event)
    }
  })
})

describe('each transport reaches GA4', () => {
  it('the shared transport (Voice Mirror) does', () => {
    trackFunnel('mirror_view')
    expect(trackGa4Event).toHaveBeenCalledWith('mirror_view')
  })

  it('Karaoke Night does — the page Campaign E pays for', () => {
    trackKaraoke('karaoke_song_staged')
    expect(trackGa4Event).toHaveBeenCalledWith('karaoke_song_staged')
  })

  it('Glass does', () => {
    trackGlass('glass_view')
    expect(trackGa4Event).toHaveBeenCalledWith('glass_view')
  })

  it('the app funnel does, even though it fires no Ads conversion', () => {
    trackEvent('app_open')
    expect(trackGa4Event).toHaveBeenCalledWith('app_open')
    expect(trackAdConversion).not.toHaveBeenCalled()
  })
})

describe('the karaoke dedup rules are unchanged by the mirror', () => {
  it('mirrors every staging, while the Ads conversion stays once per device', () => {
    trackKaraoke('karaoke_song_staged')
    trackKaraoke('karaoke_song_staged')
    trackKaraoke('karaoke_song_staged')

    // GA4 is an event stream — repeat stagers are exactly who an audience
    // would want.
    expect(
      trackGa4Event.mock.calls.filter((c) => c[0] === 'karaoke_song_staged'),
    ).toHaveLength(3)
    // The bid target must not inflate: one conversion per device.
    expect(trackAdConversion).toHaveBeenCalledTimes(1)
  })

  it('does not mirror a karaoke_view that the session guard swallowed', () => {
    trackKaraoke('karaoke_view')
    trackKaraoke('karaoke_view')

    expect(
      trackGa4Event.mock.calls.filter((c) => c[0] === 'karaoke_view'),
    ).toHaveLength(1)
  })
})
