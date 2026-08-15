import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SwStaleBuildNotice } from './sw-runtime'
import { BUILD_ID_MESSAGE, CACHE_PREFIX, createServiceWorkerRuntime, extensionOf, firstPaintAssets, htmlBelongsToBuild, isVersionedAssetPath, manifestRevision, SHELL_KEY, SKIP_WAITING_MESSAGE, STALE_BUILD_MESSAGE, STANDALONE_DOCUMENT_PATHS, } from './sw-runtime'

// These tests are the reason the caching rules live outside src/sw.ts. Every
// case here is a thing that happened, or would have: a deploy landing between
// two fetches, a chunk answered with index.html and a 200, a cache surviving
// from a build whose chunks are gone. In a browser each of them needs a
// deployment to reproduce; here they are a fake CacheStorage and a fake fetch.

const ORIGIN = 'https://mercurypitch.test'
const BASE_URL = `${ORIGIN}/`
const BUILD_ID = 'abc1234'

const ENTRY_JS = '/assets/index-AAAAAAAA.js'
const ENTRY_CSS = '/assets/index-BBBBBBBB.css'
const LAZY_JS = '/assets/Exercises-CCCCCCCC.js'
const FOREIGN_JS = '/assets/index-D3adB33f.js'

const MANIFEST = [
  { url: ENTRY_JS, revision: null },
  { url: ENTRY_CSS, revision: null },
  { url: LAZY_JS, revision: null },
  { url: '/site.webmanifest', revision: null },
  { url: '/favicon.svg', revision: null },
  { url: '/icon-192.png', revision: null },
]

const ALLOWED = new Set(MANIFEST.map((entry) => entry.url))

