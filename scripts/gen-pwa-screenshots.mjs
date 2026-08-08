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
 * The surfaces worth showing a first-time installer, in install-sheet order:
 * the daily hub, the two rooms that look like a night out (Karaoke Night and
 * the Jam room), the guided path, and one wide shot so desktop install sheets
 * have something to use. Truly canvas-driven surfaces stay absent —
 * requestAnimationFrame is throttled to a stop in headless Chromium, so they
 * photograph blank.
 *
 * The Karaoke rail and the room backgrounds come from the API, so build
 * against dev, with analytics inert:
 *
 *   cross-env VITE_API_BASE_URL=https://api-dev.mercurypitch.com \
 *     VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= \
 *     VITE_JAM_MOCK_SIGNALING=1 pnpm run build
 */
const NARROW = { width: 540, height: 1170 }
const SHOTS = [
  {
    file: 'home-narrow.png',
    tab: 'home',
    formFactor: 'narrow',
    viewport: NARROW,
    scale: 1,
  },
  {
    file: 'karaoke-narrow.png',
    // The Karaoke Night surface, not the in-app upload panel — and not its
    // landing either: the picture is the stage itself, so walk into the
    // bundled demo song and wait for the lyric sheet.
    path: '/karaoke-night',
    readySelector: '.kn-app',
    steps: [
      { click: 'button:has-text("Sing this song")' },
      { waitFor: '[class*="lyrics"]' },
      { settle: 2500 },
    ],
    mic: true,
    formFactor: 'narrow',
    viewport: NARROW,
    scale: 1,
  },
  {
    file: 'jam-narrow.png',
    tab: 'jam',
    formFactor: 'narrow',
    viewport: NARROW,
    // The room asks for a mic the moment it exists; a denied prompt would be
    // the screenshot.
    mic: true,
    scale: 1,
  },
  {
    file: 'path-narrow.png',
    tab: 'path',
    formFactor: 'narrow',
    viewport: NARROW,
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

/**
 * Every tab that owns a spotlight tour offers it in a toast on first visit
 * (usePageTourOffer). Product screenshots are always a first visit, so the
 * offer key is pre-set for every tab — otherwise the shot ships with a
 * "Take a quick tour" card on top, which is exactly what happened to v1 of
 * these. Keep this list a superset of hash-router's VALID_TABS.
 */
const TOUR_OFFER_TABS = [
  'home',
  'path',
  'singing',
  'piano',
  'guitar',
  'karaoke',
  'jam',
  'exercises',
  'community',
  'challenges',
  'leaderboard',
  'analysis',
  'lab',
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
  let requested = decodeURIComponent((req.url ?? '/').split('?')[0])
  // Mirror production's path routing (vite.config KARAOKE_PATHS): the
  // Karaoke Night surface is its own HTML entry, not the SPA fallback.
  if (requested === '/karaoke-night' || requested === '/karaoke') {
    requested = '/karaoke-night.html'
  }
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
// Fake media devices: a mic-holding surface (the karaoke stage, a jam room)
// must get a silent fake stream, never a permission prompt.
const browser = await chromium.launch({
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
let failed = 0

for (const shot of SHOTS) {
  const context = await browser.newContext({
    viewport: shot.viewport,
    deviceScaleFactor: shot.scale,
    isMobile: shot.formFactor === 'narrow',
    hasTouch: shot.formFactor === 'narrow',
    // Screenshots are marketing surfaces: no half-played transitions.
    reducedMotion: 'reduce',
    ...(shot.mic ? { permissions: ['microphone'] } : {}),
  })
  // First-run chrome (welcome, onboarding, the survey, every per-tab tour
  // offer) would be the whole picture otherwise.
  await context.addInitScript(
    ({ version, tourTabs }) => {
      localStorage.setItem('pitchperfect_welcome_version', version)
      localStorage.setItem('pitchperfect_onboarding_done', '1')
      localStorage.setItem('pitchperfect_focus_mode', 'false')
      localStorage.setItem('pitchperfect_survey_dismissed', '1')
      for (const tab of tourTabs) {
        localStorage.setItem(`pitchperfect_page_tour_offered_${tab}`, 'true')
      }
    },
    { version: appVersion, tourTabs: TOUR_OFFER_TABS },
  )

  const page = await context.newPage()
  try {
    // The tab is chosen by hash route (src/lib/hash-router.ts), not by
    // clicking: on a narrow viewport the top tab bar unmounts in favour of
    // BottomTabBar, whose overflow tabs sit behind a sheet. Shots with a
    // `path` are standalone HTML entries with their own ready signal.
    const target = shot.path ?? `/#/${shot.tab}`
    await page.goto(`${base}${target}`, { waitUntil: 'load' })
    // `#root.loaded` is set by src/index.tsx once App has mounted.
    await page.waitForSelector(shot.readySelector ?? '#root.loaded', {
      timeout: 20_000,
    })
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
    // ids, and which one is mounted depends on the viewport. Standalone
    // entries have no app navigation — their readySelector already vouched.
    if (
      shot.path === undefined &&
      (await page.locator('[id^="tab-"]').count()) === 0
    ) {
      throw new Error('no navigation rendered — the app did not finish booting')
    }
    // Optional staging: walk the page into the state worth photographing.
    for (const step of shot.steps ?? []) {
      if (step.click !== undefined) {
        await page.click(step.click, { timeout: 15_000 })
      }
      if (step.waitFor !== undefined) {
        await page.waitForSelector(step.waitFor, { timeout: 30_000 })
      }
      if (step.settle !== undefined) {
        await page.waitForTimeout(step.settle)
      }
    }
    // Belt for whatever toast the init keys did not predict (an update
    // notice, a future tour channel): no transient card belongs in a
    // product screenshot.
    await page.addStyleTag({
      content: '[class*="notificationContainer"] { display: none !important; }',
    })
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
