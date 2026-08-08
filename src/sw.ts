// ============================================================
// sw.ts — the MercuryPitch service worker
// ============================================================
// Built by vite-plugin-pwa's `injectManifest` strategy and emitted as
// dist/sw.js, at the site root, so its scope is the whole origin. It exists
// first to make the app installable (Chrome will not offer "Install app"
// without a service worker that handles `fetch`) and second to make the
// installed app open offline.
//
// It is hand-written rather than generated because the caching rules are the
// interesting part of the file, and two hazards shape every one of them.
//
// 1. `wrangler.jsonc` sets `assets.not_found_handling:
//    "single-page-application"`, so a path that no longer exists answers with
//    index.html and a 200 — not a 404. A cache-first strategy that missed on a
//    deleted hashed chunk would store HTML under a `.js` URL, and every later
//    load of that URL would be a syntax error no reload could clear. So only
//    URLs in *this* build's manifest are ever read from the cache, and nothing
//    enters a cache until its content type matches what its extension claims.
//
// 2. An index.html from one deploy served next to another deploy's chunk map
//    reproduces `vite:preloadError` forever, and the 60s cooldown in
//    src/lib/chunk-load-recovery.ts means the second failure lands on the
//    error boundary instead of recovering. So entry HTML is network-first,
//    never cache-first, and `activate` drops every cached entry that the new
//    build's manifest does not list.
//
// Deliberately never cached: public/models/** (ONNX/WASM), anything from R2,
// and audio or video. They are large, already CDN-cached, and would exhaust
// the storage quota. Cross-origin requests are not touched at all.

/// <reference lib="webworker" />

// Forces module scope, which is what lets `self` below be re-declared as the
// worker global instead of colliding with lib.dom's `Window`. Rollup drops it
// from the IIFE bundle.
export {}

interface PrecacheEntry {
  url: string
  revision: string | null
}

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: PrecacheEntry[]
}

/**
 * Bump only when the caching scheme itself changes. The name is otherwise
 * stable across deploys on purpose: a per-build cache would re-download the
 * whole first-paint payload every release, and `activate` already prunes
 * everything the new build does not list.
 */
const CACHE_NAME = 'mercurypitch-assets-v1'

/**
 * The shell document is cached under the bare origin root because that is
 * `start_url` in site.webmanifest, and because `/index.html` is a redirect on
 * some static hosts (a redirected response is not a response to the URL we
 * asked for, so it must not be cached).
 */
const SHELL_KEY = '/'

/** Posted by src/lib/pwa-service-worker.ts when the user accepts an update. */
const SKIP_WAITING_MESSAGE = 'mercurypitch:skip-waiting'

/**
 * Paths that are their own HTML document, not the app shell: the extra Rollup
 * inputs in vite.config.ts plus the alias paths that `assets.run_worker_first`
 * and public/_redirects map onto them. Substituting the app shell for one of
 * these offline would silently serve the wrong product, so they get no offline
 * fallback at all.
 */
const STANDALONE_DOCUMENT_PATHS = new Set([
  '/mirror',
  '/mirror.html',
  '/karaoke',
  '/karaoke-night',
  '/karaoke.html',
  '/karaoke-night.html',
  '/vocal-range-test',
  '/vocal-range-test.html',
  '/tone-deaf-test',
  '/glass',
  '/glass.html',
  '/break-glass-with-your-voice',
  '/high-note-test',
  '/shatter',
])

/**
 * What each extension is allowed to answer with. A response whose type does
 * not match is the SPA fallback (or an error page) wearing an asset URL, and
 * caching it is the failure mode described in hazard 1 above.
 */
const CONTENT_TYPE_BY_EXTENSION = new Map<string, RegExp>([
  ['.js', /javascript|ecmascript/],
  ['.mjs', /javascript|ecmascript/],
  ['.css', /text\/css/],
  ['.webmanifest', /json|manifest/],
  ['.json', /json/],
  ['.png', /^image\//],
  ['.svg', /svg|xml/],
  ['.ico', /icon|image\//],
  ['.woff2', /font/],
])

/**
 * Every URL this build actually shipped, injected by vite-plugin-pwa. It is
 * used as an allowlist rather than an eager precache list: a URL in it may be
 * read from and written to the cache, and a URL absent from it — an old
 * deploy's chunk, a model, an API call — is passed straight to the network and
 * never stored.
 */
const ALLOWED_PATHS = new Set(
  self.__WB_MANIFEST.map((entry) => new URL(entry.url, self.location.href).pathname),
)

function extensionOf(pathname: string): string {
  const lastDot = pathname.lastIndexOf('.')
  const lastSlash = pathname.lastIndexOf('/')
  return lastDot > lastSlash ? pathname.slice(lastDot).toLowerCase() : ''
}

function contentTypeMatchesUrl(pathname: string, response: Response): boolean {
  const expected = CONTENT_TYPE_BY_EXTENSION.get(extensionOf(pathname))
  // An extension with no rule is not something this worker knows how to
  // validate, so it does not get cached.
  if (expected === undefined) return false
  const contentType = response.headers.get('content-type') ?? ''
  return expected.test(contentType.toLowerCase())
}

/**
 * A response is only allowed into a cache when it is unambiguously the bytes
 * for the URL that was asked for: not an error, not opaque (an opaque response
 * cannot be inspected at all), not a redirect to somewhere else, and carrying
 * the content type its extension promises.
 */
function isCacheableAsset(pathname: string, response: Response): boolean {
  if (response.status !== 200) return false
  if (response.type !== 'basic' && response.type !== 'default') return false
  if (response.redirected) return false
  return contentTypeMatchesUrl(pathname, response)
}

function isHtmlDocument(response: Response): boolean {
  if (response.status !== 200) return false
  if (response.type !== 'basic' && response.type !== 'default') return false
  return (response.headers.get('content-type') ?? '')
    .toLowerCase()
    .includes('text/html')
}

/** Fetch one allowlisted URL and store it, but never fail the caller. */
async function warm(cache: Cache, pathname: string): Promise<void> {
  if (!ALLOWED_PATHS.has(pathname)) return
  try {
    const response = await fetch(pathname, { cache: 'no-cache' })
    if (isCacheableAsset(pathname, response)) {
      await cache.put(pathname, response)
    }
  } catch {
    // A cold install on a flaky connection must still finish; the runtime
    // handler below fills in whatever is missing on the next request.
  }
}

/**
 * The subresources index.html itself references — its entry module, its
 * stylesheet and the modulepreloads Vite emits for the first paint. Read out
 * of the shipped HTML instead of hardcoded, so the set cannot drift from the
 * build, and intersected with the manifest so a hand-edited HTML file cannot
 * widen it.
 */
function firstPaintAssets(html: string): string[] {
  const found = new Set<string>()
  const pattern = /(?:src|href)="(\/assets\/[^"]+)"/g
  let match = pattern.exec(html)
  while (match !== null) {
    const url = match[1]
    if (url !== undefined && ALLOWED_PATHS.has(url)) found.add(url)
    match = pattern.exec(html)
  }
  return [...found]
}

