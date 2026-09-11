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
// WHAT IT DELIBERATELY DOES NOT DO: start a run. The transport only exists
// while one is going, a run needs the microphone, and a microphone needs a
// permission and a device a headless browser has neither of. The run is the
// device round's job (mp-v0.3.0); this is the half that can be proved on a
// machine, on every push, for nothing.
//
// Native plugins do not exist here either: `@capacitor/*` answers
// `Unimplemented`, which the platform wrappers already turn into a no-op, so
// nothing in this walk depends on one.

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
  }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === '--base-url') args.baseUrl = argv[(i += 1)]
    else if (flag === '--shots') args.shots = argv[(i += 1)]
    else if (flag === '--theme') args.theme = argv[(i += 1)]
    else if (flag === '--headed') args.headed = true
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

async function walk(page, { shots, theme }) {
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.shots !== null) mkdirSync(args.shots, { recursive: true })

  const browser = await chromium.launch({
    headless: !args.headed,
    // Any window this opens belongs on the agent workspace, never the one
    // somebody is looking at. Headless opens none; headed must still say so.
    args: ['--class=agent-browser'],
  })
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: args.theme,
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
    steps = steps.concat(await walk(page, args))
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
