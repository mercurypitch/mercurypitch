import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'
import type * as StoreModule from './experimental-features-store'
import { EXPERIMENTAL_FEATURES_BUILD_DEFAULT, experimentalFeatureDefault, experimentalFeatureOn, experimentalFeaturesPending, FEATURES_READ_TIMEOUT_MS, loadExperimentalFeatures, REMEMBERED_FEATURES_KEY, resetExperimentalFeaturesStoreForTests, } from './experimental-features-store'

const API = 'https://api.test'

/** A name the db-worker could list ahead of this build: a feature still being built, on in production nowhere. */
const STILL_BEING_BUILT = 'karaoke-v2'

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

/**
 * Every read that gives this page nothing it can use. The error status
 * carries `switches`, the opposite of what the test expects to keep, so a
 * page that read its body would show.
 */
function failedReads(switches: Record<string, boolean>): [string, Fetcher][] {
  return [
    ['an error status', answering(switches, 500)],
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
}

/** Pages a test opened, each a fresh copy of the store, as a reload makes one. */
const opened: Store[] = []

/**
 * A new page in this same browser. `production` is mercurypitch.com's web
 * build: the shared default off, Studio on all the same, as it is on in
 * production. `dev` is the dev deploy's, with every feature on. `native` is
 * the native app's: the shared default off, and nothing on in production
 * reaches it. Storage carries over from the page before, as it does across
 * a reload.
 */
async function openPage(
  build: 'production' | 'dev' | 'native',
): Promise<Store> {
  vi.stubEnv('VITE_EXPERIMENTAL_FEATURES', build === 'dev' ? '1' : '0')
  vi.resetModules()
  if (build === 'native') {
    vi.doMock('@/lib/native-build', async (importOriginal) => ({
      ...(await importOriginal<typeof NativeBuild>()),
      IS_NATIVE_BUILD: true,
    }))
  }
  const page = await import('./experimental-features-store')
  opened.push(page)
  return page
}

/** A page of `build` that heard the owner's `switches`, as the visit before this one did. */
async function heard(
  build: 'production' | 'dev',
  switches: Record<string, boolean>,
): Promise<void> {
  const page = await openPage(build)
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
  vi.doUnmock('@/lib/native-build')
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
  localStorage.clear()
})

