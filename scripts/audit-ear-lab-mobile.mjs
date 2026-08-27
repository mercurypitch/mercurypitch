// ============================================================
// audit-ear-lab-mobile — screenshot the Ear Lab bench at a phone
// viewport (and, optionally, a desktop one) and flag the layout
// regressions the Regulator Room is prone to.
//
// The bench is a room with its own scroller, a session bar and a
// console bridge that has to sit above the app's tab bar on phones.
// The failure modes worth automating:
//   • the page itself scrolls sideways (something escaped the shell)
//   • the amber Run Calibration control is off-screen or under the
//     app's tab bar
//   • the instrument strip collapsed (its flex min-height) or the
//     Regulator vanished
//   • opening the rack leaves no visible Close control
//   • a drill stage's console is off-screen, its pads shorter than a
//     finger, or a practice run never arms them
//
// Usage:
//   pnpm run build:tours && pnpm dlx serve dist -l 3005 &   # local-mode bundle
//   node scripts/audit-ear-lab-mobile.mjs
//   AUDIT_DESKTOP=1 node scripts/audit-ear-lab-mobile.mjs    # add a 1440×900 pass
//
// build:tours builds with an EMPTY VITE_API_BASE_URL so the app runs on
// the local Dexie adapter — never point this at a prod-API bundle, same
// rule as walk-tours.mjs and audit-exercises-mobile.mjs.
//
// Env vars:
//   BASE_URL       app URL (default http://localhost:3005)
//   CHROMIUM       chromium executable path (default: Playwright's own)
//   OUT            output dir for screenshots + report (default ./ear-lab-audit)
//   AUDIT_DESKTOP  1 → also capture the desktop bench
//   APP_VERSION    version used to mark the welcome screen seen
//
// Exits 0 when every audited screen is clean; exits 1 and prints FAIL
// lines otherwise — usable as a CI gate.
// ============================================================
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium, devices } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const OUT = process.env.OUT || 'ear-lab-audit'
const AUDIT_DESKTOP = process.env.AUDIT_DESKTOP === '1'
const APP_VERSION =
  process.env.APP_VERSION ||
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    .version

mkdirSync(OUT, { recursive: true })

