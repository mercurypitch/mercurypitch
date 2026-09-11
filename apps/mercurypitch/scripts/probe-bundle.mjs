// The native shell, driven in a real browser against the BUILT bundle.
//
//   node scripts/probe-bundle.mjs --base-url http://127.0.0.1:4179
//   node scripts/probe-bundle.mjs --base-url … --shots <dir> --theme light
//
// What it is for: `pnpm build` proves the bundle compiles, and
// `assert-bundle.mjs` proves it carries what it should. Neither opens it.
// This does — at 393 x 852, the phone the shell is drawn for — and walks the
// chrome a first run touches: the five rail destinations, the More sheet,
// and Settings pushed and popped.
//
// It walks in two halves. The CHROME half needs nothing but a document. The
// RUN half starts a real run against Chromium's fake capture device, because
// everything the shell is for only exists while one is going — and because a
// probe that stopped at the chrome is exactly what let a shell ship that
// never left `browsing`: it watched a signal nothing writes, and every
// screenshot of the rail looked perfect.
//
// Native plugins do not exist here: `@capacitor/*` answers `Unimplemented`,
// which the platform wrappers already turn into a no-op, so nothing in this
// walk depends on one.

import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

const PHONE = { width: 393, height: 852 }
const BOOT_TIMEOUT_MS = 15_000
const STEP_TIMEOUT_MS = 10_000

/** Console noise a browser cannot avoid, and that says nothing about the shell. */
const IGNORED_CONSOLE = [
  'Failed to load resource',
  'net::ERR_',
  'ERR_CONNECTION_REFUSED',
  'The AudioContext was not allowed to start',
  'Unimplemented',
  'not implemented',
]

function parseArgs(argv) {
  const args = {
    baseUrl: 'http://127.0.0.1:4179',
    shots: null,
    theme: 'dark',
    headed: false,
    chromeOnly: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === '--base-url') args.baseUrl = argv[(i += 1)]
    else if (flag === '--shots') args.shots = argv[(i += 1)]
    else if (flag === '--theme') args.theme = argv[(i += 1)]
    else if (flag === '--headed') args.headed = true
    else if (flag === '--chrome-only') args.chromeOnly = true
    else throw new Error(`probe-bundle: unknown argument ${flag}`)
  }
  if (args.theme !== 'dark' && args.theme !== 'light') {
    throw new Error("probe-bundle: --theme takes 'dark' or 'light'")
  }
  return args
}

// The welcome overlay covers the whole screen on a first run, and a page-tour
// toast sits over the very rail this walks. Both are seeded away, exactly as
// the repository's other headless walks do it.
function seed(theme) {
  window.E2E_TEST_MODE = true
  try {
    localStorage.setItem('pitchperfect_welcome_version', 'probe-bundle')
    localStorage.setItem('pitchperfect_survey_seen', 'probe-bundle')
    localStorage.setItem('pitchperfect_theme', theme)
    localStorage.setItem('pitchperfect_theme_source', 'manual')
    for (const tab of [
      'home',
      'singing',
      'ear-lab',
      'progress',
      'settings',
      'karaoke',
      'piano',
      'guitar',
    ]) {
      localStorage.setItem(`pitchperfect_page_tour_offered_${tab}`, 'true')
    }
  } catch {
    /* storage blocked: the walk still runs, it just starts noisier */
  }
}

const RAIL_ITEMS = ['rooms', 'stage', 'ear', 'progress']

async function shoot(page, shots, name) {
  if (shots === null) return
  await page.screenshot({ path: resolve(shots, `${name}.png`) })
}

