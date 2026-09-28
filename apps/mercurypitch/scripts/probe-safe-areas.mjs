// ============================================================
// Every native surface, clear of the status bar, the notch and the home indicator
// ============================================================
//
// TestFlight 0.7.1 (owner, 28 Sep, iPhone 13 Pro): Progress and the Ear Lab
// drew their first row where the clock, the battery and the wifi sit. Headless
// Chromium resolves every `env(safe-area-inset-*)` to 0, so every walk before
// this one measured a phone with no status bar at all, and the landscape walk
// (probe-landscape.mjs) sets the insets on its side only, where there is none.
//
// This walk sets a phone's own insets through the DevTools protocol
// (Emulation.setSafeAreaInsetsOverride): upright with the notch's 47 at the
// top, the Dynamic Island's 59 and 62, and 34 at the bottom; and on its side
// both ways round, 59 or 47 at each side and 21 at the bottom. Then it opens
// every surface the native build draws and measures it with the landscape
// walk's audit, asking only the inset rules. No run of text and no control
// may sit
//   - under the status bar,
//   - in a side inset,
//   - in the home indicator's band,
// unless a scroll brings it out. Each surface is measured where it opens and,
// where it scrolls, again at its end.
//
// Every surface, walked three ways: a fresh install signed out, a phone with
// an account on it, and a phone that refused the microphone. The alley and its
// welcome; the Sing room, its options, song and room pickers, the priming
// door, a live run with its coach mark and its column, the end card, the
// account offer; the Ear Lab, each of its racks, a drill and the report;
// Progress; the More sheet; Settings and every screen it pushes (the
// microphone and its latency sheet, room noise, storage and its alert, this
// phone, appearance, Karaoke, About, Developer); the account signed out and
// signed in, its name and devices, deleting it; the sign-in sheet down to its
// code pane; Piano and Guitar; Karaoke with its library, options and studio,
// playing; a toast; and the refused microphone's way back.
//
// A surface this walk cannot reach is a finding of its own, not a pass: the
// page is loaded afresh and the next section still runs, so one broken door
// does not hide every screen behind it.
//
// Wired into probe-bundle.mjs, which owns the browser (with its fake voice)
// and passes in its own seed, isolation and screenshot helpers.
// `--safe-areas-only` walks this alone.

import { audit, EXEMPT, toEnd } from './probe-landscape.mjs'

/**
 * The phones, upright and on their sides.
 *
 * An iPhone on its side reports the same inset at both ends whichever way it
 * was turned; what the turn changes is `screen.orientation`, which is set
 * too, so a surface that reads it is walked both ways round.
 */
export const SAFE_AREA_FRAMES = [
  // The owner's iPhone 13 Pro: the notch.
  {
    width: 390,
    height: 844,
    insets: { top: 47, right: 0, bottom: 34, left: 0 },
    orientation: { type: 'portraitPrimary', angle: 0 },
  },
  // A Dynamic Island phone (iPhone 15 Pro).
  {
    width: 393,
    height: 852,
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
    orientation: { type: 'portraitPrimary', angle: 0 },
  },
  // The tallest status bar today (iPhone 16 Pro).
  {
    width: 402,
    height: 874,
    insets: { top: 62, right: 0, bottom: 34, left: 0 },
    orientation: { type: 'portraitPrimary', angle: 0 },
  },
  // The island phone turned one way...
  {
    width: 852,
    height: 393,
    insets: { top: 0, right: 59, bottom: 21, left: 59 },
    orientation: { type: 'landscapePrimary', angle: 90 },
  },
  // ...and the owner's phone turned the other.
  {
    width: 844,
    height: 390,
    insets: { top: 0, right: 47, bottom: 21, left: 47 },
    orientation: { type: 'landscapeSecondary', angle: 270 },
  },
  // An iPad with Face ID (iPad Air 11-inch), which the owner tests on too:
  // a status bar at the top either way up, and a home indicator.
  {
    width: 820,
    height: 1180,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
    orientation: { type: 'portraitPrimary', angle: 0 },
  },
  {
    width: 1180,
    height: 820,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
    orientation: { type: 'landscapePrimary', angle: 90 },
  },
]

