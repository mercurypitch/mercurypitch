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
  // The bench's sound lives in the same panel: one level, three clicks.
  if (
    !(await page
      .getByTestId('ear-room-volume')
      .isVisible()
      .catch(() => false))
  )
    fail(`${name} rack`, 'stage volume slider missing')
  const voices = page
    .getByRole('radiogroup', { name: "The Grid's click" })
    .getByRole('radio')
  if ((await voices.count()) !== 3)
    fail(
      `${name} rack`,
      `expected 3 click voices, found ${await voices.count()}`,
    )
  for (const box of await voices.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().height),
  )) {
    if (box < 44)
      fail(`${name} rack`, `a click voice pad is ${Math.round(box)}px tall`)
  }
  // The light room inks what is written on the room; the plates keep
  // parchment. Measured on the bench title: dark ink, not parchment.
  await page.getByRole('button', { name: /Glasshouse Bench/ }).click()
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const light = await page.evaluate(() => {
    const shell = document.querySelector('[data-room-treatment]')
    const title = document.querySelector('[data-testid="ear-bench-title"]')
    const color = title ? getComputedStyle(title).color : ''
    const [r, g, b] = (color.match(/\d+/g) ?? ['255', '255', '255']).map(Number)
    return {
      treatment: shell?.getAttribute('data-room-treatment') ?? null,
      luminance: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
    }
  })
  await page.screenshot({ path: `${OUT}/${name}-bench-light.png` })
  if (light.treatment !== 'light')
    fail(`${name} light room`, `shell treatment is ${light.treatment}`)
  if (light.luminance > 0.35)
    fail(
      `${name} light room`,
      `bench title is not inked (luminance ${light.luminance.toFixed(2)})`,
    )
  await page.getByTestId('ear-room-chip').click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Regulator Room/ }).click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // Today opens the regulation in the rack — it used to scroll the bench.
  await page.getByRole('button', { name: 'Today' }).click()
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${OUT}/${name}-rack-today.png` })
  const todaySlots = page.getByRole('dialog').locator('button[data-drill]')
  if ((await todaySlots.count()) === 0)
    fail(`${name} rack`, "Today's regulation has no drill slots in the rack")
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

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
/** The Contour instrument, by its viewBox coordinates: the first
 *  segment, where the pen's nib rests, and whether every part of the
 *  pen sits inside the drum — a pivoted arm reaching in from outside
 *  once read as a rising line on the answer screen. */
function measureStylus() {
  const svg = document.querySelector('svg[data-instrument="stylus"]')
  if (!svg) return null
  const lines = [...svg.querySelectorAll('line')].map((line) =>
    ['x1', 'y1', 'x2', 'y2'].map((key) => Number(line.getAttribute(key))),
  )
  const segment = lines.some(([x1, , x2]) => x1 === 120 && x2 === 250)
  const nib = svg.querySelector('[data-part="nib"]')
  const drum = svg.querySelector('[data-part="drum"]')
  if (!nib || !drum) return { segment, tipX: null, inside: false }
  const bounds = drum.getBBox()
  const inside = ['rail', 'carriage', 'nib', 'tip'].every((part) => {
    const box = svg.querySelector(`[data-part="${part}"]`)?.getBBox()
    return (
      box !== undefined &&
      box.x >= bounds.x &&
      box.y >= bounds.y &&
      box.x + box.width <= bounds.x + bounds.width &&
      box.y + box.height <= bounds.y + bounds.height
    )
  })
  return { segment, tipX: Number(nib.getAttribute('data-tip-x')), inside }
}

/** The Stack's wheels (the toothed circles) and captions, in viewBox
 *  units: the smallest gap between any two wheels, and whether any
 *  caption's box touches a wheel. */
function measureGears() {
  const svg = document.querySelector('svg[data-instrument="gears"]')
  if (!svg) return null
  const wheels = [...svg.querySelectorAll('circle')]
    .map((c) => ({
      cx: Number(c.getAttribute('cx')),
      cy: Number(c.getAttribute('cy')),
      r: Number(c.getAttribute('r')),
    }))
    .filter((c) => c.r >= 34)
  let minGap = Infinity
  for (let i = 0; i < wheels.length; i++)
    for (let j = i + 1; j < wheels.length; j++) {
      const d = Math.hypot(
        wheels[i].cx - wheels[j].cx,
        wheels[i].cy - wheels[j].cy,
      )
      minGap = Math.min(minGap, d - wheels[i].r - wheels[j].r)
    }
  const texts = [...svg.querySelectorAll('text')].map((t) => {
    const b = t.getBBox()
    return { x: b.x, y: b.y, w: b.width, h: b.height, text: t.textContent }
  })
  const hits = (w, t) => {
    const nx = Math.max(t.x, Math.min(w.cx, t.x + t.w))
    const ny = Math.max(t.y, Math.min(w.cy, t.y + t.h))
    return Math.hypot(w.cx - nx, w.cy - ny) < w.r
  }
  return {
    wheels: wheels.length,
    minGap,
    textHit: texts.some((t) => wheels.some((w) => hits(w, t))),
    texts: texts.map((t) => t.text),
  }
}

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
  await page.waitForTimeout(400)

  // Contour: while the answer waits, the first tone's trace stays on
  // the drum and the stylus rests at its end — not a bare arm.
  await openFromStrip('Contour')
  await page.getByText('Begin').click()
  const contourArmed = await page
    .locator('[data-testid="ear-stage-pads"] button:not([disabled])', {
      hasText: 'Up',
    })
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false)
  if (!contourArmed) fail(`${name} contour`, 'the answer never armed')
  const stylus = await page.evaluate(measureStylus)
  await page.screenshot({ path: `${OUT}/${name}-stage-contour-answer.png` })
  if (!stylus) fail(`${name} contour`, 'no stylus trace on the stage')
  else if (!stylus.segment || stylus.tipX !== 250 || !stylus.inside)
    fail(
      `${name} contour`,
      `answer phase shows segment=${stylus.segment}, nib at ${stylus.tipX}, pen inside the drum=${stylus.inside}`,
    )
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)
  // Pulse: the answer opens as the call ends, on a pad a thumb can hit;
  // three taps land on the drum at the reveal.
  await openFromStrip('Pulse')
  results.pulseIdle = await checkStage('pulse idle', 'stage-pulse-idle')
  await page.getByText('Begin').click()
  const pulsePad = page.locator('[data-testid="ear-tap-pad"]:not([disabled])')
  const pulseArmed = await pulsePad
    .waitFor({ timeout: 12000 })
    .then(() => true)
    .catch(() => false)
  if (!pulseArmed) fail(`${name} pulse`, 'the response bar never armed the pad')
  else {
    const padBox = await pulsePad.boundingBox()
    if (!padBox || padBox.height < 44)
      fail(
        `${name} pulse`,
        `tap pad is ${Math.round(padBox?.height ?? 0)}px tall`,
      )
    await page.screenshot({ path: `${OUT}/${name}-stage-pulse-answer.png` })
    for (let i = 0; i < 3; i++) {
      await pulsePad.dispatchEvent('pointerdown', { button: 0 })
      await page.waitForTimeout(600)
    }
    const revealed = await page
      .locator('[data-testid="ear-stage-status"]', {
        hasText: /Clean|Not quite/,
      })
      .waitFor({ timeout: 8000 })
      .then(() => true)
      .catch(() => false)
    if (!revealed) fail(`${name} pulse`, 'the take was never judged')
    const drumMarks = await page.evaluate(() => {
      const svg = document.querySelector('svg[data-instrument="drum"]')
      return svg
        ? {
            onsets: svg.querySelectorAll('[data-part="onset"]').length,
            taps:
              svg.querySelectorAll('[data-part="tap"]').length +
              svg.querySelectorAll('[data-part="extra"]').length,
          }
        : null
    })
    await page.screenshot({ path: `${OUT}/${name}-stage-pulse-reveal.png` })
    if (!drumMarks || drumMarks.onsets < 3 || drumMarks.taps < 1)
      fail(
        `${name} pulse`,
        `reveal shows ${drumMarks?.onsets ?? 0} onsets and ${drumMarks?.taps ?? 0} taps on the drum`,
      )
  }
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)

  // Echo: the ladder arms only after the cadence and the phrase, every
  // rung a thumb can hit; the phrase is judged when the last rung lands
  // and the chain shows a bead and a mark per note at the reveal.
  await openFromStrip('Echo')
  results.echoIdle = await checkStage('echo idle', 'stage-echo-idle')
  await page.getByText('Begin').click()
  const echoRungs = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
  )
  const echoArmed = await echoRungs
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  if (!echoArmed) fail(`${name} echo`, 'the ladder never armed')
  else {
    const rungCount = await echoRungs.count()
    if (rungCount !== 8)
      fail(`${name} echo`, `${rungCount} rungs armed, expected 8`)
    const rungBox = await echoRungs.first().boundingBox()
    if (!rungBox || rungBox.height < 44)
      fail(
        `${name} echo`,
        `a rung is ${Math.round(rungBox?.height ?? 0)}px tall`,
      )
    await page.screenshot({ path: `${OUT}/${name}-stage-echo-answer.png` })
    const judgedStatus = page.locator('[data-testid="ear-stage-status"]', {
      hasText: /Yes —|That was/,
    })
    // The phrase is three to six notes: tap the first rung until judged.
    let judged = false
    for (let i = 0; i < 6 && !judged; i++) {
      await echoRungs.first().click()
      await page.waitForTimeout(150)
      judged = (await judgedStatus.count()) > 0
    }
    if (!judged) fail(`${name} echo`, 'the phrase was never judged')
    const chain = await page.evaluate(() => {
      const svg = document.querySelector('svg[data-instrument="chain"]')
      return svg
        ? {
            beads: svg.querySelectorAll('[data-part="expected"]').length,
            marks: svg.querySelectorAll(
              '[data-part="right"], [data-part="wrong"]',
            ).length,
          }
        : null
    })
    await page.screenshot({ path: `${OUT}/${name}-stage-echo-reveal.png` })
    if (!chain || chain.beads < 3 || chain.marks !== chain.beads)
      fail(
        `${name} echo`,
        `reveal shows ${chain?.beads ?? 0} beads and ${chain?.marks ?? 0} marks on the chain`,
      )
  }
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)

  // Span: a practice run opens at three notes; the ladder arms after the
  // phrase, three rungs judge it, and the reveal names the length.
  await openFromStrip('Span')
  results.spanIdle = await checkStage('span idle', 'stage-span-idle')
  await page.getByText('Practice run').click()
  const spanRungs = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
  )
  const spanArmed = await spanRungs
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  if (!spanArmed) fail(`${name} span`, 'the ladder never armed')
  else {
    await page.screenshot({ path: `${OUT}/${name}-stage-span-answer.png` })
    for (let i = 0; i < 3; i++) {
      await spanRungs.first().click()
      await page.waitForTimeout(150)
    }
    const revealed = await page
      .locator('[data-testid="ear-stage-status"]', {
        hasText: /Held —|Slipped at/,
      })
      .waitFor({ timeout: 8000 })
      .then(() => true)
      .catch(() => false)
    if (!revealed) fail(`${name} span`, 'the phrase was never judged')
    const chain = await page.evaluate(() => {
      const svg = document.querySelector('svg[data-instrument="chain"]')
      return svg ? svg.querySelectorAll('[data-part="expected"]').length : 0
    })
    await page.screenshot({ path: `${OUT}/${name}-stage-span-reveal.png` })
    if (chain !== 3)
      fail(`${name} span`, `reveal shows ${chain} beads, expected 3`)
  }
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)

  // Beat Hunt: two pairs on the clock, the pads arm after the second;
  // nothing on the pendulums says which pair beat until the reveal.
  await openFromStrip('Beat Hunt')
  results.beatHuntIdle = await checkStage(
    'beat-hunt idle',
    'stage-beat-hunt-idle',
  )
  await page.getByText('Practice run').click()
  const beatPads = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
  )
  const beatArmed = await beatPads
    .first()
    .waitFor({ timeout: 12000 })
    .then(() => true)
    .catch(() => false)
  if (!beatArmed) fail(`${name} beat-hunt`, 'the pads never armed')
  else {
    const beatingEarly = await page.evaluate(
      () =>
        document.querySelectorAll(
          'svg[data-instrument="beat-pendulums"] [data-beating="true"]',
        ).length,
    )
    if (beatingEarly > 0)
      fail(`${name} beat-hunt`, 'a pair is marked beating before the reveal')
    await page.screenshot({
      path: `${OUT}/${name}-stage-beat-hunt-answer.png`,
    })
    await beatPads.first().click()
    const revealed = await page
      .locator('[data-testid="ear-stage-status"]', {
        hasText: /pair was beating/,
      })
      .waitFor({ timeout: 6000 })
      .then(() => true)
      .catch(() => false)
    if (!revealed) fail(`${name} beat-hunt`, 'the reveal never named the pair')
    const marks = await page.evaluate(() => {
      const svg = document.querySelector(
        'svg[data-instrument="beat-pendulums"]',
      )
      return svg
        ? {
            beating: svg.querySelectorAll('[data-beating="true"]').length,
            plate:
              svg.querySelector('[data-part="nameplate"]')?.textContent ?? '',
          }
        : null
    })
    await page.screenshot({
      path: `${OUT}/${name}-stage-beat-hunt-reveal.png`,
    })
    if (!marks || marks.beating !== 1 || !/beat/.test(marks.plate))
      fail(
        `${name} beat-hunt`,
        `reveal marks ${marks?.beating ?? 0} pairs beating, plate "${marks?.plate ?? ''}"`,
      )
  }
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)

  // Drift: eleven clicks, the arm upright until the reveal, then leaning
  // the way the nameplate says.
  await openFromStrip('Drift')
  results.driftIdle = await checkStage('drift idle', 'stage-drift-idle')
  await page.getByText('Practice run').click()
  const driftPads = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
  )
  const driftArmed = await driftPads
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  if (!driftArmed) fail(`${name} drift`, 'the pads never armed')
  else {
    const leanEarly = await page.evaluate(
      () =>
        document
          .querySelector('svg[data-instrument="metronome"] [data-part="arm"]')
          ?.getAttribute('data-lean') ?? null,
    )
    if (leanEarly !== '0')
      fail(`${name} drift`, `the arm leans ${leanEarly} before the reveal`)
    await page.screenshot({ path: `${OUT}/${name}-stage-drift-answer.png` })
    await driftPads.first().click()
    const revealed = await page
      .locator('[data-testid="ear-stage-status"]', {
        hasText: /held steady|gained|lost/,
      })
      .waitFor({ timeout: 6000 })
      .then(() => true)
      .catch(() => false)
    if (!revealed) fail(`${name} drift`, 'the reveal never said which way')
    const arm = await page.evaluate(() => {
      const svg = document.querySelector('svg[data-instrument="metronome"]')
      return svg
        ? {
            lean: svg
              .querySelector('[data-part="arm"]')
              ?.getAttribute('data-lean'),
            plate:
              svg.querySelector('[data-part="nameplate"]')?.textContent ?? '',
          }
        : null
    })
    await page.screenshot({ path: `${OUT}/${name}-stage-drift-reveal.png` })
    const expectedLean = /Faster/.test(arm?.plate ?? '')
      ? '22'
      : /Slower/.test(arm?.plate ?? '')
        ? '-22'
        : '0'
    if (!arm || arm.lean !== expectedLean)
      fail(
        `${name} drift`,
        `arm leans ${arm?.lean ?? 'nowhere'} under the plate "${arm?.plate ?? ''}"`,
      )
  }
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)

  // Gravity: twelve rungs, each a thumb can hit, armed only after the
  // probe; the reveal engraves the chromatic label.
  await openFromStrip('Gravity')
  results.gravityIdle = await checkStage('gravity idle', 'stage-gravity-idle')
  await page.getByText('Begin').click()
  const gravityRungs = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
  )
  const gravityArmed = await gravityRungs
    .first()
    .waitFor({ timeout: 12000 })
    .then(() => true)
    .catch(() => false)
  if (!gravityArmed) fail(`${name} gravity`, 'the pads never armed')
  else {
    const rungCount = await gravityRungs.count()
    if (rungCount !== 12)
      fail(`${name} gravity`, `${rungCount} pads armed, expected 12`)
    const rungBox = await gravityRungs.first().boundingBox()
    if (!rungBox || rungBox.height < 44)
      fail(
        `${name} gravity`,
        `a pad is ${Math.round(rungBox?.height ?? 0)}px tall`,
      )
    await page.screenshot({ path: `${OUT}/${name}-stage-gravity-answer.png` })
    await gravityRungs.first().click()
    const revealed = await page
      .locator('[data-testid="ear-stage-status"]', {
        hasText: /Yes —|That was/,
      })
      .waitFor({ timeout: 6000 })
      .then(() => true)
      .catch(() => false)
    if (!revealed) fail(`${name} gravity`, 'the answer was never judged')
    await page.screenshot({ path: `${OUT}/${name}-stage-gravity-reveal.png` })
  }
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)

  // The Pull: the beam stays level through both notes and tips only at
  // the reveal, toward the pan the nameplate names.
  await openFromStrip('The Pull')
  results.pullIdle = await checkStage('the-pull idle', 'stage-the-pull-idle')
  await page.getByText('Begin').click()
  const pullPads = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
  )
  const pullArmed = await pullPads
    .first()
    .waitFor({ timeout: 12000 })
    .then(() => true)
    .catch(() => false)
  if (!pullArmed) fail(`${name} the-pull`, 'the pads never armed')
  else {
    const tiltEarly = await page.evaluate(
      () =>
        document
          .querySelector('svg[data-instrument="beam"] [data-part="beam"]')
          ?.getAttribute('data-tilt') ?? null,
    )
    if (tiltEarly !== '0')
      fail(`${name} the-pull`, `the beam tilts ${tiltEarly} before the reveal`)
    await page.screenshot({ path: `${OUT}/${name}-stage-the-pull-answer.png` })
    await pullPads.first().click()
    const revealed = await page
      .locator('[data-testid="ear-stage-status"]', {
        hasText: /Yes —|That was/,
      })
      .waitFor({ timeout: 6000 })
      .then(() => true)
      .catch(() => false)
    if (!revealed) fail(`${name} the-pull`, 'the answer was never judged')
    const beam = await page.evaluate(() => {
      const svg = document.querySelector('svg[data-instrument="beam"]')
      return svg
        ? {
            tilt: Number(
              svg
                .querySelector('[data-part="beam"]')
                ?.getAttribute('data-tilt'),
            ),
            leaning: svg
              .querySelector('[data-leaning="true"]')
              ?.getAttribute('data-side'),
            plate:
              svg.querySelector('[data-part="nameplate"]')?.textContent ?? '',
          }
        : null
    })
    await page.screenshot({ path: `${OUT}/${name}-stage-the-pull-reveal.png` })
    const tiltsRight = beam ? (beam.leaning === '2') === beam.tilt > 0 : false
    if (
      !beam ||
      beam.tilt === 0 ||
      !tiltsRight ||
      !/leaning to/.test(beam.plate)
    )
      fail(
        `${name} the-pull`,
        `beam tilts ${beam?.tilt ?? 0} with pan ${beam?.leaning ?? 'none'} leaning, plate "${beam?.plate ?? ''}"`,
      )
  }
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)

  // Cadence: the train turns while the progression strums, four pads are
  // drawn with the answer among them, the reveal engraves the wheels.
  await openFromStrip('Cadence')
  results.cadenceIdle = await checkStage('cadence idle', 'stage-cadence-idle')
  await page.getByText('Begin').click()
  const cadencePads = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
  )
  const cadenceArmed = await cadencePads
    .first()
    .waitFor({ timeout: 12000 })
    .then(() => true)
    .catch(() => false)
  if (!cadenceArmed) fail(`${name} cadence`, 'the pads never armed')
  else {
    const padCount = await cadencePads.count()
    if (padCount !== 4)
      fail(`${name} cadence`, `${padCount} pads drawn, expected 4`)
    const numeralsEarly = await page.evaluate(
      () =>
        document.querySelectorAll(
          'svg[data-instrument="train"] [data-part="numeral"]',
        ).length,
    )
    if (numeralsEarly > 0)
      fail(`${name} cadence`, 'the wheels are engraved before the reveal')
    await page.screenshot({ path: `${OUT}/${name}-stage-cadence-answer.png` })
    await cadencePads.first().click()
    const revealed = await page
      .locator('[data-testid="ear-stage-status"]', {
        hasText: /Yes —|That was/,
      })
      .waitFor({ timeout: 6000 })
      .then(() => true)
      .catch(() => false)
    if (!revealed) fail(`${name} cadence`, 'the answer was never judged')
    const numerals = await page.evaluate(
      () =>
        document.querySelectorAll(
          'svg[data-instrument="train"] [data-part="numeral"]',
        ).length,
    )
    await page.screenshot({ path: `${OUT}/${name}-stage-cadence-reveal.png` })
    if (numerals < 3)
      fail(`${name} cadence`, `${numerals} wheels engraved at the reveal`)
  }
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)

  // Bassline: seven rungs in numerals arm after the line; four taps judge
  // it and the chain shows the roots at the reveal.
  await openFromStrip('Bassline')
  results.basslineIdle = await checkStage(
    'bassline idle',
    'stage-bassline-idle',
  )
  await page.getByText('Begin').click()
  const bassRungs = page.locator(
    '[data-testid="ear-stage-pads"] button:not([disabled])',
  )
  const bassArmed = await bassRungs
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  if (!bassArmed) fail(`${name} bassline`, 'the ladder never armed')
  else {
    const rungCount = await bassRungs.count()
    if (rungCount !== 7)
      fail(`${name} bassline`, `${rungCount} rungs armed, expected 7`)
    await page.screenshot({ path: `${OUT}/${name}-stage-bassline-answer.png` })
    for (let i = 0; i < 4; i++) {
      await bassRungs.first().click()
      await page.waitForTimeout(120)
    }
    const revealed = await page
      .locator('[data-testid="ear-stage-status"]', {
        hasText: /Yes —|That was/,
      })
      .waitFor({ timeout: 6000 })
      .then(() => true)
      .catch(() => false)
    if (!revealed) fail(`${name} bassline`, 'the line was never judged')
    const beads = await page.evaluate(
      () =>
        document.querySelectorAll(
          'svg[data-instrument="chain"] [data-part="expected"]',
        ).length,
    )
    await page.screenshot({ path: `${OUT}/${name}-stage-bassline-reveal.png` })
    if (beads !== 4)
      fail(`${name} bassline`, `${beads} roots on the chain, expected 4`)
  }
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)

  // Stack: the reveal's wheels mesh side by side; none may overlap,
  // and the nameplate keeps clear of the root wheel.
  await openFromStrip('Stack')
  await page.getByText('Begin').click()
  const stackPad = page
    .locator('[data-testid="ear-stage-pads"] button:not([disabled])')
    .first()
  const stackArmed = await stackPad
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false)
  if (!stackArmed) fail(`${name} stack`, 'the answer never armed')
  else {
    await stackPad.click()
    await page.waitForTimeout(250)
    const gears = await page.evaluate(measureGears)
    await page.screenshot({ path: `${OUT}/${name}-stage-stack-reveal.png` })
    if (!gears || gears.wheels < 3)
      fail(`${name} stack`, `reveal shows ${gears?.wheels ?? 0} wheels`)
    else {
      if (gears.minGap < -0.5)
        fail(
          `${name} stack`,
          `wheels overlap by ${(-gears.minGap).toFixed(1)}px`,
        )
      if (gears.textHit)
        fail(
          `${name} stack`,
          `a caption sits on a wheel (${gears.texts.join(' / ')})`,
        )
    }
  }
  await page.getByLabel('Stop').click()
  await page.waitForTimeout(300)
  await page.getByText('Back to the bench').click()
  await page.locator('#ear-lab-panel').waitFor({ timeout: 8000 })

  // The readiness panel: the app's one latency number, in the rack.
  await page.getByLabel(/Open the readiness panel/).click()
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${OUT}/${name}-rack-readiness.png` })
  // The rhythm seam's input sits under the wizard: a tap pad, touch-sized.
  const tapPad = page.getByTestId('ear-tap-pad')
  const tapPadHeight = await tapPad
    .evaluate((el) => el.getBoundingClientRect().height)
    .catch(() => 0)
  if (tapPadHeight < 44)
    fail(
      `${name} readiness`,
      `tap pad missing or ${Math.round(tapPadHeight)}px tall`,
    )
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
