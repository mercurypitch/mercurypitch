// Verify the end-of-run score overlay docks as a bottom sheet on mobile.
// Plays the default melody in Once mode to completion and asserts the
// #score-card (or #session-summary-card) is bottom-anchored + full width.
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const OUT = process.env.OUT || './score-sheet-verify'
const version = JSON.parse(readFileSync('./package.json', 'utf8')).version
const results = []
const check = (n, ok, extra = '') => {
  results.push({ n, ok })
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${n}${extra ? ` — ${extra}` : ''}`)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()
await page.addInitScript((v) => {
  window.E2E_TEST_MODE = true
  localStorage.setItem('pitchperfect_welcome_version', v)
  // The result popup is opt-in (off by default) — enable it so the
  // end-of-run sheet renders.
  localStorage.setItem('pitchperfect_show_practice_result_popup', 'true')
  for (const t of [
    'exercises', 'singing', 'piano', 'guitar', 'karaoke', 'community',
    'leaderboard', 'challenges', 'jam', 'compose', 'analysis', 'settings',
  ]) localStorage.setItem(`pitchperfect_page_tour_offered_${t}`, 'true')
}, version)

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const stage = page.locator('[data-testid="singing-mobile-stage"]')
check('singing mobile stage present', await stage.isVisible())

// Speed things up: crank BPM via the options sheet, then play Once.
await stage.getByRole('button', { name: /key, scale and playback/i }).tap()
const sheet = page.getByRole('dialog', { name: /practice options/i })
await sheet.waitFor({ state: 'visible', timeout: 4000 })
await sheet.locator('input[type="range"]').first().evaluate((el) => {
  el.value = '220'
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.mouse.click(195, 90) // backdrop close
await page.waitForTimeout(400)

await stage.getByRole('button', { name: /^play$/i }).tap()

// Poll for the score overlay (run finishes → popup).
let appeared = false
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(500)
  if (await page.locator('#score-card, #session-summary-card').count()) {
    appeared = true
    break
  }
}
check('score overlay appears after a run', appeared)

if (appeared) {
  await page.waitForTimeout(500)
  const card = page.locator('#score-card, #session-summary-card').first()
  const geom = await page.evaluate(() => {
    const el = document.querySelector('#score-card, #session-summary-card')
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      vh: window.innerHeight,
      vw: window.innerWidth,
      radiusTop: cs.borderTopLeftRadius,
      radiusBottom: cs.borderBottomLeftRadius,
    }
  })
  check(
    'card is bottom-anchored',
    geom !== null && Math.abs(geom.bottom - geom.vh) <= 1,
    JSON.stringify(geom),
  )
  check('card spans full width', geom !== null && geom.width === geom.vw)
  check(
    'card has sheet radius (rounded top, square bottom)',
    geom !== null &&
      parseFloat(geom.radiusTop) >= 12 &&
      parseFloat(geom.radiusBottom) === 0,
  )
  await card.screenshot({ path: `${OUT}/score-sheet.png` }).catch(() => {})
  await page.screenshot({ path: `${OUT}/full.png` })
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length > 0 ? 1 : 0)