/** The audit's rules this walk asks for: the insets, and nothing else. */
const RULES = ['status-bar', 'notch', 'home-indicator']

/** `390x844-top47`, `844x390-landscapeSecondary` or `1180x820-top24-landscapePrimary`. */
export function frameName(frame) {
  const turned = frame.orientation.type.startsWith('landscape')
  const top = frame.insets.top > 0 ? `-top${frame.insets.top}` : ''
  return `${frame.width}x${frame.height}${top}${turned ? `-${frame.orientation.type}` : ''}`
}

// ── A phone with an account on it ────────────────────────────
//
// Invented, all of it: `probe-singer-0001` is nobody, and the address is an
// Apple relay address with an obviously made-up name, because only a relay
// address has a Copy button on the Account screen, and the copy is what
// raises a toast. The token is not signed and could not be; nothing but this
// walk's own route ever answers for it.

const SINGER = {
  id: 'probe-singer-0001',
  name: 'Probe Singer',
  email: 'probe-0000@privaterelay.appleid.com',
  provider: 'apple',
}

function seedAccount(singer) {
  const part = (value) =>
    btoa(JSON.stringify(value))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/u, '')
  const issued = Math.floor(Date.now() / 1000) - 86_400
  try {
    localStorage.setItem(
      'mp:authToken',
      [
        part({ alg: 'none', typ: 'JWT' }),
        part({
          sub: singer.id,
          provider: singer.provider,
          iat: issued,
          exp: issued + 30 * 86_400,
        }),
        'probe',
      ].join('.'),
    )
    localStorage.setItem('mp:userId', singer.id)
    localStorage.setItem(
      'mp:account-card',
      JSON.stringify({ ...singer, newsletter: false }),
    )
    localStorage.setItem('pitchperfect_native_welcome_seen', 'true')
  } catch {
    /* storage blocked: the screens show the signed-out phone instead */
  }
}

/** The worker's answers this walk gives, and nothing else of the worker's. */
const WORKER = /^https:\/\/api(?:-dev)?\.mercurypitch\.com\/api\/auth\//u

function answer(route, status, body) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
    body: body === null ? '' : JSON.stringify(body),
  })
}

/**
 * The code request (so the sign-in sheet reaches its code pane) and, on the
 * phone with an account, who that account is. Everything else the worker
 * would answer stays refused by the kit's isolation, which runs after this
 * because Playwright tries the newest route first.
 */
async function standIn(context, signedIn) {
  await context.route(WORKER, async (route, request) => {
    const path = new URL(request.url()).pathname
    const method = request.method()
    if (method === 'OPTIONS') return answer(route, 204, null)
    if (path === '/api/auth/email-code/request' && method === 'POST') {
      return answer(route, 200, { ceremony: 'probe-ceremony' })
    }
    if (path === '/api/auth/me' && method === 'GET' && signedIn) {
      return answer(route, 200, {
        user: {
          id: SINGER.id,
          email: SINGER.email,
          authProvider: SINGER.provider,
          newsletterOptIn: false,
        },
        profile: { displayName: SINGER.name },
      })
    }
    return route.fallback()
  })
}

/** A refused microphone, thrown the way a real refusal is (see walkDenied). */
function refuseMicrophone() {
  if (navigator.mediaDevices === undefined) return
  navigator.mediaDevices.getUserMedia = () => {
    const error = new Error('Permission denied')
    error.name = 'NotAllowedError'
    return Promise.reject(error)
  }
}

async function openPage(browser, args, frame, kit, results, how = {}) {
  const { isolate, seed, bootTimeoutMs, stepTimeoutMs } = kit
  const viewport = { width: frame.width, height: frame.height }
  const context = await isolate(
    await browser.newContext({
      viewport,
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
      permissions: how.refused === true ? [] : ['microphone'],
    }),
  )
  await standIn(context, how.signedIn === true)
  const page = await context.newPage()
  page.on('pageerror', (error) => {
    results.failures.push(`page error: ${error.message}`)
  })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: frame.insets,
  })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    ...viewport,
    deviceScaleFactor: 3,
    mobile: true,
    screenOrientation: frame.orientation,
  })
  await page.addInitScript(seed, args.theme)
  if (how.signedIn === true) await page.addInitScript(seedAccount, SINGER)
  if (how.refused === true) await page.addInitScript(refuseMicrophone)
  const boot = async () => {
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page
      .locator('#root.loaded')
      .waitFor({ state: 'attached', timeout: bootTimeoutMs })
    await page
      .locator('[data-testid="rooms-alley"]')
      .waitFor({ state: 'visible', timeout: stepTimeoutMs })
    await page.waitForTimeout(600)
  }
  await boot()
  return { context, page, boot }
}

