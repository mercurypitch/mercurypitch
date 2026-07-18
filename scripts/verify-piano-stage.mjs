// Verify the PianoMobileStage end-to-end at a phone viewport: the stage
// replaces the desktop tree, chips/canvas/transport render, play flips to
// pause, the options sheet works, the song picker opens, and desktop keeps
// its panel. Exits 1 on any failed assertion.
//
// Usage: pnpm run build:tours && pnpm dlx serve dist -l 3005 &
//        node scripts/verify-piano-stage.mjs
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const OUT = process.env.OUT || './piano-stage-verify'
const version = JSON.parse(readFileSync('./package.json', 'utf8')).version
const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
})

async function newPage(viewport, isMobile) {
  const ctx = await browser.newContext({
    viewport,
    isMobile,
    hasTouch: isMobile,
    deviceScaleFactor: isMobile ? 2 : 1,
  })
  const page = await ctx.newPage()
  await page.addInitScript((v) => {
    window.E2E_TEST_MODE = true
    localStorage.setItem('pitchperfect_welcome_version', v)
    for (const t of [
      'exercises', 'singing', 'piano', 'guitar', 'karaoke', 'community',
      'leaderboard', 'challenges', 'jam', 'compose', 'analysis', 'settings',
    ]) localStorage.setItem(`pitchperfect_page_tour_offered_${t}`, 'true')
  }, version)
  return page
}

// ── Phone ──
const page = await newPage({ width: 390, height: 844 }, true)
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(`${BASE}/#/piano`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const stage = page.locator('[data-testid="piano-mobile-stage"]')
check('mobile stage replaces the desktop tree', await stage.isVisible())
check(
  'desktop #falling-notes-panel absent on phone',
  (await page.locator('#falling-notes-panel').count()) === 0,
)
check(
  'falling-notes canvas mounted in stage',
  (await stage.locator('canvas').count()) >= 1,
)
const songChip = stage.getByRole('button', { name: /choose a song/i })
check('song chip renders', await songChip.isVisible())
await page.screenshot({ path: `${OUT}/1-stage.png` })

const overflowX = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
)
check('no horizontal overflow', !overflowX)

// Play → pause state flips (gameState-driven).
const playBtn = stage.getByRole('button', { name: /^play$/i })
check('play button renders', await playBtn.isVisible())
await playBtn.tap()
await page.waitForTimeout(1800)
const pauseVisible = await stage
  .getByRole('button', { name: /^pause$/i })
  .isVisible()
  .catch(() => false)
check('play starts the game (pause shown)', pauseVisible)
await page.screenshot({ path: `${OUT}/2-playing.png` })
if (pauseVisible) {
  await stage.getByRole('button', { name: /^pause$/i }).tap()
  await page.waitForTimeout(400)
}

// Options sheet.
await stage.getByRole('button', { name: /practice options/i }).tap()
const sheet = page.getByRole('dialog', { name: /practice options/i })
await sheet.waitFor({ state: 'visible', timeout: 4000 })
check('options sheet opens', await sheet.isVisible())
const sheetText = await sheet.innerText()
check(
  'sheet has Playback/Display/Input sections + desktop hint',
  /PLAYBACK/i.test(sheetText) &&
    /DISPLAY/i.test(sheetText) &&
    /INPUT/i.test(sheetText) &&
    /desktop/i.test(sheetText),
)
await page.screenshot({ path: `${OUT}/3-options.png` })
await page.mouse.click(195, 100)
await page.waitForTimeout(400)

// Song picker opens from the chip.
await songChip.tap()
await page.waitForTimeout(800)
const songModalOpen = await page.evaluate(
  () =>
    document.body.innerText.includes('Import MIDI') ||
    document.querySelector('[class*="modal" i]') !== null,
)
check('song picker opens from the chip', songModalOpen)
await page.screenshot({ path: `${OUT}/4-songs.png` })

const realErrors = errors.filter((e) => !/net::|Failed to fetch|ERR_/i.test(e))
check('no page errors (phone)', realErrors.length === 0, realErrors.join('|').slice(0, 200))
await page.context().close()

// ── Desktop control ──
const desk = await newPage({ width: 1280, height: 800 }, false)
await desk.goto(`${BASE}/#/piano`, { waitUntil: 'domcontentloaded' })
await desk.waitForTimeout(2000)
check(
  'desktop keeps #falling-notes-panel',
  (await desk.locator('#falling-notes-panel').count()) === 1,
)
check(
  'desktop has no mobile stage',
  (await desk.locator('[data-testid="piano-mobile-stage"]').count()) === 0,
)
await desk.screenshot({ path: `${OUT}/5-desktop.png` })
await desk.context().close()

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length > 0 ? 1 : 0)
