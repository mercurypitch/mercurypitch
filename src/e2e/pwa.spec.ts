import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

// Installability is not "the PWA code loaded" — it is a list of things the
// browser checks before it will offer "Install app": a manifest that parses and
// declares a standalone display with usable icons, and a service worker with a
// fetch handler that ends up controlling the page. These assert those, and then
// the thing most likely to reach a user if the worker is wrong: HTML cached
// under a hashed asset URL, which never self-heals.

const CONTROLLER_TIMEOUT = 20_000

async function cachedPaths(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const paths: string[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        paths.push(new URL(request.url).pathname)
      }
    }
    return paths
  })
}

async function bootWithWorkerInControl(page: Page): Promise<void> {
  await page.goto('/')
  // Registration is deferred to `load` (src/lib/pwa-service-worker.ts).
  await page.waitForFunction(
    async () =>
      (await navigator.serviceWorker.getRegistration('/')) !== undefined,
    undefined,
    { timeout: CONTROLLER_TIMEOUT },
  )
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // The worker deliberately does not call clients.claim(), so the page that
  // registered it stays uncontrolled until its next navigation.
  await page.reload()
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: CONTROLLER_TIMEOUT },
  )
}

test('the web manifest is linked, parses, and declares an installable app @smoke', async ({
  page,
  request,
}) => {
  await page.goto('/')

  const href = await page
    .locator('link[rel="manifest"]')
    .first()
    .getAttribute('href')
  expect(href).toBe('/site.webmanifest')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#0d1117',
  )

  const response = await request.get(href ?? '/site.webmanifest')
  expect(response.ok()).toBe(true)
  const manifest = JSON.parse(await response.text()) as {
    id?: string
    name?: string
    start_url?: string
    scope?: string
    display?: string
    orientation?: string
    categories?: string[]
    icons?: { sizes?: string; purpose?: string }[]
    screenshots?: { sizes?: string; form_factor?: string }[]
  }

  expect(manifest.name).toBeTruthy()
  expect(manifest.id).toBeTruthy()
  expect(manifest.start_url).toBe('/')
  expect(manifest.scope).toBe('/')
  expect(manifest.display).toBe('standalone')
  expect(manifest.orientation).toBeTruthy()
  expect(manifest.categories?.length ?? 0).toBeGreaterThan(0)

  // Chrome wants a 192 and a 512, and a maskable icon to avoid a letterboxed
  // launcher icon on Android.
  const sizes = (manifest.icons ?? []).map((icon) => icon.sizes)
  expect(sizes).toContain('192x192')
  expect(sizes).toContain('512x512')
  expect(
    (manifest.icons ?? []).some((icon) => icon.purpose === 'maskable'),
  ).toBe(true)

  // Screenshots are what make the Android install sheet a rich app card rather
  // than a bookmark prompt, and only `narrow` ones are used there.
  const narrow = (manifest.screenshots ?? []).filter(
    (shot) => shot.form_factor === 'narrow',
  )
  expect(narrow.length).toBeGreaterThan(0)
  for (const shot of manifest.screenshots ?? []) {
    expect(shot.sizes).toMatch(/^\d+x\d+$/)
    const [width, height] = (shot.sizes ?? '0x0').split('x').map(Number)
    // Chrome ignores a screenshot outside 320-3840px or beyond a 2.3 aspect
    // ratio, silently, and the card falls back to the plain prompt.
    expect(Math.min(width, height)).toBeGreaterThanOrEqual(320)
    expect(Math.max(width, height)).toBeLessThanOrEqual(3840)
    expect(Math.max(width, height) / Math.min(width, height)).toBeLessThan(2.3)
  }

  for (const shot of manifest.screenshots ?? []) {
    const src = (shot as { src?: string }).src ?? ''
    const asset = await request.get(src)
    expect(asset.ok(), `${src} should be shipped`).toBe(true)
  }
})