/** The walk's verbs over one page, and the measurement they feed. */
function verbs(page, args, frame, kit, results) {
  const { shoot, stepTimeoutMs, runTimeoutMs } = kit
  const ctx = { ...args, frame: { width: frame.width, height: frame.height } }
  const visible = (selector, timeout = stepTimeoutMs) =>
    page
      .locator(selector)
      .first()
      .waitFor({ state: 'visible', timeout })
      .catch(() => {
        throw new Error(`${selector} never showed`)
      })
  const hidden = (selector, timeout = stepTimeoutMs) =>
    page
      .locator(selector)
      .first()
      .waitFor({ state: 'hidden', timeout })
      .catch(() => {
        throw new Error(`${selector} never went`)
      })
  const settle = (ms = 400) => page.waitForTimeout(ms)
  /** The system Back, as the shell hears it. */
  const back = () =>
    page.evaluate(() => {
      const press = window.mpShellBack
      if (typeof press !== 'function') throw new Error('no shell back handler')
      return press()
    })
  /**
   * Every scroller back to its top. A scroll to the end folds the rail down to
   * its minimized row, and a folded item is too small to press.
   */
  const toTop = async () => {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('*')) {
        if (el.scrollTop > 0) el.scrollTop = 0
      }
    })
    await settle(300)
  }

  const once = (scope) =>
    page.evaluate(audit, {
      scope,
      exempt: EXEMPT,
      rules: RULES,
      controls: true,
    })

  const measure = async (name, scope, { end = false } = {}) => {
    const first = await once(scope)
    const want = frame.insets
    if (
      first.inset.top !== want.top ||
      first.inset.right !== want.right ||
      first.inset.bottom !== want.bottom ||
      first.inset.left !== want.left
    ) {
      throw new Error(
        `the insets did not take: the page reads ${JSON.stringify(first.inset)}`,
      )
    }
    await shoot(page, ctx, `safe-${name}`)
    const problems = first.problems.map((p) => `${name}: ${p}`)
    let inks = first.inks
    if (end && (await page.evaluate(toEnd, scope)) > 0) {
      await settle(300)
      const last = await once(scope)
      problems.push(...last.problems.map((p) => `${name}, at its end: ${p}`))
      inks += last.inks
      await shoot(page, ctx, `safe-${name}-end`)
    }
    if (problems.length > 0) results.failures.push(...problems)
    else results.surfaces.push(`${name} (${inks})`)
  }

  const rail = async (id) => {
    await toTop()
    await page.locator(`[data-rail-item="${id}"]`).click()
    await visible(`[data-rail-item="${id}"][aria-current="page"]`)
    await settle()
  }
  const more = async (item) => {
    await toTop()
    await page.locator('[data-rail-item="more"]').click()
    await visible('[data-more-item="settings"]')
    await settle(300)
    if (item !== null) await page.locator(`[data-more-item="${item}"]`).click()
  }
  const pushed = '[data-testid="shell-pushed"]'
  /** One screen down the stack, to `under`, or off the stack altogether. */
  const pop = async (under = null) => {
    await page.locator('[data-testid="shell-pushed-back"]').click()
    if (under === null) await hidden(pushed)
    else await visible(under)
    await settle(300)
  }
  /** A row's screen, pushed and measured where it opens and at its end. */
  const row = async (id, screen, name) => {
    await toTop()
    await page.locator(`[data-settings-row="${id}"]`).click()
    await visible(screen)
    await settle()
    await measure(name, pushed, { end: true })
  }
  /** Back, pane by pane, until the sign-in sheet is gone. */
  const closeSignIn = async () => {
    const sheet = page.locator('[data-testid="signin-sheet"]')
    for (let i = 0; i < 4 && (await sheet.isVisible()); i += 1) {
      await back()
      await settle(300)
    }
    await hidden('[data-testid="signin-sheet"]')
  }

  return {
    visible,
    hidden,
    settle,
    back,
    toTop,
    measure,
    rail,
    more,
    pushed,
    pop,
    row,
    closeSignIn,
    runTimeoutMs,
    stepTimeoutMs,
  }
}

