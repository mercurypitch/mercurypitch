// Verify the desktop "Zen mode" opt-in on Karaoke Night: on a wide screen,
// staging a song shows the mixer; the Zen toggle swaps in the clean stage
// (centered column); Back returns to the mixer with the song still staged.
// Exits 1 on any failed assertion.
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const OUT = process.env.OUT || './zen-desktop-verify'
const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`)
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
})
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const page = await ctx.newPage()

await page.goto(`${BASE}/karaoke`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

// Stage the example song → desktop mixer (not the zen stage, since wide).
await page.getByRole('button', { name: /sing this song/i }).first().click()
await page.waitForTimeout(2500)
const stageSel = '[data-testid="karaoke-mobile-stage"]'
check(
  'wide viewport shows the mixer, not the zen stage',
  (await page.locator(stageSel).count()) === 0 &&
    (await page.locator('.stem-mixer').count()) >= 1,
)
await page.screenshot({ path: `${OUT}/1-mixer.png` })

// Click the Zen toggle in the mixer chrome.
const zenBtn = page.getByRole('button', { name: /^zen/i }).first()
check('mixer has a Zen toggle', await zenBtn.isVisible())
await zenBtn.click()
await page.waitForTimeout(1200)
const stage = page.locator(stageSel)
check('Zen toggle swaps in the zen stage', await stage.isVisible())

// The zen content should be a centered column (~760px), not full-bleed.
const geom = await page.evaluate(() => {
  const lyrics = document.querySelector(
    '[data-testid="karaoke-mobile-stage"] [class*="lyrics"]',
  )
  if (!lyrics) return null
  const r = lyrics.getBoundingClientRect()
  return { w: Math.round(r.width), left: Math.round(r.left), vw: window.innerWidth }
})
check(
  'zen content is a centered column on desktop',
  geom !== null && geom.w <= 780 && geom.left > 150,
  JSON.stringify(geom),
)
await page.screenshot({ path: `${OUT}/2-zen.png` })

// Back returns to the mixer (song still staged).
await page.getByRole('button', { name: /^back$/i }).first().click()
await page.waitForTimeout(1000)
check(
  'Back exits zen to the mixer',
  (await page.locator(stageSel).count()) === 0 &&
    (await page.locator('.stem-mixer').count()) >= 1,
)
await page.screenshot({ path: `${OUT}/3-back-to-mixer.png` })

await browser.close()
const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} checks passed`)
process.exit(failed ? 1 : 0)
