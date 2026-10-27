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
// the local Dexie adapter, and with VITE_JAM_MOCK_SIGNALING=1 so "Create
// Room" opens the preview room instead of asking a signalling server. A plain production build bakes in the real
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
//   ONLY         comma-separated tour names to walk instead of all of them,
//                as they are printed here (e.g. ONLY="Jam,Jam (inside a room)")
//
// Every step is also held to the two rules in tour-rules.mjs: its spotlight
// takes at most 70% of the window's height (WIDE otherwise), and a consent
// bar put up beside it stays on top (BAR otherwise). Merc's tours are walked
// by src/e2e/coach-tours.spec.ts, under the same rules: this walker drives
// the Guide's spotlight tooltip.
//
// Exits 0 when every step of every tour spotlights a visible element and
// keeps both rules; exits 1 and prints MISS, WIDE or BAR lines otherwise.
// The Karaoke mixer tour is not walked — its targets only exist once a song
// is loaded in the mixer. The Jam tab has two tours (the lobby's and the
// room's) and both are: "Jam" in the Guide starts whichever screen is up, so
// the second walk opens the preview room first.
// ============================================================
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { barOnTop, probeConsentBar, targetFits } from './tour-rules.mjs'

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
  'Home',
  'Path',
  'Guitar',
  'Piano',
  'Analysis',
  'Exercises',
  'Jam',
  'Community',
  'Leaderboard',
  'Challenges',
  'Ear Lab',
]
// Tours that belong to no tab. Unlike the Karaoke mixer's, the voice tour's
// targets exist on a cold start — the pill is in every view and the rest are
// Settings rows — so it can and should be walked.
const CONTEXTUAL_TOURS = ['Voice control']
// The Jam tab's second tour. Walked as "Jam" from inside a room; this is the
// name it is printed (and asked for, with ONLY) under.
const JAM_ROOM_TOUR = 'Jam (inside a room)'
const ONLY =
  process.env.ONLY === undefined || process.env.ONLY.trim() === ''
    ? null
    : new Set(process.env.ONLY.split(',').map((name) => name.trim()))
const wanted = (name) => ONLY === null || ONLY.has(name)

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

const VIEWPORT = MOBILE
  ? { width: 390, height: 844 }
  : { width: 1280, height: 800 }
const ctx = await browser.newContext({ viewport: VIEWPORT, hasTouch: MOBILE })
const page = await ctx.newPage()
await page.addInitScript((v) => {
  globalThis.window.E2E_TEST_MODE = true
  // Skip first-run overlays so tours start cleanly.
  globalThis.localStorage.setItem('pitchperfect_welcome_version', v)
  globalThis.localStorage.setItem('pitchperfect_survey_seen', '1')
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

// Steps whose target only exists once the cloud has answered with a populated
// board. build:tours empties VITE_API_BASE_URL on purpose (see the note at the
// top), so the leaderboard renders its "Boards need the cloud" empty state and
// the podium and table are never in the DOM here. That is the walk's own
// limitation, not a broken step — the same reason the Karaoke mixer tour is
// left out entirely. Keyed `tour::step title`; a typo shows up as the step
// still counting as a MISS, never as a silent pass.
const NEEDS_CLOUD_DATA = new Set([
  'Leaderboard::Top of the board',
  'Leaderboard::Full rankings',
  // Same limitation, one page over: the Progress cabinet renders its
  // "Reconnect to load your badges and achievements" fallback when the account
  // side is unavailable (`available: input.availability?.account`), and the
  // badge and achievement groups are inside that Show. With the cloud, both
  // targets are there.
  'Challenges::Earn badges',
  'Challenges::Achievements',
])

// Steps whose spotlight was already taller than 70% of the window when the
// rule came in (walked on 26 Oct 2026, at 1280x800 and 390x844), keyed as
// NEEDS_CLOUD_DATA is. Each prints `wide` rather than failing the walk, so a
// new one fails while these wait to be pointed at something smaller. Most
// ring a whole page or panel; the Piano one is 592 px of 800 on a desktop
// and 581 of 844 on a phone.
const WIDE_TARGETS = new Set([
  'Singing::Practice Mode',
  'Settings: General::The General tab',
  'Settings: General::Credits',
  'Settings: General::About & What’s New',
  'Settings: Display & Controls::Show or hide panels',
  'Home::Choose your next room',
  'Path::The Ascent',
  'Path::The week card',
  'Piano::Play the falling notes',
  'Exercises::Pick a drill',
  'Challenges::Take on a challenge',
])

let totalSteps = 0
let missing = 0
let skipped = 0
let broken = 0
let wide = 0

async function walkTour(name, label = name) {
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
    console.log(`\n### ${label}: TOUR DID NOT START`)
    missing++
    return
  }
  console.log(`\n### ${label}`)
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
    const excused = !ok && NEEDS_CLOUD_DATA.has(`${name}::${title}`)
    // The two rules: a spotlight that fits, and the consent bar on top.
    const fits = box === null || targetFits(box, VIEWPORT)
    const knownWide = !fits && WIDE_TARGETS.has(`${name}::${title}`)
    const onTop = barOnTop(await page.evaluate(probeConsentBar))
    totalSteps++
    if (excused) skipped++
    else if (!ok) missing++
    if (knownWide) wide++
    if (!onTop || (!fits && !knownWide)) broken++
    const verdict = !ok
      ? excused
        ? 'skip'
        : 'MISS'
      : !onTop
        ? 'BAR '
        : !fits
          ? knownWide
            ? 'wide'
            : 'WIDE'
          : 'ok  '
    console.log(
      `  ${verdict}  step ${i + 1}: ${title}  ${box ? `${Math.round(box.width)}x${Math.round(box.height)}` : excused ? 'needs a cloud board' : 'no-highlight'}`,
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

/**
 * The room's own tour, from inside a room.
 *
 * build:tours has no signalling server, so Create Room opens the preview room
 * -- real UI, invented peers, nothing on the wire. Left again afterwards, or
 * every tour after this one would start from inside it.
 */
async function walkJamRoomTour() {
  await page.goto(`${BASE}/#/jam`)
  const create = page.getByRole('button', { name: 'Create Room' })
  try {
    await create.waitFor({ state: 'visible', timeout: 15000 })
    await create.click()
    await page.waitForSelector('[data-testid="jam-room-header"]', {
      timeout: 15000,
    })
  } catch {
    console.log(`\n### ${JAM_ROOM_TOUR}: COULD NOT OPEN A ROOM`)
    missing++
    return
  }
  await walkTour('Jam', JAM_ROOM_TOUR)
  await page
    .getByTitle('Leave room')
    .click()
    .catch(() => {})
  await page.waitForTimeout(600)
}

for (const t of [...SECTION_TOURS, ...PAGE_TOURS, ...CONTEXTUAL_TOURS]) {
  if (wanted(t)) await walkTour(t)
}
if (wanted(JAM_ROOM_TOUR)) await walkJamRoomTour()

console.log(
  `\nTOTAL steps: ${totalSteps}, steps without visible spotlight: ${missing}` +
    `, steps breaking a rule (WIDE or BAR): ${broken}${
      skipped > 0 ? `, skipped (need a cloud board): ${skipped}` : ''
    }${wide > 0 ? `, known wide spotlights: ${wide}` : ''}`,
)
await browser.close()
process.exit(missing === 0 && broken === 0 ? 0 : 1)
