// Regenerate the install-sheet screenshots in public/screenshots/.
//
// Android's install sheet renders as a rich app card only when the manifest
// carries `screenshots`; without them it looks like a bookmark prompt. These
// are shot from the real built app rather than mocked up, so they cannot drift
// from what the user actually gets.
//
//   pnpm run build && node scripts/gen-pwa-screenshots.mjs
//
// Sizes are baked into public/site.webmanifest — if you change a viewport
// here, update the matching `sizes` there. Exits non-zero if any shot fails.
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const DIST = resolve('dist')
const OUT = resolve('public/screenshots')
// 0 = let the OS pick a free port, so this never collides with a dev server.
const PORT = Number(process.env.PWA_SHOT_PORT ?? 0)

/**
 * The tabs worth showing a first-time installer: the daily hub, the guided
 * path, and one wide shot so desktop install sheets have something to use.
 * Canvas-heavy surfaces are deliberately absent — requestAnimationFrame is
 * throttled to a stop in headless Chromium, so they photograph blank.
 */
const SHOTS = [
  {
    file: 'home-narrow.png',
    tab: 'home',
    formFactor: 'narrow',
    viewport: { width: 540, height: 1170 },
    scale: 1,
  },
  {
    file: 'path-narrow.png',
    tab: 'path',
    formFactor: 'narrow',
    viewport: { width: 540, height: 1170 },
    scale: 1,
  },
  {
    file: 'home-wide.png',
    tab: 'home',
    formFactor: 'wide',
    viewport: { width: 1280, height: 800 },
    scale: 1,
  },
]

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json'],
  ['.webmanifest', 'application/manifest+json'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/vnd.microsoft.icon'],
  ['.woff2', 'font/woff2'],
  ['.wasm', 'application/wasm'],
])

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(
    'gen-pwa-screenshots: dist/index.html is missing. Run `pnpm run build` first.',
  )
  process.exit(1)
}

/**
 * Static server for dist with the same SPA fallback production uses
 * (wrangler's `assets.not_found_handling`), so the app boots the way it will
 * for a real visitor.
 */
const server = createServer((req, res) => {
  const requested = decodeURIComponent((req.url ?? '/').split('?')[0])
  const candidate = join(
    DIST,
    normalize(requested).replace(/^(\.\.[/\\])+/, ''),
  )
  const file =
    candidate.startsWith(DIST) &&
    existsSync(candidate) &&
    statSync(candidate).isFile()
      ? candidate
      : join(DIST, 'index.html')
  res.writeHead(200, {
    'content-type': MIME.get(extname(file)) ?? 'application/octet-stream',
  })
  createReadStream(file).pipe(res)
})

await new Promise((done) => server.listen(PORT, '127.0.0.1', done))
const base = `http://127.0.0.1:${server.address().port}`
const appVersion = JSON.parse(readFileSync('package.json', 'utf8')).version

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
let failed = 0

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.scale,
    isMobile: shot.formFactor === 'narrow',
    hasTouch: shot.formFactor === 'narrow',
    // Screenshots are marketing surfaces: no half-played transitions.
    reducedMotion: 'reduce',
  })
  // First-run chrome (welcome, onboarding, the survey) would be the whole
  // picture otherwise.
  await context.addInitScript((version) => {
    localStorage.setItem('pitchperfect_welcome_version', version)
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    localStorage.setItem('pitchperfect_focus_mode', 'false')
    localStorage.setItem('pitchperfect_survey_dismissed', '1')
  }, appVersion)

  const page = await context.newPage()
  try {
    // The tab is chosen by hash route (src/lib/hash-router.ts), not by
    // clicking: on a narrow viewport the top tab bar unmounts in favour of
    // BottomTabBar, whose overflow tabs sit behind a sheet.
    await page.goto(`${base}/#/${shot.tab}`, { waitUntil: 'load' })
    // `#root.loaded` is set by src/index.tsx once App has mounted.
    await page.waitForSelector('#root.loaded', { timeout: 20_000 })
    await page.waitForTimeout(1800)
    // A screenshot of the error boundary would ship to the install sheet and
    // nobody would notice until it was live.
    if (
      (await page.getByRole('dialog', { name: 'Application error' }).count()) >
      0
    ) {
      throw new Error('the app rendered its error boundary')
    }
    // Any tab button will do: the top bar and BottomTabBar share the `tab-*`
    // ids, and which one is mounted depends on the viewport.
    if ((await page.locator('[id^="tab-"]').count()) === 0) {
      throw new Error('no navigation rendered — the app did not finish booting')
    }
    const path = join(OUT, shot.file)
    await page.screenshot({ path })
    const { size } = statSync(path)
    console.log(
      `ok    ${shot.file}  ${shot.viewport.width * shot.scale}x${shot.viewport.height * shot.scale}  ${Math.round(size / 1024)} KiB  (${shot.formFactor})`,
    )
  } catch (error) {
    failed += 1
    console.error(
      `FAIL  ${shot.file}: ${error instanceof Error ? error.message : error}`,
    )
  } finally {
    await context.close()
  }
}

await browser.close()
server.close()

if (failed > 0) {
  console.error(`gen-pwa-screenshots: ${failed} shot(s) failed`)
  process.exit(1)
}
console.log(
  'gen-pwa-screenshots: done. Update `screenshots` in public/site.webmanifest if sizes changed.',
)
