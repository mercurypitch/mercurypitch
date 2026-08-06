// ============================================================
// Karaoke Night funnel — activation denominator and dedupe tests
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as KaraokeFunnel from './funnel'

type KaraokeFunnelModule = typeof KaraokeFunnel

async function loadFunnel(): Promise<KaraokeFunnelModule> {
  vi.resetModules()
  vi.doMock('@/lib/defaults', () => ({ API_BASE_URL: 'http://api.test' }))
  vi.doMock('@/lib/consent', () => ({
    AD_CONVERSIONS: {
      karaoke_demo_complete: 'AW-X/demo',
      karaoke_song_staged: 'AW-X/staged',
    },
    trackAdConversion: vi.fn(),
  }))
  return await import('./funnel')
}

function sentEvents(fetchFn: ReturnType<typeof vi.fn>): string[] {
  return fetchFn.mock.calls.map((call) => {
    const [, init] = call as unknown as [string, RequestInit]
    return (JSON.parse(init.body as string) as { event: string }).event
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Karaoke Night activation milestones', () => {
  it('sends each activation milestone once in a browser session', async () => {
    const { trackKaraokeSessionOnce } = await loadFunnel()
    const fetchFn = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchFn)

    const milestones = [
      'karaoke_mic_granted',
      'karaoke_first_pitch',
      'karaoke_first_score',
      'karaoke_scorecard_view',
    ] as const
    for (const milestone of milestones) {
      trackKaraokeSessionOnce(milestone)
      trackKaraokeSessionOnce(milestone)
    }

    expect(sentEvents(fetchFn)).toEqual(milestones)
  })

  it('counts activation again in a new session but keeps demo conversion lifetime-scoped', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchFn)

    const first = await loadFunnel()
    first.trackKaraokeSessionOnce('karaoke_first_pitch')
    first.trackKaraokeOnce('karaoke_demo_complete')

    // A browser restart clears sessionStorage, not localStorage. Reload the
    // module as a new page lifetime so its in-memory guards reset too.
    sessionStorage.clear()
    const returning = await loadFunnel()
    returning.trackKaraokeSessionOnce('karaoke_first_pitch')
    returning.trackKaraokeOnce('karaoke_demo_complete')

    expect(sentEvents(fetchFn)).toEqual([
      'karaoke_first_pitch',
      'karaoke_demo_complete',
      'karaoke_first_pitch',
    ])
  })
})