/**
 * Warm the shell and exactly what the shell needs to boot. This is the whole
 * eager precache: the browser downloads this same set on the visit that
 * installs the worker, so it costs a shared HTTP cache hit rather than a
 * second download, and it is what makes an offline cold start render the app
 * instead of a blank page. Everything else is cached lazily, the first time
 * the user reaches a surface that needs it.
 */
async function primeCache(): Promise<void> {
  const cache = await caches.open(CACHE_NAME)
  try {
    const shell = await fetch(SHELL_KEY, { cache: 'no-cache' })
    if (isHtmlDocument(shell)) {
      const html = await shell.clone().text()
      await cache.put(SHELL_KEY, shell)
      await Promise.all(
        firstPaintAssets(html).map((url) => warm(cache, url)),
      )
    }
  } catch {
    // Offline at install time. The worker still activates and starts caching
    // on the next successful request.
  }
  await Promise.all(
    ['/site.webmanifest', '/favicon.svg', '/icon-192.png'].map((url) =>
      warm(cache, url),
    ),
  )
}

/**
 * Drop other cache versions, then drop every entry the new build does not
 * list. This is the guarantee that matters: after a deploy, no request can be
 * answered from the cache with a previous build's chunk, so the stale-chunk
 * path stays exactly the one src/lib/chunk-load-recovery.ts already handles.
 */
async function pruneCaches(): Promise<void> {
  const names = await caches.keys()
  await Promise.all(
    names
      .filter((name) => name !== CACHE_NAME)
      .map((name) => caches.delete(name)),
  )

  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.keys()
  await Promise.all(
    cached
      .filter((request) => {
        const { pathname } = new URL(request.url)
        return pathname !== SHELL_KEY && !ALLOWED_PATHS.has(pathname)
      })
      .map((request) => cache.delete(request)),
  )
}

/**
 * Entry HTML is network-first without exception (hazard 2). The cache is only
 * the offline safety net, and only for paths the SPA shell legitimately
 * answers — which is every path except the standalone documents above.
 */
async function handleNavigation(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  const servesShell =
    !STANDALONE_DOCUMENT_PATHS.has(pathname) && !pathname.startsWith('/api/')

  try {
    const response = await fetch(request)
    if (servesShell && isHtmlDocument(response)) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(SHELL_KEY, response.clone())
    }
    return response
  } catch (error) {
    if (!servesShell) throw error
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(SHELL_KEY)
    if (cached !== undefined) return cached
    throw error
  }
}

/**
 * Cache-first, but only ever for a URL this build shipped — the caller has
 * already checked the allowlist. Hashed URLs are immutable, so a hit is always
 * correct and a miss is validated before it is stored.
 */
async function handleAsset(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(pathname)
  if (cached !== undefined) return cached

  const response = await fetch(request)
  if (isCacheableAsset(pathname, response)) {
    await cache.put(pathname, response.clone())
  }
  return response
}

self.addEventListener('install', (event) => {
  // No skipWaiting(): a worker that took over mid-session would pair its own
  // chunk map with the page's already-loaded HTML. The waiting worker is
  // adopted only when the user accepts the update prompt.
  event.waitUntil(primeCache())
})

self.addEventListener('activate', (event) => {
  // No clients.claim() either, for the same reason. An open page keeps the
  // worker it started with and picks up the new one on its next navigation.
  event.waitUntil(pruneCaches())
})

self.addEventListener('message', (event) => {
  const data: unknown = event.data
  const type =
    typeof data === 'object' && data !== null
      ? (data as { type?: unknown }).type
      : undefined
  if (type === SKIP_WAITING_MESSAGE) {
    void self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Anything not a plain same-origin GET is none of this worker's business:
  // POSTs to /api, R2 stem downloads, Google Fonts, the tag manager.
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
    return
  }

  // Range requests are how <audio> streams; a cache cannot satisfy a partial
  // response, so they go straight to the network.
  if (request.headers.has('range')) return

  // The allowlist is what keeps models, media, /api and — critically — a
  // previous deploy's hashed chunks out of the cache entirely. An unlisted URL
  // is fetched normally, so a deleted chunk still surfaces as the
  // `vite:preloadError` that chunk-load-recovery already knows how to fix.
  if (!ALLOWED_PATHS.has(url.pathname)) return

  event.respondWith(handleAsset(request))
})