// Mark the welcome screen seen and silence every page-tour offer so a
// toast never sits over the controls being measured.
function seed(version) {
  window.E2E_TEST_MODE = true
  try {
    localStorage.setItem('pitchperfect_welcome_version', version)
    for (const t of [
      'home',
      'ear-lab',
      'exercises',
      'singing',
      'piano',
      'guitar',
      'karaoke',
      'community',
      'leaderboard',
      'challenges',
      'jam',
      'compose',
      'analysis',
      'settings',
      'progress',
      'path',
    ]) {
      localStorage.setItem(`pitchperfect_page_tour_offered_${t}`, 'true')
    }
    // A short history, so the report has traces and a map to draw and
    // the bench has a sealed index to show.
    const now = Date.now()
    const day = 86400000
    const reading = (value, daysAgo, source) => ({
      drillId: 'hairline',
      value,
      spread: 1.2,
      tracks: source === 'calibration' ? 3 : 1,
      source,
      at: now - daysAgo * day,
    })
    localStorage.setItem(
      'mercurypitch_ear_readings',
      JSON.stringify([
        reading(9.4, 2, 'calibration'),
        reading(11.2, 5, 'practice'),
        reading(14, 12, 'practice'),
        reading(17.5, 20, 'practice'),
        reading(22, 33, 'calibration'),
        reading(27, 41, 'practice'),
        reading(31, 50, 'practice'),
        {
          drillId: 'the-grid',
          value: 34,
          spread: 3,
          tracks: 1,
          source: 'practice',
          at: now - 8 * day,
        },
      ]),
    )
    localStorage.setItem(
      'mercurypitch_ear_calibrations',
      JSON.stringify([
        {
          at: now - 2 * day,
          index: 618,
          parts: { resolution: 618 },
          readings: [{ drillId: 'hairline', value: 9.4, spread: 1.2 }],
        },
        {
          at: now - 33 * day,
          index: 580,
          parts: { resolution: 580 },
          readings: [{ drillId: 'hairline', value: 22, spread: 2 }],
        },
      ]),
    )
    // Tap attempts per Home item, so the map has a diagonal and rates.
    localStorage.setItem(
      'mercurypitch_ear_items',
      JSON.stringify({
        'home:deg-1': { rating: 1000, attempts: 8 },
        'home:deg-2': { rating: 1120, attempts: 7 },
        'home:deg-3': { rating: 1100, attempts: 6 },
        'home:deg-4': { rating: 1180, attempts: 9 },
        'home:deg-5': { rating: 1060, attempts: 8 },
        'home:deg-6': { rating: 1150, attempts: 7 },
        'home:deg-7': { rating: 1220, attempts: 6 },
      }),
    )
    localStorage.setItem(
      'mercurypitch_ear_confusions',
      JSON.stringify({
        'home|deg-4>deg-5': 3,
        'home|deg-7>deg-1': 2,
        'home|deg-6>deg-7': 2,
        'home|deg-2>deg-3': 1,
      }),
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
    '--autoplay-policy=no-user-gesture-required',
  ]
  if (process.env.CHROMIUM) {
    return chromium.launch({ executablePath: process.env.CHROMIUM, args })
  }
  try {
    return await chromium.launch({ args })
  } catch {
    return chromium.launch({
      executablePath: '/opt/pw-browsers/chromium',
      args,
    })
  }
}

/** Everything the audit measures, read in one evaluate so it is one frame. */
function measure() {
  const de = document.documentElement
  const vw = window.innerWidth
  const vh = window.innerHeight
  const rect = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height, bottom: r.bottom }
  }
  const visible = (r) =>
    r !== null &&
    r.w > 0 &&
    r.h > 0 &&
    r.y >= 0 &&
    r.bottom <= vh + 1 &&
    r.x >= 0 &&
    r.x + r.w <= vw + 1
  const primary = rect('[data-tour="ear.actions"]')
  const tabBar = rect('#app-tabs')
  const strip = rect('[data-tour="ear.drills"]')
  const regulator = rect('[data-tour="ear.column"] svg')
  const sessionBar = rect('[data-testid="ear-session-bar"]')
  const primaryEl = document.querySelector('[data-tour="ear.actions"]')
  const bridge = primaryEl?.parentElement?.getBoundingClientRect() ?? null
  const column = rect('[data-tour="ear.column"]')
  return {
    vw,
    vh,
    overflowX: de.scrollWidth > de.clientWidth + 2,
    primaryVisible: visible(primary),
    // Only a bar BELOW the bench (the phone tab bar) can cover it; on desktop
    // the same nav sits at the top.
    primaryUnderTabBar:
      primary !== null &&
      tabBar !== null &&
      tabBar.y > primary.y &&
      primary.bottom > tabBar.y + 1,
    stripHeight: strip?.h ?? 0,
    regulatorHeight: regulator?.h ?? 0,
    sessionBarVisible: visible(sessionBar),
    sessionBar,
    // The amber label must not spill past its own box (phones give it a
    // grid column, not its content width).
    primaryClipped:
      primaryEl !== null && primaryEl.scrollWidth > primaryEl.clientWidth + 1,
    // On a desk the Regulator (and its legend) belongs to the first
    // viewport: nothing of it may sit under the bridge before scrolling.
    columnInFirstView:
      column !== null && bridge !== null && column.bottom <= bridge.top + 1,
  }
}

const report = []
let failures = 0
const fail = (screen, why) => {
  failures++
  console.log(`FAIL  ${screen}: ${why}`)
}

async function auditViewport(browser, name, contextOptions) {
  const context = await browser.newContext(contextOptions)
  await context.addInitScript(seed, APP_VERSION)
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    window.location.hash = '#/ear-lab'
  })
  await page.locator('#ear-lab-panel').waitFor({ timeout: 10000 })
  await page.waitForTimeout(900)

  const bench = await page.evaluate(measure)
  await page.screenshot({ path: `${OUT}/${name}-bench.png` })
  if (bench.overflowX) fail(`${name} bench`, 'horizontal overflow on the page')
  if (!bench.primaryVisible)
    fail(`${name} bench`, 'Run Calibration is not fully on screen')
  if (bench.primaryUnderTabBar)
    fail(`${name} bench`, 'Run Calibration sits under the app tab bar')
  if (bench.stripHeight < 60)
    fail(
      `${name} bench`,
      `instrument strip collapsed (${Math.round(bench.stripHeight)}px)`,
    )
  if (bench.regulatorHeight < 200)
    fail(
      `${name} bench`,
      `Regulator too small (${Math.round(bench.regulatorHeight)}px)`,
    )
  if (!bench.sessionBarVisible) fail(`${name} bench`, 'session bar not visible')
  if (bench.primaryClipped)
    fail(`${name} bench`, 'Run Calibration label is clipped by its box')
  if (name === 'desktop' && !bench.columnInFirstView)
    fail(`${name} bench`, 'Regulator does not fit the first viewport')

  await page.locator('[data-tour="ear.drills"]').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${name}-bench-strip.png` })

  await page.getByRole('button', { name: 'Instruments' }).click()
  await page.waitForTimeout(450)
  const rackClose = page
    .getByRole('dialog')
    .getByRole('button', { name: 'Close' })
  const rackVisible = await rackClose.isVisible().catch(() => false)
  await page.screenshot({ path: `${OUT}/${name}-rack-instruments.png` })
  if (!rackVisible)
    fail(`${name} rack`, 'no visible Close control on the open rack')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  await page.getByTestId('ear-room-chip').click()
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${OUT}/${name}-rack-room.png` })
  const slider = page.getByTestId('ear-room-glass')
  if (!(await slider.isVisible().catch(() => false)))
    fail(`${name} rack`, 'room glass slider missing')
  await page.keyboard.press('Escape')

  const stage = await auditStage(page, name)

  report.push({ viewport: name, ...bench, rackVisible, stage })
  await context.close()
}