/** Walk `sections` in order over one page, each on its own (see the header). */
async function walkSections(boot, sections, results) {
  for (const [name, walk] of sections) {
    try {
      await walk()
    } catch (error) {
      results.failures.push(
        `${name}: could not walk it: ${error.message.split('\n')[0]}`,
      )
      await boot().catch(() => {})
    }
  }
}

/** A fresh install, signed out, with the microphone granted. */
async function signedOut(browser, args, frame, kit, results) {
  const { context, page, boot } = await openPage(
    browser,
    args,
    frame,
    kit,
    results,
  )
  const go = verbs(page, args, frame, kit, results)
  const rack = '[data-testid="ear-rack"]'
  const stage = (label) =>
    `[data-testid="karaoke-mobile-stage"] button[aria-label="${label}"]`
  try {
    await walkSections(
      boot,
      [
        [
          'the alley',
          async () => {
            // A first run: the alley still owes its welcome headline.
            await go.visible('[data-testid="alley-headline"]')
            await go.measure('alley-welcome', null)
            await kit.tapDoor(page, 'sing')
            await kit.waitPhase(page, 'alive', 'sing', 'a door picked')
            await go.visible('[data-testid="alley-enter"]')
            await go.settle()
            await go.measure('alley-card', null)
            await go.back()
            await kit.waitPhase(page, 'rest', null, 'the door put back')
          },
        ],
        [
          'the Sing room',
          async () => {
            await go.rail('stage')
            await go.visible('[data-testid="sing-room"]')
            await go.settle(600)
            await go.measure('sing-room', null)
            const options = '[role="dialog"][aria-label="Practice options"]'
            await page.locator('[data-testid="shell-room-gear"]').click()
            await go.visible(options)
            await go.settle()
            await go.measure('sing-options', options, { end: true })
            await page.locator('[data-testid="sing-options-song"]').click()
            await go.visible('.fn-modal-content')
            await go.settle()
            await go.measure('sing-song-picker', '.fn-modal-content', {
              end: true,
            })
            await go.back()
            await go.hidden('.fn-modal-content')
            await go.settle()
            const picker = '[data-testid="sing-room-picker"]'
            await page.locator('[data-testid="shell-room-chip"]').click()
            await go.visible(picker)
            await go.settle(600)
            await go.measure('sing-room-picker', picker, { end: true })
            await go.back()
            await go.hidden(picker)
            await go.settle()
          },
        ],
        [
          'a Sing run',
          async () => {
            await go.rail('stage')
            await go.visible('[data-testid="sing-room"]')
            await page.locator('[data-testid="sing-capsule"]').click()
            await go.visible('[data-testid="sing-priming"]')
            await go.settle(300)
            await go.measure('sing-priming', '[data-testid="sing-priming"]', {
              end: true,
            })
            await page.locator('[data-testid="sing-priming-continue"]').click()
            await go.hidden('[data-testid="sing-priming"]')
            await page.waitForFunction(
              () => window.mpSingRoom?.().state === 'live',
              null,
              { timeout: go.runTimeoutMs },
            )
            // The coach mark rises on the first live run, and a take needs
            // three seconds of voice to earn its card.
            await go.settle(4000)
            await go.measure('sing-live', null)
            await page.locator('[data-testid="shell-chip"]').click()
            await go.visible('[data-column-item="rooms"]')
            await go.settle()
            await go.measure('sing-column', null)
            await page.mouse.click(frame.width / 2, frame.height / 2)
            await go.hidden('[data-column-item="rooms"]')
            await page
              .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
              .click()
            await go.visible('[data-testid="sing-take-sheet"]', go.runTimeoutMs)
            await go.settle(300)
            await go.measure('sing-take', '[data-testid="sing-take-sheet"]', {
              end: true,
            })
            await page.locator('[data-testid="sing-take-keep"]').click()
            await go.hidden('[data-testid="sing-take-sheet"]')
            await go.visible('[data-testid="account-offer"]')
            await go.settle()
            await go.measure('account-offer', '[data-testid="sheet-panel"]', {
              end: true,
            })
            await page.locator('[data-testid="offer-sign-in"]').click()
            await go.visible('[data-testid="signin-sheet"]')
            await go.settle()
            await go.measure(
              'sign-in',
              '[role="dialog"][aria-label="Sign in"]',
              {
                end: true,
              },
            )
            await go.closeSignIn()
          },
        ],
        [
          'the Ear Lab',
          async () => {
            await go.rail('ear')
            await go.visible('[data-testid="ear-room-shell"]')
            await go.settle(600)
            await go.measure('ear-lab', null, { end: true })
            const panels = [
              ['[data-testid="ear-readiness-chip"]', 'ear-readiness'],
              ['[data-testid="ear-rulers-chip"]', 'ear-rulers'],
              ['[data-testid="ear-room-chip"]', 'ear-rooms'],
            ]
            for (const [chip, name] of panels) {
              await go.toTop()
              await page.locator(chip).first().click()
              await go.visible(rack)
              await go.settle()
              await go.measure(name, rack, { end: true })
              await page.keyboard.press('Escape')
              await go.hidden(rack)
            }
            await go.toTop()
            await page
              .getByRole('button', { name: 'Today', exact: true })
              .first()
              .click()
            await go.visible(rack)
            await go.settle()
            await go.measure('ear-today', rack, { end: true })
            await page.keyboard.press('Escape')
            await go.hidden(rack)
            await go.toTop()
            await page
              .getByRole('button', { name: /Instruments/u })
              .first()
              .click()
            await go.visible(rack)
            await go.settle()
            await go.measure('ear-instruments', rack, { end: true })
            await page
              .locator(`${rack} button`, { hasText: 'Hairline' })
              .first()
              .click()
            await go.visible('[data-testid="ear-stage"]')
            await go.settle(600)
            await go.measure('ear-drill', null, { end: true })
            await go.toTop()
            await page
              .locator('[data-testid="ear-stage"] button[aria-label^="Back"]')
              .first()
              .click()
            await go.hidden('[data-testid="ear-stage"]')
            await page
              .getByRole('button', { name: /Ear Report/u })
              .first()
              .click()
            await go.visible('[data-testid="ear-report"]')
            await go.settle(600)
            await go.measure('ear-report', null, { end: true })
            await go.toTop()
            await page
              .locator('[data-testid="ear-report"] button[aria-label^="Back"]')
              .first()
              .click()
            await go.hidden('[data-testid="ear-report"]')
          },
        ],
        [
          'Progress',
          async () => {
            await go.rail('progress')
            // Loaded: the skeleton that stands in first has no words to measure.
            await page.waitForFunction(
              () =>
                document.querySelector('section[aria-busy="true"]') === null &&
                [...document.querySelectorAll('h1')].some(
                  (h) => (h.textContent ?? '').trim() === 'Progress',
                ),
              undefined,
              { timeout: go.stepTimeoutMs },
            )
            await go.measure('progress', null, { end: true })
          },
        ],
        [
          'More',
          async () => {
            await go.more(null)
            await go.measure('more', '[role="dialog"][aria-label="More"]')
            await page.keyboard.press('Escape')
            await go.hidden('[data-more-item="settings"]')
          },
        ],
        [
          'Settings',
          async () => {
            await go.more('settings')
            await go.visible('[data-testid="settings-screen"]')
            await go.settle()
            await go.measure('settings', go.pushed, { end: true })
            await go.row(
              'microphone',
              '[data-testid="microphone-screen"]',
              'microphone',
            )
            const latency = '[role="dialog"][aria-label="Microphone latency"]'
            await go.toTop()
            await page.locator('[data-testid="latency-measure"]').click()
            await go.visible(latency)
            await go.settle()
            await go.measure('latency-sheet', latency, { end: true })
            await go.back()
            await go.hidden(latency)
            await go.row(
              'mic-room-noise',
              '[data-testid="room-noise-screen"]',
              'room-noise',
            )
            await go.pop('[data-testid="microphone-screen"]')
            await go.pop('[data-testid="settings-screen"]')
            await go.row('storage', '[data-testid="storage-screen"]', 'storage')
            await go.toTop()
            await page.locator('[data-settings-row="start-fresh"]').click()
            await go.visible('[data-testid="settings-alert"]')
            await go.settle()
            await go.measure('settings-alert', '[data-testid="settings-alert"]')
            await page.locator('[data-testid="settings-alert-cancel"]').click()
            await go.hidden('[data-testid="settings-alert"]')
            await go.pop('[data-testid="settings-screen"]')
            for (const [id, screen, name] of [
              ['this-phone', 'this-phone-screen', 'this-phone'],
              ['appearance', 'appearance-screen', 'appearance'],
              ['rooms-karaoke', 'karaoke-settings-screen', 'karaoke-settings'],
              ['about', 'about-screen', 'about'],
            ]) {
              await go.row(id, `[data-testid="${screen}"]`, name)
              await go.pop('[data-testid="settings-screen"]')
            }
            await go.pop()
          },
        ],
        [
          'the account, signed out',
          async () => {
            await go.more('account')
            await go.visible('[data-testid="account-screen"]')
            await go.settle()
            await go.measure('account', go.pushed, { end: true })
            await go.toTop()
            await page.locator('[data-testid="account-sign-in"]').click()
            const sheet = '[role="dialog"][aria-label="Sign in"]'
            await go.visible('[data-testid="signin-sheet"]')
            await page.locator('[data-testid="signin-email"]').click()
            await go.visible('[data-testid="signin-email-input"]')
            await go.settle()
            await go.measure('sign-in-email', sheet, { end: true })
            // Answered by this walk's stand-in: nothing leaves the machine.
            await page
              .locator('[data-testid="signin-email-input"]')
              .fill('probe@example.com')
            await page.locator('[data-testid="signin-send-code"]').click()
            await go.visible('[data-testid="signin-sheet"][data-pane="code"]')
            await go.settle()
            await go.measure('sign-in-code', sheet, { end: true })
            await go.closeSignIn()
            await go.pop('[data-testid="settings-screen"]')
            await go.pop()
          },
        ],
        [
          'Developer',
          async () => {
            // A test build's screen. A store build has neither it nor its tile.
            await go.more(null)
            const tile = page.locator('[data-more-item="developer"]')
            if ((await tile.count()) === 0) {
              await page.keyboard.press('Escape')
              await go.hidden('[data-more-item="settings"]')
              return
            }
            await tile.click()
            await go.visible('[data-testid="shell-developer"]')
            await go.settle()
            await go.measure('developer', go.pushed, { end: true })
            await go.pop()
          },
        ],
        [
          'Piano and Guitar',
          async () => {
            // Piano is its phone stage upright and the desk's toolbar on its side.
            for (const [item, ready] of [
              [
                'piano',
                '[data-testid="piano-mobile-stage"]:visible, [data-testid="practice-view-toolbar"]:visible',
              ],
              ['guitar', '[data-testid="gp-song-status-bar"]:visible'],
            ]) {
              await go.more(item)
              await go.visible(ready)
              await go.settle(800)
              await go.measure(item, null, { end: true })
            }
          },
        ],
        [
          'the Karaoke room',
          async () => {
            await go.more('karaoke')
            await go.visible('[data-testid="karaoke-room"]')
            await page
              .locator(`${stage('Play')}:not([disabled])`)
              .waitFor({ state: 'visible', timeout: go.runTimeoutMs })
            await go.settle(600)
            await go.measure('karaoke', null, { end: true })
            await go.toTop()
            await page.locator('[data-testid="karaoke-songline"]').tap()
            await go.visible('[data-testid="karaoke-library"]')
            await go.settle()
            await go.measure(
              'karaoke-library',
              '[role="dialog"][aria-label="Songs"]',
              { end: true },
            )
            await go.back()
            await go.hidden('[data-testid="karaoke-library"]')
            const options = '[role="dialog"][aria-label="Karaoke options"]'
            await page.locator('[data-testid="shell-room-gear"]').click()
            await go.visible(options)
            await go.settle()
            await go.measure('karaoke-options', options, { end: true })
            await page.locator('button[aria-label="Manage songs"]').click()
            await go.visible('[data-testid="karaoke-studio"]')
            await go.settle(600)
            await go.measure('karaoke-studio', go.pushed, { end: true })
            await go.pop('[data-testid="karaoke-room"]')
            await go.toTop()
            await page.locator(stage('Play')).click()
            await go.visible(stage('Pause'))
            await go.settle(1200)
            await go.measure('karaoke-playing', null)
            await page.locator(stage('Pause')).click()
            await go.visible(stage('Play'))
          },
        ],
      ],
      results,
    )
  } finally {
    await context.close()
  }
}

