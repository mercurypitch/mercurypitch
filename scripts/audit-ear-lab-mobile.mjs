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

  report.push({ viewport: name, ...bench, rackVisible })
  await context.close()
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
