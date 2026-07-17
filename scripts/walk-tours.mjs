// ============================================================
// walk-tours — step through EVERY guided spotlight tour in a real
// browser and assert each step's spotlight lands on a visible target.
//
// Use this whenever tour steps, their target selectors, or the UI they
// point at change (Walkthrough.tsx, WALKTHROUGH_STEPS / PAGE_TOURS in
// app-store.ts, control bars, sidebar, settings panel, …).
//
// Usage:
//   pnpm run build:tours && pnpm dlx serve dist -l 3005   # or any static server
//   node scripts/walk-tours.mjs                           # desktop viewport
//   MOBILE=1 node scripts/walk-tours.mjs                  # iPhone-sized viewport
//
// build:tours builds with an EMPTY VITE_API_BASE_URL so the app runs on
// the local Dexie adapter. A plain production build bakes in the real
// api.mercurypitch.com — walking that would create a junk anonymous user
// in prod D1 per run and go flaky whenever the API hiccups, so this
// script refuses to walk a remote-API bundle (see the HybridAdapter
// guard below) and blocks any non-local request as a safety net.
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
// Cap every implicit action/wait so a single stuck step can't hang the whole
// walk. Calls that need longer (page load, tour start) pass explicit timeouts.
page.setDefaultTimeout(5000)
await page.addInitScript((v) => {
  window.E2E_TEST_MODE = true
  // Skip first-run overlays so tours start cleanly.
  localStorage.setItem('pitchperfect_welcome_version', v)
  localStorage.setItem('pitchperfect_survey_seen', '1')
}, APP_VERSION)
page.on('pageerror', (e) =>
  console.log('  [pageerror]', String(e).slice(0, 120)),
)

// Never let a tour walk touch a real backend: block every request that
// leaves localhost (belt) and fail fast when the bundle was built with a
// remote VITE_API_BASE_URL (suspenders) — that means `pnpm run build` was
// used instead of `pnpm run build:tours`, and the walk would run against
// cloud data instead of the seeded local Dexie DB.
await ctx.route('**/*', (route) => {
  const host = new URL(route.request().url()).hostname
  if (host === 'localhost' || host === '127.0.0.1') return route.continue()
  console.log(`  [blocked] ${route.request().url().slice(0, 100)}`)
  return route.abort()
})
page.on('console', (m) => {
  if (m.text().includes('using HybridAdapter')) {
    console.error(
      'FATAL: the served bundle points at a remote API (HybridAdapter). ' +
        'Rebuild with `pnpm run build:tours` so the walk uses the local ' +
        'Dexie adapter and seeded definitions.',
    )
    process.exit(1)
  }
})

await page.goto(BASE)
// Nav differs by viewport: desktop has the top #app-tabs bar; mobile
// (<=768px) unmounts it and shows the floating BottomTabBar instead.
await page.waitForSelector(
  MOBILE ? '[data-tour="mobile-tabbar"]' : '#app-tabs',
  { timeout: 30000 },
)
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

// ---- step settling ------------------------------------------------------
// Clicking Next flips the step title immediately (it's reactive) but the
// spotlight only repositions once Walkthrough.tsx's waitForTarget budget
// (~1s) resolves and any tab switch / sidebar drawer / reveal animation
// finishes. Instead of sleeping for that whole worst case on every step,
// poll: wait for the title to change (we're now looking at the *new* step,
// not the outgoing one), then sample the highlight box until it stops moving
// AND has left the previous step's position — so we never mistake the stale
// leftover box for the new spotlight. A settled step usually resolves in
// ~200–400ms; a genuinely missing spotlight still waits the full budget
// before we call it, so real MISSes are not lost to a race.
const POLL_MS = 85
const TITLE_POLLS = 12 // ~1s for the reactive title to flip
const BOX_POLLS = 24 // ~2s for the spotlight to reposition and settle

const readTitle = () =>
  page
    .locator('[class*="walkthroughStepTitle"]')
    .textContent({ timeout: 1500 })
    .then((t) => (t ?? '').trim())
    .catch(() => '')

const readBox = async () => {
  const hl = page.locator('[class*="walkthroughHighlight"]')
  if (!(await hl.isVisible().catch(() => false))) return null
  return hl.boundingBox().catch(() => null)
}

// Two boxes are "the same place" within 1px (boundingBox returns floats).
// null === null so a hidden spotlight compares equal to a hidden spotlight.
const sameBox = (a, b) => {
  if (a === null || b === null) return a === b
  return (
    Math.abs(a.x - b.x) < 1 &&
    Math.abs(a.y - b.y) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  )
}

// Wait for the current step to settle and return its final highlight box
// (or null when the spotlight is hidden — i.e. a MISS). `prevTitle` is the
// outgoing step's title (null on the first step); `lastBox` is its final box.
async function settleStep(prevTitle, lastBox) {
  // 1) Wait for the reactive title to replace the outgoing step's, so we
  //    don't measure the previous spotlight mid-transition. Skipped on the
  //    first step and harmless if the title genuinely repeats (falls through).
  if (prevTitle !== null) {
    for (let p = 0; p < TITLE_POLLS; p++) {
      if ((await readTitle()) !== prevTitle) break
      await page.waitForTimeout(POLL_MS)
    }
  }
  // 2) Sample the highlight until it POSITIVELY settles: visible, stopped
  //    moving (two consecutive reads agree), and left the previous step's box
  //    (proof the reposition happened, not a stale leftover). Crucially we
  //    never early-return a *null*: a step's target is transiently hidden
  //    (display:none) while prep runs — a tab switch or scroll fires the
  //    reposition handler before the new target mounts — and returning that
  //    hidden frame would be a false MISS. Genuine misses instead fall
  //    through the whole budget to the final read below, matching the old
  //    flat-sleep-then-measure-once behaviour.
  let prev = await readBox()
  for (let p = 0; p < BOX_POLLS; p++) {
    await page.waitForTimeout(POLL_MS)
    const cur = await readBox()
    if (cur !== null && sameBox(prev, cur) && !sameBox(cur, lastBox)) return cur
    prev = cur
  }
  return prev
}

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
  let prevTitle = null
  let lastBox = null
  for (let i = 0; i < 40; i++) {
    if (!(await tooltip.isVisible().catch(() => false))) break
    // Poll until this step's spotlight has settled (replaces a flat 1700ms
    // sleep — see settleStep above).
    const box = await settleStep(prevTitle, lastBox)
    if (!(await tooltip.isVisible().catch(() => false))) break
    const title = await readTitle()
    const key = `${i}:${title}`
    if (seen.has(key)) break
    seen.add(key)
    const ok = !!box && box.width > 14 && box.height > 14
    totalSteps++
    if (!ok) missing++
    console.log(
      `  ${ok ? 'ok  ' : 'MISS'}  step ${i + 1}: ${title}  ${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'no-highlight'}`,
    )
    prevTitle = title
    lastBox = box
    const next = page
      .locator('[class*="walkthroughNext"]:not([class*="NextSection"])')
      .last()
    if (!(await next.isVisible().catch(() => false))) break
    await next.click({ timeout: 4000 }).catch(() => {})
  }
  if (await tooltip.isVisible().catch(() => false)) {
    await page
      .locator('[class*="walkthroughClose"]')
      .click()
      .catch(() => {})
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(200)
}

for (const t of [...SECTION_TOURS, ...PAGE_TOURS]) {
  await walkTour(t)
}

console.log(
  `\nTOTAL steps: ${totalSteps}, steps without visible spotlight: ${missing}`,
)
await browser.close()
process.exit(missing === 0 ? 0 : 1)
