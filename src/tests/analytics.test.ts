// ============================================================
// App funnel analytics tests — src/lib/analytics.ts
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Analytics from '@/lib/analytics'

type AnalyticsModule = typeof Analytics

/** Load a fresh module instance with the given API base mocked in. */
async function loadAnalytics(
  apiBase: string | undefined,
): Promise<AnalyticsModule> {
  vi.resetModules()
  vi.doMock('@/lib/defaults', () => ({ API_BASE_URL: apiBase }))
  return await import('@/lib/analytics')
}

function stubFetch(): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async () => ({ ok: true }))
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('trackEvent', () => {
  it('is a silent no-op when no API base is configured', async () => {
    const { trackEvent } = await loadAnalytics('')
    const fetchFn = stubFetch()
    expect(() => trackEvent('session_complete')).not.toThrow()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('posts {clientId, event} to /api/mirror/event via keepalive fetch', async () => {
    const { trackEvent } = await loadAnalytics('http://api.test')
    const fetchFn = stubFetch()
    trackEvent('session_complete')
    expect(fetchFn).toHaveBeenCalledTimes(1)
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://api.test/api/mirror/event')
    expect(init.keepalive).toBe(true)
    const payload = JSON.parse(init.body as string) as {
      clientId: string
      event: string
    }
    expect(payload.event).toBe('session_complete')
    // Server enforces this shape on the clientId index.
    expect(payload.clientId).toMatch(/^[A-Za-z0-9-]{8,64}$/)
  })

  it('omits credentials — the worker CORS wildcard rejects credentialed requests', async () => {
    const { trackEvent } = await loadAnalytics('http://api.test')
    const fetchFn = stubFetch()
    trackEvent('pricing_view')
    const [, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.credentials).toBe('omit')
  })

  it('keeps one stable clientId across events', async () => {
    const { trackEvent } = await loadAnalytics('http://api.test')
    const fetchFn = stubFetch()
    trackEvent('pricing_view')
    trackEvent('checkout_start')
    const ids = fetchFn.mock.calls.map(
      (c) =>
        (
          JSON.parse(
            (c as unknown as [string, RequestInit])[1].body as string,
          ) as { clientId: string }
        ).clientId,
    )
    expect(ids[0]).toBe(ids[1])
    expect(localStorage.getItem('mp.analytics.clientId.v1')).toBe(ids[0])
  })

  it('sends app_open once per browser session, other events every time', async () => {
    const { trackEvent } = await loadAnalytics('http://api.test')
    const fetchFn = stubFetch()
    trackEvent('app_open')
    trackEvent('app_open')
    trackEvent('session_complete')
    trackEvent('session_complete')
    const events = fetchFn.mock.calls.map(
      (c) =>
        (
          JSON.parse(
            (c as unknown as [string, RequestInit])[1].body as string,
          ) as { event: string }
        ).event,
    )
    expect(events).toEqual(['app_open', 'session_complete', 'session_complete'])
  })

  it('never throws when the network call fails', async () => {
    const { trackEvent } = await loadAnalytics('http://api.test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    expect(() => trackEvent('signup')).not.toThrow()
    // Flush the rejected promise — an unhandled rejection would fail the run.
    await Promise.resolve()
  })
})
