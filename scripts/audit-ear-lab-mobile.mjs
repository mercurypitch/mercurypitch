// ============================================================
// audit-ear-lab-mobile — walk Merc's bench, the Ear Lab the web shows
// since November 2026 (EAR_LAB_WITH_MERC, src/lib/native-build.ts), at a
// phone viewport and, optionally, at desks, and flag the layout
// regressions it is prone to, with a screenshot behind every verdict.
//
// What it measures, per viewport:
//   • the bench: nothing scrolls sideways; Calibrate and Today's Start
//     are on the screen when scrolled to and not under the app's tab
//     bar; the six stations are full tap targets inside the screen; at a
//     desk, the bench is laid out for the width (Merc's desk beside the
//     Mercury Index and Today, the stations three to a row) and none of
//     its parts lies over another
//   • each station's sheet: it opens inside the window, its close is on
//     the screen, every row is a full tap target, and the close shuts it
//   • a drill from a station's sheet (Hairline) and Today's first: the
//     room covers the window, a practice run arms its pads, every pad is
//     a finger tall and the console ends on the screen; ending the run
//     comes back to the bench
//   • the Ear Report: it opens at its top with its back button on the
//     screen, nothing scrolls sideways, and back returns to the bench
//
// The drills' rooms in detail are held by src/e2e/ear-lab*.spec.ts; this
// walk is the look a person would take before a release. The older bench
// (EarLabDashboard.tsx, its rack and instrument strip) is not on any web
// build now, only in the store build, and is not audited here.
//
// Usage:
//   pnpm run build:tours && pnpm dlx serve dist -l 3005 &   # local-mode bundle
//   node scripts/audit-ear-lab-mobile.mjs
//   AUDIT_DESKTOP=1 node scripts/audit-ear-lab-mobile.mjs    # add 1440x900 and 1024x768
//
// build:tours builds with an EMPTY VITE_API_BASE_URL so the app runs on
// the local Dexie adapter — never point this at a prod-API bundle, same
// rule as walk-tours.mjs and audit-exercises-mobile.mjs.
//
// Env vars:
//   BASE_URL       app URL (default http://localhost:3005)
//   CHROMIUM       chromium executable path (default: Playwright's own)
//   OUT            output dir for screenshots + report (default ./ear-lab-audit)
//   AUDIT_DESKTOP  1 → also walk the bench at two desks
//   APP_VERSION    version used to mark the welcome screen seen
//
// Exits 0 when every audited screen is clean; exits 1 and prints FAIL
// lines otherwise — usable as a CI gate.
// ============================================================
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3005'
const OUT = process.env.OUT || 'ear-lab-audit'
const AUDIT_DESKTOP = process.env.AUDIT_DESKTOP === '1'
const APP_VERSION =
  process.env.APP_VERSION ||
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    .version

mkdirSync(OUT, { recursive: true })

/** The smallest a thing a finger presses may be. */
const TAP = 44
/** From this tab width the bench is a desk (merc/bench.module.css). */
const DESK = 860

