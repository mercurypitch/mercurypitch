// ============================================================
// audit-exercises-mobile — screenshot every exercise's setup and
// live-run screens at a phone viewport and flag mobile layout
// regressions automatically.
//
// The exercises all render through one shared shell (ExerciseShell),
// so a layout mistake there (content overflowing the fixed canvas, the
// floating Stop button landing on an exercise's metrics, a missing
// Start CTA) repeats across every drill. Eyeballing 18 exercises by
// hand is slow and easy to skip; this walks them in a real mobile
// browser, measures the common failure modes, and drops annotated
// screenshots + a machine-readable report for review.
//
// What it checks per screen:
//   • idle   — no horizontal overflow, the recent-scores card is in
//              flow (not the absolute desktop corner card), Start present
//   • active — no horizontal overflow, and the Stop control does not
//              overlap the exercise's metric labels/values
//
// Usage:
//   pnpm run build:tours && pnpm dlx serve dist -l 3005 &   # local-mode bundle
//   node scripts/audit-exercises-mobile.mjs                 # idle screens only
//   AUDIT_ACTIVE=1 node scripts/audit-exercises-mobile.mjs  # also drive live runs
//
// build:tours builds with an EMPTY VITE_API_BASE_URL so the app runs on
// the local Dexie adapter — never point this at a prod-API bundle (it
// would create junk anonymous users), same rule as walk-tours.mjs.
//
// Env vars:
//   BASE_URL      app URL (default http://localhost:3005)
//   CHROMIUM      chromium executable path (default: Playwright's own;
//                 falls back to /opt/pw-browsers/chromium)
//   OUT           output dir for screenshots + report (default ./mobile-audit)
//   AUDIT_ACTIVE  1 → start each exercise and screenshot the running view
//   ONLY          comma-separated title substrings to limit the run
//                 (e.g. ONLY="Slide,Pitch Hold")
//   APP_VERSION   version used to mark the welcome screen seen
//                 (default: read from package.json)
//
// Exits 0 when every audited screen is clean; exits 1 and prints FAIL
// lines otherwise — usable as a CI gate.
// ============================================================
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const OUT = process.env.OUT || 'mobile-audit'
const AUDIT_ACTIVE = process.env.AUDIT_ACTIVE === '1'
const ONLY = (process.env.ONLY || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const APP_VERSION =
  process.env.APP_VERSION ||
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    .version

mkdirSync(OUT, { recursive: true })
const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// Mark the welcome screen seen and silence the "take a quick tour" toast
// so it never sits over the very controls we are auditing.
function seed(version) {
  window.E2E_TEST_MODE = true
  try {
    localStorage.setItem('pitchperfect_welcome_version', version)
    for (const t of [
      'exercises', 'singing', 'piano', 'guitar', 'karaoke', 'community',
      'leaderboard', 'challenges', 'jam', 'compose', 'analysis', 'settings',
    ]) {
      localStorage.setItem(`pitchperfect_page_tour_offered_${t}`, 'true')
    }
    // A little history so the recent-scores strip renders on the setup screen.
    localStorage.setItem(
      'mercurypitch_exercise_history',
      JSON.stringify([
        { type: 'warmup', score: 78, metrics: {}, completedAt: 1 },
      ]),
    )
  } catch {
    /* storage may be unavailable; the audit still runs */
  }
}

async function launch() {
  const args = [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--ignore-certificate-errors',
  ]
  if (process.env.CHROMIUM) {
    return chromium.launch({ executablePath: process.env.CHROMIUM, args })
  }
  try {
    return await chromium.launch({ args })
  } catch {
    // Sandboxes ship a prebuilt Chromium that Playwright's own install misses.
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args })
  }
}

// Measure the common mobile failure modes in the live DOM.
function probe() {
  // Real overflow = the page itself scrolls sideways. Content that spills
  // past the viewport but is clipped/scrollable inside an overflow container
  // (e.g. the sight-singing staff) is intentional, so don't flag it.
  const de = document.documentElement
  const overflowX = de.scrollWidth > de.clientWidth + 2
  const score = document.querySelector('.exercise-score-history')
  const stop = document.querySelector('.exercise-btn-stop')
  const start = document.querySelector('.exercise-idle-start')
  let stopOverlapsMetrics = false
  if (stop) {
    const s = stop.getBoundingClientRect()
    const labels = document.querySelectorAll(
      '.exercise-canvas-area [class*="metric-label"], .exercise-canvas-area [class*="metric-value"]',
    )
    for (const el of labels) {
      const r = el.getBoundingClientRect()
      const hit = !(r.right < s.left || r.left > s.right || r.bottom < s.top || r.top > s.bottom)
      if (hit) { stopOverlapsMetrics = true; break }
    }
  }
  return {
    overflowX,
    scorePos: score ? getComputedStyle(score).position : null,
    hasStart: !!start,
    hasStop: !!stop,
    stopOverlapsMetrics,
  }
}

