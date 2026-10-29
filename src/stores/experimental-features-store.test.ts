import { afterEach, describe, expect, it, vi } from 'vitest'
import { EXPERIMENTAL_FEATURES_BUILD_DEFAULT, experimentalFeatureOn, experimentalFeaturesPending, FEATURES_READ_TIMEOUT_MS, loadExperimentalFeatures, resetExperimentalFeaturesStoreForTests, } from './experimental-features-store'

const API = 'https://api.test'

type Fetcher = typeof fetch

/** A fetcher that answers `body` as JSON with `status`, counting its calls. */
function answering(body: unknown, status = 200): Fetcher & { calls: string[] } {
  const calls: string[] = []
  const fetcher = (async (input: RequestInfo | URL) => {
    calls.push(String(input))
    return Response.json(body, { status })
  }) as Fetcher & { calls: string[] }
  fetcher.calls = calls
  return fetcher
}

/** A fetcher that never answers, and fails only when its signal aborts. */
const hanging: Fetcher = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('The read was aborted', 'AbortError'))
    })
  })

afterEach(() => {
  resetExperimentalFeaturesStoreForTests()
  delete (window as { __MP_E2E_EXPERIMENTS__?: unknown }).__MP_E2E_EXPERIMENTS__
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('the build default', () => {
  it('is on in the test build, as on the dev deploy and in the e2e bundle', () => {
    expect(EXPERIMENTAL_FEATURES_BUILD_DEFAULT).toBe(true)
    expect(experimentalFeatureOn('studio')).toBe(true)
    expect(experimentalFeaturesPending()).toBe(false)
  })

  it('is off in a production build until the owner switches a feature on', async () => {
    vi.stubEnv('VITE_EXPERIMENTAL_FEATURES', '0')
    vi.resetModules()
    const store = await import('./experimental-features-store')
    expect(store.EXPERIMENTAL_FEATURES_BUILD_DEFAULT).toBe(false)
    expect(store.experimentalFeatureOn('studio')).toBe(false)

    await store.loadExperimentalFeatures({
      base: API,
      fetcher: answering({ studio: true }),
    })

    expect(store.experimentalFeatureOn('studio')).toBe(true)
  })
})

describe('the startup read', () => {
  it('asks nobody in a build with no API, and settles on the default', async () => {
    const fetcher = answering({ studio: false })

    await loadExperimentalFeatures({ base: '', fetcher })

    expect(fetcher.calls).toEqual([])
    expect(experimentalFeatureOn('studio')).toBe(true)
    expect(experimentalFeaturesPending()).toBe(false)
  })

  it("asks the db-worker, holds pending while it waits, and follows the owner's off", async () => {
    const fetcher = answering({ studio: false })

    const read = loadExperimentalFeatures({ base: `${API}/`, fetcher })
    const pendingWhileAsking = experimentalFeaturesPending()
    const onWhileAsking = experimentalFeatureOn('studio')
    await read

    expect(fetcher.calls).toEqual([`${API}/api/features`])
    expect(pendingWhileAsking).toBe(true)
    expect(onWhileAsking).toBe(true)
    expect(experimentalFeatureOn('studio')).toBe(false)
    expect(experimentalFeaturesPending()).toBe(false)
  })

  it('asks once per page, however many times it is called', async () => {
    const fetcher = answering({ studio: false })

    const first = loadExperimentalFeatures({ base: API, fetcher })
    const second = loadExperimentalFeatures({ base: API, fetcher })
    await Promise.all([first, second])

    expect(second).toBe(first)
    expect(fetcher.calls).toHaveLength(1)
  })

  it.each([
    ['an error status', answering({ studio: false }, 500)],
    [
      'a body that is not JSON',
      (async () => new Response('<html>', { status: 200 })) as Fetcher,
    ],
    [
      'a network failure',
      (async () => {
        throw new TypeError('Failed to fetch')
      }) as Fetcher,
    ],
    ['an answer with no switch it knows', answering({ ghost: false })],
  ])('keeps the default on %s', async (_label, fetcher) => {
    await loadExperimentalFeatures({ base: API, fetcher })

    expect(experimentalFeatureOn('studio')).toBe(true)
    expect(experimentalFeaturesPending()).toBe(false)
  })

  it('gives up after its timeout and keeps the default', async () => {
    const started = performance.now()

    await loadExperimentalFeatures({
      base: API,
      fetcher: hanging,
      timeoutMs: 5,
    })

    expect(performance.now() - started).toBeLessThan(FEATURES_READ_TIMEOUT_MS)
    expect(experimentalFeatureOn('studio')).toBe(true)
    expect(experimentalFeaturesPending()).toBe(false)
  })
})

describe('the e2e door', () => {
  it('reads the page origin on a loopback host, from the default the spec hands it', async () => {
    ;(window as { __MP_E2E_EXPERIMENTS__?: unknown }).__MP_E2E_EXPERIMENTS__ = {
      buildDefault: false,
    }
    const fetcher = answering({})

    const read = loadExperimentalFeatures({ base: '', fetcher })
    const onWhileAsking = experimentalFeatureOn('studio')
    await read

    expect(window.location.hostname).toBe('localhost')
    expect(fetcher.calls).toEqual(['/api/features'])
    expect(onWhileAsking).toBe(false)
    expect(experimentalFeatureOn('studio')).toBe(false)
  })

  it('is ignored by a build that has an API to ask', async () => {
    ;(window as { __MP_E2E_EXPERIMENTS__?: unknown }).__MP_E2E_EXPERIMENTS__ = {
      buildDefault: false,
    }
    const fetcher = answering({})

    await loadExperimentalFeatures({ base: API, fetcher })

    expect(fetcher.calls).toEqual([`${API}/api/features`])
    expect(experimentalFeatureOn('studio')).toBe(true)
  })
})
