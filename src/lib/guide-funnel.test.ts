import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Defaults from '@/lib/defaults'
import { tourMetrics, trackTour } from '@/lib/guide-funnel'

// The beacon only fires when the build has an API; give it one.
vi.mock('@/lib/defaults', async (importOriginal) => ({
  ...(await importOriginal<typeof Defaults>()),
  API_BASE_URL: 'https://api.example.test',
}))

describe('tourMetrics', () => {
  it('turns a tour key into its number', () => {
    expect(tourMetrics('exercises', 3, 6)).toEqual({ tour: 8, step: 3, of: 6 })
  })

  it('carries nulls for an event with no place in a tour', () => {
    expect(tourMetrics('home', null, null)).toEqual({
      tour: 2,
      step: null,
      of: null,
    })
  })
})

describe('trackTour on the wire', () => {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(null))

  /** The JSON body of the one request the tracker sent. */
  const sentBody = (): { event: string; metrics?: unknown } => {
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.example.test/api/mirror/event')
    return JSON.parse(String(init?.body))
  }

  beforeEach(() => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends the tour number, step and steps shown as the body metrics on an exit', () => {
    trackTour('tour_exit', 'home', { step: 3, of: 7 })
    const body = sentBody()
    expect(body.event).toBe('tour_exit')
    expect(body.metrics).toEqual({ tour: 2, step: 3, of: 7 })
  })

  it('sends the steps shown and a null step on a start', () => {
    trackTour('tour_start', 'home', { of: 7 })
    const body = sentBody()
    expect(body.event).toBe('tour_start')
    expect(body.metrics).toEqual({ tour: 2, step: null, of: 7 })
  })

  it('sends neither a step nor steps shown on an offer', () => {
    trackTour('tour_offer', 'home')
    const body = sentBody()
    expect(body.event).toBe('tour_offer')
    expect(body.metrics).toEqual({ tour: 2, step: null, of: null })
  })
})