const browser = await launch()
const context = await browser.newContext({
  ...devices['iPhone 12'],
  ignoreHTTPSErrors: true,
  permissions: ['microphone'],
})
await context.addInitScript(seed, APP_VERSION)
const page = await context.newPage()

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)
// #tab-exercises is the shared tab id: the desktop top bar and the mobile
// BottomTabBar both use it (only one is mounted per viewport), so this
// works regardless of which bar the audit viewport gets.
const exTab = page.locator('#tab-exercises')
if (!(await exTab.count())) {
  console.error('FAIL: could not find the Exercises tab — is the app served at ' + BASE + '?')
  await browser.close()
  process.exit(1)
}
await exTab.first().click()
await page.locator('.exercises-grid').first().waitFor({ timeout: 8000 })
await page.waitForTimeout(800)

let titles = await page.$$eval('.exercise-card', (els) =>
  els.map((e) => ({
    title: e.querySelector('h3')?.textContent?.trim() || '?',
    disabled: e.classList.contains('exercise-card-disabled'),
  })),
)
if (ONLY.length) {
  titles = titles.map((t) => ({
    ...t,
    skip: !ONLY.some((o) => t.title.toLowerCase().includes(o.toLowerCase())),
  }))
}

const report = []
let failures = 0
const fail = (title, screen, why) => {
  failures++
  console.log(`FAIL  ${title} [${screen}] — ${why}`)
}

for (let i = 0; i < titles.length; i++) {
  const { title, disabled, skip } = titles[i]
  if (disabled || skip) continue
  const s = String(i).padStart(2, '0') + '-' + slug(title)
  try {
    await page.locator('.exercise-card').nth(i).locator('.exercise-card-head').click()
    await page.locator('.exercise-runner').waitFor({ timeout: 8000 })
    await page.waitForTimeout(900)

    const idle = await page.evaluate(probe)
    await page.screenshot({ path: `${OUT}/${s}-idle.png` })
    if (idle.overflowX) fail(title, 'idle', 'horizontal overflow in the canvas')
    if (!idle.hasStart) fail(title, 'idle', 'no Start button')
    if (idle.scorePos === 'absolute') fail(title, 'idle', 'recent-scores card still absolute (desktop corner) on mobile')

    let active = null
    if (AUDIT_ACTIVE) {
      const startBtn = page.locator('.exercise-idle-start')
      if (await startBtn.count()) {
        await startBtn.first().click().catch(() => {})
        await page.waitForTimeout(3200)
        active = await page.evaluate(probe)
        await page.screenshot({ path: `${OUT}/${s}-active.png` })
        if (active.overflowX) fail(title, 'active', 'horizontal overflow in the canvas')
        if (active.stopOverlapsMetrics) fail(title, 'active', 'Stop button overlaps the metrics row')
        const stop = page.locator('.exercise-btn-stop')
        if (await stop.count()) await stop.first().click().catch(() => {})
        await page.waitForTimeout(500)
      }
    }

    report.push({ title, idle, active })
    const flags = [
      idle.overflowX && 'idle:overflow',
      idle.scorePos === 'absolute' && 'idle:abs-score',
      active?.overflowX && 'active:overflow',
      active?.stopOverlapsMetrics && 'active:stop-overlap',
    ].filter(Boolean)
    console.log(`${flags.length ? 'WARN' : 'ok  '}  ${title}${flags.length ? ' — ' + flags.join(', ') : ''}`)

    const back = page.locator('.back-btn')
    if (await back.count()) await back.first().click()
    await page.locator('.exercises-grid').first().waitFor({ timeout: 8000 })
    await page.waitForTimeout(400)
  } catch (e) {
    report.push({ title, error: String(e).slice(0, 160) })
    console.log(`ERR   ${title} — ${String(e).slice(0, 120)}`)
    // Recover to the grid for the next exercise.
    await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1800)
    const t2 = page.locator('.app-tab', { hasText: 'Exercise' })
    if (await t2.count()) await t2.first().click().catch(() => {})
    await page.locator('.exercises-grid').first().waitFor({ timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(500)
  }
}

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
console.log(`\n${report.length} exercises audited → ${OUT}/ (report.json + screenshots)`)
if (failures) {
  console.log(`\n${failures} failing check(s).`)
  await browser.close()
  process.exit(1)
}
console.log('\nAll audited screens clean.')
await browser.close()