function shellHtml(entry = ENTRY_JS): string {
  return [
    '<!doctype html><html><head>',
    `<link rel="stylesheet" href="${ENTRY_CSS}">`,
    '<link rel="icon" href="/favicon.svg">',
    '</head><body><div id="root"></div>',
    `<script type="module" crossorigin src="${entry}"></script>`,
    '</body></html>',
  ].join('')
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function javascript(body = 'export default 1'): Response {
  return new Response(body, {
    headers: { 'content-type': 'application/javascript' },
  })
}

function stylesheet(body = '.a{}'): Response {
  return new Response(body, { headers: { 'content-type': 'text/css' } })
}

function image(): Response {
  return new Response('png', { headers: { 'content-type': 'image/png' } })
}

function json(body = '{}'): Response {
  return new Response(body, {
    headers: { 'content-type': 'application/manifest+json' },
  })
}

/** A request object with only the members the runtime reads. */
function request(
  path: string,
  init: { method?: string; mode?: string; headers?: HeadersInit } = {},
): Request {
  return {
    url: path.startsWith('http') ? path : `${ORIGIN}${path}`,
    method: init.method ?? 'GET',
    mode: init.mode ?? 'no-cors',
    headers: new Headers(init.headers),
  } as unknown as Request
}

function navigation(path: string): Request {
  return request(path, { mode: 'navigate' })
}

function pathOf(key: RequestInfo | URL): string {
  const raw =
    typeof key === 'string'
      ? key
      : key instanceof URL
        ? key.href
        : (key as Request).url
  return new URL(raw, BASE_URL).pathname
}

class FakeCache {
  readonly entries = new Map<string, Response>()

  async match(key: RequestInfo | URL): Promise<Response | undefined> {
    // Real Cache hands out a fresh body every time; without the clone the
    // second read in a test would throw instead of the assertion failing.
    return Promise.resolve(this.entries.get(pathOf(key))?.clone())
  }

  async put(key: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(pathOf(key), response)
    return Promise.resolve()
  }

  async keys(): Promise<Request[]> {
    return Promise.resolve(
      [...this.entries.keys()].map(
        (path) => ({ url: `${ORIGIN}${path}` }) as unknown as Request,
      ),
    )
  }

  async delete(key: RequestInfo | URL): Promise<boolean> {
    return Promise.resolve(this.entries.delete(pathOf(key)))
  }
}

class FakeCacheStorage {
  readonly opened = new Map<string, FakeCache>()

  async open(name: string): Promise<FakeCache> {
    const existing = this.opened.get(name)
    if (existing !== undefined) return Promise.resolve(existing)
    const created = new FakeCache()
    this.opened.set(name, created)
    return Promise.resolve(created)
  }

  async keys(): Promise<string[]> {
    return Promise.resolve([...this.opened.keys()])
  }

  async delete(name: string): Promise<boolean> {
    return Promise.resolve(this.opened.delete(name))
  }
}

interface Harness {
  runtime: ReturnType<typeof createServiceWorkerRuntime>
  caches: FakeCacheStorage
  fetched: string[]
  notices: SwStaleBuildNotice[]
  respond: (path: string, factory: () => Response) => void
  cacheEntries: () => Promise<string[]>
}

function harness(
  options: {
    manifest?: { url: string; revision: string | null }[]
    buildId?: string
    routes?: Record<string, () => Response>
  } = {},
): Harness {
  const cacheStorage = new FakeCacheStorage()
  const fetched: string[] = []
  const notices: SwStaleBuildNotice[] = []
  const routes = new Map<string, () => Response>(
    Object.entries(options.routes ?? {}),
  )

  const runtime = createServiceWorkerRuntime({
    manifest: options.manifest ?? MANIFEST,
    buildId: options.buildId ?? BUILD_ID,
    baseUrl: BASE_URL,
    env: {
      caches: cacheStorage as unknown as CacheStorage,
      fetch: async (input) => {
        const path = pathOf(input as RequestInfo)
        fetched.push(path)
        const route = routes.get(path)
        if (route === undefined) {
          return Promise.reject(new Error(`unrouted fetch: ${path}`))
        }
        return Promise.resolve(route())
      },
      notifyClients: (message) => notices.push(message),
    },
  })

  return {
    runtime,
    caches: cacheStorage,
    fetched,
    notices,
    respond: (path, factory) => routes.set(path, factory),
    cacheEntries: async () => {
      const cache = await cacheStorage.open(runtime.cacheName)
      return [...cache.entries.keys()].sort()
    },
  }
}

/** Everything a healthy deploy answers. */
function healthyRoutes(): Record<string, () => Response> {
  return {
    [SHELL_KEY]: () => html(shellHtml()),
    [ENTRY_JS]: () => javascript(),
    [ENTRY_CSS]: () => stylesheet(),
    [LAZY_JS]: () => javascript(),
    '/site.webmanifest': () => json(),
    '/favicon.svg': () =>
      new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }),
    '/icon-192.png': () => image(),
  }
}

describe('the standalone documents', () => {
  it('excludes every URL vite.config.ts routes to a document of its own', () => {
    // The cost of missing one changed with the precached shell. Network-first
    // fetched whatever the origin answered, so an alias left off this list
    // still served the right product; cache-first answers it with the app
    // shell, and the visitor gets the studio where Voice Mirror should be.
    // Each `const X_PATHS = new Set([...])` in the build config is one
    // mini-app's URLs, and TONE_DEAF_PATH redirects onto one.
    const config = readFileSync(
      resolve(process.cwd(), 'vite.config.ts'),
      'utf8',
    )
    const declarations = [
      ...config.matchAll(
        /const [A-Z_]+_PATHS?\s*=\s*(new Set\(\[[^\]]*\]\)|'[^']*')/g,
      ),
    ]
    const paths = declarations.flatMap((match) =>
      [...(match[1] ?? '').matchAll(/'(\/[^']*)'/g)].map((inner) => inner[1]),
    )

    expect(paths.length).toBeGreaterThan(10)
    for (const path of paths) {
      expect(
        STANDALONE_DOCUMENT_PATHS.has(path as string),
        `${path} is its own document in vite.config.ts, so the worker must not answer it with the app shell`,
      ).toBe(true)
    }
  })

  it('does not claim the app shell itself', () => {
    expect(STANDALONE_DOCUMENT_PATHS.has('/')).toBe(false)
    expect(STANDALONE_DOCUMENT_PATHS.has('/index.html')).toBe(false)
  })
})