// Mark the welcome screen seen, silence every page-tour offer so a toast
// never sits over what is measured, and leave a short history, so the
// bench has a sealed Index and the report has traces and a map to draw.
function seed(version) {
  window.E2E_TEST_MODE = true
  try {
    localStorage.setItem('pitchperfect_welcome_version', version)
    localStorage.setItem('pitchperfect_onboarding_done', '1')
    for (const t of ['home', 'ear-lab', 'exercises', 'singing', 'progress']) {
      localStorage.setItem(`pitchperfect_page_tour_offered_${t}`, 'true')
    }
    const now = Date.now()
    const day = 86400000
    const reading = (drillId, value, daysAgo, source) => ({
      drillId,
      value,
      spread: 1.2,
      tracks: source === 'calibration' ? 3 : 1,
      source,
      at: now - daysAgo * day,
    })
    localStorage.setItem(
      'mercurypitch_ear_readings',
      JSON.stringify([
        reading('hairline', 9.4, 2, 'calibration'),
        reading('hairline', 11.2, 5, 'practice'),
        reading('the-grid', 34, 8, 'practice'),
        reading('hairline', 14, 12, 'practice'),
        reading('hairline', 22, 33, 'calibration'),
        reading('hairline', 31, 50, 'practice'),
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
    localStorage.setItem(
      'mercurypitch_ear_confusions',
      JSON.stringify({
        'home|deg-4>deg-5': 3,
        'home|deg-7>deg-1': 2,
        'leap|leap:m3>leap:M3': 2,
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
    '--mute-audio',
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

const report = []
let failures = 0
const fail = (screen, why) => {
  failures++
  console.log(`FAIL  ${screen}: ${why}`)
}

/** The bench, read in one evaluate so it is one frame. */
function measureBench() {
  const de = document.documentElement
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  }
  const one = (sel) => box(document.querySelector(sel))
  const bench = document.querySelector('[data-testid="merc-bench"]')
  const parts = [
    ['hero', '[data-testid="merc-bench-line"]'],
    ['index', '[data-tour="ear.index"]'],
    ['today', '[data-testid="merc-today"]'],
    ['rooms', '[data-testid="ear-rooms-row"]'],
    ['stations', '[data-tour="ear.faculties"]'],
    ['path', '[data-tour="ear.path"]'],
    ['report', '[data-tour="ear.report"]'],
  ].map(([name, sel]) => [name, one(sel)])
  const overlaps = []
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const [an, a] = parts[i]
      const [bn, b] = parts[j]
      if (!a || !b) continue
      const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (x > 1 && y > 1) overlaps.push(`${an} and ${bn}`)
    }
  }
  const stations = [
    ...document.querySelectorAll('[data-testid="merc-station"]'),
  ].map(box)
  return {
    vw: innerWidth,
    tab: bench ? bench.getBoundingClientRect().width : 0,
    sideways: de.scrollWidth - de.clientWidth,
    parts: Object.fromEntries(parts),
    overlaps,
    stations,
    stationRows: new Set(stations.map((s) => Math.round(s.y))).size,
  }
}

/** Whether `selector` is fully on the screen and clear of the tab bar. */
function onScreen(selector) {
  const el = document.querySelector(selector)
  if (!el) return { found: false }
  const r = el.getBoundingClientRect()
  const bar = document.querySelector('[data-tour="mobile-tabbar"]')
  const b = bar ? bar.getBoundingClientRect() : null
  return {
    found: true,
    inside:
      r.width > 0 &&
      r.top >= 0 &&
      r.bottom <= innerHeight + 1 &&
      r.left >= 0 &&
      r.right <= innerWidth + 1,
    underBar:
      b !== null && b.height > 0 && b.top > r.top && r.bottom > b.top + 1,
  }
}

/**
 * Scroll the tab's own scroller until `selector` stands in the middle of
 * it, as a person's wheel or thumb would. Not `scrollIntoView`: that also
 * scrolls the app's clipped frames, which no person can, and leaves the
 * app shifted up under its bars.
 */
async function centre(page, selector) {
  await page
    .locator(selector)
    .first()
    .evaluate((el) => {
      let s = el.parentElement
      while (
        s &&
        !(
          s.scrollHeight > s.clientHeight + 1 &&
          /(auto|scroll)/.test(getComputedStyle(s).overflowY)
        )
      )
        s = s.parentElement
      const scroller = s ?? document.scrollingElement
      const view =
        s === null
          ? { top: 0, height: innerHeight }
          : scroller.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      scroller.scrollTop += r.top + r.height / 2 - (view.top + view.height / 2)
    })
  await page.waitForTimeout(300)
}

async function openBench(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  // By the hash: a static server answers /ear-lab with the directory of
  // the room art, not the app.
  await page.evaluate(() => {
    window.location.hash = '#/ear-lab'
  })
  await page.getByTestId('merc-bench').waitFor({ timeout: 30000 })
  await page.waitForTimeout(900)
}

async function auditBench(page, name) {
  const bench = await page.evaluate(measureBench)
  await page.screenshot({ path: `${OUT}/${name}-bench.png` })
  if (bench.sideways > 0)
    fail(`${name} bench`, `the page scrolls sideways by ${bench.sideways}px`)
  if (bench.overlaps.length > 0)
    fail(`${name} bench`, `parts overlap: ${bench.overlaps.join('; ')}`)
  if (bench.stations.length !== 6)
    fail(`${name} bench`, `${bench.stations.length} stations, not 6`)
  for (const s of bench.stations) {
    if (s.h < TAP || s.w < TAP)
      fail(
        `${name} bench`,
        `a station is ${Math.round(s.w)}x${Math.round(s.h)}`,
      )
    if (s.x < 0 || s.x + s.w > bench.vw + 1)
      fail(`${name} bench`, 'a station runs past the screen edge')
  }
  const { hero, index, stations } = bench.parts
  if (bench.tab >= DESK) {
    if (!hero || !index || index.x < hero.x + hero.w)
      fail(`${name} bench`, 'the Mercury Index is not beside Merc at a desk')
    if (bench.stationRows !== 2)
      fail(`${name} bench`, `stations in ${bench.stationRows} rows, not 2`)
    if (!stations || stations.w <= 600)
      fail(`${name} bench`, 'the stations are a phone column at a desk')
  } else if (bench.stationRows !== 3) {
    fail(`${name} bench`, `stations in ${bench.stationRows} rows, not 3`)
  }
  for (const [what, sel] of [
    ['Calibrate', '[data-testid="merc-calibrate"]'],
    ["Today's Start", '[data-testid="merc-today-start"]'],
  ]) {
    // To the middle of the window, as a person scrolls to it: brought only
    // to the scroller's edge, it would stand under the tab bar on a phone.
    await centre(page, sel)
    const seen = await page.evaluate(onScreen, sel)
    if (!seen.found) fail(`${name} bench`, `${what} is missing`)
    else if (!seen.inside) fail(`${name} bench`, `${what} is not on the screen`)
    else if (seen.underBar)
      fail(`${name} bench`, `${what} is under the tab bar`)
  }
  return bench
}

async function auditSheets(page, name) {
  const faculties = await page
    .locator('[data-testid="merc-station"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-faculty')))
  const sheets = []
  for (const faculty of faculties) {
    await page
      .locator(`[data-testid="merc-station"][data-faculty="${faculty}"]`)
      .click()
    const sheet = page.getByTestId('merc-station-sheet')
    await sheet.waitFor({ timeout: 8000 })
    await page.waitForTimeout(400)
    const seen = await sheet.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const rows = [...el.querySelectorAll('[data-testid="merc-station-row"]')]
      const close = el.querySelector('button[aria-label^="Close"]')
      const c = close ? close.getBoundingClientRect() : null
      return {
        inside: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1,
        rows: rows.map((row) => row.getBoundingClientRect().height),
        close:
          c !== null &&
          c.width >= 44 &&
          c.top >= 0 &&
          c.bottom <= innerHeight + 1,
      }
    })
    await page.screenshot({ path: `${OUT}/${name}-sheet-${faculty}.png` })
    if (!seen.inside) fail(`${name} ${faculty} sheet`, 'it runs off the window')
    if (!seen.close)
      fail(`${name} ${faculty} sheet`, 'its close is not on the screen')
    for (const h of seen.rows) {
      if (h < TAP)
        fail(`${name} ${faculty} sheet`, `a row is ${Math.round(h)}px tall`)
    }
    await sheet.locator('button[aria-label^="Close"]').first().click()
    await page.waitForTimeout(400)
    if (await sheet.isVisible().catch(() => false))
      fail(`${name} ${faculty} sheet`, 'its close did not shut it')
    sheets.push({ faculty, ...seen })
  }
  return sheets
}

/** A practice run in the room: the pads arm, a finger tall, on the screen. */
async function auditRoom(page, name, how) {
  const room = page.getByTestId('ear-stage')
  await room.waitFor({ timeout: 20000 })
  const armed = await page
    .locator('[data-testid="ear-stage-pads"] button:not([disabled])')
    .first()
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false)
  await page.waitForTimeout(400)
  const seen = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="ear-stage"]')
    const box = r ? r.getBoundingClientRect() : null
    const pads = [
      ...document.querySelectorAll('[data-testid="ear-stage-pads"] button'),
    ].map((pad) => pad.getBoundingClientRect())
    const consoleEl = document.querySelector(
      '[data-testid="ear-stage-console"]',
    )
    return {
      covers:
        box !== null &&
        box.left <= 0 &&
        box.top <= 0 &&
        box.right >= innerWidth - 1 &&
        box.bottom >= innerHeight - 1,
      shortest: pads.length ? Math.min(...pads.map((p) => p.height)) : 0,
      consoleBottom: consoleEl ? consoleEl.getBoundingClientRect().bottom : 0,
      vh: innerHeight,
      sideways:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    }
  })
  await page.screenshot({ path: `${OUT}/${name}-room-${how}.png` })
  if (!armed) fail(`${name} ${how}`, 'the practice run never armed its pads')
  if (!seen.covers) fail(`${name} ${how}`, 'the room does not cover the window')
  if (seen.shortest < TAP)
    fail(`${name} ${how}`, `a pad is ${Math.round(seen.shortest)}px tall`)
  if (seen.consoleBottom > seen.vh + 1)
    fail(`${name} ${how}`, 'the console ends below the screen')
  if (seen.sideways > 0) fail(`${name} ${how}`, 'the page scrolls sideways')
  // Close asks first, and ending the run keeps nothing.
  await page.getByRole('button', { name: 'End the run' }).first().click()
  await page
    .getByTestId('merc-exit')
    .getByRole('button', { name: 'End the run' })
    .click()
  await room.waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
  const back = await page
    .getByTestId('merc-bench')
    .isVisible()
    .catch(() => false)
  if (!back)
    fail(`${name} ${how}`, 'ending the run did not come back to the bench')
  // A run from a station's row comes back to that station's sheet.
  const sheet = page.getByTestId('merc-station-sheet')
  const sheetBack = await sheet.isVisible().catch(() => false)
  if (sheetBack) {
    await sheet.locator('button[aria-label^="Close"]').first().click()
    await page.waitForTimeout(400)
  }
  return { how, armed, ...seen, back, sheetBack }
}