test('the service worker takes control and the app still boots @smoke', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await bootWithWorkerInControl(page)

  const worker = await page.evaluate(() => {
    const registration = navigator.serviceWorker.controller
    return {
      scriptURL: registration?.scriptURL ?? '',
      state: registration?.state ?? '',
    }
  })
  expect(worker.scriptURL.endsWith('/sw.js')).toBe(true)
  expect(worker.state).toBe('activated')

  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/')
    return registration?.scope ?? ''
  })
  expect(new URL(scope).pathname).toBe('/')

  // The app has to survive being served through the worker, not merely load
  // before it.
  await page.waitForSelector('#root.loaded', { timeout: CONTROLLER_TIMEOUT })
  await expect(page.locator('[id^="tab-"]').first()).toBeVisible()
  await expect(
    page.getByRole('dialog', { name: 'Application error' }),
  ).toHaveCount(0)
  expect(
    consoleErrors.filter((text) => /service ?worker|sw\.js/i.test(text)),
  ).toEqual([])

  // The shell is precached so an installed app opens offline; the models and
  // the OG images must never be, or the storage quota goes.
  const paths = await cachedPaths(page)
  expect(paths).toContain('/')
  expect(paths.some((path) => path.startsWith('/assets/'))).toBe(true)
  expect(paths.filter((path) => path.startsWith('/models/'))).toEqual([])
  expect(paths.filter((path) => path.endsWith('og-image.png'))).toEqual([])
})

test('HTML answered under an asset URL never enters the cache @smoke', async ({
  page,
  context,
}) => {
  await bootWithWorkerInControl(page)

  // Production answers an unknown path with index.html and a 200, not a 404
  // (wrangler `assets.not_found_handling: "single-page-application"`). Replay
  // that for a URL the worker considers cacheable, which is the one shape that
  // could poison the cache permanently. `context.route` rather than
  // `page.route`: this request is issued by the worker, not the page.
  //
  // apple-touch-icon.png specifically: it is in the injected manifest, so the
  // worker will try to cache it, but it is not part of the shell warmed at
  // install time and Chromium never asks for it on its own — so the first
  // request in this test really is the first request.
  const poisoned = '/apple-touch-icon.png'
  let served = 0
  await context.route(`**${poisoned}`, async (route) => {
    served += 1
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>SPA fallback</title>',
    })
  })

  const first = await page.evaluate(async (url) => {
    const response = await fetch(url, { cache: 'no-store' })
    return { status: response.status, body: await response.text() }
  }, poisoned)
  expect(served).toBeGreaterThan(0)
  expect(first.status).toBe(200)
  expect(first.body).toContain('SPA fallback')

  expect(
    await cachedPaths(page),
    'a text/html body must never be stored under a non-HTML URL',
  ).not.toContain(poisoned)

  // And a second request still reaches the network rather than a poisoned
  // cache entry — this is the difference between a bad minute and a broken
  // install that no reload clears.
  const before = served
  await page.evaluate(async (url) => {
    await fetch(url, { cache: 'no-store' })
  }, poisoned)
  expect(served).toBeGreaterThan(before)

  // With the fallback gone the real file is cached, proving the guard rejects
  // bad responses rather than quietly caching nothing at all.
  await context.unroute(`**${poisoned}`)
  const real = await page.evaluate(async (url) => {
    const response = await fetch(url, { cache: 'no-store' })
    return {
      contentType: response.headers.get('content-type') ?? '',
      bytes: (await response.arrayBuffer()).byteLength,
    }
  }, poisoned)
  expect(real.contentType).toContain('image/png')
  expect(real.bytes).toBeGreaterThan(1000)
  await expect.poll(() => cachedPaths(page)).toContain(poisoned)
})

test('a hashed chunk this build never shipped is passed through, not cached @smoke', async ({
  page,
}) => {
  await bootWithWorkerInControl(page)

  // What a tab left open across a deploy asks for. It is absent from the
  // injected manifest, so the worker must not touch it: the request has to
  // reach the network and fail the way src/lib/chunk-load-recovery.ts already
  // expects, and nothing may be written under its URL.
  const stale = '/assets/SessionEditor-D3adB33f.js'
  const result = await page.evaluate(async (url) => {
    const response = await fetch(url, { cache: 'no-store' })
    return {
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
    }
  }, stale)

  // Whatever the host answers — a 404 here, index.html with a 200 in
  // production — the worker must not have cached it.
  expect(result.status).not.toBe(0)
  expect(await cachedPaths(page)).not.toContain(stale)
})