describe('manifestRevision', () => {
  it('names a set of URLs, not an order', () => {
    expect(manifestRevision(['/a.js', '/b.js'])).toBe(
      manifestRevision(['/b.js', '/a.js']),
    )
  })

  it('changes when the shipped set changes', () => {
    expect(manifestRevision(['/a.js'])).not.toBe(
      manifestRevision(['/a.js', '/b.js']),
    )
    expect(manifestRevision(['/index-AAA.js'])).not.toBe(
      manifestRevision(['/index-BBB.js']),
    )
  })

  it('separates entries, so a shifted boundary is a different build', () => {
    expect(manifestRevision(['/ab', '/c'])).not.toBe(
      manifestRevision(['/a', '/bc']),
    )
  })

  it('is eight hex characters, so the cache name stays readable', () => {
    expect(manifestRevision(['/a.js'])).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('path classification', () => {
  it('reads the extension only when it belongs to the last segment', () => {
    expect(extensionOf('/assets/index-AAA.js')).toBe('.js')
    expect(extensionOf('/a.b/c')).toBe('')
    expect(extensionOf('/assets/FILE.JS')).toBe('.js')
  })

  it('recognises build output, and nothing else', () => {
    expect(isVersionedAssetPath(ENTRY_JS)).toBe(true)
    expect(isVersionedAssetPath(ENTRY_CSS)).toBe(true)
    expect(isVersionedAssetPath('/assets/logo-AAA.png')).toBe(false)
    expect(isVersionedAssetPath('/models/pitch.onnx')).toBe(false)
    expect(isVersionedAssetPath('/assets/nodots')).toBe(false)
  })
})

describe('htmlBelongsToBuild', () => {
  it('accepts a shell whose scripts this build shipped', () => {
    expect(htmlBelongsToBuild(shellHtml(), ALLOWED)).toBe(true)
  })

  it('rejects a shell naming an entry from another deploy', () => {
    expect(htmlBelongsToBuild(shellHtml(FOREIGN_JS), ALLOWED)).toBe(false)
  })

  it('rejects a document with no build output at all', () => {
    expect(htmlBelongsToBuild('<!doctype html><h1>502</h1>', ALLOWED)).toBe(
      false,
    )
  })

  it('ignores stylesheets and preloads, which are not the chunk map', () => {
    const withForeignCss = [
      '<link rel="stylesheet" href="/assets/theme-ZZZZZZZZ.css">',
      `<script type="module" src="${ENTRY_JS}"></script>`,
    ].join('')
    expect(htmlBelongsToBuild(withForeignCss, ALLOWED)).toBe(true)
  })
})

describe('firstPaintAssets', () => {
  it('collects the shell subresources this build shipped', () => {
    expect(firstPaintAssets(shellHtml(), ALLOWED).sort()).toEqual(
      [ENTRY_CSS, ENTRY_JS].sort(),
    )
  })

  it('drops references the manifest does not list', () => {
    expect(firstPaintAssets(shellHtml(FOREIGN_JS), ALLOWED)).toEqual([
      ENTRY_CSS,
    ])
  })

  it('deduplicates a URL referenced twice', () => {
    const doubled = `<script src="${ENTRY_JS}"></script><link href="${ENTRY_JS}">`
    expect(firstPaintAssets(doubled, ALLOWED)).toEqual([ENTRY_JS])
  })
})

describe('install', () => {
  it('precaches the shell and what it needs to boot', async () => {
    const app = harness({ routes: healthyRoutes() })
    await app.runtime.install()

    expect(await app.cacheEntries()).toEqual(
      [
        SHELL_KEY,
        ENTRY_JS,
        ENTRY_CSS,
        '/site.webmanifest',
        '/favicon.svg',
        '/icon-192.png',
      ].sort(),
    )
    // The lazily-loaded chunk is deliberately not part of the eager set.
    expect(app.fetched).not.toContain(LAZY_JS)
  })

  it('names the cache after the shipped set, so builds do not share one', () => {
    const app = harness()
    const other = harness({
      manifest: [
        ...MANIFEST,
        { url: '/assets/extra-EEEEEEEE.js', revision: null },
      ],
    })
    expect(app.runtime.cacheName).toMatch(
      new RegExp(`^${CACHE_PREFIX}[0-9a-f]{8}$`),
    )
    expect(app.runtime.cacheName).not.toBe(other.runtime.cacheName)
  })

  it('refuses a shell built from a different deploy', async () => {
    const app = harness({
      routes: {
        ...healthyRoutes(),
        [SHELL_KEY]: () => html(shellHtml(FOREIGN_JS)),
      },
    })

    await expect(app.runtime.install()).rejects.toThrow(/different build/)
    // Nothing was stored: the visitor keeps the build they already have.
    expect(await app.cacheEntries()).not.toContain(SHELL_KEY)
  })

  it('refuses a shell request the origin did not answer with a document', async () => {
    const app = harness({
      routes: {
        ...healthyRoutes(),
        [SHELL_KEY]: () => new Response('', { status: 503 }),
      },
    })
    await expect(app.runtime.install()).rejects.toThrow(/did not answer/)
  })

  it('fails rather than activating when the origin is unreachable', async () => {
    const app = harness({ routes: {} })
    await expect(app.runtime.install()).rejects.toThrow(/unrouted fetch/)
  })

  it('copies a previous build forward instead of re-downloading it', async () => {
    const app = harness({ routes: healthyRoutes() })
    const previous = await app.caches.open(`${CACHE_PREFIX}00000001`)
    await previous.put(ENTRY_JS, javascript('cached copy'))
    await previous.put(ENTRY_CSS, stylesheet())
    // Not this build's, and the shell is build-specific: neither may travel.
    await previous.put(FOREIGN_JS, javascript())
    await previous.put(SHELL_KEY, html(shellHtml(FOREIGN_JS)))

    await app.runtime.install()

    expect(app.fetched).not.toContain(ENTRY_JS)
    expect(app.fetched).not.toContain(ENTRY_CSS)
    expect(app.fetched).toContain(SHELL_KEY)
    const entries = await app.cacheEntries()
    expect(entries).toContain(ENTRY_JS)
    expect(entries).not.toContain(FOREIGN_JS)

    const cache = await app.caches.open(app.runtime.cacheName)
    expect(await (await cache.match(ENTRY_JS))?.text()).toBe('cached copy')
    // The shell that came back from the network, not the one carried forward.
    expect(await (await cache.match(SHELL_KEY))?.text()).toContain(ENTRY_JS)
  })

  it('copies a URL once when two previous builds both hold it', async () => {
    const app = harness({ routes: healthyRoutes() })
    const older = await app.caches.open(`${CACHE_PREFIX}00000001`)
    const newer = await app.caches.open(`${CACHE_PREFIX}00000002`)
    await older.put(ENTRY_JS, javascript('from the older build'))
    await newer.put(ENTRY_JS, javascript('from the newer build'))

    await app.runtime.install()

    const cache = await app.caches.open(app.runtime.cacheName)
    // Same hashed URL means the same bytes, so first one wins and the second
    // is skipped rather than overwriting it.
    expect(await (await cache.match(ENTRY_JS))?.text()).toBe(
      'from the older build',
    )
    expect(app.fetched).not.toContain(ENTRY_JS)
  })

  it('survives an entry evicted between listing it and reading it', async () => {
    const app = harness({ routes: healthyRoutes() })
    const previous = await app.caches.open(`${CACHE_PREFIX}00000001`)
    await previous.put(LAZY_JS, javascript())
    // The quota manager can drop an entry at any moment, including between
    // these two calls. Copying forward must not fail the whole install for it.
    previous.match = async () => Promise.resolve(undefined)

    await expect(app.runtime.install()).resolves.toBeUndefined()
    expect(await app.cacheEntries()).not.toContain(LAZY_JS)
  })

  it('does not request a shell asset this build did not ship', async () => {
    const app = harness({
      manifest: MANIFEST.filter((entry) => entry.url !== '/favicon.svg'),
      routes: healthyRoutes(),
    })

    await app.runtime.install()

    expect(app.fetched).not.toContain('/favicon.svg')
    expect(await app.cacheEntries()).not.toContain('/favicon.svg')
  })

  it('still adopts the build when storage is full', async () => {
    const app = harness({ routes: healthyRoutes() })
    const previous = await app.caches.open(`${CACHE_PREFIX}00000001`)
    await previous.put(LAZY_JS, javascript())
    const cache = await app.caches.open(app.runtime.cacheName)
    cache.put = async () =>
      Promise.reject(new DOMException('Quota exceeded', 'QuotaExceededError'))

    // A visitor whose quota is full must not be stranded on a build they can
    // never leave: the worker installs, and serves from the network instead.
    await expect(app.runtime.install()).resolves.toBeUndefined()

    const response = await app.runtime.handleFetch(navigation('/'))
    expect(await response?.text()).toContain(ENTRY_JS)
  })

  it('ignores caches belonging to something else on the origin', async () => {
    const app = harness({ routes: healthyRoutes() })
    const foreign = await app.caches.open('some-other-feature')
    await foreign.put(ENTRY_JS, javascript('not ours'))

    await app.runtime.install()

    expect(app.fetched).toContain(ENTRY_JS)
  })

  it('finishes even when a first-paint asset cannot be fetched', async () => {
    const routes = healthyRoutes()
    delete routes[ENTRY_CSS]
    const app = harness({ routes })

    await expect(app.runtime.install()).resolves.toBeUndefined()
    expect(await app.cacheEntries()).toContain(ENTRY_JS)
    expect(await app.cacheEntries()).not.toContain(ENTRY_CSS)
  })

  it('never stores a response whose type contradicts its URL', async () => {
    const app = harness({
      routes: { ...healthyRoutes(), [ENTRY_JS]: () => html(shellHtml()) },
    })

    await app.runtime.install()

    expect(await app.cacheEntries()).not.toContain(ENTRY_JS)
  })

  it('revalidates stable names and trusts hashed ones', async () => {
    const seen: { path: string; init: RequestInit | undefined }[] = []
    const cacheStorage = new FakeCacheStorage()
    const routes = healthyRoutes()
    const runtime = createServiceWorkerRuntime({
      manifest: MANIFEST,
      buildId: BUILD_ID,
      baseUrl: BASE_URL,
      env: {
        caches: cacheStorage as unknown as CacheStorage,
        fetch: async (input, init) => {
          const path = pathOf(input as RequestInfo)
          seen.push({ path, init })
          return Promise.resolve(
            (routes[path] ?? (() => new Response('', { status: 404 })))(),
          )
        },
        notifyClients: () => undefined,
      },
    })

    await runtime.install()

    const hashed = seen.find((call) => call.path === ENTRY_JS)
    const stable = seen.find((call) => call.path === '/site.webmanifest')
    expect(hashed?.init).toBeUndefined()
    expect(stable?.init).toEqual({ cache: 'no-cache' })
  })
})

describe('activate', () => {
  it('drops the other builds and keeps this one', async () => {
    const app = harness({ routes: healthyRoutes() })
    await app.caches.open(`${CACHE_PREFIX}00000001`)
    await app.caches.open(`${CACHE_PREFIX}00000002`)
    await app.caches.open('some-other-feature')
    await app.runtime.install()

    await app.runtime.activate()

    expect((await app.caches.keys()).sort()).toEqual(
      [app.runtime.cacheName, 'some-other-feature'].sort(),
    )
  })
})

describe('navigation', () => {
  it('answers from the precache without touching the network', async () => {
    const app = harness({ routes: healthyRoutes() })
    await app.runtime.install()
    const fetchesAfterInstall = app.fetched.length

    const response = await app.runtime.handleFetch(navigation('/exercises'))

    expect(await response?.text()).toContain(ENTRY_JS)
    expect(app.fetched.length).toBe(fetchesAfterInstall)
  })

  it('serves the shell for a deep link, not just the root', async () => {
    const app = harness({ routes: healthyRoutes() })
    await app.runtime.install()

    const response = await app.runtime.handleFetch(
      navigation('/settings?tab=audio'),
    )

    expect(response?.status).toBe(200)
    expect(await response?.text()).toContain('id="root"')
  })

  it('falls back to the network before the first install finishes', async () => {
    const app = harness({ routes: healthyRoutes() })

    const response = await app.runtime.handleFetch(navigation('/'))

    expect(response?.status).toBe(200)
    expect(app.fetched).toContain(SHELL_KEY)
    // And adopts it, because it is this build's.
    expect(await app.cacheEntries()).toContain(SHELL_KEY)
  })

  it('serves but never caches a document from another build', async () => {
    const app = harness({
      routes: {
        ...healthyRoutes(),
        [SHELL_KEY]: () => html(shellHtml(FOREIGN_JS)),
      },
    })

    const response = await app.runtime.handleFetch(navigation('/'))

    expect(await response?.text()).toContain(FOREIGN_JS)
    expect(await app.cacheEntries()).not.toContain(SHELL_KEY)
  })

  it('discards a cached shell whose chunks this build does not have', async () => {
    const app = harness({ routes: healthyRoutes() })
    const cache = await app.caches.open(app.runtime.cacheName)
    await cache.put(SHELL_KEY, html(shellHtml(FOREIGN_JS)))

    const response = await app.runtime.handleFetch(navigation('/'))

    expect(await response?.text()).toContain(ENTRY_JS)
    expect(app.fetched).toContain(SHELL_KEY)
    // Replaced, not left to be served again on the next navigation.
    const stored = await cache.match(SHELL_KEY)
    expect(await stored?.text()).toContain(ENTRY_JS)
  })

  it('passes an error page straight through without caching it', async () => {
    const app = harness({
      routes: {
        ...healthyRoutes(),
        [SHELL_KEY]: () =>
          new Response('gateway timeout', {
            status: 504,
            headers: { 'content-type': 'text/html' },
          }),
      },
    })

    const response = await app.runtime.handleFetch(navigation('/'))

    expect(response?.status).toBe(504)
    expect(await app.cacheEntries()).not.toContain(SHELL_KEY)
  })

  it('hands a redirect back to the browser instead of following it', async () => {
    const app = harness({
      routes: {
        [SHELL_KEY]: () => {
          const response = html(shellHtml())
          Object.defineProperty(response, 'redirected', { value: true })
          Object.defineProperty(response, 'url', {
            value: `${ORIGIN}/somewhere-else`,
          })
          return response
        },
      },
    })

    const response = await app.runtime.handleFetch(navigation('/'))

    expect(response?.status).toBe(302)
    expect(response?.headers.get('location')).toBe(`${ORIGIN}/somewhere-else`)
    expect(await app.cacheEntries()).not.toContain(SHELL_KEY)
  })

  it('stays out of the way of the standalone documents', async () => {
    const app = harness({ routes: healthyRoutes() })
    await app.runtime.install()

    for (const path of [
      '/mirror',
      '/free-sing',
      '/karaoke-night',
      '/jam',
      '/piano-night',
    ]) {
      expect(app.runtime.handleFetch(navigation(path))).toBeUndefined()
    }
  })

  it('stays out of the way of the API', async () => {
    const app = harness({ routes: healthyRoutes() })
    await app.runtime.install()

    expect(app.runtime.handleFetch(navigation('/api/session'))).toBeUndefined()
  })
})

describe('assets', () => {
  let app: Harness

  beforeEach(async () => {
    app = harness({ routes: healthyRoutes() })
    await app.runtime.install()
    app.fetched.length = 0
  })

  it('answers a precached chunk without a request', async () => {
    const response = await app.runtime.handleFetch(request(ENTRY_JS))

    expect(response?.status).toBe(200)
    expect(app.fetched).toEqual([])
  })

  it('fetches and stores a chunk that was not part of the first paint', async () => {
    const response = await app.runtime.handleFetch(request(LAZY_JS))

    expect(response?.status).toBe(200)
    expect(app.fetched).toEqual([LAZY_JS])
    expect(await app.cacheEntries()).toContain(LAZY_JS)
  })

  it('turns the SPA fallback under a chunk URL into a load failure', async () => {
    app.respond(LAZY_JS, () => html(shellHtml()))

    const response = await app.runtime.handleFetch(request(LAZY_JS))

    expect(response?.status).toBe(503)
    expect(await response?.text()).toBe('')
    expect(await app.cacheEntries()).not.toContain(LAZY_JS)
    expect(app.notices).toEqual([{ type: STALE_BUILD_MESSAGE, path: LAZY_JS }])
  })

  it('passes through a non-cacheable answer that is not build output', async () => {
    app.respond('/site.webmanifest', () => new Response('', { status: 404 }))
    const cache = await app.caches.open(app.runtime.cacheName)
    await cache.delete('/site.webmanifest')

    const response = await app.runtime.handleFetch(request('/site.webmanifest'))

    expect(response?.status).toBe(404)
    expect(app.notices).toEqual([])
  })

  it('fails a previous build’s chunk cleanly instead of serving HTML', async () => {
    app.respond(FOREIGN_JS, () => html(shellHtml()))

    const response = await app.runtime.handleFetch(request(FOREIGN_JS))

    expect(response?.status).toBe(503)
    expect(app.notices).toEqual([
      { type: STALE_BUILD_MESSAGE, path: FOREIGN_JS },
    ])
    expect(await app.cacheEntries()).not.toContain(FOREIGN_JS)
  })

  it('reports a previous build’s chunk that 404s, and passes the 404 on', async () => {
    app.respond(FOREIGN_JS, () => new Response('', { status: 404 }))

    const response = await app.runtime.handleFetch(request(FOREIGN_JS))

    expect(response?.status).toBe(404)
    expect(app.notices).toEqual([
      { type: STALE_BUILD_MESSAGE, path: FOREIGN_JS },
    ])
  })

  it('leaves a previous build’s chunk alone while it is still served', async () => {
    app.respond(FOREIGN_JS, () => javascript())

    const response = await app.runtime.handleFetch(request(FOREIGN_JS))

    expect(response?.status).toBe(200)
    expect(app.notices).toEqual([])
    expect(await app.cacheEntries()).not.toContain(FOREIGN_JS)
  })

  it('never stores an opaque response, which it cannot inspect', async () => {
    app.respond(LAZY_JS, () => {
      const response = javascript()
      Object.defineProperty(response, 'type', { value: 'opaque' })
      return response
    })

    const response = await app.runtime.handleFetch(request(LAZY_JS))

    expect(response?.status).toBe(200)
    expect(await app.cacheEntries()).not.toContain(LAZY_JS)
  })

  it('never stores a response that came from somewhere else', async () => {
    app.respond(LAZY_JS, () => {
      const response = javascript()
      Object.defineProperty(response, 'redirected', { value: true })
      return response
    })

    const response = await app.runtime.handleFetch(request(LAZY_JS))

    expect(response?.status).toBe(200)
    expect(await app.cacheEntries()).not.toContain(LAZY_JS)
  })

  it('never stores a response that declares no type at all', async () => {
    app.respond(LAZY_JS, () => new Response(null))

    const response = await app.runtime.handleFetch(request(LAZY_JS))

    expect(response?.status).toBe(200)
    expect(await app.cacheEntries()).not.toContain(LAZY_JS)
    // Untyped is not the SPA fallback, so it is not evidence of a deploy.
    expect(app.notices).toEqual([])
  })

  it('serves the network when storage refuses to answer at all', async () => {
    // Site data cleared mid-session, or storage disabled under a policy. A
    // promise that rejects inside respondWith() shows the browser's
    // network-error page, so every cache touch has to degrade instead.
    app.caches.open = async () =>
      Promise.reject(new DOMException('denied', 'SecurityError'))

    const asset = await app.runtime.handleFetch(request(LAZY_JS))
    const document = await app.runtime.handleFetch(navigation('/'))

    expect(asset?.status).toBe(200)
    expect(await document?.text()).toContain(ENTRY_JS)
  })

  it('serves the response even when it cannot be stored', async () => {
    const cache = await app.caches.open(app.runtime.cacheName)
    cache.put = async () =>
      Promise.reject(new DOMException('Quota exceeded', 'QuotaExceededError'))

    const response = await app.runtime.handleFetch(request(LAZY_JS))

    expect(response?.status).toBe(200)
    expect(await response?.text()).toBe('export default 1')
  })

  it('never stores an extension it has no rule for', async () => {
    const withText = harness({
      manifest: [...MANIFEST, { url: '/robots.txt', revision: null }],
      routes: {
        ...healthyRoutes(),
        '/robots.txt': () =>
          new Response('User-agent: *', {
            headers: { 'content-type': 'text/plain' },
          }),
      },
    })
    await withText.runtime.install()

    const response = await withText.runtime.handleFetch(request('/robots.txt'))

    expect(await response?.text()).toBe('User-agent: *')
    expect(await withText.cacheEntries()).not.toContain('/robots.txt')
  })
})

describe('what the worker declines to handle', () => {
  let app: Harness

  beforeEach(async () => {
    app = harness({ routes: healthyRoutes() })
    await app.runtime.install()
  })

  it('ignores anything that is not a GET', () => {
    expect(
      app.runtime.handleFetch(request('/api/takes', { method: 'POST' })),
    ).toBeUndefined()
  })

  it('ignores other origins', () => {
    expect(
      app.runtime.handleFetch(request('https://fonts.googleapis.com/css2')),
    ).toBeUndefined()
  })

  it('ignores range requests, which a cache cannot satisfy', () => {
    expect(
      app.runtime.handleFetch(
        request(LAZY_JS, { headers: { range: 'bytes=0-1' } }),
      ),
    ).toBeUndefined()
  })

  it('ignores models, media and anything else off the manifest', () => {
    expect(
      app.runtime.handleFetch(request('/models/pitch.onnx')),
    ).toBeUndefined()
    expect(app.runtime.handleFetch(request('/og-image.png'))).toBeUndefined()
    expect(app.runtime.handleFetch(request('/api/me'))).toBeUndefined()
  })
})

describe('messages', () => {
  const app = harness()

  it('recognises the accepted-update message', () => {
    expect(app.runtime.handleMessage({ type: SKIP_WAITING_MESSAGE })).toEqual({
      kind: 'skip-waiting',
    })
  })

  it('answers the build-id question with what it was built from', () => {
    expect(app.runtime.handleMessage({ type: BUILD_ID_MESSAGE })).toEqual({
      kind: 'build-id',
      buildId: BUILD_ID,
    })
  })

  it('ignores anything else, including data with no shape at all', () => {
    expect(app.runtime.handleMessage(undefined)).toBeUndefined()
    expect(app.runtime.handleMessage(null)).toBeUndefined()
    expect(app.runtime.handleMessage('skip-waiting')).toBeUndefined()
    expect(app.runtime.handleMessage({})).toBeUndefined()
    expect(
      app.runtime.handleMessage({ type: 'something-else' }),
    ).toBeUndefined()
  })
})

describe('the runtime it exposes to src/sw.ts', () => {
  it('reports the build and the allowlist it was created with', () => {
    const app = harness()
    expect(app.runtime.buildId).toBe(BUILD_ID)
    expect([...app.runtime.allowedPaths].sort()).toEqual([...ALLOWED].sort())
  })

  it('resolves manifest URLs against the worker scope', () => {
    const app = harness({
      manifest: [{ url: 'assets/relative-FFFFFFFF.js', revision: null }],
    })
    expect(app.runtime.allowedPaths.has('/assets/relative-FFFFFFFF.js')).toBe(
      true,
    )
  })

  it('does not notify anyone when nothing is stale', async () => {
    const notify = vi.fn()
    const cacheStorage = new FakeCacheStorage()
    const routes = healthyRoutes()
    const runtime = createServiceWorkerRuntime({
      manifest: MANIFEST,
      buildId: BUILD_ID,
      baseUrl: BASE_URL,
      env: {
        caches: cacheStorage as unknown as CacheStorage,
        fetch: async (input) =>
          Promise.resolve(
            (
              routes[pathOf(input as RequestInfo)] ?? (() => new Response(''))
            )(),
          ),
        notifyClients: notify,
      },
    })

    await runtime.install()
    await runtime.handleFetch(navigation('/'))
    await runtime.handleFetch(request(ENTRY_JS))

    expect(notify).not.toHaveBeenCalled()
  })
})