async function walkChrome(page, { shots, theme }) {
  const steps = []
  const rail = page.locator('[data-testid="shell-rail"]')
  await rail.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })

  const count = await page.locator('[data-rail-item]').count()
  if (count !== 5) {
    throw new Error(`the rail should offer five destinations, found ${count}`)
  }
  steps.push('rail: five destinations')

  // Where it is, not only that it exists. A screenshot cannot be read by the
  // thing that took it, and a rail portalled into a clipping ancestor is
  // exactly the failure that looks fine in the DOM.
  const box = await rail.boundingBox()
  if (box === null) throw new Error('the rail has no box')
  const bottom = box.y + box.height
  if (bottom > PHONE.height || bottom < PHONE.height - 160) {
    throw new Error(
      `the rail should sit on the bottom edge; its bottom is at ${bottom}`,
    )
  }
  if (box.x < 0 || box.x + box.width > PHONE.width) {
    throw new Error('the rail runs off the side of the screen')
  }
  steps.push(
    `rail: on the bottom edge (${Math.round(bottom)} of ${PHONE.height})`,
  )

  // And that the app's scroller reserves the height, at this width and any
  // other: the web rule is behind a phone-sized media query and the shell's
  // is not.
  const reserved = await page.evaluate(() => {
    const scroller = document.querySelector('.main-content')
    if (scroller === null) return null
    return {
      padding: getComputedStyle(scroller).paddingBottom,
      theme: document.documentElement.getAttribute('data-theme'),
      shell: document.documentElement.hasAttribute('data-native-shell'),
    }
  })
  if (reserved === null) throw new Error('no .main-content to reserve room in')
  if (!reserved.shell) throw new Error('the shell did not mark the document')
  if (parseFloat(reserved.padding) < 70) {
    throw new Error(
      `the scroller reserves only ${reserved.padding} for a 64 px rail`,
    )
  }
  if (reserved.theme !== theme) {
    throw new Error(`asked for the ${theme} theme, got ${reserved.theme}`)
  }
  steps.push(`shell: ${reserved.padding} reserved, ${reserved.theme} theme`)

  // The web chrome must be absent, not merely hidden: two bottom bars is the
  // stacked-chrome problem S1b exists to remove, and the header carries the
  // desktop nav tabs.
  const webChrome = await page.evaluate(() => ({
    bar: document.querySelectorAll('[data-tour="mobile-tabbar"]').length,
    header: document.querySelectorAll('#main-layout ~ header, body header')
      .length,
    sidebar: document.querySelectorAll('.sidebar, #app-sidebar').length,
  }))
  if (webChrome.bar !== 0) {
    throw new Error('the web BottomTabBar mounted under the shell')
  }
  if (webChrome.header !== 0) {
    throw new Error('the web header mounted under the shell')
  }
  steps.push('shell: no web bar, no web header')

  for (const id of RAIL_ITEMS) {
    await page.locator(`[data-rail-item="${id}"]`).click()
    await page
      .locator(`[data-rail-item="${id}"][aria-current="page"]`)
      .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    // The rail is fixed chrome over a tab that may still be settling.
    await page.waitForTimeout(400)
    await shoot(page, shots, `${theme}-tab-${id}`)
    steps.push(`rail: ${id} selected`)
  }

  await page.locator('[data-rail-item="more"]').click()
  const settingsTile = page.locator('[data-more-item="settings"]')
  await settingsTile.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  await page.waitForTimeout(300)
  await shoot(page, shots, `${theme}-more-sheet`)
  steps.push('more: sheet open')

  await page.keyboard.press('Escape')
  await settingsTile.waitFor({ state: 'hidden', timeout: STEP_TIMEOUT_MS })
  steps.push('more: sheet closed')

  await page.locator('[data-rail-item="more"]').click()
  await settingsTile.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  await settingsTile.click()
  const pushed = page.locator('[data-testid="shell-pushed"]')
  await pushed.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  await page.waitForTimeout(500)
  await shoot(page, shots, `${theme}-settings-pushed`)
  steps.push('settings: pushed')

  await page.locator('[data-testid="shell-pushed-back"]').click()
  await pushed.waitFor({ state: 'hidden', timeout: STEP_TIMEOUT_MS })
  // The rail outlives the screen that covered it: this is the assertion that
  // a pushed screen is a navigation level and not a modal.
  await rail.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  steps.push('settings: back to the rail')

  return steps
}

// ── The run half ─────────────────────────────────────────────
//
// Everything the shell exists for is here, and none of it is reachable
// without a real run: the transport, the corner chip, its column, the lock,
// the session pill and the return. This is the half that fails when the shell
// is watching the wrong signal.

const RUN_TIMEOUT_MS = 20_000

async function expectVisible(locator, what) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: RUN_TIMEOUT_MS })
  } catch {
    throw new Error(`${what} never appeared`)
  }
}

async function expectGone(locator, what) {
  try {
    await locator.first().waitFor({ state: 'hidden', timeout: RUN_TIMEOUT_MS })
  } catch {
    throw new Error(`${what} is still on screen`)
  }
}

/** The shell's band has the transport, and the stage has stopped drawing one. */
async function expectShellOwnsBand(page) {
  await page
    .locator('[data-testid="shell-transport-layer"].is-in')
    .waitFor({ state: 'attached', timeout: RUN_TIMEOUT_MS })
  await expectVisible(
    page.locator('[data-testid="shell-transport"]'),
    'the shell transport',
  )
  const stageBar = await page.locator('[data-tour="singing-options"]').count()
  if (stageBar !== 0) {
    throw new Error('the stage kept its own transport under the shell')
  }
}