/** A phone with an account on it: the screens only an account has. */
async function signedIn(browser, args, frame, kit, results) {
  const { context, page, boot } = await openPage(
    browser,
    args,
    frame,
    kit,
    results,
    { signedIn: true },
  )
  const go = verbs(page, args, frame, kit, results)
  try {
    await walkSections(
      boot,
      [
        [
          'the alley, welcomed back',
          async () => {
            await go.visible('[data-testid="alley-title"]')
            await go.measure('alley-returning', null)
          },
        ],
        [
          'the account, signed in',
          async () => {
            await go.more('settings')
            await go.visible('[data-settings-row="delete-account"]')
            await go.settle()
            await go.measure('settings-signed-in', go.pushed, { end: true })
            await go.row(
              'account',
              '[data-testid="account-screen"]',
              'account-signed-in',
            )
            // A toast: the relay address copied, or why it was not.
            await go.toTop()
            await page.locator('[data-testid="account-copy-address"]').click()
            const toasts = '[role="region"][aria-label="Notifications"]'
            await go.visible(
              `${toasts} [role="status"], ${toasts} [role="alert"]`,
            )
            await go.settle()
            await go.measure('toast', toasts)
            await go.row(
              'account-name',
              '[data-testid="account-name-screen"]',
              'account-name',
            )
            await go.pop('[data-testid="account-screen"]')
            await go.row('devices', '[data-testid="devices-screen"]', 'devices')
            await go.pop('[data-testid="account-screen"]')
            await go.pop('[data-testid="settings-screen"]')
            await go.row(
              'delete-account',
              '[data-testid="delete-account-screen"]',
              'delete-account',
            )
            await go.pop('[data-testid="settings-screen"]')
            await go.pop()
          },
        ],
      ],
      results,
    )
  } finally {
    await context.close()
  }
}

