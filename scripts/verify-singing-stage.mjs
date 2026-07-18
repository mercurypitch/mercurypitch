// Verify the SingingMobileStage end-to-end at a phone viewport: the stage
// replaces the desktop panel, chips/canvas/transport render, play starts and
// pauses, the options sheet works and edits BPM, and the desktop panel is
// untouched at desktop width. Exits 1 on any failed assertion.
//
// Usage: pnpm run build:tours && pnpm dlx serve dist -l 3005 &
//        node scripts/verify-singing-stage.mjs
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const OUT = process.env.OUT || './singing-stage-verify'
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
await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const stage = page.locator('[data-testid="singing-mobile-stage"]')
check('mobile stage replaces the desktop panel', await stage.isVisible())
check(
  'desktop #practice-panel absent on phone',
  (await page.locator('#practice-panel').count()) === 0,
)

// Chips + canvas.
const keyChip = stage.getByRole('button', { name: /key, scale and playback/i })
check('key/BPM chip renders', await keyChip.isVisible())
const songChip = stage.getByRole('button', { name: /choose a song/i })
check('song chip renders', await songChip.isVisible())
check(
  'pitch canvas mounted in stage',
  (await stage.locator('canvas').count()) >= 1,
)
await page.screenshot({ path: `${OUT}/1-stage.png` })

// No overlap: transport above the tab bar.
const geom = await page.evaluate(() => {
  const bar = document.querySelector('[data-tour="mobile-tabbar"]')
  const transport = document.querySelector('[data-tour="singing-transport"]')
  if (!bar || !transport) return null
  return {
    barTop: bar.getBoundingClientRect().top,
    transportBottom: transport.getBoundingClientRect().bottom,
  }
})
check(
  'transport clears the tab bar',
  geom !== null && geom.transportBottom <= geom.barTop + 1,
  JSON.stringify(geom),
)
const overflowX = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
)
check('no horizontal overflow', !overflowX)

// Play → pause state flips.
const playBtn = stage.getByRole('button', { name: /^play$/i })
check('play button renders', await playBtn.isVisible())
await playBtn.tap()
await page.waitForTimeout(1500)
const pauseVisible = await stage
  .getByRole('button', { name: /^pause$/i })
  .isVisible()
  .catch(() => false)
check('play starts (pause state shown)', pauseVisible)
await page.screenshot({ path: `${OUT}/2-playing.png` })
if (pauseVisible) {
  await stage.getByRole('button', { name: /^pause$/i }).tap()
  await page.waitForTimeout(400)
}

// Options sheet: opens, sections present, BPM slider live-updates the chip.
await stage.getByRole('button', { name: /practice options/i }).tap()
const sheet = page.getByRole('dialog', { name: /practice options/i })
await sheet.waitFor({ state: 'visible', timeout: 4000 })
check('options sheet opens', await sheet.isVisible())
const sheetText = await sheet.innerText()
check(
  'sheet has Setup/Playback/Mic sections + desktop hint',
  /SETUP/i.test(sheetText) &&
    /PLAYBACK/i.test(sheetText) &&
    /MIC/i.test(sheetText) &&
    /desktop/i.test(sheetText),
)
const bpmSlider = sheet.locator('input[type="range"]').first()
await bpmSlider.evaluate((el) => {
  el.value = '150'
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(300)
const chipText = await keyChip.innerText()
check('BPM edit reflects in the chip', /150 BPM/.test(chipText), chipText)
await page.screenshot({ path: `${OUT}/3-options.png` })

// Close sheet (backdrop), open the song picker modal.
await page.mouse.click(195, 100)
await page.waitForTimeout(400)
await songChip.tap()
await page.waitForTimeout(800)
const songModalOpen = await page.evaluate(
  () => document.body.innerText.includes('Import MIDI') ||
    document.querySelector('[class*="modal" i]') !== null,
)
check('song picker opens from the chip', songModalOpen)
await page.screenshot({ path: `${OUT}/4-songs.png` })

const realErrors = errors.filter((e) => !/net::|Failed to fetch|ERR_/i.test(e))
check('no page errors (phone)', realErrors.length === 0, realErrors.join('|').slice(0, 200))
await page.context().close()

// ── Desktop control ──
const desk = await newPage({ width: 1280, height: 800 }, false)
await desk.goto(BASE, { waitUntil: 'domcontentloaded' })
await desk.waitForTimeout(2000)
check(
  'desktop keeps #practice-panel',
  (await desk.locator('#practice-panel').count()) === 1,
)
check(
  'desktop has no mobile stage',
  (await desk.locator('[data-testid="singing-mobile-stage"]').count()) === 0,
)
await desk.screenshot({ path: `${OUT}/5-desktop.png` })
await desk.context().close()

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length > 0 ? 1 : 0)