/** Everything the stage audit measures, read in one evaluate. */
function measureStage() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const rectOf = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height, bottom: r.bottom }
  }
  const visible = (r) =>
    r !== null &&
    r.w > 0 &&
    r.h > 0 &&
    r.y >= 0 &&
    r.bottom <= vh + 1 &&
    r.x >= 0 &&
    r.x + r.w <= vw + 1
  const consoleEl = document.querySelector('[data-testid="ear-stage-console"]')
  const consoleRect = rectOf(consoleEl)
  const tabBar = rectOf(document.querySelector('#app-tabs'))
  const instrument = rectOf(
    document.querySelector('[data-testid="ear-stage"] figure > svg'),
  )
  const pads = [...(consoleEl?.querySelectorAll('button') ?? [])].map(rectOf)
  return {
    consoleVisible: visible(consoleRect),
    consoleUnderTabBar:
      consoleRect !== null &&
      tabBar !== null &&
      tabBar.y > consoleRect.y &&
      consoleRect.bottom > tabBar.y + 1,
    instrumentHeight: instrument?.h ?? 0,
    shortestPad: pads.length ? Math.min(...pads.map((r) => r.h)) : 0,
    padCount: pads.length,
  }
}

/** Open Hairline from the strip, run one practice trial to its pads,
 *  stop onto the plate; then Home to its ladder. Layout only — the
 *  fake audio device makes the tones inaudible, not absent. */
/** The report's layout facts, read in one evaluate. */
function measureReport() {
  const doc = document.documentElement
  const root = document.querySelector('[data-testid="ear-report"]')
  const plates = root ? root.querySelectorAll('[data-plate]').length : 0
  const traces = root
    ? root.querySelectorAll('[data-testid="ear-trace"]').length
    : 0
  const matrixSpills = [
    ...(root?.querySelectorAll('[role="table"]') ?? []),
  ].some((table) => {
    const box = table.parentElement
    const plate = box?.closest('[data-plate]')
    if (!box || !plate) return false
    return (
      box.getBoundingClientRect().right >
      plate.getBoundingClientRect().right + 1
    )
  })
  const range = root?.querySelector('[role="group"][aria-label="Range"]')
  const rangeRect = range?.getBoundingClientRect()
  const rangeVisible =
    !!rangeRect &&
    rangeRect.width > 0 &&
    rangeRect.top >= 0 &&
    rangeRect.bottom <= window.innerHeight
  return {
    overflowX: doc.scrollWidth > doc.clientWidth + 1,
    plates,
    traces,
    matrixSpills,
    rangeVisible,
  }
}

