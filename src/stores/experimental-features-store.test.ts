import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as StoreModule from './experimental-features-store'
import { EXPERIMENTAL_FEATURES_BUILD_DEFAULT, experimentalFeatureOn, experimentalFeaturesBuildDefault, experimentalFeaturesPending, FEATURES_READ_TIMEOUT_MS, loadExperimentalFeatures, REMEMBERED_FEATURES_KEY, resetExperimentalFeaturesStoreForTests, } from './experimental-features-store'

const API = 'https://api.test'

type Fetcher = typeof fetch
type Store = typeof StoreModule

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

/** A fetcher whose one answer the test hands over when it likes. */
function answeringLater(): Fetcher & { answer: (body: unknown) => void } {
  let answer: (body: unknown) => void = () => {}
  const fetcher: Fetcher = () =>
    new Promise<Response>((resolve) => {
      answer = (body) => resolve(Response.json(body))
    })
  return Object.assign(fetcher, { answer: (body: unknown) => answer(body) })
}

/** Every read that gives this page nothing it can use. */
const FAILED_READS: [string, Fetcher][] = [
  ['an error status', answering({ studio: false }, 500)],
  [
    'a body that is not JSON',
    (async () => new Response('<html>', { status: 200 })) as Fetcher,
  ],
  ['a body that is not an object', answering(['studio'])],
  [
    'a network failure',
    (async () => {
      throw new TypeError('Failed to fetch')
    }) as Fetcher,
  ],
]

/** Pages a test opened, each a fresh copy of the store, as a reload makes one. */
const opened: Store[] = []

/**
 * A new page in this same browser, built with experimental features `on` or
 * off by default: off as mercurypitch.com is built, on as the dev deploy is.
 * Storage carries over from the page before, as it does across a reload.
 */
async function openPage(buildDefault: 'on' | 'off'): Promise<Store> {
  vi.stubEnv('VITE_EXPERIMENTAL_FEATURES', buildDefault === 'on' ? '1' : '0')
  vi.resetModules()
  const page = await import('./experimental-features-store')
  opened.push(page)
  return page
}

/** A page on `buildDefault` that heard the owner's `switches`, as the visit before this one did. */
async function heard(
  buildDefault: 'on' | 'off',
  switches: Record<string, boolean>,
): Promise<void> {
  const page = await openPage(buildDefault)
  await page.loadExperimentalFeatures({
    base: API,
    fetcher: answering(switches),
  })
}

afterEach(() => {
  for (const page of opened.splice(0)) {
    page.resetExperimentalFeaturesStoreForTests()
  }
  resetExperimentalFeaturesStoreForTests()
  delete (window as { __MP_E2E_EXPERIMENTS__?: unknown }).__MP_E2E_EXPERIMENTS__
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
  localStorage.clear()
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
    ...FAILED_READS,
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
    // The console says which default this page stands on: the spec's.
    expect(experimentalFeaturesBuildDefault()).toBe(false)
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

// The last answer this browser heard stands until the server answers again.
// Studio's songs live only in this browser, so a switched-on Studio that
// vanished whenever a read was slow or offline took them out of reach for
// that visit, and sent /studio-night Home (the Studio audit's E1).
describe('a browser that heard the owner switch Studio on', () => {
  it('keeps Studio while the read is out, and after the page stops waiting on it', async () => {
    await heard('off', { studio: true })
    const page = await openPage('off')

    const read = page.loadExperimentalFeatures({
      base: API,
      fetcher: hanging,
      timeoutMs: 5,
    })
    const onWhileAsking = page.experimentalFeatureOn('studio')
    await read

    expect(onWhileAsking).toBe(true)
    expect(page.experimentalFeatureOn('studio')).toBe(true)
    expect(page.experimentalFeaturesPending()).toBe(false)
  })

  it.each(FAILED_READS)('keeps Studio through %s', async (_label, fetcher) => {
    await heard('off', { studio: true })
    const page = await openPage('off')

    await page.loadExperimentalFeatures({ base: API, fetcher })

    expect(page.experimentalFeatureOn('studio')).toBe(true)
    expect(page.experimentalFeaturesPending()).toBe(false)
  })

  it('still has it for the page after a failed read', async () => {
    await heard('off', { studio: true })
    const failed = await openPage('off')
    await failed.loadExperimentalFeatures({
      base: API,
      fetcher: hanging,
      timeoutMs: 5,
    })
    const page = await openPage('off')

    const read = page.loadExperimentalFeatures({
      base: API,
      fetcher: answering({}, 503),
    })
    const onWhileAsking = page.experimentalFeatureOn('studio')
    await read

    expect(onWhileAsking).toBe(true)
    expect(page.experimentalFeatureOn('studio')).toBe(true)
  })

  it("hides Studio once the server answers the owner's off", async () => {
    await heard('off', { studio: true })
    const page = await openPage('off')

    const read = page.loadExperimentalFeatures({
      base: API,
      fetcher: answering({ studio: false }),
    })
    const onWhileAsking = page.experimentalFeatureOn('studio')
    await read

    expect(onWhileAsking).toBe(true)
    expect(page.experimentalFeatureOn('studio')).toBe(false)
  })

  it('hands Studio back to the build once the server answers no switch at all', async () => {
    await heard('off', { studio: true })
    const page = await openPage('off')

    await page.loadExperimentalFeatures({ base: API, fetcher: answering({}) })

    expect(page.experimentalFeatureOn('studio')).toBe(false)
  })

  it('keeps nothing heard from another API', async () => {
    await heard('off', { studio: true })
    const page = await openPage('off')

    const read = page.loadExperimentalFeatures({
      base: 'https://api.other.test',
      fetcher: hanging,
      timeoutMs: 5,
    })
    const onWhileAsking = page.experimentalFeatureOn('studio')
    await read

    expect(onWhileAsking).toBe(false)
    expect(page.experimentalFeatureOn('studio')).toBe(false)
  })
})

describe('what a browser heard last', () => {
  it("keeps the owner's off through a failed read where the build's default is on", async () => {
    await heard('on', { studio: false })
    const page = await openPage('on')

    const read = page.loadExperimentalFeatures({
      base: API,
      fetcher: hanging,
      timeoutMs: 5,
    })
    const onWhileAsking = page.experimentalFeatureOn('studio')
    await read

    expect(onWhileAsking).toBe(false)
    expect(page.experimentalFeatureOn('studio')).toBe(false)
  })

  it('takes an answer that lands after the page stopped waiting for the next page, not this one', async () => {
    const late = answeringLater()
    const page = await openPage('off')
    await page.loadExperimentalFeatures({
      base: API,
      fetcher: late,
      timeoutMs: 5,
    })

    late.answer({ studio: true })
    await vi.waitFor(() => {
      expect(localStorage.getItem(REMEMBERED_FEATURES_KEY)).not.toBeNull()
    })
    const next = await openPage('off')
    const read = next.loadExperimentalFeatures({
      base: API,
      fetcher: hanging,
      timeoutMs: 5,
    })
    const onNextWhileAsking = next.experimentalFeatureOn('studio')
    await read

    expect(page.experimentalFeatureOn('studio')).toBe(false)
    expect(onNextWhileAsking).toBe(true)
  })

  it('follows the server on a browser that blocks storage', async () => {
    const blocked = (): never => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    }
    vi.stubGlobal('localStorage', {
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    })
    const page = await openPage('off')

    await page.loadExperimentalFeatures({
      base: API,
      fetcher: answering({ studio: true }),
    })

    expect(page.experimentalFeatureOn('studio')).toBe(true)
    expect(page.experimentalFeaturesPending()).toBe(false)
  })
})
