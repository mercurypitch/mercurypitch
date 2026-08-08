// ============================================================
// Marking our own visits — the rules that matter
// ============================================================
//
// Two of these are the whole reason the module exists rather than an
// inline localStorage read: the marking visit must already be excluded
// (otherwise the pageview that turns the flag on is the one that leaks),
// and a storage failure must fail OPEN — counting one of our own visits
// is a smaller mistake than excluding a real visitor.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ga4TrafficParams, isInternalTraffic } from './internal-traffic'

const STORAGE_KEY = 'mp.internal.v1'

function visit(url: string): void {
  window.history.replaceState({}, '', url)
}

beforeEach(() => {
  localStorage.clear()
  visit('/')
  vi.restoreAllMocks()
})

describe('marking and clearing', () => {
  it('marks the browser and excludes the marking visit itself', () => {
    visit('/?mp_internal=1')

    expect(isInternalTraffic()).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('1')
  })

  it('stays marked on later visits without the param', () => {
    visit('/?mp_internal=1')
    isInternalTraffic()

    visit('/#/karaoke-night')
    expect(isInternalTraffic()).toBe(true)
  })

  it('clears on ?mp_internal=0', () => {
    visit('/?mp_internal=1')
    isInternalTraffic()

    visit('/?mp_internal=0')
    expect(isInternalTraffic()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('leaves an unmarked browser alone', () => {
    expect(isInternalTraffic()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('ignores a value that is not 1 or 0', () => {
    visit('/?mp_internal=yes')

    expect(isInternalTraffic()).toBe(false)
  })
})

describe('failure mode', () => {
  it('fails open when storage throws', () => {
    // Counting one of our own visits beats excluding a real one.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })

    expect(isInternalTraffic()).toBe(false)
  })
})

describe('ga4TrafficParams', () => {
  it('sends the parameter GA4 filters on, and only when marked', () => {
    expect(ga4TrafficParams()).toEqual({})

    visit('/?mp_internal=1')
    expect(ga4TrafficParams()).toEqual({ traffic_type: 'internal' })
  })
})

// ── the GA4 funnel mirror carries the same marking ─────────────

describe('trackGa4Event', () => {
  it('addresses GA4 explicitly and repeats the internal marking', async () => {
    // The dataLayer is shared with the Google Ads tag: an event with no
    // send_to is delivered to every configured product, so a funnel
    // milestone would also reach Ads as an unnamed event.
    vi.resetModules()
    vi.doMock('@/lib/defaults', () => ({
      GA4_MEASUREMENT_ID: 'G-TEST123',
      GOOGLE_ADS_TAG_ID: '',
      IS_TEST: false,
      API_BASE_URL: '',
    }))
    const consent = await import('@/lib/consent')

    localStorage.setItem('mp.internal.v1', '1')
    const pushed: unknown[][] = []
    ;(window as unknown as { dataLayer: unknown[] }).dataLayer = {
      push: (args: unknown) =>
        pushed.push(Array.from(args as ArrayLike<unknown>)),
    } as unknown as unknown[]

    consent.trackGa4Event('karaoke_song_staged')

    const event = pushed.find((c) => c[0] === 'event')
    expect(event?.[1]).toBe('karaoke_song_staged')
    expect(event?.[2]).toMatchObject({
      send_to: 'G-TEST123',
      traffic_type: 'internal',
    })
    vi.doUnmock('@/lib/defaults')
    vi.resetModules()
  })

  it('is a no-op when the build ships no GA4 tag', async () => {
    vi.resetModules()
    vi.doMock('@/lib/defaults', () => ({
      GA4_MEASUREMENT_ID: '',
      GOOGLE_ADS_TAG_ID: 'AW-1',
      IS_TEST: false,
      API_BASE_URL: '',
    }))
    const consent = await import('@/lib/consent')

    const pushed: unknown[][] = []
    ;(window as unknown as { dataLayer: unknown[] }).dataLayer = {
      push: (args: unknown) =>
        pushed.push(Array.from(args as ArrayLike<unknown>)),
    } as unknown as unknown[]

    consent.trackGa4Event('mirror_view')

    expect(pushed).toHaveLength(0)
    vi.doUnmock('@/lib/defaults')
    vi.resetModules()
  })
})