async function auditStage(page, name) {
  const results = {}
  const openFromStrip = async (label) => {
    await page
      .locator('[data-tour="ear.drills"] button', { hasText: label })
      .first()
      .click()
    await page.locator('[data-testid="ear-stage"]').waitFor({ timeout: 8000 })
    await page.waitForTimeout(500)
  }
  const checkStage = async (screen, shot) => {
    const m = await page.evaluate(measureStage)
    await page.screenshot({ path: `${OUT}/${name}-${shot}.png` })
    if (!m.consoleVisible)
      fail(`${name} ${screen}`, 'console is not fully on screen')
    if (m.consoleUnderTabBar)
      fail(`${name} ${screen}`, 'console sits under the app tab bar')
    if (m.instrumentHeight < 120)
      fail(
        `${name} ${screen}`,
        `instrument too small (${Math.round(m.instrumentHeight)}px)`,
      )
    if (m.padCount > 0 && m.shortestPad < 44)
      fail(
        `${name} ${screen}`,
        `a pad is shorter than 44px (${Math.round(m.shortestPad)}px)`,
      )
    return m
  }

  await openFromStrip('Hairline')
  results.hairlineIdle = await checkStage(
    'hairline idle',
    'stage-hairline-idle',
  )

  await page.getByText('Practice run').click()
  const armed = await page
    .locator('button:not([disabled])', { hasText: 'The first' })
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false)
  if (!armed)
    fail(`${name} hairline run`, 'a practice run never armed its pads')
  results.hairlineRun = await checkStage('hairline run', 'stage-hairline-run')
  if (armed) {
    await page.getByRole('button', { name: 'The first' }).click()
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${OUT}/${name}-stage-hairline-reveal.png` })
  }
  await page.getByLabel('Stop').click()
  await page
    .locator('[data-testid="ear-stage-plate"]')
    .waitFor({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${name}-stage-hairline-plate.png` })
  const plateBack = page.getByText('Back to the bench')
  if (!(await plateBack.isVisible().catch(() => false)))
    fail(`${name} hairline plate`, 'no visible Back on the plate')
  await plateBack.click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)

  await openFromStrip('Home')
  results.homeIdle = await checkStage('home idle', 'stage-home-idle')
  await page.getByText('Begin').click()
  await page.waitForTimeout(700)
  results.homeRun = await checkStage('home run', 'stage-home-ladder')
  if (results.homeRun.padCount < 8)
    fail(
      `${name} home run`,
      `ladder has ${results.homeRun.padCount - 1} rungs, expected 7`,
    )
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })

  // The readiness panel: the app's one latency number, in the rack.
  await page.getByLabel(/Open the readiness panel/).click()
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${OUT}/${name}-rack-readiness.png` })
  const startVisible = await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start' })
    .isVisible()
    .catch(() => false)
  if (!startVisible)
    fail(`${name} readiness`, 'no Start control in the readiness panel')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // Calibration as a ritual: at rest, running, abandoned.
  // The bridge's primary reads "Run Calibration" on a desk and
  // "Calibrate" on a phone; the sub-line is the same on both.
  await page
    .locator('[data-tour="ear.actions"]', { hasText: 'marks the glass' })
    .first()
    .click()
  await page.locator('[data-ear-drill="hairline"]').waitFor({ timeout: 8000 })
  await page.waitForTimeout(500)
  results.calibrationIdle = await checkStage(
    'calibration idle',
    'stage-calibration-idle',
  )
  const begin = page.getByRole('button', { name: /Begin/ })
  if (!(await begin.isVisible().catch(() => false)))
    fail(`${name} calibration`, 'no Begin pad on the sealed protocol')
  await begin.click()
  const calArmed = await page
    .locator('button:not([disabled])', { hasText: 'The first' })
    .waitFor({ timeout: 8000 })
    .then(() => true)
    .catch(() => false)
  if (!calArmed)
    fail(`${name} calibration`, 'the calibration never armed its pads')
  results.calibrationRun = await checkStage(
    'calibration run',
    'stage-calibration-run',
  )
  await page.getByLabel('Abandon').click()
  await page
    .locator('[data-testid="ear-stage-plate"]')
    .waitFor({ timeout: 4000 })
  await page.waitForTimeout(300)
  await page.screenshot({
    path: `${OUT}/${name}-stage-calibration-plate.png`,
  })
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(300)

  // The Ear Report inside the room.
  await page.getByRole('button', { name: 'Ear Report' }).first().click()
  await page.locator('[data-testid="ear-report"]').waitFor({ timeout: 8000 })
  await page.waitForTimeout(500)
  const report = await page.evaluate(measureReport)
  await page.screenshot({ path: `${OUT}/${name}-report.png` })
  if (report.overflowX)
    fail(`${name} report`, 'horizontal overflow on the page')
  if (report.plates < 6)
    fail(`${name} report`, `only ${report.plates} plates on the report`)
  if (report.traces < 3)
    fail(`${name} report`, `only ${report.traces} traces drawn from the seed`)
  if (report.matrixSpills)
    fail(`${name} report`, 'a confusion matrix spills past its plate')
  if (!report.rangeVisible)
    fail(`${name} report`, 'the range control is not on screen')
  await page
    .locator('[data-testid="ear-report"] [data-plate="confusion-home"]')
    .scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/${name}-report-map.png` })
  results.report = report
  await page.getByLabel('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })

  return results
}

const browser = await launch()
try {
  await auditViewport(browser, 'phone', { ...devices['iPhone 13'] })
  if (AUDIT_DESKTOP) {
    await auditViewport(browser, 'desktop', {
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    })
  }
} finally {
  await browser.close()
}

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
console.log(
  `\n${report.length} viewport(s) audited → ${OUT}/ (report.json + screenshots)`,
)
if (failures > 0) {
  console.log(`${failures} problem(s)`)
  process.exit(1)
}
