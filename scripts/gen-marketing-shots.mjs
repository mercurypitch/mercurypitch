// Regenerate the wide marketing stills in public/marketing/.
//
// Sibling of gen-pwa-screenshots.mjs, and deliberately its opposite in one
// respect: that script SUPPRESSES first-run chrome, because an install sheet
// should show the app. These shots are of the first run itself — First Light
// is what the ads promise, so it is what the ads should show.
//
//   pnpm run build && node scripts/gen-marketing-shots.mjs
//
// Build against dev with analytics inert, exactly as the PWA script documents:
//
//   cross-env VITE_API_BASE_URL=https://api-dev.mercurypitch.com \
//     VITE_GOOGLE_ADS_TAG_ID= VITE_GA4_MEASUREMENT_ID= \
//     VITE_JAM_MOCK_SIGNALING=1 pnpm run build
//
// 1440x900 to match the existing gallery masters in the campaigns repo
// (packages/showcase-gallery/assets/mercurypitch/*.webp). Ad slots are cropped
// from these, never shot at ad size — Google wants 1.91:1 and 1:1 from the
// same frame. Exits non-zero if any shot fails.
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const DIST = resolve('dist')
const OUT = resolve('public/marketing')
const PORT = Number(process.env.SHOT_PORT ?? 0)
const VIEWPORT = { width: 1440, height: 900 }

/**
 * Beats are addressed by `[data-beat="..."]`, the same hook src/e2e/
 * onboarding.spec.ts uses, so a renamed beat breaks the shot loudly instead
 * of photographing whatever happened to be on screen.
 *
 * The voiceprint and twin beats are absent on purpose: they need ~90s of real
 * singing through a fake device, and the frame they end on is a result panel
 * that means nothing without the singing that earned it.
 */
const SHOTS = [
  {
    file: 'first-light.png',
    // The FEATURE is First Light; its opening BEAT is called `sky`. There is
    // no `first-light` beat and no welcome door in front of it — a fresh
    // visitor lands straight on beat 1, which src/e2e/onboarding.spec.ts
    // asserts by name. Targeting 'first-light' here photographs nothing.
    beat: 'sky',
    firstRun: true,
  },
  {
    file: 'map.png',
    beat: 'map',
    // The Map has its own replay route, which skips the whole first run.
    hash: '#/map',
    firstRun: false,
  },
]

// The fork, voiceprint and twin beats are reachable only by actually singing:
// beat 1's onward action is 'Sing one note', and `voice-session` rejects a
// silent stream on purpose, so Chromium's default fake device routes past them
// rather than into them. Shooting those needs the generated-tone rig in
// src/e2e/helpers/tone-wav.ts (`--use-file-for-fake-audio-capture`); until a
// shot actually needs them, this script stays audio-free.

const MIME = new Map([
  ['.html', 'text/html'],
  ['.js', 'text/javascript'],
  ['.css', 'text/css'],
  ['.json', 'application/json'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2'],
  ['.ico', 'image/x-icon'],
  ['.webmanifest', 'application/manifest+json'],
])

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('gen-marketing-shots: dist/index.html is missing. Build first.')
  process.exit(1)
}

const server = createServer((req, res) => {
  let requested = decodeURIComponent((req.url ?? '/').split('?')[0])
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
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    permissions: ['microphone'],
  })
  // Even on a first-run shot the release announcement must stay shut — it is
  // modal, so it would photograph the changelog instead of the onboarding.
  // The key holds a release LINE (major.minor), not a version; see
  // src/features/whats-new/whats-new-release.ts.
  await context.addInitScript(
    ({ line, firstRun, version }) => {
      if (line !== null)
        localStorage.setItem('pitchperfect_whats_new_seen', line)
      localStorage.setItem('pitchperfect_survey_dismissed', '1')
      if (!firstRun) {
        localStorage.setItem('pitchperfect_welcome_version', version)
        localStorage.setItem('pitchperfect_onboarding_done', '1')
      }
    },
    {
      line: /^(\d+)\.(\d+)/.exec(appVersion)?.slice(1, 3).join('.') ?? null,
      firstRun: shot.firstRun,
      version: appVersion,
    },
  )

  const page = await context.newPage()
  try {
    await page.goto(`${base}/${shot.hash ?? ''}`, { waitUntil: 'networkidle' })
    for (const step of shot.steps ?? []) {
      await page.getByRole(step.role, { name: step.name }).click()
    }
    const beat = page.locator(`[data-beat="${shot.beat}"]`)
    await beat.waitFor({ state: 'visible', timeout: 20000 })
    // Let the beat's entrance settle; reducedMotion shortens but does not
    // remove the transition.
    await page.waitForTimeout(1200)
    await page.screenshot({
      path: join(OUT, shot.file),
      animations: 'disabled',
    })
    const size = statSync(join(OUT, shot.file)).size
    console.log(
      `ok    ${shot.file}  ${VIEWPORT.width * 2}x${VIEWPORT.height * 2}  ${Math.round(size / 1024)} KiB  (beat: ${shot.beat})`,
    )
  } catch (error) {
    failed += 1
    console.error(`FAIL  ${shot.file}  (beat: ${shot.beat})  ${error.message}`)
  } finally {
    await context.close()
  }
}

await browser.close()
server.close()
if (failed > 0) {
  console.error(`gen-marketing-shots: ${failed} shot(s) failed.`)
  process.exit(1)
}
console.log('gen-marketing-shots: done.')