async function auditReport(page, name) {
  await centre(page, '[data-testid="merc-report"]')
  await page.getByTestId('merc-report').click()
  const screen = page.getByTestId('merc-report-screen')
  await screen.waitFor({ timeout: 8000 })
  await page.waitForTimeout(800)
  const seen = await page.evaluate(() => {
    const back = document.querySelector('[data-testid="merc-report-back"]')
    const b = back ? back.getBoundingClientRect() : null
    return {
      back:
        b !== null && b.top >= 0 && b.bottom <= innerHeight && b.width >= 44,
      sideways:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      plates: document.querySelectorAll(
        '[data-testid="merc-report-screen"] [data-plate]',
      ).length,
    }
  })
  await page.screenshot({ path: `${OUT}/${name}-report.png` })
  if (!seen.back) fail(`${name} report`, 'its back button is not on the screen')
  if (seen.sideways > 0) fail(`${name} report`, 'the page scrolls sideways')
  if (seen.plates === 0) fail(`${name} report`, 'it drew no plates')
  await page.getByTestId('merc-report-back').click()
  await page
    .getByTestId('merc-bench')
    .waitFor({ timeout: 8000 })
    .catch(() => {})
  if (
    !(await page
      .getByTestId('merc-bench')
      .isVisible()
      .catch(() => false))
  )
    fail(`${name} report`, 'back did not come back to the bench')
  return seen
}

