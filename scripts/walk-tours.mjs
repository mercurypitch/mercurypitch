// ============================================================
// walk-tours — step through EVERY guided spotlight tour in a real
// browser and assert each step's spotlight lands on a visible target.
//
// Use this whenever tour steps, their target selectors, or the UI they
// point at change (Walkthrough.tsx, WALKTHROUGH_STEPS / PAGE_TOURS in
// app-store.ts, control bars, sidebar, settings panel, …).
//
// Usage:
//   pnpm run build && pnpm dlx serve dist -l 3005   # or any static server
//   node scripts/walk-tours.mjs                     # desktop viewport
//   MOBILE=1 node scripts/walk-tours.mjs            # iPhone-sized viewport
//
// Env vars:
//   BASE_URL     app URL (default http://localhost:3005)
//   MOBILE=1     390x844 touch viewport instead of 1280x800
//   APP_VERSION  version used to mark the welcome screen as seen
//                (default: read from package.json)
//   CHROMIUM     chromium executable path (default: Playwright's own
//                install; falls back to /opt/pw-browsers/chromium)
//
// Exits 0 when every step of every tour spotlights a visible element;
// exits 1 and prints MISS lines otherwise. The Karaoke mixer tour is not
// walked — its targets only exist once a song is loaded in the mixer.
// ============================================================
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const MOBILE = process.env.MOBILE === '1'
const APP_VERSION =
  process.env.APP_VERSION ||
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    .version

// Titles as they appear in the Guide dialog (GuideSelection.tsx):
// GUIDE_SECTIONS + PAGE_TOUR_CATALOG in src/stores/app-store.ts.
const SECTION_TOURS = [
  'Singing',
  'Toolbar',
  'Compose',
  'Effects & Slides',
  'Settings: General',
  'Settings: Practice',
  'Settings: Display & Controls',
]
const PAGE_TOURS = [
  'Guitar',
  'Piano',
  'Analysis',
  'Exercises',
  'Jam',
  'Community',
  'Leaderboard',
  'Challenges',
]

const launchOpts = {}
if (process.env.CHROMIUM) launchOpts.executablePath = process.env.CHROMIUM
let browser
try {
  browser = await chromium.launch(launchOpts)
} catch {
  browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
  })
}

const ctx = await browser.newContext({
  viewport: MOBILE ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  hasTouch: MOBILE,
})
const page = await ctx.newPage()
await page.addInitScript((v) => {
  window.E2E_TEST_MODE = true
  // Skip first-run overlays so tours start cleanly.
  localStorage.setItem('pitchperfect_welcome_version', v)
  localStorage.setItem('pitchperfect_survey_seen', '1')
}, APP_VERSION)
page.on('pageerror', (e) =>
  console.log('  [pageerror]', String(e).slice(0, 120)),
)

await page.goto(BASE)
await page.waitForSelector('#app-tabs', { timeout: 30000 })
await page.waitForTimeout(1500)

const openGuide = async () => {
  // The Guide button lives in the sidebar; on mobile open the drawer first.
  if (MOBILE) {
    await page.locator('.sidebar-toggle-btn').click()
    await page.waitForTimeout(400)
  }
  await page
    .getByTitle('Interactive guide tours')
    .first()
    .click({ timeout: 8000 })
  await page.waitForSelector('[class*="guideSelection"]', { timeout: 5000 })
}

let totalSteps = 0
let missing = 0

async function walkTour(name) {
  await openGuide()
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await page
    .locator('[class*="guideSectionName"]', {
      hasText: new RegExp(`^${escaped}$`),
    })
    .first()
    .click()
  const tooltip = page.locator('[class*="walkthroughTooltip"]')
  try {
    await tooltip.waitFor({ state: 'visible', timeout: 6000 })
  } catch {
    console.log(`\n### ${name}: TOUR DID NOT START`)
    missing++
    return
  }
  console.log(`\n### ${name}`)
  const seen = new Set()
  for (let i = 0; i < 40; i++) {
    // Let step preparation settle: tab switch, sidebar drawer, reveals,
    // and the ~1s waitForTarget budget in Walkthrough.tsx.
    await page.waitForTimeout(1700)
    if (!(await tooltip.isVisible().catch(() => false))) break
    const title = (
      (await page
        .locator('[class*="walkthroughStepTitle"]')
        .textContent()
        .catch(() => '')) ?? ''
    ).trim()
    const key = `${i}:${title}`
    if (seen.has(key)) break
    seen.add(key)
    const hl = page.locator('[class*="walkthroughHighlight"]')
    const hlVisible = await hl.isVisible().catch(() => false)
    const box = hlVisible ? await hl.boundingBox() : null
    const ok = !!box && box.width > 14 && box.height > 14
    totalSteps++
    if (!ok) missing++
    console.log(
      `  ${ok ? 'ok  ' : 'MISS'}  step ${i + 1}: ${title}  ${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'no-highlight'}`,
    )
    const next = page
      .locator('[class*="walkthroughNext"]:not([class*="NextSection"])')
      .last()
    if (!(await next.isVisible().catch(() => false))) break
    await next.click().catch(() => {})
  }
  if (await tooltip.isVisible().catch(() => false)) {
    await page
      .locator('[class*="walkthroughClose"]')
      .click()
      .catch(() => {})
    await page.waitForTimeout(400)
  }
  await page.waitForTimeout(400)
}

for (const t of [...SECTION_TOURS, ...PAGE_TOURS]) {
  await walkTour(t)
}

console.log(
  `\nTOTAL steps: ${totalSteps}, steps without visible spotlight: ${missing}`,
)
await browser.close()
process.exit(missing === 0 ? 0 : 1)