describe('the build default', () => {
  it('is on in the test build, as on the dev deploy and in the e2e bundle', () => {
    expect(EXPERIMENTAL_FEATURES_BUILD_DEFAULT).toBe(true)
    expect(experimentalFeatureOn('studio')).toBe(true)
    expect(experimentalFeatureDefault(STILL_BEING_BUILT)).toBe(true)
    expect(experimentalFeaturesPending()).toBe(false)
  })

  it('keeps Studio on in the production build, whose shared default is off, until the owner switches it off', async () => {
    const page = await openPage('production')
    const onBeforeAsking = page.experimentalFeatureOn('studio')

    await page.loadExperimentalFeatures({
      base: API,
      fetcher: answering({ studio: false }),
    })

    expect(page.EXPERIMENTAL_FEATURES_BUILD_DEFAULT).toBe(false)
    expect(page.experimentalFeatureDefault('studio')).toBe(true)
    expect(onBeforeAsking).toBe(true)
    expect(page.experimentalFeatureOn('studio')).toBe(false)
  })

  it('keeps a feature that is not on in production off there, and on for the dev deploy', async () => {
    const production = await openPage('production')
    const productionDefault =
      production.experimentalFeatureDefault(STILL_BEING_BUILT)
    const dev = await openPage('dev')

    expect(productionDefault).toBe(false)
    expect(dev.experimentalFeatureDefault(STILL_BEING_BUILT)).toBe(true)
  })

  it('keeps every feature off in the native app, Studio included', async () => {
    const page = await openPage('native')

    expect(page.experimentalFeatureDefault('studio')).toBe(false)
    expect(page.experimentalFeatureOn('studio')).toBe(false)
    expect(page.experimentalFeatureDefault(STILL_BEING_BUILT)).toBe(false)
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
    ...failedReads({ studio: false }),
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
  it("reads the page origin on a loopback host, and boots on the spec's default: production's, Studio on and the rest off", async () => {
    ;(window as { __MP_E2E_EXPERIMENTS__?: unknown }).__MP_E2E_EXPERIMENTS__ = {
      buildDefault: false,
    }
    const fetcher = answering({})

    const read = loadExperimentalFeatures({ base: '', fetcher })
    const onWhileAsking = experimentalFeatureOn('studio')
    await read

    expect(window.location.hostname).toBe('localhost')
    expect(fetcher.calls).toEqual(['/api/features'])
    expect(onWhileAsking).toBe(true)
    expect(experimentalFeatureOn('studio')).toBe(true)
    // The console says which default this page stands on: the spec's.
    expect(experimentalFeatureDefault(STILL_BEING_BUILT)).toBe(false)
  })

  it('is ignored by a build that has an API to ask', async () => {
    ;(window as { __MP_E2E_EXPERIMENTS__?: unknown }).__MP_E2E_EXPERIMENTS__ = {
      buildDefault: false,
    }
    const fetcher = answering({})

    await loadExperimentalFeatures({ base: API, fetcher })

    expect(fetcher.calls).toEqual([`${API}/api/features`])
    expect(experimentalFeatureDefault(STILL_BEING_BUILT)).toBe(true)
  })
})

// The last answer this browser heard stands until the server answers again,
// an "off" included. With Studio on in production, the owner's off is the
// switch a visitor keeps: a slow or offline read must not bring Studio back
// over it.
describe('a browser that heard the owner switch Studio off in production', () => {
  it('keeps Studio off while the read is out, and after the page stops waiting on it', async () => {
    await heard('production', { studio: false })
    const page = await openPage('production')

    const read = page.loadExperimentalFeatures({
      base: API,
      fetcher: hanging,
      timeoutMs: 5,
    })
    const onWhileAsking = page.experimentalFeatureOn('studio')
    await read

    expect(onWhileAsking).toBe(false)
    expect(page.experimentalFeatureOn('studio')).toBe(false)
    expect(page.experimentalFeaturesPending()).toBe(false)
  })

  it.each(failedReads({ studio: true }))(
    'keeps Studio off through %s',
    async (_label, fetcher) => {
      await heard('production', { studio: false })
      const page = await openPage('production')

      await page.loadExperimentalFeatures({ base: API, fetcher })

      expect(page.experimentalFeatureOn('studio')).toBe(false)
      expect(page.experimentalFeaturesPending()).toBe(false)
    },
  )

  it('still has it for the page after a failed read', async () => {
    await heard('production', { studio: false })
    const failed = await openPage('production')
    await failed.loadExperimentalFeatures({
      base: API,
      fetcher: hanging,
      timeoutMs: 5,
    })
    const page = await openPage('production')

    const read = page.loadExperimentalFeatures({
      base: API,
      fetcher: answering({}, 503),
    })
    const onWhileAsking = page.experimentalFeatureOn('studio')
    await read

    expect(onWhileAsking).toBe(false)
    expect(page.experimentalFeatureOn('studio')).toBe(false)
  })

  it('hands Studio back to its default, on, once the owner clears the switch', async () => {
    await heard('production', { studio: false })
    const page = await openPage('production')

    const read = page.loadExperimentalFeatures({
      base: API,
      fetcher: answering({}),
    })
    const onWhileAsking = page.experimentalFeatureOn('studio')
    await read

    expect(onWhileAsking).toBe(false)
    expect(page.experimentalFeatureOn('studio')).toBe(true)
  })

  it('keeps nothing heard from another API', async () => {
    await heard('production', { studio: false })
    const page = await openPage('production')

    const read = page.loadExperimentalFeatures({
      base: 'https://api.other.test',
      fetcher: hanging,
      timeoutMs: 5,
    })
    const onWhileAsking = page.experimentalFeatureOn('studio')
    await read

    expect(onWhileAsking).toBe(true)
    expect(page.experimentalFeatureOn('studio')).toBe(true)
  })
})

describe('what a browser heard last', () => {
  it("keeps the owner's off through a failed read on the dev deploy too", async () => {
    await heard('dev', { studio: false })
    const page = await openPage('dev')

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
    const page = await openPage('production')
    await page.loadExperimentalFeatures({
      base: API,
      fetcher: late,
      timeoutMs: 5,
    })

    late.answer({ studio: false })
    await vi.waitFor(() => {
      expect(localStorage.getItem(REMEMBERED_FEATURES_KEY)).not.toBeNull()
    })
    const next = await openPage('production')
    const read = next.loadExperimentalFeatures({
      base: API,
      fetcher: hanging,
      timeoutMs: 5,
    })
    const onNextWhileAsking = next.experimentalFeatureOn('studio')
    await read

    expect(page.experimentalFeatureOn('studio')).toBe(true)
    expect(onNextWhileAsking).toBe(false)
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
    const page = await openPage('production')

    await page.loadExperimentalFeatures({
      base: API,
      fetcher: answering({ studio: false }),
    })

    expect(page.experimentalFeatureOn('studio')).toBe(false)
    expect(page.experimentalFeaturesPending()).toBe(false)
  })
})