async function auditViewport(browser, name, contextOptions) {
  const context = await browser.newContext({
    ...contextOptions,
    permissions: ['microphone'],
    ignoreHTTPSErrors: true,
  })
  await context.addInitScript(seed, APP_VERSION)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)))

  await openBench(page)
  const bench = await auditBench(page, name)
  const sheets = await auditSheets(page, name)

  await page
    .locator('[data-testid="merc-station"][data-faculty="resolution"]')
    .click()
  await page
    .getByTestId('merc-station-row')
    .filter({ hasText: 'Hairline' })
    .first()
    .click()
  const station = await auditRoom(page, name, 'station-hairline')

  await centre(page, '[data-testid="merc-today-start"]')
  await page.getByTestId('merc-today-start').click()
  const today = await auditRoom(page, name, 'today')

  const ear = await auditReport(page, name)
  for (const error of errors) fail(`${name} page`, `error: ${error}`)
  report.push({
    viewport: name,
    bench,
    sheets,
    rooms: [station, today],
    report: ear,
  })
  await context.close()
}

const browser = await launch()
try {
  await auditViewport(browser, 'phone', {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  if (AUDIT_DESKTOP) {
    for (const [width, height] of [
      [1440, 900],
      [1024, 768],
    ]) {
      await auditViewport(browser, `desktop-${width}`, {
        viewport: { width, height },
        deviceScaleFactor: 1,
      })
    }
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