async function walkRun(page, { shots, theme }) {
  const steps = []

  await page.locator('[data-rail-item="stage"]').click()
  await expectVisible(
    page.locator('[data-testid="singing-mobile-stage"]'),
    'the Sing stage',
  )

  // The stage owns Start, so the mic and the first Play are its controls.
  await page.locator('[aria-label="Start the mic"]').click()
  await expectVisible(
    page.locator('[aria-label="Stop the mic"]'),
    'a live microphone',
  )
  steps.push('run: the mic is live')

  await page
    .locator('[data-testid="singing-mobile-stage"] [aria-label="Play"]')
    .click()
  await expectShellOwnsBand(page)
  steps.push('run: the shell has the band, the stage bar is gone')

  // The one control the band has no room for stays in the room.
  const micChip = page.locator('[data-testid="stage-mic-chip"]')
  await expectVisible(micChip, 'the stage mic chip')
  const micLabel = await micChip.textContent()
  if (micLabel?.trim() !== 'Listening') {
    throw new Error(`the mic chip reads "${micLabel?.trim()}" during a run`)
  }
  steps.push('run: the mic is still reachable from the room')

  // Geometry, from the brief: 56 pt, 8 pt above the band, 16 pt from the edge.
  // Measured after the scale-in settles — a box read mid-transition is the
  // 0.6 the chip starts at, not the size it ends up.
  await page.waitForFunction(
    () => {
      const node = document.querySelector('[data-testid="shell-chip"]')
      if (node === null) return false
      return Math.abs(node.getBoundingClientRect().width - 56) <= 1.5
    },
    { timeout: RUN_TIMEOUT_MS },
  )
  const chip = await page.locator('[data-testid="shell-chip"]').boundingBox()
  const band = await page.locator('.mp-band').boundingBox()
  if (chip === null || band === null) throw new Error('no chip or no band')
  const near = (a, b) => Math.abs(a - b) <= 1.5
  if (!near(chip.width, 56) || !near(chip.height, 56)) {
    throw new Error(`the chip is ${chip.width} x ${chip.height}, not 56 x 56`)
  }
  if (!near(PHONE.width - (chip.x + chip.width), 16)) {
    throw new Error(
      `the chip sits ${PHONE.width - (chip.x + chip.width)} from the right edge`,
    )
  }
  if (!near(band.y - (chip.y + chip.height), 8)) {
    throw new Error(
      `the chip sits ${band.y - (chip.y + chip.height)} above the band`,
    )
  }
  steps.push('run: the chip is 56, 8 above the band, 16 from the edge')
  await shoot(page, shots, `${theme}-run-active`)

  // The column opens upward, takes focus, and a tap on the stage closes it.
  await page.locator('[data-testid="shell-chip"]').click()
  await expectVisible(
    page.locator('[data-column-item="rooms"]'),
    'the tab column',
  )
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute('data-column-item'),
  )
  if (focused !== 'rooms') {
    throw new Error(`focus went to ${focused ?? 'nothing'}, not the first tab`)
  }
  await shoot(page, shots, `${theme}-run-column`)
  steps.push('run: the column opens with focus in it')

  await page.mouse.click(PHONE.width / 2, PHONE.height / 2)
  await expectGone(
    page.locator('[data-column-item="rooms"]'),
    'the column after a stage tap',
  )
  steps.push('run: a stage tap closes the column')

  // Pause keeps the band. The rail does not come back — the chip is the only
  // way to the tabs for as long as a run exists.
  await page
    .locator('[data-testid="shell-transport"] [aria-label="Pause"]')
    .click()
  await expectVisible(
    page.locator('[data-testid="shell-transport"] [aria-label="Play"]'),
    'Play on the primary after a pause',
  )
  const railBack = await page
    .locator('[data-testid="shell-rail-layer"]')
    .evaluate((node) => node.classList.contains('is-in'))
  if (railBack) throw new Error('the rail came back on pause')
  await shoot(page, shots, `${theme}-run-paused`)
  steps.push('run: paused, and the rail stayed away')

  // Lock dims Stop and the primary without taking them out of the tree.
  await page.locator('[aria-label="Lock controls"]').click()
  const locked = await page.evaluate(() => {
    const stop = document.querySelector(
      '[data-testid="shell-transport"] [aria-label="Stop"]',
    )
    const lock = document.querySelector('[aria-label="Lock controls"]')
    return {
      pressed: lock?.getAttribute('aria-pressed'),
      disabled: stop?.getAttribute('aria-disabled'),
      removed: stop?.hasAttribute('disabled'),
      opacity: stop === null ? null : getComputedStyle(stop).opacity,
    }
  })
  if (locked.pressed !== 'true') throw new Error('Lock does not say it is on')
  if (locked.disabled !== 'true') throw new Error('a locked Stop is not marked')
  if (locked.removed)
    throw new Error('a locked Stop left the accessibility tree')
  if (Number(locked.opacity) > 0.6)
    throw new Error('a locked Stop is not dimmed')
  await shoot(page, shots, `${theme}-run-locked`)
  steps.push('run: locked, dimmed, still announced')
  await page.locator('[aria-label="Lock controls"]').click()

  // A tab from the column parks: the destination pushes in, the pill takes
  // the dock's accessory slot, and the microphone is released on the way.
  await page.locator('[data-testid="shell-chip"]').click()
  await page.locator('[data-column-item="progress"]').click()
  await page.waitForFunction(() => window.location.hash.includes('progress'), {
    timeout: RUN_TIMEOUT_MS,
  })
  await expectVisible(
    page.locator('[data-testid="shell-session-pill"]'),
    'the session pill',
  )
  await shoot(page, shots, `${theme}-run-parked`)
  steps.push('run: parked, with the pill in the dock')

  // Return: the room, still paused, nothing sounding, the mic off.
  await page.locator('[data-testid="shell-session-pill"]').click()
  await expectVisible(
    page.locator('[data-testid="shell-transport"] [aria-label="Play"]'),
    'the transport showing Play on return',
  )
  await expectVisible(micChip, 'the mic chip on return')
  const returnedMic = await micChip.textContent()
  if (returnedMic?.trim() !== 'Mic off') {
    throw new Error(
      `the mic was not released by parking (reads "${returnedMic?.trim()}")`,
    )
  }
  await shoot(page, shots, `${theme}-run-returned`)
  steps.push('run: returned paused, the mic released')

  // Stop ends it. No room claims an unsaved take, so nothing is asked.
  await page
    .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
    .click()
  const alerts = await page.locator('[data-testid="shell-keep-alert"]').count()
  if (alerts !== 0) throw new Error('Stop asked a question no room can answer')
  await page
    .locator('[data-testid="shell-rail-layer"].is-in')
    .waitFor({ state: 'attached', timeout: RUN_TIMEOUT_MS })
  await expectVisible(
    page.locator('[data-tour="singing-options"]'),
    'the stage bar after the run',
  )
  await shoot(page, shots, `${theme}-run-ended`)
  steps.push('run: ended, no alert, the rail and the stage bar are back')

  // And the leave that is NOT a park still ends cleanly: the room comes back
  // with its own transport rather than none at all.
  await page.locator('[data-rail-item="rooms"]').click()
  await page.locator('[data-rail-item="stage"]').click()
  await expectVisible(
    page.locator('[data-testid="singing-mobile-stage"] [aria-label="Play"]'),
    'the room’s own transport after leaving and coming back',
  )
  steps.push('run: leaving with no run leaves the room usable')

  return steps
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.shots !== null) mkdirSync(args.shots, { recursive: true })

  const browser = await chromium.launch({
    headless: !args.headed,
    args: [
      // Any window this opens belongs on the agent workspace, never the one
      // somebody is looking at. Headless opens none; headed must still say so.
      '--class=agent-browser',
      // A microphone that answers, and no permission sheet in front of it.
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
    ],
  })
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: args.theme,
    permissions: ['microphone'],
  })

  const failures = []
  context.on('page', (page) => {
    page.on('pageerror', (error) => {
      failures.push(`page error: ${error.message}`)
    })
    page.on('console', (message) => {
      if (message.type() !== 'error') return
      const text = message.text()
      if (IGNORED_CONSOLE.some((entry) => text.includes(entry))) return
      failures.push(`console error: ${text}`)
    })
  })

  const page = await context.newPage()
  await page.addInitScript(seed, args.theme)

  let steps = []
  try {
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('#root.loaded').waitFor({
      state: 'attached',
      timeout: BOOT_TIMEOUT_MS,
    })
    steps.push('boot: #root.loaded')
    steps = steps.concat(await walkChrome(page, args))
    if (!args.chromeOnly) steps = steps.concat(await walkRun(page, args))
  } catch (error) {
    failures.push(`walk: ${error.message}`)
  } finally {
    await context.close()
    await browser.close()
  }

  for (const step of steps) console.log(`ok    ${step}`)
  for (const failure of failures) console.error(`FAIL  ${failure}`)

  if (failures.length > 0) {
    console.error(`\nprobe-bundle: ${failures.length} problem(s).`)
    process.exitCode = 1
    return
  }
  console.log(`\nprobe-bundle: every step passed (${args.theme}).`)
}

await main()