/** The microphone refused: the Sing room's way back to it (3d). */
async function refused(browser, args, frame, kit, results) {
  const { context, page, boot } = await openPage(
    browser,
    args,
    frame,
    kit,
    results,
    { refused: true },
  )
  const go = verbs(page, args, frame, kit, results)
  try {
    await walkSections(
      boot,
      [
        [
          'the refused microphone',
          async () => {
            await go.rail('stage')
            await go.visible('[data-testid="sing-room"]')
            await page.locator('[data-testid="sing-capsule"]').click()
            await page.locator('[data-testid="sing-priming-continue"]').click()
            await go.visible('[data-testid="sing-denied"]')
            await go.settle()
            await go.measure('sing-denied', null, { end: true })
          },
        ],
      ],
      results,
    )
  } finally {
    await context.close()
  }
}

/**
 * One frame: every surface on a fresh install, on a phone with an account,
 * and on a phone that refused the microphone.
 */
export async function walkSafeAreas(browser, args, frame, kit) {
  const results = { surfaces: [], failures: [] }
  for (const walk of [signedOut, signedIn, refused]) {
    try {
      await walk(browser, args, frame, kit, results)
    } catch (error) {
      results.failures.push(error.message.split('\n')[0])
    }
  }
  const where = frameName(frame)
  if (results.failures.length > 0) {
    throw new Error(`[${where}] safe areas: ${results.failures.join('; ')}`)
  }
  const { top, right, bottom, left } = frame.insets
  return [
    `[${where}] safe areas: ${results.surfaces.length} surfaces clear of the insets (top ${top}, left ${left}, right ${right}, bottom ${bottom}): ${results.surfaces.join(', ')}`,
  ]
}
