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
    expect(tourMetrics('exercises', 3)).toEqual({ tour: 8, step: 3 })
  })

  it('carries a null step for an event with no step', () => {
    expect(tourMetrics('home', null)).toEqual({ tour: 2, step: null })
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

  it('sends the tour number and step as the request body metrics on an exit', () => {
    trackTour('tour_exit', 'home', 3)
    const body = sentBody()
    expect(body.event).toBe('tour_exit')
    expect(body.metrics).toEqual({ tour: 2, step: 3 })
  })

  it('sends a null step when a tour event has none', () => {
    trackTour('tour_start', 'home')
    const body = sentBody()
    expect(body.event).toBe('tour_start')
    expect(body.metrics).toEqual({ tour: 2, step: null })
  })
})
