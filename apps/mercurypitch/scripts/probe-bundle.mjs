// The native shell, driven in a real browser against the BUILT bundle.
//
//   node scripts/probe-bundle.mjs --base-url http://127.0.0.1:4179
//   node scripts/probe-bundle.mjs --base-url … --shots <dir> --theme light
//
// What it is for: `pnpm build` proves the bundle compiles, and
// `assert-bundle.mjs` proves it carries what it should. Neither opens it.
// This does — and walks the chrome a first run touches: the five rail
// destinations, the More sheet, the Developer screen, and Settings pushed and
// popped.
//
// IT WALKS EVERY FRAME IN `FRAMES`, and there are two. 393 x 852 is the size
// the rail lab is drawn at; 390 x 844 is the iPhone 13 Pro the owner holds.
// Three points is not a rounding error when four rail items share a row with
// a fixed circle beside them — device round 1 came back with labels that fit
// the lab and not the phone, so both are walked and both are measured.
//
// It walks in two halves. The CHROME half needs nothing but a document. The
// RUN half starts a real run against Chromium's fake capture device, because
// everything the shell is for only exists while one is going — and because a
// probe that stopped at the chrome is exactly what let a shell ship that
// never left `browsing`: it watched a signal nothing writes, and every
// screenshot of the rail looked perfect.
//
// ON ITS SIDE, TOO. After the frames, every surface is walked again on the
// two phones turned sideways, with their own notch and home-indicator insets
// set through the DevTools protocol (probe-landscape.mjs). `--landscape-only`
// walks that half alone.
//
// Native plugins do not exist here: `@capacitor/*` answers `Unimplemented`,
// which the platform wrappers already turn into a no-op, so nothing in this
// walk depends on one.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { LANDSCAPE_INSET_FRAMES, walkLandscapeSurfaces, } from './probe-landscape.mjs'
import { parseRoomNames } from './room-names-source.mjs'
import { selfTestUploadDenial, UPLOAD_DENIAL } from './upload-denial.mjs'

/** Every frame the walk is repeated at. The lab's, and the owner's phone. */
const FRAMES = [
  { width: 393, height: 852 },
  { width: 390, height: 844 },
]
const BOOT_TIMEOUT_MS = 15_000

/**
 * The names the app gives its rooms, read from the module that owns them
 * (`src/features/rooms/room-names.ts`) rather than copied here, so the walk
 * measures the strings that ship. Parsed rather than imported because this
 * script runs under bare node, and every key must be read or it throws
 * (room-names-source.mjs).
 */
const ROOM_NAMES = parseRoomNames(
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../src/features/rooms/room-names.ts',
    ),
    'utf8',
  ),
)
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
    landscapeOnly: false,
    dist: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === '--base-url') args.baseUrl = argv[(i += 1)]
    else if (flag === '--shots') args.shots = argv[(i += 1)]
    else if (flag === '--theme') args.theme = argv[(i += 1)]
    else if (flag === '--headed') args.headed = true
    else if (flag === '--chrome-only') args.chromeOnly = true
    else if (flag === '--landscape-only') args.landscapeOnly = true
    else if (flag === '--dist') args.dist = argv[(i += 1)]
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
    // The dev portable console ships in this bundle and grows from the bottom
    // edge as it captures lines — over the rail, which is what this walk taps.
    // A layout probe has no business measuring a debug overlay.
    localStorage.setItem('mp:portableConsole', '0')
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

/**
 * Count what the canvas actually does, not what it says it does.
 *
 * Every frame `PitchCanvas` draws begins with one `clearRect` of the whole
 * buffer, so counting those counts repaints. A still picture that repaints is
 * invisible in a screenshot and expensive on a phone: measured at 120 clears
 * a second while paused and 56 behind the end card, for a trace that had not
 * moved in minutes.
 */
function installRepaintCounter() {
  window.__mpClears = 0
  const clear = CanvasRenderingContext2D.prototype.clearRect
  CanvasRenderingContext2D.prototype.clearRect = function counted(...args) {
    window.__mpClears += 1
    return clear.apply(this, args)
  }
}

/** Repaints over `ms`, as a rate per second. */
async function repaintRate(page, ms = 1000) {
  const before = await page.evaluate(() => window.__mpClears ?? 0)
  await page.waitForTimeout(ms)
  const after = await page.evaluate(() => window.__mpClears ?? 0)
  return ((after - before) * 1000) / ms
}

/**
 * The db-worker is not part of what this walks, so no request reaches one.
 *
 * The bundle compiles the dev worker in (apps/mercurypitch/api-base.mjs), and
 * a walk that keeps takes would otherwise provision an anonymous identity on
 * it every run and leave rows behind. Refused at the network, so the app sees
 * what it sees offline — which is also the state a first run on a phone with
 * no signal has to survive.
 */
const API_HOSTS = /^https:\/\/api(?:-dev)?\.mercurypitch\.com\//u

/**
 * Packaged media, answered the way the iPhone answers it (device round 4).
 *
 * Capacitor's iOS scheme handler answers a non-Range GET for a bundled media
 * file with a bare URLResponse, so WebKit hands the page `ok: false, status:
 * 0` and the whole body. Chromium answers 200, which is how a loader that
 * threw on `!response.ok` walked green here while the phone played no
 * ambient. So a same-origin, non-Range fetch of one of the handler's media
 * extensions gets the real response behind a Proxy reporting status 0. Only
 * a success is re-dressed: a missing file on iOS is a network error, never a
 * status-0 body. Runs in the page, so it cannot close over anything here.
 */
function emulateIosPackagedMedia() {
  const MEDIA = /\.(m4v|mov|mp4|aac|ac3|aiff|au|flac|m4a|mp3|wav)$/iu
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const response = await realFetch(input, init)
    const request = input instanceof Request ? input : null
    const url = new URL(request?.url ?? String(input), window.location.href)
    const headers = new Headers(init?.headers ?? request?.headers)
    const packaged =
      url.origin === window.location.origin && MEDIA.test(url.pathname)
    if (!packaged || headers.has('range') || !response.ok) return response
    return new Proxy(response, {
      get(target, key) {
        if (key === 'status') return 0
        if (key === 'ok') return false
        const value = Reflect.get(target, key, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  }
}

async function isolate(context) {
  await context.route(API_HOSTS, (route) => route.abort('internetdisconnected'))
  await context.addInitScript(emulateIosPackagedMedia)
  return context
}

const RAIL_ITEMS = ['rooms', 'stage', 'ear', 'progress']

/**
 * What each rail item must and must not have under the shell (P5).
 *
 * `gone` is the page's own information band. `kept` is everything the first
 * cut of that fix took away with it — a page heading, and the Ear Lab's three
 * chips, which are the only way to the readiness panel every tap drill
 * subtracts from, to the rulers, and to the room picker. Hiding a band is one
 * line; hiding a band and its controls is a regression, and only the second
 * list can tell them apart.
 *
 * Every selector is a `data-testid`, never a class: both bands are styled
 * through CSS modules whose names are hashed per build, so a probe that
 * matched on them would go green the day the hash changed.
 */
const WEB_PAGE_HEADER = {
  // The web's card gallery and its page band are gone under the shell: the
  // Rooms tab is the alley (S4). What must stay is the alley's own way in —
  // its tap surface and the six door buttons a screen reader walks.
  rooms: {
    gone: [
      '[data-testid="home-learn"]',
      '[data-testid="home-whats-new"]',
      '[data-testid="home-heading"]',
      '[data-destination]',
    ],
    kept: [
      '[data-testid="rooms-alley"]',
      '[data-testid="alley-hit"]',
      '[data-testid="alley-door-ear"]',
      '[data-testid="alley-door-sing"]',
    ],
  },
  ear: {
    gone: ['[data-testid="ear-session-copy"]'],
    kept: [
      '[data-testid="ear-readiness-chip"]',
      '[data-testid="ear-rulers-chip"]',
      '[data-testid="ear-room-chip"]',
    ],
    // Presence is not function: the original Console tile was present and
    // wired to nothing. One kept control is tapped and must open its panel.
    tap: {
      selector: '[data-testid="ear-readiness-chip"]',
      opens: '#ear-rack-title',
    },
  },
}

/** `<frame>-<theme>-<name>` — one flat directory holds every frame and theme. */
function stem(ctx, name) {
  return `${ctx.frame.width}x${ctx.frame.height}-${ctx.theme}-${name}`
}

async function shoot(page, ctx, name) {
  if (ctx.shots === null) return
  await page.screenshot({ path: resolve(ctx.shots, `${stem(ctx, name)}.png`) })
}

// ── The rail, measured ───────────────────────────────────────
//
// Device round 1's first item was "the rail looks squished next to the lab
// page", and nothing in the walk could tell whether that was true. It can
// now: this reads the computed font, the item, its label, its plate, its icon
// box and the label's text-size-adjust, and writes them beside the
// screenshots. What is asserted from them is in `measureRail` below.
//
// The plate IS the item's background (`.mp-rail__item[aria-current]`), so the
// plate box is the item box. It is reported separately because the kit draws
// its indicator as its own element and a future rail may too — but for that
// same reason a plate-versus-label comparison proves nothing today, and
// `measureRail` does not make one.
const readRail = () => {
  const round = (n) => Math.round(n * 100) / 100
  const box = (el) => {
    if (el === null) return null
    const r = el.getBoundingClientRect()
    return {
      x: round(r.x),
      y: round(r.y),
      width: round(r.width),
      height: round(r.height),
    }
  }
  const aside = document.querySelector('.mp-more-aside')
  const firstLabel = document.querySelector('.mp-rail__label')
  return {
    row: box(document.querySelector('[data-testid="shell-rail"]')),
    rail: box(document.querySelector('.mp-rail')),
    aside: box(aside),
    asideIcon: box(aside === null ? null : aside.querySelector('svg')),
    // Off the LABEL, not off <html>. The property is inherited, the rule is
    // on the shell root, and the document keeps its own `auto` — so reading
    // the root would report "auto" for a label that is pinned at 100% and
    // call the fix missing.
    textSizeAdjust:
      firstLabel === null
        ? null
        : getComputedStyle(firstLabel).webkitTextSizeAdjust,
    items: [...document.querySelectorAll('.mp-rail__item')].map((item) => {
      const label = item.querySelector('.mp-rail__label')
      const style = label === null ? null : getComputedStyle(label)
      return {
        id: item.getAttribute('data-rail-item'),
        selected: item.getAttribute('aria-current') === 'page',
        text: label === null ? '' : label.textContent,
        item: box(item),
        plate: box(item),
        label: box(label),
        icon: box(item.querySelector('svg')),
        overflow:
          label === null ? null : round(label.scrollWidth - label.clientWidth),
        font:
          style === null
            ? null
            : {
                family: style.fontFamily,
                size: style.fontSize,
                weight: style.fontWeight,
                lineHeight: style.lineHeight,
                letterSpacing: style.letterSpacing,
              },
      }
    }),
  }
}

/**
 * The kit's numbers, which are also the lab page's. Asserted, not just dumped.
 *
 * The first version of this check dumped everything and asserted almost
 * nothing, and a review proved it: re-injecting the original bug — a `font:`
 * shorthand with an undefined token, and a 64 px aside — left it GREEN at both
 * frames. Two reasons, and both are worth remembering.
 *
 * `label.width > plate.width` cannot fire. The plate IS the item's own
 * background, so the two boxes are the same element, and `.mp-rail__label` is
 * `max-width: 100%` inside it — the label is incapable of being wider. And
 * `overflow` stayed 0 because "Progress" at 16px happens to fit a 68 px item
 * in headless Chrome by three pixels.
 *
 * So the check is now on the values that actually broke, plus a headroom
 * margin instead of a boundary: three pixels of slack is not a rail that fits,
 * it is a rail that fits this string in this font on this machine.
 */
const RAIL_SPEC = {
  labelSize: '10px',
  labelWeight: '500',
  asideWidth: 52,
  iconSize: 26,
  textSizeAdjust: '100%',
  /** Px of item width a label must leave over. Below this it only looks fine. */
  headroom: 12, // the shipped rail has ~30 px spare; the 16 px bug leaves 5.7-6.4, so 6 was a boundary, not a margin
}

async function measureRail(page, ctx) {
  const rail = await page.evaluate(readRail)
  if (ctx.shots !== null) {
    writeFileSync(
      resolve(ctx.shots, `${stem(ctx, 'rail-metrics')}.json`),
      `${JSON.stringify(rail, null, 2)}\n`,
    )
  }
  if (rail.items.length !== 4) {
    throw new Error(`the pill holds ${rail.items.length} items, not four`)
  }

  // The bug was a dropped `font:` shorthand, so the label's computed font is
  // the thing to read back. Nothing about a box would have caught it.
  if (rail.textSizeAdjust !== RAIL_SPEC.textSizeAdjust) {
    throw new Error(
      `the rail's labels are at text-size-adjust ${rail.textSizeAdjust}, not ${RAIL_SPEC.textSizeAdjust}`,
    )
  }
  if (rail.aside === null) throw new Error('there is no More circle')
  if (Math.abs(rail.aside.width - RAIL_SPEC.asideWidth) > 0.5) {
    throw new Error(
      `the More circle is ${rail.aside.width} px, not the kit's ${RAIL_SPEC.asideWidth}`,
    )
  }

  for (const item of rail.items) {
    if (item.label === null) throw new Error(`${item.id} has no label`)
    if (item.font.size !== RAIL_SPEC.labelSize) {
      throw new Error(
        `"${item.text}" is set at ${item.font.size}, not ${RAIL_SPEC.labelSize}`,
      )
    }
    if (item.font.weight !== RAIL_SPEC.labelWeight) {
      throw new Error(
        `"${item.text}" is weight ${item.font.weight}, not ${RAIL_SPEC.labelWeight}`,
      )
    }
    if (item.icon === null) throw new Error(`${item.id} has no symbol`)
    if (Math.abs(item.icon.width - RAIL_SPEC.iconSize) > 0.5) {
      throw new Error(
        `${item.id}'s symbol is ${item.icon.width} px, not ${RAIL_SPEC.iconSize}`,
      )
    }
    if (item.overflow > 0.5) {
      throw new Error(
        `"${item.text}" is clipped by ${item.overflow} px at ${ctx.frame.width}`,
      )
    }
    const headroom = item.item.width - item.label.width
    if (headroom < RAIL_SPEC.headroom) {
      throw new Error(
        `"${item.text}" leaves ${Math.round(headroom * 10) / 10} px of its ${item.item.width} px item — under ${RAIL_SPEC.headroom}`,
      )
    }
  }

  const worst = rail.items.reduce((a, b) =>
    a.item.width - a.label.width < b.item.width - b.label.width ? a : b,
  )
  const label = rail.items[0].font
  return `rail: ${rail.items[0].item.width} px items, ${label.size}/${label.weight} labels, ${rail.aside.width} px More, ${Math.round((worst.item.width - worst.label.width) * 10) / 10} px spare on "${worst.text}"`
}

async function walkChrome(page, ctx) {
  const { theme, frame } = ctx
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
  if (bottom > frame.height || bottom < frame.height - 160) {
    throw new Error(
      `the rail should sit on the bottom edge; its bottom is at ${bottom}`,
    )
  }
  if (box.x < 0 || box.x + box.width > frame.width) {
    throw new Error('the rail runs off the side of the screen')
  }
  steps.push(
    `rail: on the bottom edge (${Math.round(bottom)} of ${frame.height})`,
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
    await shoot(page, ctx, `tab-${id}`)
    steps.push(`rail: ${id} selected`)

    // The corner slot is empty here, and an empty slot is not a surface. Its
    // 56 x 64 box sat over most of the bridge's Ear Report and took the tap
    // (device round 4): the button answered only along its right edge.
    if (id === 'ear') {
      const under = await page.evaluate(() => {
        const report = [...document.querySelectorAll('button')].find((b) =>
          (b.textContent ?? '').includes('Ear Report'),
        )
        if (report === undefined) return 'there is no Ear Report'
        const box = report.getBoundingClientRect()
        const hit = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        )
        if (hit !== null && report.contains(hit)) return null
        return `its centre is under ${hit?.getAttribute('data-testid') ?? hit?.tagName}`
      })
      if (under !== null) {
        throw new Error(
          `ear: the bridge's Ear Report cannot be tapped: ${under}`,
        )
      }
      steps.push("ear: the bridge's Ear Report takes a tap at its centre")
    }

    // The web page header is a band of prose the native design does not have —
    // and under a room header it is a second title bar. Absent, not merely
    // scrolled off. But the controls that sat beside it are NOT the band, and
    // taking them with it is the review finding this half exists for.
    const rule = WEB_PAGE_HEADER[id]
    if (rule !== undefined) {
      for (const selector of rule.gone) {
        const present = await page.locator(selector).count()
        if (present !== 0) {
          throw new Error(`the web page band is still on ${id} (${selector})`)
        }
      }
      for (const selector of rule.kept) {
        const present = await page.locator(selector).count()
        if (present === 0) {
          throw new Error(`${id} lost ${selector} along with its band`)
        }
      }
      if (rule.tap !== undefined) {
        await page.locator(rule.tap.selector).first().click()
        await page
          .locator(rule.tap.opens)
          .first()
          .waitFor({ state: 'visible', timeout: 10_000 })
          .catch(() => {
            throw new Error(
              `${id}: ${rule.tap.selector} is present but opens nothing (${rule.tap.opens})`,
            )
          })
        await page.keyboard.press('Escape')
        await page
          .locator(rule.tap.opens)
          .first()
          .waitFor({ state: 'hidden', timeout: 10_000 })
      }
      steps.push(
        `${id}: no page band, ${rule.kept.length} control(s)/heading kept${rule.tap === undefined ? '' : ', one tapped and working'}`,
      )
    }
  }

  // The rail, measured rather than photographed (P1). Progress is selected
  // here — the longest of the four labels, so the plate that has to reach the
  // end of it is the one under test.
  steps.push(await measureRail(page, ctx))

  await page.locator('[data-rail-item="more"]').click()
  const settingsTile = page.locator('[data-more-item="settings"]')
  await settingsTile.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  await page.waitForTimeout(300)
  await shoot(page, ctx, 'more-sheet')
  steps.push('more: sheet open')

  await page.keyboard.press('Escape')
  await settingsTile.waitFor({ state: 'hidden', timeout: STEP_TIMEOUT_MS })
  steps.push('more: sheet closed')

  // Developer (P3). The tile used to call `setupDeveloperConsole()`, which
  // mounts a host for a floating panel that renders nothing while its own
  // Settings toggle is off — a tile that did nothing, every time, on the
  // build where a tester has no devtools. It pushes a screen now, and the
  // screen has the sections the native entry registered in it.
  await page.locator('[data-rail-item="more"]').click()
  const developerTile = page.locator('[data-more-item="developer"]')
  await developerTile.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  await developerTile.click()
  const developer = page.locator('[data-testid="shell-developer"]')
  await developer.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  const sections = await page.locator('[data-developer-section]').count()
  if (sections === 0) {
    throw new Error('the Developer screen pushed with no sections in it')
  }
  await page.waitForTimeout(300)
  await shoot(page, ctx, 'developer-pushed')
  steps.push(`developer: pushed, ${sections} section(s)`)

  await page.locator('[data-testid="shell-pushed-back"]').click()
  await developer.waitFor({ state: 'hidden', timeout: STEP_TIMEOUT_MS })
  await rail.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  steps.push('developer: back to the rail')

  await page.locator('[data-rail-item="more"]').click()
  await settingsTile.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  await settingsTile.click()
  const pushed = page.locator('[data-testid="shell-pushed"]')
  await pushed.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  await page.waitForTimeout(500)
  await shoot(page, ctx, 'settings-pushed')
  steps.push('settings: pushed')

  await page.locator('[data-testid="shell-pushed-back"]').click()
  await pushed.waitFor({ state: 'hidden', timeout: STEP_TIMEOUT_MS })
  // The rail outlives the screen that covered it: this is the assertion that
  // a pushed screen is a navigation level and not a modal.
  await rail.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  steps.push('settings: back to the rail')

  // One reservation, not two (P2). The stage's own bar used to add its own
  // safe-area inset on top of the scroller's, which left 8 + 10 + 34 pt of
  // nothing between the last control and the band on a notched phone. Since
  // S3 the Sing tab is a ROOM with no bar of its own, so what is measured is
  // the room's own bottom reserve: its last control sits a fixed, small gap
  // above the band whatever the home indicator does.
  //
  // WITH A HOME INDICATOR STOOD UP BY HAND. Headless resolves every
  // `env(safe-area-inset-*)` to 0, so a doubled reservation IS the safe area
  // and at 0 the broken room and the fixed one measure the same. The inset is
  // pushed onto the document for this one measurement and taken off again.
  await page.locator('[data-rail-item="stage"]').click()
  await page
    .locator('[data-testid="sing-room"]')
    .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  await page.waitForTimeout(400)

  const readSeam = () => {
    const round = (n) => Math.round(n * 10) / 10
    const capsule = document.querySelector('[data-testid="sing-capsule"]')
    const band = document.querySelector('.mp-band')
    if (capsule === null || band === null) return null
    return {
      gap: round(
        band.getBoundingClientRect().top -
          capsule.getBoundingClientRect().bottom,
      ),
      safeBottom: getComputedStyle(document.documentElement)
        .getPropertyValue('--safe-bottom')
        .trim(),
    }
  }

  const NOTCH = 34
  await page.evaluate((inset) => {
    document.documentElement.style.setProperty('--safe-bottom', `${inset}px`)
  }, NOTCH)
  await page.waitForTimeout(200)
  const notched = await page.evaluate(readSeam)
  await shoot(page, ctx, 'room-bottom-seam')
  await page.evaluate(() => {
    document.documentElement.style.removeProperty('--safe-bottom')
  })
  await page.waitForTimeout(200)
  const flat = await page.evaluate(readSeam)

  for (const [what, seam] of [
    ['with a home indicator', notched],
    ['without one', flat],
  ]) {
    if (seam === null) throw new Error('no capsule, or no band, in the room')
    // One reservation: a doubled one puts the whole safe area between them.
    if (seam.gap < 4 || seam.gap > 24) {
      throw new Error(
        `${what}, the room's last control sits ${seam.gap} px above the band`,
      )
    }
  }
  if (notched.safeBottom !== `${NOTCH}px`) {
    throw new Error(
      `the home indicator did not take: --safe-bottom read ${notched.safeBottom}`,
    )
  }
  steps.push(
    `room: the capsule sits ${flat.gap} px above the band, and ${notched.gap} px at a ${NOTCH} pt inset`,
  )

  // The room header steps aside for a pushed screen (P6). It is fixed at
  // `--z-rail` and a pushed screen sits one step below, so its Back used to
  // take the tap meant for the screen's own — and this is the only place in
  // the walk where a room header and a pushed screen are up together, which
  // is why the step lives here and not beside the other Settings push.
  const roomHeader = page.locator('[data-testid="shell-room-header"]')
  await roomHeader.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  const headerBack = await page
    .locator('[data-testid="shell-room-back"]')
    .boundingBox()
  if (headerBack === null) throw new Error('the room header has no Back')
  const atBack = {
    x: Math.round(headerBack.x + headerBack.width / 2),
    y: Math.round(headerBack.y + headerBack.height / 2),
  }

  await page.locator('[data-rail-item="more"]').click()
  await settingsTile.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  await settingsTile.click()
  await pushed.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })

  // Waited for rather than read once: the header fades over `--mp-out`, and a
  // box read on the frame the class changed is the state it is leaving.
  await page.waitForFunction(
    () => {
      const node = document.querySelector('[data-testid="shell-room-header"]')
      if (node === null) return true
      const style = getComputedStyle(node)
      return style.visibility === 'hidden' && Number(style.opacity) === 0
    },
    undefined,
    { timeout: STEP_TIMEOUT_MS },
  )

  // Gone is not the same as out of the way. `elementFromPoint` is the only
  // question that matters here: whose Back is under the thumb at the corner
  // the room header used to own?
  const atCorner = await page.evaluate(({ x, y }) => {
    const node = document.elementFromPoint(x, y)
    const header = document.querySelector('[data-testid="shell-room-header"]')
    return {
      inHeader: node !== null && header !== null && header.contains(node),
      inPushed:
        node !== null && node.closest('[data-testid="shell-pushed"]') !== null,
      inert: header !== null && header.hasAttribute('inert'),
    }
  }, atBack)
  if (atCorner.inHeader) {
    throw new Error('the room header still takes the tap over a pushed screen')
  }
  if (!atCorner.inPushed) {
    throw new Error('nothing of the pushed screen is under its own Back')
  }
  if (!atCorner.inert) throw new Error('the hidden room header is not inert')
  await shoot(page, ctx, 'room-header-pushed')
  steps.push('room header: out, inert, and not under the thumb while pushed')

  // And back on the pop — this click is itself the proof, because it is the
  // one that used to land on the room header instead.
  await page.locator('[data-testid="shell-pushed-back"]').click()
  await pushed.waitFor({ state: 'hidden', timeout: STEP_TIMEOUT_MS })
  await page.waitForFunction(
    () => {
      const node = document.querySelector('[data-testid="shell-room-header"]')
      if (node === null) return false
      const style = getComputedStyle(node)
      return (
        style.visibility === 'visible' &&
        Number(style.opacity) === 1 &&
        !node.hasAttribute('inert')
      )
    },
    undefined,
    { timeout: STEP_TIMEOUT_MS },
  )
  steps.push('room header: back on the pop')

  return steps
}

// ── The run half: the Sing room ──────────────────────────────
//
// Everything the shell exists for is here, and none of it is reachable
// without a real run: the transport, the corner chip, its column, the lock,
// the session pill and the return. Since S3 the room around it is the Retro
// Analog Studio, so this half also walks the room's own states — resting,
// priming, live, muted, paused, the end card, and the denied fallback.
//
// IT SINGS. `--use-file-for-fake-audio-capture` feeds Chromium a WAV of three
// held notes, so the detector reports real pitches, the trace draws real
// pixels, and a take really does pass three seconds of voice. The fake DEVICE
// on its own beeps once a second — about a tenth of the time voiced — and a
// three-second take would need half a minute of wall clock before any of the
// end card's numbers could be checked at all.

const RUN_TIMEOUT_MS = 20_000

/** Long enough for a take to clear the three-second floor with room to spare. */
const TAKE_MS = 5000

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

/** Waits rather than samples: every chip in the room settles a frame late. */
async function expectText(page, selector, expected, what) {
  try {
    await page.waitForFunction(
      ([sel, want]) =>
        document.querySelector(sel)?.textContent?.trim() === want,
      [selector, expected],
      { timeout: RUN_TIMEOUT_MS },
    )
  } catch {
    const actual = await page
      .locator(selector)
      .first()
      .textContent()
      .catch(() => null)
    throw new Error(`${what} reads "${actual?.trim()}", not "${expected}"`)
  }
}

/** The shell's band has the transport, and the room draws none of its own. */
async function expectShellOwnsBand(page) {
  await page
    .locator('[data-testid="shell-transport-layer"].is-in')
    .waitFor({ state: 'attached', timeout: RUN_TIMEOUT_MS })
  await expectVisible(
    page.locator('[data-testid="shell-transport"]'),
    'the shell transport',
  )
  const roomBar = await page.locator('[data-tour="singing-options"]').count()
  if (roomBar !== 0) {
    throw new Error('the room drew a transport of its own under the shell')
  }
}

/**
 * Three held notes as a WAV, written once per run.
 *
 * A4, C5 and E5 at 48 kHz mono, four seconds each with a short gap between
 * them: enough voice for a take, two clean steps for "range touched", and a
 * pitch the note chip can name. Chromium loops the file, so a long walk never
 * runs out of voice.
 */
function writeToneWav(path) {
  const rate = 48_000
  const plan = [
    { hz: 440, seconds: 4 },
    { hz: 0, seconds: 0.35 },
    { hz: 523.25, seconds: 4 },
    { hz: 0, seconds: 0.35 },
    { hz: 659.25, seconds: 4 },
  ]
  const frames = plan.reduce(
    (total, part) => total + Math.round(part.seconds * rate),
    0,
  )
  const data = Buffer.alloc(frames * 2)
  let at = 0
  let phase = 0
  for (const part of plan) {
    const count = Math.round(part.seconds * rate)
    const step = (2 * Math.PI * part.hz) / rate
    for (let i = 0; i < count; i++) {
      // A little third harmonic: a pure sine is a signal no microphone ever
      // hears, and autocorrelation is happier with a voice-shaped one.
      const value =
        part.hz === 0 ? 0 : 0.55 * Math.sin(phase) + 0.12 * Math.sin(3 * phase)
      phase += step
      data.writeInt16LE(
        Math.max(-32767, Math.min(32767, Math.round(value * 32767))),
        at,
      )
      at += 2
    }
  }

  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)

  writeFileSync(path, Buffer.concat([header, data]))
  return path
}

/**
 * Is the canvas really drawn over the photograph, in the room's own colours?
 *
 * Two questions one screenshot cannot answer, and both of them are the whole
 * point of S3: a plate that is still opaque hides the room while looking
 * perfectly fine in a picture, and a trace that is still the stage's flat
 * green still looks like a trace. So the pixels are read.
 */
/** How many takes this phone has kept. Keep writes one; Discard writes none. */
async function storedTakes(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('pitchperfect_sing_takes')
      const parsed = raw === null ? [] : JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.length : -1
    } catch {
      return -1
    }
  })
}

async function sampleTrace(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="sing-room"] canvas')
    if (canvas === null) return { error: 'no canvas in the room' }
    const ctx = canvas.getContext('2d')
    if (ctx === null) return { error: 'no 2d context' }
    const { width, height } = canvas
    const pixels = ctx.getImageData(0, 0, width, height).data

    let transparent = 0
    let painted = 0
    let flatGreen = 0
    let spectrum = 0
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      if (pixels[i + 3] === 0) {
        transparent += 1
        continue
      }
      painted += 1
      // The stage's old trail is #3fb950 — green well clear of both others.
      if (g > 120 && g - r > 60 && g - b > 60) flatGreen += 1
      // The kit's gradient runs #58a6ff → #2dd4bf → #bc8cff: blue at one end,
      // teal in the middle, violet at the other, and strongly blue all the
      // way across, which the green never is.
      if (b > 120 && b - r > 40) spectrum += 1
    }
    return {
      total: pixels.length / 4,
      transparent,
      painted,
      flatGreen,
      spectrum,
    }
  })
}

/** The room's whole walk, from the silent trace to a decided take. */
/**
 * `steps` is an OUT parameter, not a return value.
 *
 * A throw halfway through used to take every step this walk had already
 * proved with it, so a failure at step forty reported forty blank lines and a
 * message with no place in it. The caller keeps the array.
 */
async function walkRun(page, ctx, steps) {
  const { frame } = ctx

  await page.locator('[data-rail-item="stage"]').click()
  await expectVisible(
    page.locator('[data-testid="sing-room"]'),
    'the Sing room',
  )

  // ── R0: the path opens on a silent trace and asks for nothing ──
  await expectVisible(
    page.locator('[data-testid="sing-trace-silent"]'),
    'the silent trace',
  )
  await expectVisible(
    page.locator('[data-testid="sing-capsule"]'),
    'the capsule',
  )
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Mic off',
    'the state chip at rest',
  )
  await shoot(page, ctx, 'room-resting')
  steps.push('room: rests on a silent trace with one capsule, mic off')

  // ── 3b: one priming screen, then the ask ──
  await page.locator('[data-testid="sing-capsule"]').click()
  await expectVisible(
    page.locator('[data-testid="sing-priming"]'),
    'the priming screen',
  )
  await shoot(page, ctx, 'room-priming')
  steps.push('room: Sing a note opens the priming screen, not the microphone')

  // The door closes. It is a portal with one button on it, so a Back that
  // fell through to history left `priming` set for good: the room came back
  // with the door drawn over it and nothing on it but Continue.
  const primingBack = await pressBack(page)
  if (primingBack !== 'room-overlay') {
    throw new Error(`Back over the priming door resolved as "${primingBack}"`)
  }
  await expectGone(
    page.locator('[data-testid="sing-priming"]'),
    'the priming screen after Back',
  )
  await expectVisible(
    page.locator('[data-testid="sing-capsule"]'),
    'the capsule after Back over the door',
  )
  steps.push('room: Back over the priming door rests the room')

  // …and the next tap asks again.
  await page.locator('[data-testid="sing-capsule"]').click()
  await expectVisible(
    page.locator('[data-testid="sing-priming"]'),
    'the priming screen on the second tap',
  )

  await page.locator('[data-testid="sing-priming-continue"]').click()
  await expectGone(
    page.locator('[data-testid="sing-priming"]'),
    'the priming screen after Continue',
  )
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Listening',
    'the state chip once the mic is granted',
  )
  steps.push('room: Continue asks, and the microphone is granted')

  // ── A: the live trace, drawn over the photograph ──
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="sing-note-chip"]')
        ?.getAttribute('data-variant') !== 'quiet',
    undefined,
    { timeout: RUN_TIMEOUT_MS },
  )
  const chipText = (
    await page.locator('[data-testid="sing-note-chip"]').textContent()
  )?.trim()
  if (!/^[A-G]#?\d/u.test(chipText ?? '')) {
    throw new Error(`the note chip reads "${chipText}", which is not a note`)
  }
  if (!/cents/u.test(chipText ?? '')) {
    throw new Error(`the note chip says no cents: "${chipText}"`)
  }
  steps.push(`room: the note chip names a note and its cents (${chipText})`)

  // Sampled once the room says it has a line to draw, not once it says it can
  // hear: the first cut read the canvas a tenth of a second after the mic
  // opened and found two points of trail, then reported that the trace was
  // not drawing at all. The room exposes its own count under E2E mode.
  await page.waitForFunction(
    () => (window.mpSingRoom?.().trail ?? 0) > 120,
    undefined,
    { timeout: RUN_TIMEOUT_MS },
  )
  const room = await page.evaluate(() => window.mpSingRoom?.())
  if (room?.melodyRun !== false || room?.micIntent !== true) {
    throw new Error(`the room is not in a free run: ${JSON.stringify(room)}`)
  }

  const trace = await sampleTrace(page)
  if (trace.error !== undefined) throw new Error(trace.error)
  if (trace.transparent < trace.total * 0.5) {
    const opaque = Math.round((100 * trace.painted) / trace.total)
    throw new Error(
      `the canvas is ${opaque}% opaque — the room is behind a plate`,
    )
  }
  if (trace.spectrum < 200) {
    throw new Error(
      `only ${trace.spectrum} spectrum pixels with ${room.trail} of trail: the trace is not drawing`,
    )
  }
  if (trace.flatGreen > trace.spectrum / 4) {
    throw new Error(
      `${trace.flatGreen} flat-green pixels: the old stage trail is still drawn`,
    )
  }
  await shoot(page, ctx, 'room-live')
  steps.push(
    `room: the trace draws in the spectrum on a transparent plate (${trace.spectrum} px lit, ${trace.flatGreen} green)`,
  )

  // The shell took the band the moment the run started.
  await expectShellOwnsBand(page)
  await page.waitForFunction(
    () => {
      const node = document.querySelector('[data-testid="shell-chip"]')
      return (
        node !== null &&
        Math.abs(node.getBoundingClientRect().width - 56) <= 1.5
      )
    },
    undefined,
    { timeout: RUN_TIMEOUT_MS },
  )
  const chip = await page.locator('[data-testid="shell-chip"]').boundingBox()
  const band = await page.locator('.mp-band').boundingBox()
  if (chip === null || band === null) throw new Error('no chip or no band')
  const near = (a, b) => Math.abs(a - b) <= 1.5
  if (!near(frame.width - (chip.x + chip.width), 16)) {
    throw new Error(
      `the chip sits ${frame.width - (chip.x + chip.width)} from the right edge`,
    )
  }
  if (!near(band.y - (chip.y + chip.height), 8)) {
    throw new Error(
      `the chip sits ${band.y - (chip.y + chip.height)} above the band`,
    )
  }
  steps.push(
    'run: the shell has the band, and the chip is 56, 8 above it, 16 in',
  )

  // ── The state chip mutes, and does NOT end the take ──
  await page.locator('[data-testid="sing-state-chip"]').click()
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Mic off',
    'the state chip after a mute',
  )
  await expectShellOwnsBand(page)
  await shoot(page, ctx, 'room-muted')
  steps.push('room: a mute says Mic off and the run keeps its transport')

  await page.locator('[data-testid="sing-state-chip"]').click()
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Listening',
    'the state chip after unmuting',
  )
  steps.push('room: a second tap listens again')

  // ── The column, the pause, the lock ──
  await page.locator('[data-testid="shell-chip"]').click()
  await expectVisible(
    page.locator('[data-column-item="rooms"]'),
    'the tab column',
  )
  await shoot(page, ctx, 'run-column')
  await page.mouse.click(frame.width / 2, frame.height / 2)
  await expectGone(
    page.locator('[data-column-item="rooms"]'),
    'the column after a room tap',
  )
  steps.push('run: the column opens and a room tap closes it')

  await page
    .locator('[data-testid="shell-transport"] [aria-label="Pause"]')
    .click()
  await expectVisible(
    page.locator('[data-testid="shell-transport"] [aria-label="Play"]'),
    'Play on the primary after a pause',
  )
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Paused',
    'the state chip while paused',
  )
  const railBack = await page
    .locator('[data-testid="shell-rail-layer"]')
    .evaluate((node) => node.classList.contains('is-in'))
  if (railBack) throw new Error('the rail came back on pause')
  await shoot(page, ctx, 'run-paused')
  steps.push('run: paused, the chip says so, and the rail stayed away')

  const pausedRate = await repaintRate(page)
  if (pausedRate > 4) {
    throw new Error(
      `the canvas repaints ${pausedRate}/s while paused, over a still trace`,
    )
  }
  steps.push(`run: a paused canvas stops repainting (${pausedRate}/s)`)

  await page
    .locator('[data-testid="shell-transport"] [aria-label="Play"]')
    .click()
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Listening',
    'the state chip after a resume',
  )
  steps.push('run: resumed, and the microphone came back with it')

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
  if (locked.removed) {
    throw new Error('a locked Stop left the accessibility tree')
  }
  if (Number(locked.opacity) > 0.6)
    throw new Error('a locked Stop is not dimmed')
  await shoot(page, ctx, 'run-locked')
  steps.push('run: locked, dimmed, still announced')
  await page.locator('[aria-label="Lock controls"]').click()

  // ── Park, the pill, and the return ──
  await page.locator('[data-testid="shell-chip"]').click()
  await page.locator('[data-column-item="progress"]').click()
  await page.waitForFunction(
    () => window.location.hash.includes('progress'),
    undefined,
    { timeout: RUN_TIMEOUT_MS },
  )
  await expectVisible(
    page.locator('[data-testid="shell-session-pill"]'),
    'the session pill',
  )
  await shoot(page, ctx, 'run-parked')
  // Five seconds on another tab. The room is unmounted, no frame arrives,
  // and the take's clock must not count any of it — a seven-second take used
  // to come back claiming forty-nine.
  const parkedAt = await page.evaluate(
    () => window.mpSingRoom?.().elapsedSeconds ?? 0,
  )
  await page.waitForTimeout(5000)
  for (const tab of ['ear', 'rooms']) {
    await page.locator(`[data-rail-item="${tab}"]`).click()
    await page
      .locator(`[data-rail-item="${tab}"][aria-current="page"]`)
      .waitFor({ state: 'visible', timeout: RUN_TIMEOUT_MS })
    await expectVisible(
      page.locator('[data-testid="shell-session-pill"]'),
      `the session pill on ${tab}`,
    )
  }
  steps.push('run: parked, with the pill on every tab the run is not')

  await page.locator('[data-testid="shell-session-pill"]').click()
  await expectVisible(
    page.locator('[data-testid="shell-transport"] [aria-label="Play"]'),
    'the transport showing Play on return',
  )
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Paused',
    'the state chip on return',
  )
  await shoot(page, ctx, 'run-returned')
  steps.push('run: returned paused, the microphone released')

  const returnedAt = await page.evaluate(
    () => window.mpSingRoom?.().elapsedSeconds ?? 0,
  )
  if (returnedAt - parkedAt > 1) {
    throw new Error(
      `the take's clock ran ${(returnedAt - parkedAt).toFixed(1)}s while parked`,
    )
  }
  steps.push(
    `run: five seconds parked cost the take ${(returnedAt - parkedAt).toFixed(2)}s`,
  )

  // ── The end card ──
  await page
    .locator('[data-testid="shell-transport"] [aria-label="Play"]')
    .click()
  await page.waitForTimeout(TAKE_MS)
  await page
    .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
    .click()
  await expectVisible(
    page.locator('[data-testid="sing-take-sheet"]'),
    'the end card',
  )
  for (const stat of ['duration', 'takes', 'range', 'cents']) {
    const text = (
      await page.locator(`[data-testid="sing-stat-${stat}"]`).textContent()
    )?.trim()
    if (text === undefined || text.length === 0) {
      throw new Error(`the end card's ${stat} stat is blank`)
    }
  }
  if ((await page.locator('[data-testid="sing-take-history"]').count()) !== 0) {
    throw new Error(
      'a first take compared itself with a history it has not got',
    )
  }
  await shoot(page, ctx, 'room-end-card')
  steps.push(
    'room: Stop opens the end card with four counts and no history yet',
  )

  const endedRate = await repaintRate(page)
  if (endedRate > 4) {
    throw new Error(
      `the canvas repaints ${endedRate}/s behind the end card, over a frozen trace`,
    )
  }
  steps.push(`room: the canvas behind the card is still (${endedRate}/s)`)

  await page.locator('[data-testid="sing-take-keep"]').click()
  await expectGone(
    page.locator('[data-testid="sing-take-sheet"]'),
    'the end card',
  )
  await expectVisible(
    page.locator('[data-testid="sing-capsule"]'),
    'the capsule after Keep',
  )
  steps.push('room: Keep closes the card and the room rests')

  // ── A second take: the history line is there now ──
  await page.locator('[data-testid="sing-capsule"]').click()
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Listening',
    'the state chip on a second take',
  )
  await page.waitForTimeout(TAKE_MS)
  await page
    .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
    .click()
  await expectVisible(
    page.locator('[data-testid="sing-take-history"]'),
    'the line against your own history',
  )
  const history = (
    await page.locator('[data-testid="sing-take-history"]').textContent()
  )?.trim()
  if (
    history === undefined ||
    !history.startsWith('Against your own history:')
  ) {
    throw new Error(`the history line reads "${history}"`)
  }
  const takes = (
    await page.locator('[data-testid="sing-stat-takes"]').textContent()
  )?.trim()
  if (takes !== '2 takes') {
    throw new Error(`the second take says "${takes}" this session`)
  }
  await shoot(page, ctx, 'room-end-card-history')
  steps.push('room: the second take counts itself and compares with the first')

  await page.locator('[data-testid="sing-take-discard"]').click()
  await expectGone(
    page.locator('[data-testid="sing-take-sheet"]'),
    'the end card after Discard',
  )
  await expectVisible(
    page.locator('[data-testid="sing-trace-silent"]'),
    'the silent trace after a discarded take',
  )
  const afterDiscard = await storedTakes(page)
  if (afterDiscard !== 1) {
    throw new Error(`Discard left ${afterDiscard} takes stored, not 1`)
  }
  await shoot(page, ctx, 'room-resting-returning')
  steps.push('room: Discard stores nothing and the room rests')

  // ── A third take, dismissed with Back rather than decided ──
  //
  // The blocker this exists for: the card is the room's, so Back fell through
  // to history, the room unmounted with `ended` and no summary, and what came
  // back was a frozen canvas with no capsule, no card and no way out — for
  // good. And the take went with it.
  await page.locator('[data-testid="sing-capsule"]').click()
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Listening',
    'the state chip on a third take',
  )
  await page.waitForTimeout(TAKE_MS)
  await page
    .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
    .click()
  await expectVisible(
    page.locator('[data-testid="sing-take-sheet"]'),
    'the end card on a third take',
  )
  const backOutcome = await pressBack(page)
  if (backOutcome !== 'room-overlay') {
    throw new Error(`Back over the end card resolved as "${backOutcome}"`)
  }
  await expectGone(
    page.locator('[data-testid="sing-take-sheet"]'),
    'the end card after Back',
  )
  await expectVisible(
    page.locator('[data-testid="sing-capsule"]'),
    'the capsule after Back over the card',
  )
  const afterBack = await storedTakes(page)
  if (afterBack !== 2) {
    throw new Error(
      `Back over the card stored ${afterBack} takes: a dismissal is a keep`,
    )
  }
  steps.push('room: Back over the end card rests the room and keeps the take')

  // …and the room still works when it is entered again.
  await page.locator('[data-rail-item="rooms"]').click()
  await page.locator('[data-rail-item="stage"]').click()
  await expectVisible(
    page.locator('[data-testid="sing-capsule"]'),
    'the capsule on re-entering after a Back',
  )
  await expectVisible(
    page.locator('[data-testid="sing-trace-silent"]'),
    'the silent trace on re-entering after a Back',
  )
  steps.push('room: re-entering after that Back finds a usable room')

  // ── A take under three seconds has nothing to keep ──
  await page.locator('[data-testid="sing-capsule"]').click()
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Listening',
    'the state chip on a short take',
  )
  await page
    .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
    .click()
  await expectGone(
    page.locator('[data-testid="sing-take-sheet"]'),
    'the end card after a take with nothing in it',
  )
  await expectVisible(
    page.locator('[data-testid="sing-capsule"]'),
    'the capsule after a short take',
  )
  steps.push('room: a run under three seconds shows no card at all')

  // ── The song picker is above the dock, not trapped under it ──
  //
  // The room is `position: fixed` with a z-index, which makes it a stacking
  // context: a modal rendered inside it cannot climb above the rail whatever
  // z-index it asks for. Measured before the portal: a tap on the rail behind
  // the open picker changed tab, straight through the backdrop.
  await page.locator('[data-testid="shell-room-gear"]').click()
  await page.locator('[data-testid="sing-options-song"]').click()
  const picker = page.locator('.fn-modal-content')
  await expectVisible(picker, 'the song picker')
  const railBox = await page.locator('[data-rail-item="rooms"]').boundingBox()
  if (railBox === null) throw new Error('no rail to tap behind the picker')
  await shoot(page, ctx, 'room-song-picker')

  // What is actually on top of the rail's own middle. This is the whole
  // question, asked without a click: while the picker was trapped inside the
  // room's stacking context the answer here was the rail button itself.
  const onTop = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y)
      return {
        rail:
          el?.closest('[data-rail-item]')?.getAttribute('data-rail-item') ??
          null,
        picker: el?.closest('.fn-modal-overlay') !== null,
      }
    },
    [railBox.x + railBox.width / 2, railBox.y + railBox.height / 2],
  )
  if (onTop.rail !== null || !onTop.picker) {
    throw new Error(
      `the rail is on top of the open picker (${JSON.stringify(onTop)})`,
    )
  }

  // And a real tap there reaches the picker's backdrop, not the dock: the
  // picker closes, and the tab does not change.
  const hashBefore = await page.evaluate(() => window.location.hash)
  await page.mouse.click(
    railBox.x + railBox.width / 2,
    railBox.y + railBox.height / 2,
  )
  await page.waitForTimeout(250)
  const hashAfter = await page.evaluate(() => window.location.hash)
  if (hashAfter !== hashBefore) {
    throw new Error(
      `a tap behind the picker changed the tab (${hashBefore} to ${hashAfter})`,
    )
  }
  await expectGone(picker, 'the song picker after its backdrop was tapped')
  steps.push('room: the song picker is above the dock and swallows its taps')

  // Back closes it too, rather than leaving the room under it.
  await page.locator('[data-testid="shell-room-gear"]').click()
  await page.locator('[data-testid="sing-options-song"]').click()
  await expectVisible(picker, 'the song picker, opened again')
  const pickerBack = await pressBack(page)
  if (pickerBack !== 'room-overlay') {
    throw new Error(`Back over the song picker resolved as "${pickerBack}"`)
  }
  await expectGone(picker, 'the song picker after Back')
  steps.push('room: Back closes the picker rather than leaving the room')

  // ── And a leave that is NOT a park leaves the room usable ──
  await page.locator('[data-rail-item="rooms"]').click()
  await page.locator('[data-rail-item="stage"]').click()
  await expectVisible(
    page.locator('[data-testid="sing-room"]'),
    'the room after leaving and coming back',
  )
  steps.push('room: leaving with no run leaves the room usable')

  return steps
}

// ── Device round 2: the polish batch (R1-R7) ─────────────────
//
// Everything here is a thing the owner saw on a phone and the walk could not
// see at all: a second pitch readout under the HUD, a pill whose text sat at
// the top of it, a melody that could be loaded and never put down, a run that
// vanished when its melody ran out. Half of these are LAYOUT, so half of this
// reads boxes rather than pressing buttons — a screenshot of a squeezed row
// and a screenshot of a fine one are the same picture at a glance.

/**
 * Where the options sheet's first row starts, measured from the panel's top.
 *
 * The pre-R7 number, to the pixel: 1px border + 8px panel pad - 8px band
 * margin + a 16px band + the bar's 12px bottom margin, collapsed with this
 * sheet's own first row (review F6).
 */
const SHEET_CONTENT_TOP = 31

/** The box of one element, rounded, or null when it is not there. */
async function boxOf(page, selector) {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel)
    if (node === null) return null
    const rect = node.getBoundingClientRect()
    const round = (n) => Math.round(n * 100) / 100
    return {
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.width),
      height: round(rect.height),
      right: round(rect.right),
      bottom: round(rect.bottom),
      centreY: round(rect.y + rect.height / 2),
    }
  }, selector)
}

/**
 * Row 1, measured rather than assumed (R3, and the review's F3).
 *
 * The rule the stylesheet states: the key chip and the microphone chip never
 * clip, whatever is in them; the song chip may ellipsize but must keep its
 * floor and stay inside the row — and when the floor will not fit, it takes a
 * line of its own rather than squeezing the two beside it.
 *
 * The assertion this replaces read `.hudSlack`'s width against its own
 * `min-width`, which is a CSS invariant: `flex-shrink: 0` meant the spacer
 * could not be narrower than 12px whatever the chips did, so the step could
 * not fail — and it reported that floor as headroom while both chips beside
 * it were clipped (review F3).
 */
async function assertRow1(page, ctx, what) {
  const m = await page.evaluate(() => {
    const round = (n) => Math.round(n * 100) / 100
    const read = (sel) => {
      const el = document.querySelector(sel)
      if (el === null) return null
      const rect = el.getBoundingClientRect()
      // Every chip is `overflow: hidden`, so content wider than the box is
      // exactly what `scrollWidth > clientWidth` means — but the ellipsis
      // lives on the inner `.chipText` span where there is one, and the
      // outer box is whole while the span inside it is cut. Both are read.
      const boxes = [el, ...el.querySelectorAll('span')]
      const clip = boxes.reduce(
        (worst, box) => Math.max(worst, box.scrollWidth - box.clientWidth),
        0,
      )
      return {
        width: round(rect.width),
        top: round(rect.top),
        right: round(rect.right),
        clip,
        text: (el.textContent ?? '').trim(),
      }
    }
    const row = document.querySelector('[data-testid="sing-hud"]')
    if (row === null) return null
    const rowRect = row.getBoundingClientRect()
    return {
      row: { right: round(rowRect.right) },
      key: read('[data-testid="sing-key-chip"]'),
      mic: read('[data-testid="sing-state-chip"]'),
      song: read('[data-testid="sing-song-chip"]'),
    }
  })

  if (m === null || m.key === null || m.mic === null) {
    throw new Error(`row 1 has lost the key chip or the state chip (${what})`)
  }
  for (const [name, chip] of [
    ['the key chip', m.key],
    ['the state chip', m.mic],
  ]) {
    if (chip.clip > 1) {
      throw new Error(
        `${name} is clipped with ${what}: "${chip.text}" is ${chip.clip}px over its box`,
      )
    }
  }
  if (m.song === null) {
    return `room: row 1 clips neither the key nor the microphone, ${what}, at ${ctx.frame.width}`
  }
  if (m.song.width < 95) {
    throw new Error(
      `the song chip is ${m.song.width}px wide with ${what}, under its 96px floor`,
    )
  }
  if (m.song.right > m.row.right + 1) {
    throw new Error(
      `the song chip runs ${round2(m.song.right - m.row.right)}px past the end of row 1 with ${what}`,
    )
  }
  const wrapped = m.song.top > m.key.top + 4
  const clipped = m.song.clip > 1
  const note = `${clipped ? ', song ellipsized' : ''}${wrapped ? ', song on its own line' : ''}`
  return `room: row 1 whole with ${what} at ${ctx.frame.width} — key ${m.key.width}px, mic ${m.mic.width}px, song ${m.song.width}px${note}`
}

/** Two decimals, for a number that came out of a subtraction. */
function round2(n) {
  return Math.round(n * 100) / 100
}

/**
 * Which melody to walk with, and how fast it has to be played.
 *
 * `mode` is 'walk' — the longest melody still short enough to play to its end
 * inside a walk — or 'longest-name', the one whose name stresses row 1.
 */
async function pickMelody(page, mode = 'walk') {
  return page.evaluate((how) => {
    const items = [...document.querySelectorAll('.fn-modal-item')]
    const read = (item) => {
      const meta = item.querySelector('.fn-item-meta')?.textContent ?? ''
      const notes = Number(/(\d+)\s+notes/u.exec(meta)?.[1] ?? '0')
      const bpm = Number(/(\d+)\s+BPM/u.exec(meta)?.[1] ?? '0')
      return {
        name: item.querySelector('.fn-item-name')?.textContent ?? '',
        notes,
        bpm,
      }
    }
    const all = items.map(read).filter((entry) => entry.notes > 0)
    if (all.length === 0) return null
    if (how === 'longest-name') {
      return all.reduce((best, entry) =>
        entry.name.length > best.name.length ? entry : best,
      )
    }
    // The longest melody that is still short enough to play to its end inside
    // a walk: a Stop has to land before it finishes, and later on it has to
    // finish inside the poll below.
    const bounded = all.filter((entry) => entry.notes <= 64)
    const pool = bounded.length > 0 ? bounded : all
    return pool.reduce((best, entry) =>
      entry.notes > best.notes ? entry : best,
    )
  }, mode)
}

/** Drag a range input the way a finger does, and let Solid hear it. */
async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((node, next) => {
    const input = node
    input.value = String(next)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

/**
 * The veil at rest, in numbers (review F10).
 *
 * `sing-glass.test.ts` re-derives `(1 - glass) * heaviest` in JavaScript and
 * asserts on its own arithmetic; the CSS check only looks for the custom
 * property inside the block. Inverting the stylesheet to
 * `opacity: var(--mp-sing-glass)` leaves both of them green, and the probe
 * asserted only that the slider moved the number in the right direction. What
 * the room actually SHIPS at its default is this: 50% of a 50% black in
 * portrait — a quarter — and 50% of a 70% black in landscape.
 */
async function assertScrim(page, ctx) {
  const read = async () =>
    page.evaluate(() => {
      const node = document.querySelector('[data-testid="sing-scrim-dim"]')
      if (node === null) return null
      const style = getComputedStyle(node)
      return { opacity: style.opacity, colour: style.backgroundColor }
    })

  const want = (what, got, opacity, colour) => {
    if (got === null) throw new Error('the room has no dim scrim')
    if (got.opacity !== opacity || got.colour !== colour) {
      throw new Error(
        `the ${what} veil is ${got.opacity} over ${got.colour}, not ${opacity} over ${colour}`,
      )
    }
  }

  const portrait = await read()
  want('portrait', portrait, '0.5', 'rgba(0, 0, 0, 0.498)')

  // The same element, turned on its side: the kit's own 35% comes back,
  // because a landscape phone shows less of the photograph's dark half.
  await page.setViewportSize({
    width: ctx.frame.height,
    height: ctx.frame.width,
  })
  await page.waitForFunction(
    () => window.matchMedia('(orientation: landscape)').matches,
    undefined,
    { timeout: RUN_TIMEOUT_MS },
  )
  const landscape = await read()
  await page.setViewportSize({
    width: ctx.frame.width,
    height: ctx.frame.height,
  })
  await page.waitForFunction(
    () => window.matchMedia('(orientation: portrait)').matches,
    undefined,
    { timeout: RUN_TIMEOUT_MS },
  )
  want('landscape', landscape, '0.5', 'rgba(0, 0, 0, 0.7)')

  return `room: the veil at rest is ${portrait.opacity} over ${portrait.colour} portrait, ${landscape.colour} landscape`
}

async function walkRound2(page, ctx, steps) {
  const { frame } = ctx
  const near = (a, b, slack = 1) => Math.abs(a - b) <= slack

  await expectVisible(
    page.locator('[data-testid="sing-room"]'),
    'the Sing room for round 2',
  )
  await expectVisible(
    page.locator('[data-testid="sing-capsule"]'),
    'the capsule at the start of round 2',
  )

  // ── R5: the veil, at the value a fresh profile arrives with ──
  steps.push(await assertScrim(page, ctx))

  // ── R3: there is ONE pitch readout on the screen ──
  //
  // The room's live region carried `class="sr-only"`, a class this repository
  // defines in no stylesheet at all, so it rendered as ordinary text under the
  // HUD: a second "No voice", and a second note-and-cents while singing.
  const readouts = await page.evaluate(() => {
    const room = document.querySelector('[data-testid="sing-room"]')
    if (room === null) return { error: 'no room' }
    const leaves = [...room.querySelectorAll('*')].filter(
      (node) => node.children.length === 0,
    )
    const visible = leaves.filter((node) => {
      const rect = node.getBoundingClientRect()
      // The live region is clipped to a single pixel, which is the whole
      // point of it; anything a singer can actually read is bigger.
      return rect.width > 2 && rect.height > 2
    })
    const says = (node) => (node.textContent ?? '').includes('No voice')
    return {
      visible: visible.filter(says).length,
      hidden:
        leaves.filter((node) => says(node)).length -
        visible.filter(says).length,
    }
  })
  if (readouts.error !== undefined) throw new Error(readouts.error)
  if (readouts.visible !== 1) {
    throw new Error(`"No voice" is drawn ${readouts.visible} times, not once`)
  }
  if (readouts.hidden < 1) {
    throw new Error('the live region that says it to a screen reader is gone')
  }
  steps.push(
    'room: one visible "No voice", and the live region still speaks it',
  )

  // ── R3: the pill's text is centred in the pill ──
  const pill = await boxOf(page, '[data-testid="sing-note-chip"]')
  const pillBox = await boxOf(page, '[data-testid="sing-note-chip-box"]')
  if (pill === null || pillBox === null) throw new Error('no pitch pill')
  if (!near(pill.centreY, pillBox.centreY)) {
    throw new Error(
      `the pill's text sits ${Math.round((pillBox.centreY - pill.centreY) * 100) / 100}px off its centre`,
    )
  }
  if (pill.height < 44) {
    throw new Error(
      `the pill is ${pill.height} tall, not the taller pill R3 asked for`,
    )
  }
  const pillRow = await boxOf(page, '[data-testid="sing-hud-pill-row"]')
  if (pillRow === null) throw new Error('no pill row')
  if (!near(pill.x - pillRow.x, pillRow.right - pill.right, 1.5)) {
    throw new Error('the pill is not centred in its row')
  }
  steps.push(
    `room: the pitch pill is ${pill.height} tall, centred, and its text is centred in it`,
  )
  await shoot(page, ctx, 'r2-hud-rows')

  // ── R7: the sheet's grabber, and a tap on it ──
  await page.locator('[data-testid="shell-room-gear"]').click()
  await expectVisible(
    page.locator('[data-testid="sheet-handle"]'),
    'the sheet grabber',
  )
  const grabber = await boxOf(page, '[data-testid="sheet-handle"]')
  const band = await boxOf(page, '[data-testid="sheet-handle-zone"]')
  if (grabber === null || band === null) throw new Error('no sheet handle')
  if (grabber.width < 44 || grabber.height < 44) {
    throw new Error(
      `the grabber's target is ${grabber.width}x${grabber.height}, under 44`,
    )
  }
  // Whose element is under the thumb, asked of the page rather than the box.
  // The grabber answers at the band's centre; the sheet's first content row
  // answers 2 px into itself. Hung from the panel's top edge (0143fe56) the
  // 44 px target reached 16 px down over the first row of every sheet, and a
  // tap there closed the web More-tabs sheet instead of switching tab
  // (PR 859 review, item 7): the pre-PR placement, centred on the band and
  // clipped by the panel, is back.
  const reach = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="sheet-panel"]')
    const hit = document.querySelector('[data-testid="sheet-handle"]')
    const first = panel?.children[1]
    if (panel === null || hit === null || first === undefined) return null
    const band = hit.parentElement.getBoundingClientRect()
    const box = hit.getBoundingClientRect()
    const x = box.left + box.width / 2
    const at = (y) => {
      const node = document.elementFromPoint(x, y)
      return {
        grabber: node !== null && hit.contains(node),
        row: node !== null && first.contains(node),
        what:
          node === null
            ? 'nothing'
            : (node.getAttribute('data-testid') ?? node.tagName.toLowerCase()),
      }
    }
    const rowTop = first.getBoundingClientRect().top
    const r = (b) => [b.top, b.bottom].map((n) => Math.round(n * 10) / 10)
    return {
      boxes: {
        panel: r(panel.getBoundingClientRect()),
        band: r(band),
        hit: r(box),
        row: r(first.getBoundingClientRect()),
      },
      centre: at(band.top + band.height / 2),
      row: at(rowTop + 2),
      hitBottom: Math.round((box.bottom - rowTop) * 10) / 10,
    }
  })
  if (reach === null)
    throw new Error('no sheet panel to measure the grabber in')
  if (!reach.centre.grabber || !reach.row.row) {
    throw new Error(
      `the grabber's centre line: band centre ${reach.centre.what}, first row +2px ${reach.row.what} (target bottom ${reach.hitBottom}px from the row; ${JSON.stringify(reach.boxes)})`,
    )
  }
  // …and it costs the sheet nothing. R7 first shipped the target as the
  // band's own height, which pushed this sheet's content 28px down the
  // screen and every other sheet in the app with it (review F6). The number
  // is the pre-R7 one, measured from the panel's own top edge.
  const contentTop = await page.evaluate(() => {
    const panel = document.querySelector('[data-testid="sheet-panel"]')
    const first = panel?.children[1]
    if (panel === null || first === undefined) return null
    return (
      Math.round(
        (first.getBoundingClientRect().top -
          panel.getBoundingClientRect().top) *
          100,
      ) / 100
    )
  })
  if (contentTop === null) throw new Error('the sheet has no content row')
  if (Math.abs(contentTop - SHEET_CONTENT_TOP) > 1) {
    throw new Error(
      `the options sheet's content starts ${contentTop}px down, not ${SHEET_CONTENT_TOP}`,
    )
  }
  await shoot(page, ctx, 'r2-sheet-handle')
  await page.mouse.click(
    grabber.x + grabber.width / 2,
    grabber.y + grabber.height / 2,
  )
  await expectGone(
    page.locator('[data-testid="sheet-handle"]'),
    'the sheet after a tap on its grabber',
  )
  steps.push(
    `sheet: the grabber is ${grabber.width}x${grabber.height} over a ${band.height}px band, the grabber answers at the band's centre and the first row 2px into itself, content still ${contentTop}px down, and a tap closes`,
  )

  // ── R4: the pill opens Your takes, and Remove removes one ──
  const before = await storedTakes(page)
  if (before < 1) throw new Error('no kept takes to list')
  await page.locator('[data-testid="sing-note-chip"]').click()
  await expectVisible(
    page.locator('[data-testid="sing-takes-sheet"]'),
    'the takes sheet',
  )
  const rows = await page.locator('[data-testid="sing-takes-row"]').count()
  if (rows !== before) {
    throw new Error(`${rows} rows for ${before} kept takes`)
  }
  await shoot(page, ctx, 'r2-takes-sheet')
  await page.locator('[data-testid="sing-takes-remove"]').first().click()
  await page.waitForFunction(
    (want) =>
      document.querySelectorAll('[data-testid="sing-takes-row"]').length ===
      want,
    rows - 1,
    { timeout: RUN_TIMEOUT_MS },
  )
  const after = await storedTakes(page)
  if (after !== before - 1) {
    throw new Error(`Remove left ${after} takes stored, not ${before - 1}`)
  }
  steps.push(`room: the pill opens ${rows} takes, and Remove forgets one`)
  const takesBack = await pressBack(page)
  if (takesBack !== 'room-overlay') {
    throw new Error(`Back over the takes sheet resolved as "${takesBack}"`)
  }

  // ── R5: the room name chip opens the picker ──
  const chip = await boxOf(page, '[data-testid="shell-room-chip"]')
  if (chip === null) throw new Error('no room chip in the header')
  if (chip.height < 44) {
    throw new Error(`the room chip is ${chip.height} tall, under 44`)
  }
  const coverBefore = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector('[data-testid="sing-cover"]'))
        .backgroundImage,
  )
  await page.locator('[data-testid="shell-room-chip"]').click()
  await expectVisible(
    page.locator('[data-testid="sing-room-picker"]'),
    'the room picker',
  )
  await shoot(page, ctx, 'r2-room-picker')
  // One cover since S4: the B and mock takes are gone from the catalogue and
  // the binary. The picker and its veil slider stay, with the one entry in
  // them — asserted as a list, because "B is not offered" and "nothing is
  // offered" read the same to a check that only looks for B.
  const covers = await page
    .locator('[data-testid="sing-room-picker"] button[aria-pressed]')
    .allTextContents()
  if (covers.length !== 1 || !covers[0].includes('Retro Analog Studio')) {
    throw new Error(
      `the picker offers ${covers.length} cover(s): ${covers.map((text) => text.trim().slice(0, 40)).join(' / ')}`,
    )
  }
  if (covers.some((text) => /Studio B|\(mock\)/u.test(text))) {
    throw new Error('a retired Sing cover is still offered')
  }
  const coverNow = await page.evaluate(
    () =>
      getComputedStyle(document.querySelector('[data-testid="sing-cover"]'))
        .backgroundImage,
  )
  if (
    coverNow !== coverBefore ||
    !/\/sing\/retro-analog-studio(?:-portrait(?:-2x)?|-4k)?\.webp/u.test(
      coverNow,
    )
  ) {
    throw new Error(`the room's cover is ${coverNow}`)
  }
  steps.push(
    'room: the header chip opens the picker, which offers the one Retro Analog Studio cover',
  )

  // …and the veil slider moves the scrim it is for.
  const veil = async () =>
    Number(
      await page.evaluate(
        () =>
          getComputedStyle(
            document.querySelector('[data-testid="sing-scrim-dim"]'),
          ).opacity,
      ),
    )
  const veilBefore = await veil()
  await setRange(page, '[data-testid="sing-room-glass"]', 1)
  const veilOpen = await veil()
  await setRange(page, '[data-testid="sing-room-glass"]', 0)
  const veilShut = await veil()
  if (!(veilOpen < veilBefore && veilShut > veilBefore)) {
    throw new Error(
      `the veil read ${veilShut} / ${veilBefore} / ${veilOpen} across the slider`,
    )
  }
  await setRange(page, '[data-testid="sing-room-glass"]', 0.5)
  await shoot(page, ctx, 'r2-room-picker-veil')
  steps.push(
    `room: the veil slider moves the scrim (${veilShut} shut, ${veilBefore} default, ${veilOpen} open)`,
  )
  const pickerBack = await pressBack(page)
  if (pickerBack !== 'room-overlay') {
    throw new Error(`Back over the room picker resolved as "${pickerBack}"`)
  }

  // ── R1: a melody, and everything that happens to it ──
  //
  // THE TEMPO IS SET BY THE WALK, twice, and it has to be: picking a melody
  // adopts that melody's own BPM, and the library is short scales. The first
  // run is slowed so a Stop can land inside it; the second is set so the
  // melody runs out on its own inside a walk's patience while still holding
  // the three seconds of voice a take needs.
  //
  // `melody` is the one the run below is measured against; row 1 is stressed
  // with a different one in between and this melody is then loaded back, so
  // the timings the walk depends on are the ones this pick chose.
  let melody = null
  const tempoFor = (seconds) =>
    Math.min(220, Math.max(40, Math.round((melody.notes * 60) / seconds)))
  const openSongPicker = async () => {
    await page.locator('[data-testid="shell-room-gear"]').click()
    await page.locator('[data-testid="sing-options-song"]').click()
    await expectVisible(page.locator('.fn-modal-content'), 'the song picker')
  }
  const chooseMelody = async (name) => {
    await page.locator('.fn-modal-item', { hasText: name }).first().click()
    await expectText(
      page,
      '[data-testid="sing-song-chip"]',
      name,
      `the song chip on "${name}"`,
    )
  }

  await openSongPicker()
  melody = await pickMelody(page)
  if (melody === null) throw new Error('the song picker has no melodies in it')
  await chooseMelody(melody.name)
  await page.waitForFunction(
    () => window.mpSingRoom?.().melodyRun === true,
    undefined,
    { timeout: RUN_TIMEOUT_MS },
  )
  steps.push(
    `room: the Melody row loads "${melody.name}" and the chip names it`,
  )

  // Nothing in row 1 is clipped except, at most, the song name (R3).
  await shoot(page, ctx, 'r2-hud-with-song')
  steps.push(await assertRow1(page, ctx, `"${melody.name}"`))

  // The worst key the room's own sheet can produce, with that melody still
  // loaded. "C# harmonic minor" is the longest label `keyChipLabel` builds.
  await page.locator('[data-testid="shell-room-gear"]').click()
  await page.locator('[data-testid="sing-options-key"]').selectOption('C#')
  await page
    .locator('[data-testid="sing-options-scale"]')
    .selectOption('harmonic-minor')
  const keyBack = await pressBack(page)
  if (keyBack !== 'room-overlay') {
    throw new Error(`Back over the options sheet resolved as "${keyBack}"`)
  }
  await expectText(
    page,
    '[data-testid="sing-key-chip"]',
    'C# harmonic minor',
    'the key chip at its longest',
  )
  await shoot(page, ctx, 'r2-hud-longest-key')
  steps.push(await assertRow1(page, ctx, 'the longest key label'))

  // …and the longest melody name the library can hand it, at that same key.
  await openSongPicker()
  const longest = await pickMelody(page, 'longest-name')
  await chooseMelody(longest.name)
  await shoot(page, ctx, 'r2-hud-longest-name')
  steps.push(await assertRow1(page, ctx, `"${longest.name}"`))

  // Put the room back where the rest of the walk expects it: default key, and
  // the melody whose length the tempo below is computed from.
  await page.locator('[data-testid="shell-room-gear"]').click()
  await page.locator('[data-testid="sing-options-key"]').selectOption('C')
  await page.locator('[data-testid="sing-options-scale"]').selectOption('major')
  await pressBack(page)
  await openSongPicker()
  await chooseMelody(melody.name)

  // Slow it down, so the Stop below lands inside the melody rather than
  // after it — which would be the other test, by accident.
  await page.locator('[data-testid="shell-room-gear"]').click()
  await setRange(page, '[data-testid="sing-options-tempo"]', tempoFor(12))
  const slowBack = await pressBack(page)
  if (slowBack !== 'room-overlay') {
    throw new Error(`Back over the options sheet resolved as "${slowBack}"`)
  }
  await page.waitForFunction(
    () => (window.mpSingRoom?.().elapsedSeconds ?? 0) > 3.6,
    undefined,
    { timeout: RUN_TIMEOUT_MS },
  )
  const beforeStop = await page.evaluate(() => window.mpSingRoom?.())
  if (beforeStop?.state !== 'live') {
    throw new Error(
      `the melody ended before the Stop step could reach it (${beforeStop?.state})`,
    )
  }
  await page
    .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
    .click()
  await expectVisible(
    page.locator('[data-testid="sing-take-sheet"]'),
    'the end card for a melody take',
  )
  await page.locator('[data-testid="sing-take-keep"]').click()

  // …and the room comes back with the melody still loaded.
  await page.locator('[data-rail-item="rooms"]').click()
  await page.locator('[data-rail-item="stage"]').click()
  await expectVisible(
    page.locator('[data-testid="sing-song-chip"]'),
    'the song chip after re-entering',
  )
  const preview = await page.evaluate(() => {
    const stage = document.querySelector('[data-testid="sing-stage"]')
    return {
      view: stage?.getAttribute('data-view') ?? null,
      opacity: Number(getComputedStyle(stage).opacity),
      canvas: stage?.querySelector('canvas') !== null,
    }
  })
  if (preview.view !== 'melody-preview' || !preview.canvas) {
    throw new Error(`the staff is showing ${JSON.stringify(preview)}`)
  }
  if (!(preview.opacity < 1)) {
    throw new Error('the target line is not dimmed at rest')
  }
  await expectText(
    page,
    '[data-testid="sing-capsule"]',
    'Continue',
    'the capsule with a melody loaded',
  )
  await shoot(page, ctx, 'r2-melody-resting')
  steps.push(
    `room: the melody stays loaded — a dimmed target at ${preview.opacity} and a Continue capsule`,
  )

  // ── R1: it plays to its own end, and the card opens ──
  await page.locator('[data-testid="shell-room-gear"]').click()
  const tempo = tempoFor(8)
  await setRange(page, '[data-testid="sing-options-tempo"]', tempo)
  const gearBack = await pressBack(page)
  if (gearBack !== 'room-overlay') {
    throw new Error(`Back over the options sheet resolved as "${gearBack}"`)
  }
  await page.locator('[data-testid="sing-song-chip"]').click()
  await expectVisible(
    page.locator('[data-testid="sing-song-sheet"]'),
    'the song sheet',
  )
  await shoot(page, ctx, 'r2-song-sheet')
  await page.locator('[data-testid="sing-song-play-again"]').click()
  await page.waitForFunction(
    () => window.mpSingRoom?.().melodyRun === true,
    undefined,
    { timeout: RUN_TIMEOUT_MS },
  )
  steps.push(`room: Play again starts the same melody, at ${tempo} BPM`)

  // Nothing is pressed from here: the melody runs out on its own.
  await page.waitForFunction(
    () => window.mpSingRoom?.().cardOpen === true,
    undefined,
    { timeout: 120_000 },
  )
  await expectVisible(
    page.locator('[data-testid="sing-take-sheet"]'),
    'the end card when the melody ran out',
  )
  await shoot(page, ctx, 'r2-melody-end-card')
  steps.push(
    'room: a melody that reaches its end opens the card, exactly like Stop',
  )
  await page.locator('[data-testid="sing-take-keep"]').click()

  // ── R1: Remove puts it down, and the free tracker is back ──
  await page.locator('[data-testid="sing-song-chip"]').click()
  await page.locator('[data-testid="sing-song-remove"]').click()
  await expectGone(
    page.locator('[data-testid="sing-song-chip"]'),
    'the song chip after Remove',
  )
  await expectVisible(
    page.locator('[data-testid="sing-trace-silent"]'),
    'the silent trace after Remove',
  )
  const freed = await page.evaluate(() => window.mpSingRoom?.())
  if (freed?.melodyLoaded !== false || freed?.view !== 'silent') {
    throw new Error(`Remove left the room at ${JSON.stringify(freed)}`)
  }
  await expectText(
    page,
    '[data-testid="sing-capsule"]',
    'Sing a note',
    'the capsule after Remove',
  )
  await shoot(page, ctx, 'r2-free-tracker')
  steps.push('room: Remove unloads the melody and the free tracker is back')

  // ── R2: the session pill, with a long room name in it ──
  await page.locator('[data-testid="sing-capsule"]').click()
  await expectText(
    page,
    '[data-testid="sing-state-chip"]',
    'Listening',
    'the state chip before parking for the pill',
  )
  await page.locator('[data-testid="shell-chip"]').click()
  await page.locator('[data-column-item="progress"]').click()
  await expectVisible(
    page.locator('[data-testid="shell-session-pill"]'),
    'the session pill',
  )
  // ── The pill as the room writes it (review F13) ──
  //
  // This step used to write "The Very Long Retro Analog Studio Room Name"
  // into the pill and then assert it ellipsized: a test of the stylesheet
  // against a string the walk made up, blind to the production path and to
  // any real name that does not fit. It now measures the parked pill exactly
  // as the room left it, with the name the room registered, and then asks
  // the same question of every name the app can put there — so a future room
  // whose name overflows fails here, instead of shipping as "Retro Analog…".
  const readPill = () => {
    const round = (n) => Math.round(n * 100) / 100
    const at = (sel) => document.querySelector(sel)
    const button = at('[data-testid="shell-session-pill"]')
    const name = at('[data-testid="shell-session-pill-name"]')
    const state = at('[data-testid="shell-session-pill-state"]')
    const control = at('.mp-pill__btn')
    const rail = at('[data-testid="shell-rail"]')
    const box = (el) => {
      const rect = el.getBoundingClientRect()
      return {
        left: round(rect.left),
        top: round(rect.top),
        width: round(rect.width),
        height: round(rect.height),
        right: round(rect.right),
        bottom: round(rect.bottom),
      }
    }
    return {
      pill: box(button),
      control: box(control),
      railTop: rail === null ? null : round(rail.getBoundingClientRect().top),
      name: name.textContent,
      nameClipped: name.scrollWidth > name.clientWidth + 1,
      stateClipped: state.scrollWidth > state.clientWidth + 1,
      stateText: state.textContent,
      viewport: window.innerWidth,
    }
  }
  const real = await page.evaluate(readPill)
  await shoot(page, ctx, 'r2-session-pill')
  if (real.name !== ROOM_NAMES.sing) {
    throw new Error(
      `the pill names "${real.name}", not the room's own "${ROOM_NAMES.sing}"`,
    )
  }
  if (real.nameClipped) {
    throw new Error(
      `the room's real name "${real.name}" is clipped in the pill`,
    )
  }
  if (real.stateClipped) throw new Error('the state word is clipped')
  if (real.control.width < 44 || real.control.height < 44) {
    throw new Error(
      `the return control is ${real.control.width}x${real.control.height}`,
    )
  }
  if (
    real.control.left < real.pill.left - 0.5 ||
    real.control.right > real.pill.right + 0.5 ||
    real.control.top < real.pill.top - 0.5 ||
    real.control.bottom > real.pill.bottom + 0.5
  ) {
    throw new Error('the return control is not inside the pill')
  }
  if (real.pill.left < 0 || real.pill.right > real.viewport) {
    throw new Error('the pill runs off the side of the screen')
  }
  if (real.railTop !== null && real.pill.bottom > real.railTop) {
    throw new Error(
      `the pill's bottom (${real.pill.bottom}) runs into the rail (${real.railTop})`,
    )
  }

  // Every name the app can put in the pill, measured in the pill.
  const names = Object.entries(ROOM_NAMES)
  const fits = await page
    .locator('[data-testid="shell-session-pill-name"]')
    .evaluate((node, list) => {
      const original = node.textContent
      const clipped = []
      for (const [id, name] of list) {
        node.textContent = name
        if (node.scrollWidth > node.clientWidth + 1)
          clipped.push(`${id} "${name}"`)
      }
      node.textContent = original
      return clipped
    }, names)
  if (fits.length > 0) {
    throw new Error(
      `room name(s) that do not fit the session pill at ${real.viewport}: ${fits.join(', ')}`,
    )
  }
  steps.push(
    `pill: the real "${real.name} ·${real.stateText.replace(/^\s*·/u, '')}" at ${real.pill.width}x${real.pill.height}, the control ${real.control.width}x${real.control.height} inside it, ${real.railTop === null ? '' : `${Math.round((real.railTop - real.pill.bottom) * 10) / 10} px clear of the rail, `}and all ${names.length} room names fit whole`,
  )

  // And the stylesheet's own promise, labelled as exactly that: a name longer
  // than any room has today still leaves the state word whole and the control
  // at 44. Written by the walk, so it proves the CSS and nothing about names —
  // the check above is the one about names.
  const squeezed = await page
    .locator('[data-testid="shell-session-pill-name"]')
    .evaluate((node, longest) => {
      const original = node.textContent
      node.textContent = longest
      const state = document.querySelector(
        '[data-testid="shell-session-pill-state"]',
      )
      const control = document
        .querySelector('.mp-pill__btn')
        .getBoundingClientRect()
      const pill = document
        .querySelector('[data-testid="shell-session-pill"]')
        .getBoundingClientRect()
      const out = {
        nameClipped: node.scrollWidth > node.clientWidth + 1,
        stateClipped: state.scrollWidth > state.clientWidth + 1,
        control: { width: control.width, height: control.height },
        pillRight: pill.right,
      }
      node.textContent = original
      return out
    }, Object.values(ROOM_NAMES).join(' '))
  if (!squeezed.nameClipped) {
    throw new Error(
      'stylesheet: an over-long name did not overflow, so nothing was tested',
    )
  }
  if (squeezed.stateClipped) {
    throw new Error('stylesheet: an over-long name clips the state word')
  }
  if (squeezed.control.width < 44 || squeezed.control.height < 44) {
    throw new Error(
      `stylesheet: an over-long name squeezes the control to ${squeezed.control.width}x${squeezed.control.height}`,
    )
  }
  if (squeezed.pillRight > real.viewport) {
    throw new Error('stylesheet: an over-long name pushes the pill off screen')
  }
  steps.push(
    'pill (stylesheet, a name the walk wrote): an over-long name ellipsizes, the state word and the 44 pt control stay whole',
  )

  // Put the room back the way the rest of the walk expects it.
  await page.locator('[data-testid="shell-session-pill"]').click()
  await expectVisible(
    page.locator('[data-testid="shell-transport"] [aria-label="Play"]'),
    'the transport on return from the pill',
  )
  await page
    .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
    .click()
  if (await page.locator('[data-testid="sing-take-sheet"]').count()) {
    await page.locator('[data-testid="sing-take-keep"]').click()
  }
  await expectVisible(
    page.locator('[data-testid="sing-capsule"]'),
    'the capsule at the end of round 2',
  )

  return steps
}

/**
 * The denied path (3d), in a context whose microphone refuses.
 *
 * A separate context, because a refusal cannot be taken back — and the
 * refusal is installed at `getUserMedia` itself rather than through the
 * context's permissions, because Chromium is launched with
 * `--use-fake-ui-for-media-stream`, which auto-accepts every prompt. What is
 * thrown is exactly what a real denial throws, which is what the app reads.
 */
async function walkDenied(browser, args, frame) {
  const ctx = { ...args, frame }
  const context = await isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
      permissions: [],
    }),
  )
  const page = await context.newPage()
  await page.addInitScript(seed, args.theme)
  await page.addInitScript(() => {
    if (navigator.mediaDevices === undefined) return
    navigator.mediaDevices.getUserMedia = () => {
      const error = new Error('Permission denied')
      error.name = 'NotAllowedError'
      return Promise.reject(error)
    }
  })

  const steps = []
  try {
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page
      .locator('#root.loaded')
      .waitFor({ state: 'attached', timeout: BOOT_TIMEOUT_MS })
    await page.locator('[data-rail-item="stage"]').click()
    await expectVisible(
      page.locator('[data-testid="sing-room"]'),
      'the Sing room',
    )
    await page.locator('[data-testid="sing-capsule"]').click()
    await page.locator('[data-testid="sing-priming-continue"]').click()

    await expectVisible(
      page.locator('[data-testid="sing-denied"]'),
      'the denied state',
    )
    await expectVisible(
      page.locator('[data-testid="sing-trace-demo"]'),
      'the demo line',
    )
    await expectVisible(
      page.locator('[data-testid="sing-open-settings"]'),
      'Open Settings',
    )
    if ((await page.getByText('Explore the rooms').count()) === 0) {
      throw new Error('the denied state offers no way out')
    }
    await shoot(page, ctx, 'room-denied')
    steps.push(
      'room: a refused mic shows the demo line, Settings and a way out',
    )

    // And the rooms really do still open.
    await page.getByText('Explore the rooms').click()
    await page
      .locator('[data-rail-item="rooms"][aria-current="page"]')
      .waitFor({ state: 'visible', timeout: RUN_TIMEOUT_MS })
    steps.push('room: "Explore the rooms" leaves, so the app stays usable')
  } finally {
    await context.close()
  }
  const at = `${frame.width}x${frame.height}`
  return steps.map((step) => `[${at}] ${step}`)
}

/**
 * The remembered grant over an audio clock that will not start.
 *
 * Its own browser, because the autoplay flag every other walk runs with
 * (`--autoplay-policy=no-user-gesture-required`) is a launch argument and
 * this is the one walk that must not have it. But a desktop Chromium hands
 * over a running context anyway, so the flag's absence proves nothing on
 * Linux and the step could not fail: the clock is FORCED suspended here,
 * which is what iOS does to a context nobody has tapped for.
 *
 * The stub is the smallest lie that reproduces it — `state` reads
 * 'suspended' and `resume()` does nothing, so the device opens and the clock
 * does not. Lifting the stub is the gesture's half of the story: the chip's
 * tap then has a context that can actually start.
 */
async function walkSuspended(args, frame) {
  const tone = resolve(tmpdir(), 'mp-probe-voice.wav')
  const browser = await chromium.launch({
    headless: !args.headed,
    args: [
      '--class=agent-browser',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-audio-capture=${tone}`,
      '--mute-audio',
    ],
  })
  const ctx = { ...args, frame }
  const steps = []
  try {
    const context = await isolate(
      await browser.newContext({
        viewport: frame,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: args.theme,
        permissions: ['microphone'],
      }),
    )
    const page = await context.newPage()
    await page.addInitScript(seed, args.theme)
    await page.addInitScript(() => {
      // This phone has said yes before. That is the whole premise.
      try {
        localStorage.setItem('pitchperfect_sing_mic_granted', 'true')
      } catch {
        /* storage blocked */
      }
      // And its audio clock refuses to start without a gesture. `state` and
      // `resume` live on BaseAudioContext, so the descriptor is found by
      // walking up rather than assumed to be on AudioContext itself.
      window.__mpForceSuspended = true
      let owner = AudioContext.prototype
      let state = Object.getOwnPropertyDescriptor(owner, 'state')
      while (state === undefined && owner !== null) {
        owner = Object.getPrototypeOf(owner)
        state =
          owner === null
            ? undefined
            : Object.getOwnPropertyDescriptor(owner, 'state')
      }
      if (owner === null || state === undefined || state.get === undefined) {
        window.__mpForceSuspended = false
        return
      }
      const realState = state.get
      Object.defineProperty(owner, 'state', {
        configurable: true,
        get() {
          if (window.__mpForceSuspended === true) return 'suspended'
          return realState.call(this)
        },
      })
      const realResume = owner.resume
      owner.resume = function stubbedResume(...rest) {
        if (window.__mpForceSuspended === true) return Promise.resolve()
        return realResume.apply(this, rest)
      }
    })
    try {
      await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
      await page
        .locator('#root.loaded')
        .waitFor({ state: 'attached', timeout: BOOT_TIMEOUT_MS })
      if ((await page.evaluate(() => window.__mpForceSuspended)) !== true) {
        throw new Error('the audio clock could not be held suspended')
      }
      await page.locator('[data-rail-item="stage"]').click()
      await expectVisible(
        page.locator('[data-testid="sing-room"]'),
        'the Sing room',
      )

      // Two seconds of watching. Every sample has to hold the invariant, and
      // the clock really is suspended for all of them.
      let sawSuspended = false
      for (let i = 0; i < 20; i += 1) {
        const room = await page.evaluate(() => window.mpSingRoom?.())
        if (room === undefined) throw new Error('the room says nothing')
        if (room.chip === 'listening' && room.audioRunning !== true) {
          throw new Error(
            'the chip says Listening while the audio clock is suspended',
          )
        }
        if (room.audioRunning !== true) sawSuspended = true
        await page.waitForTimeout(100)
      }
      if (!sawSuspended) {
        throw new Error('the clock never read suspended: the stub did nothing')
      }
      await expectText(
        page,
        '[data-testid="sing-state-chip"]',
        'Mic off',
        'the state chip over a suspended clock',
      )
      await expectVisible(
        page.locator('[data-testid="sing-capsule"]'),
        'the capsule over a suspended clock',
      )
      await shoot(page, ctx, 'room-remembered-grant')
      steps.push(
        'room: a remembered grant over a suspended clock rests, mic off',
      )

      // The gesture's half: the clock can start again, and the chip is what
      // starts it — a tap on it is the one thing iOS resumes a context from.
      await page.evaluate(() => {
        window.__mpForceSuspended = false
      })
      const chip = page.locator('[data-testid="sing-state-chip"]')
      await chip.click()
      await page.waitForFunction(
        () => window.mpSingRoom?.().chip === 'listening',
        undefined,
        { timeout: RUN_TIMEOUT_MS },
      )
      const after = await page.evaluate(() => window.mpSingRoom?.())
      if (after?.audioRunning !== true) {
        throw new Error('the chip listens with the audio clock still suspended')
      }
      steps.push('room: a tap on the chip is the gesture that starts it')
    } finally {
      await context.close()
    }
  } finally {
    await browser.close()
  }
  const at = `${frame.width}x${frame.height}`
  return steps.map((step) => `[${at}] ${step}`)
}

/**
 * Back, pressed the way Android presses it.
 *
 * The shell's handler is registered with Capacitor and no browser can fire
 * it, so the bundle exposes it under `window.E2E_TEST_MODE` — which this walk
 * sets before the first script runs. Without this the back ORDER could only
 * be asserted by inference, and the bug it hides is exactly that: a press
 * that reports itself handled while doing nothing.
 */
// ── The alley (S4) ───────────────────────────────────────────
//
// The Rooms tab under the native build, walked the way a first-time singer
// meets it: a fresh context, so the welcome flag is unset and nothing has
// ever been tapped. Every step asserts what must be GONE and what must be
// KEPT — a screenshot of an alley whose doors lost their buttons looks
// exactly like one that kept them.

const ALLEY_DOORS = ['ear', 'piano', 'drums', 'karaoke', 'sing', 'guitar']

async function alleyNow(page) {
  return page.evaluate(() =>
    typeof window.mpAlley === 'function' ? window.mpAlley() : null,
  )
}

/** Assert both lists; the returned note goes into the step line. */
async function goneKept(page, where, { gone = [], kept = [] }) {
  for (const selector of gone) {
    if ((await page.locator(selector).count()) !== 0) {
      throw new Error(`${where}: ${selector} should be gone`)
    }
  }
  for (const selector of kept) {
    if ((await page.locator(selector).count()) === 0) {
      throw new Error(`${where}: ${selector} should be kept`)
    }
  }
  return `gone [${gone.join(' ')}] kept [${kept.join(' ')}]`
}

/** The middle of a door, from its key button (sized to the quad's box). */
async function doorCentre(page, key) {
  const door = page.locator(`[data-testid="alley-door-${key}"]`)
  await door.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  const box = await door.boundingBox()
  if (box === null) {
    const where = await page.evaluate(() => ({
      hash: window.location.hash,
      alley: typeof window.mpAlley === 'function' ? window.mpAlley() : null,
    }))
    throw new Error(`door ${key} has no box (${JSON.stringify(where)})`)
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function tapDoor(page, key, x = null) {
  const centre = await doorCentre(page, key)
  const at = { x: x ?? centre.x, y: centre.y }
  // Where the tap was aimed and where its click landed, for the failure
  // message: a door that did not answer is otherwise a bare phase mismatch.
  await page.evaluate(
    ([door, aim]) => {
      window.__mpTap = { door, aim, click: null }
      if (window.__mpTapWatch) return
      window.__mpTapWatch = true
      document.addEventListener(
        'click',
        (event) => {
          if (window.__mpTap?.click !== null) return
          const target = event.target
          window.__mpTap.click = {
            x: event.clientX,
            y: event.clientY,
            target:
              target instanceof Element
                ? (target.dataset.testid ?? target.className)
                : String(target),
          }
        },
        true,
      )
    },
    [key, at],
  )
  await page.touchscreen.tap(at.x, at.y)
}

/** What a failed door step needs to say: the tap, the doors, the viewport. */
async function tapReport(page) {
  return page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector)
      if (element === null) return null
      const b = element.getBoundingClientRect()
      return [b.left, b.top, b.width, b.height].map(
        (n) => Math.round(n * 10) / 10,
      )
    }
    const tapped = window.__mpTap ?? null
    const vv = window.visualViewport
    return {
      tap: tapped,
      door: tapped ? box(`[data-testid="alley-door-${tapped.door}"]`) : null,
      alley: box('[data-testid="rooms-alley"]'),
      band: box('[data-testid="alley-hit"]'),
      viewport: [window.innerWidth, window.innerHeight],
      scroll: [window.scrollX, window.scrollY],
      visual: vv ? [vv.offsetLeft, vv.offsetTop, vv.scale] : null,
      alleys: document.querySelectorAll('[data-testid="rooms-alley"]').length,
      alleyScroll: (() => {
        const root = document.querySelector('[data-testid="rooms-alley"]')
        return root === null ? null : [root.scrollLeft, root.scrollTop]
      })(),
    }
  })
}

async function waitPhase(page, phase, door, what) {
  await page
    .waitForFunction(
      ([p, d]) => {
        const s = typeof window.mpAlley === 'function' ? window.mpAlley() : null
        return s !== null && s.phase === p && (d === null || s.door === d)
      },
      [phase, door],
      { timeout: STEP_TIMEOUT_MS },
    )
    .catch(async () => {
      throw new Error(
        `${what}: expected ${phase}/${door}, alley says ${JSON.stringify(await alleyNow(page))}; ${JSON.stringify(await tapReport(page))}`,
      )
    })
}

/**
 * At rest the alley composites one picture: no door carries a transform, the
 * dim is not visible, and the plate is the 1x file at DPR 2 (S4 fix F5).
 * Null when all of that holds, otherwise what did not.
 */
async function restLayers(page) {
  return page.evaluate(() => {
    const doors = [...document.querySelectorAll('.mp-alley__door')]
    const moved = doors
      .filter((d) => getComputedStyle(d).transform !== 'none')
      .map((d) => d.dataset.door)
    const dim = getComputedStyle(
      document.querySelector('.mp-alley__dim'),
    ).visibility
    const plate = document
      .querySelector('[data-testid="alley-plate"]')
      .getAttribute('src')
    const problems = []
    if (doors.length !== 6) problems.push(`${doors.length} doors`)
    if (moved.length > 0) problems.push(`transformed at rest: ${moved}`)
    if (dim !== 'hidden') problems.push(`dim is ${dim}`)
    if (!plate.endsWith('/night-rooms-hero.webp'))
      problems.push(`plate ${plate}`)
    return problems.length === 0 ? null : problems.join(', ')
  })
}

/** Nothing on the page is making a sound or moving a picture. */
async function mediaPlaying(page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('audio, video')].filter((m) => !m.paused)
        .length,
  )
}

// ── The open's last frame is the room's own picture (device round 4) ──
//
// The Ear Lab's door grew the plate's tuning forks, about fourteen times
// their drawn size and blurred, and only then did the real room replace
// them. The clone now ends on the room's picture, and this is the proof: in
// one frame, once the clone has covered and the room's [data-room-background]
// is up under it, the clone holds that element's own picture — decoded,
// whole, the door's content under it at 0 — drawn to within half a pixel of
// where the element draws it (cover at its focal point, then the element's
// own transform). Sampled every frame from before Enter: the window between
// the room mounting and the clone going is a few hundred milliseconds.
function watchHandOver() {
  window.__mpHandOver = null
  const deadline = performance.now() + 8000
  const r2 = (n) => Math.round(n * 100) / 100
  const sample = () => {
    if (window.__mpHandOver !== null || performance.now() > deadline) return
    const clone = document.querySelector('[data-testid="alley-morph"]')
    const el = document.querySelector('[data-room-background]')
    const phase = clone?.dataset.phase
    const style = el === null ? null : getComputedStyle(el)
    const url =
      style === null
        ? null
        : (/url\(\s*(['"]?)(.*?)\1\s*\)/u.exec(style.backgroundImage)?.[2] ??
          null)
    if (
      clone === null ||
      url === null ||
      (phase !== 'covered' && phase !== 'revealing')
    ) {
      requestAnimationFrame(sample)
      return
    }
    const img = clone.querySelector('[data-testid="alley-morph-room"]')
    let expected = null
    let drawn = null
    if (img !== null && img.naturalWidth > 0) {
      // The element's own box, from its transformed rect and its transform.
      const m = /matrix\(([^)]+)\)/u.exec(style.transform)
      const [a, , , d, e, f] =
        m === null ? [1, 0, 0, 1, 0, 0] : m[1].split(',').map(Number)
      const [ox, oy] = style.transformOrigin.split(' ').map(Number.parseFloat)
      const box = el.getBoundingClientRect()
      const w = box.width / a
      const h = box.height / d
      const x = box.left - ox * (1 - a) - e
      const y = box.top - oy * (1 - d) - f
      const [fx, fy] = style.backgroundPosition
        .split(' ')
        .map((v) => Number.parseFloat(v) / 100)
      const iw = img.naturalWidth
      const ih = img.naturalHeight
      const s = Math.max(w / iw, h / ih)
      const left = (w - iw * s) * fx
      const top = (h - ih * s) * fy
      expected = [
        x + ox + a * (left - ox) + e,
        y + oy + d * (top - oy) + f,
        a * iw * s,
        d * ih * s,
      ].map(r2)
      const b = img.getBoundingClientRect()
      drawn = [b.left, b.top, b.width, b.height].map(r2)
    }
    window.__mpHandOver = {
      phase,
      room: clone.dataset.room ?? null,
      url: new URL(url, window.location.href).href,
      size: style.backgroundSize,
      src: img === null ? null : img.currentSrc || img.src,
      complete: img?.complete ?? false,
      natural: img === null ? null : [img.naturalWidth, img.naturalHeight],
      opacity: img === null ? null : getComputedStyle(img).opacity,
      door: [...clone.children]
        .filter((c) => c !== img)
        .map((c) => `${c.className} ${getComputedStyle(c).opacity}`),
      expected,
      drawn,
    }
  }
  requestAnimationFrame(sample)
}

/** What `watchHandOver` saw, asserted; the note goes into the step line. */
async function assertHandOver(page, what) {
  const got = await page
    .waitForFunction(() => window.__mpHandOver, null, { timeout: 8000 })
    .then((handle) => handle.jsonValue())
    .catch(() => null)
  if (got === null) {
    throw new Error(
      `${what}: never saw the clone covered over the room's own background`,
    )
  }
  const problems = []
  if (got.src !== got.url) {
    problems.push(`the clone holds ${got.src}, the room draws ${got.url}`)
  }
  if (!got.complete || !(got.natural?.[0] > 0)) {
    problems.push('the picture in the clone is not decoded')
  }
  if (got.opacity !== '1') problems.push(`the picture is at ${got.opacity}`)
  if (got.door.some((layer) => !layer.endsWith(' 0'))) {
    problems.push(`the door's own layers are still up: ${got.door.join(', ')}`)
  }
  if (got.size !== 'cover') problems.push(`the room draws at ${got.size}`)
  const off =
    got.expected === null || got.drawn === null
      ? Number.POSITIVE_INFINITY
      : Math.max(...got.expected.map((v, i) => Math.abs(v - got.drawn[i])))
  if (!(off <= 0.5)) {
    problems.push(
      `drawn at ${JSON.stringify(got.drawn)}, the room draws at ${JSON.stringify(got.expected)}`,
    )
  }
  if (problems.length > 0) {
    throw new Error(`${what}: ${problems.join('; ')} (${JSON.stringify(got)})`)
  }
  const file = got.url.replace(/^.*\//u, '')
  return `the clone's last frame (${got.phase}) is the room's own ${file} ${got.natural.join('x')}, at opacity ${got.opacity}, the door's layers at 0, within ${Math.round(off * 100) / 100} px of where the room draws it`
}

/** The door opens: the clone is up, then the room is, and the clone goes. */
async function walkOpen(page, ctx, name, room = '[data-testid="sing-room"]') {
  await page.evaluate(watchHandOver)
  await page.locator('[data-testid="alley-enter"]').tap()
  const mid = await page.evaluate(() => {
    const clone = document.querySelector('[data-testid="alley-morph"]')
    if (clone === null) return null
    return {
      motion: clone.dataset.motion,
      content: clone.dataset.content,
      inline: clone.style.transform,
      computed: getComputedStyle(clone).transform,
    }
  })
  if (mid === null) throw new Error(`${name}: no clone after Enter`)
  await shoot(page, ctx, `${name}-mid`)
  await page
    .waitForFunction(
      (selector) =>
        document.querySelector('[data-testid="alley-morph"]') === null &&
        document.querySelector(selector) !== null,
      room,
      { timeout: 8000 },
    )
    .catch(() => {
      throw new Error(`${name}: the room never replaced the clone`)
    })
  return { ...mid, handOver: await assertHandOver(page, name) }
}

async function walkAlley(browser, args, frame) {
  const ctx = { ...args, frame }
  const context = await isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
    }),
  )
  const failures = []
  const steps = []
  try {
    const page = await context.newPage()
    page.on('pageerror', (error) => {
      failures.push(`page error: ${error.message}`)
    })
    await page.addInitScript(seed, args.theme)
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('#root.loaded').waitFor({
      state: 'attached',
      timeout: BOOT_TIMEOUT_MS,
    })
    const alleyRoot = page.locator('[data-testid="rooms-alley"]')
    await alleyRoot.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await page.waitForTimeout(600)

    // ── First run ─────────────────────────────────────────────
    const doorKeys = ALLEY_DOORS.map((k) => `[data-testid="alley-door-${k}"]`)
    let note = await goneKept(page, 'first run', {
      gone: [
        '[data-testid="alley-title"]',
        '.mp-alley__panel.is-shown',
        '[data-onboarding-flow]',
        '[data-destination]',
        '[data-testid="home-heading"]',
      ],
      kept: [
        '[data-testid="alley-headline"]',
        '[data-testid="alley-plate"]',
        '[data-testid="alley-hit"]',
        ...doorKeys,
      ],
    })
    const first = await page.evaluate(() => ({
      headline: document.querySelector('[data-testid="alley-headline"]')
        ?.textContent,
      firstHeading: document.querySelector('.mp-alley h1')?.textContent,
      labels: [...document.querySelectorAll('.mp-alley__key')].map((k) =>
        k.getAttribute('aria-label'),
      ),
      plate: (() => {
        const b = document
          .querySelector('[data-testid="alley-plate"]')
          .getBoundingClientRect()
        return [b.left, b.top, b.right, b.bottom]
      })(),
      earLeft: document
        .querySelector('[data-testid="alley-door-ear"]')
        .getBoundingClientRect().left,
      width: window.innerWidth,
      height: window.innerHeight,
    }))
    if (first.headline !== 'Pick a room. Make a sound.') {
      throw new Error(`first run: the headline reads "${first.headline}"`)
    }
    if (first.labels.length !== 6 || first.labels.some((l) => !l)) {
      throw new Error(`first run: door labels ${JSON.stringify(first.labels)}`)
    }
    const singLabel = 'Sing, Retro Analog Studio. A live stage for your voice.'
    const karaokeLabel =
      'Karaoke, Broadway Theater. Coming soon. Sing your favorite songs.'
    if (
      !first.labels.includes(singLabel) ||
      !first.labels.includes(karaokeLabel)
    ) {
      throw new Error(`first run: door labels ${JSON.stringify(first.labels)}`)
    }
    // Cover-fit in portrait, and the Ear Lab's jamb on screen (S4 fix F6).
    const [pl, pt, pr, pb] = first.plate
    if (
      pl > 0.5 ||
      pt > 0.5 ||
      pr < first.width - 0.5 ||
      pb < first.height - 0.5
    ) {
      throw new Error(
        `first run: the plate does not cover ${JSON.stringify(first)}`,
      )
    }
    if (first.earLeft < 0) {
      throw new Error(`first run: the Ear Lab jamb is at x ${first.earLeft}`)
    }
    const quiet = await alleyNow(page)
    if (quiet.sources !== 0 || (await mediaPlaying(page)) !== 0) {
      throw new Error('first run: something is playing on arrival')
    }
    const atRest = await restLayers(page)
    if (atRest !== null) throw new Error(`first run: ${atRest}`)
    await shoot(page, ctx, 'alley-first-run')
    steps.push(
      `alley first run: headline, six labelled doors, plate covers, Ear Lab jamb at x ${first.earLeft.toFixed(1)}, silent, 1x plate, no door transformed, dim hidden; ${note}`,
    )

    // ── Select Sing ───────────────────────────────────────────
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'select Sing')
    const levels = []
    for (let i = 0; i < 24; i++) {
      levels.push((await alleyNow(page)).level)
      await page.waitForTimeout(50)
    }
    const rising = levels.some(
      (l, i) => i > 0 && l > levels[i - 1] && l > 0 && l < 0.85,
    )
    const top = Math.max(...levels)
    if (!rising || top < 0.8) {
      throw new Error(
        `select Sing: ambient gain did not rise to its level (${levels.map((l) => l.toFixed(3)).join(' ')})`,
      )
    }
    await page
      .waitForFunction(
        () => {
          const v = document.querySelector('[data-testid="alley-clip"]')
          return v !== null && v.readyState >= 2 && !v.paused
        },
        null,
        { timeout: STEP_TIMEOUT_MS },
      )
      .catch(() => {
        throw new Error('select Sing: the clip is not playing')
      })
    note = await goneKept(page, 'select Sing', {
      gone: ['[data-testid="alley-eyebrow"]'],
      kept: [
        '[data-testid="alley-enter"]',
        '.mp-alley__panel.is-shown',
        '.mp-alley__door.is-alive[data-door="sing"]',
        '[data-testid="alley-headline"]',
      ],
    })
    await expectText(
      page,
      '[data-testid="alley-name"]',
      'Sing · Retro Analog Studio',
      'the Sing card',
    )
    await page.waitForTimeout(300)
    await shoot(page, ctx, 'alley-sing-alive')
    steps.push(
      `alley select Sing: clip playing, ambient rising to ${top.toFixed(2)}, Enter; ${note}`,
    )

    // ── A resize while Sing is alive ──────────────────────────
    // The doors move; the Sing door's <video> is the same node and keeps
    // playing. A rebuilt door is a new, paused, unloaded clip.
    await page.evaluate(() => {
      const clip = document.querySelector('[data-testid="alley-clip"]')
      window.__mpClip = clip
      window.__mpClipAt = clip.currentTime
    })
    const grown = { width: frame.width + 19, height: frame.height + 63 }
    await page.setViewportSize(grown)
    await page.waitForTimeout(700)
    const resized = await page.evaluate(() => {
      const clip = document.querySelector('[data-testid="alley-clip"]')
      return {
        same: clip === window.__mpClip,
        connected: window.__mpClip.isConnected,
        paused: clip?.paused ?? null,
        advanced: (clip?.currentTime ?? 0) > window.__mpClipAt,
        width: document.querySelector('[data-testid="rooms-alley"]')
          ?.clientWidth,
        phase:
          typeof window.mpAlley === 'function' ? window.mpAlley().phase : null,
      }
    })
    await page.setViewportSize(frame)
    await page.waitForTimeout(400)
    const restored = await page.evaluate(
      () =>
        document.querySelector('[data-testid="alley-clip"]') ===
          window.__mpClip && !window.__mpClip.paused,
    )
    if (
      !resized.same ||
      !resized.connected ||
      resized.paused !== false ||
      !resized.advanced ||
      resized.width !== grown.width ||
      resized.phase !== 'alive' ||
      !restored
    ) {
      throw new Error(
        `resize while alive: ${JSON.stringify({ ...resized, restored })}`,
      )
    }
    steps.push(
      `alley resize to ${grown.width}x${grown.height} and back while Sing is alive: the same <video>, still playing, still alive`,
    )

    // ── Open ──────────────────────────────────────────────────
    const mid = await walkOpen(page, ctx, 'alley-open')
    if (mid.motion !== 'grow' || mid.content !== 'clip') {
      throw new Error(`open: the clone was ${JSON.stringify(mid)}`)
    }
    const afterOpen = await alleyNow(page)
    if (afterOpen.level !== 0 || afterOpen.sounding !== null) {
      throw new Error(
        `open: the ambient is still up ${JSON.stringify(afterOpen)}`,
      )
    }
    note = await goneKept(page, 'open', {
      gone: ['[data-testid="rooms-alley"]', '[data-testid="alley-morph"]'],
      kept: ['[data-testid="sing-room"]', '[data-testid="sing-cover"]'],
    })
    await page.waitForTimeout(300)
    await shoot(page, ctx, 'alley-sing-room')
    steps.push(
      `alley open: clone grew (${mid.content}), then the Sing room, clone gone, ambient 0; ${note}`,
    )
    steps.push(`alley open, Sing: ${mid.handOver}`)

    // ── Back ──────────────────────────────────────────────────
    const outcome = await pressBack(page)
    if (outcome !== 'history') throw new Error(`Back answered '${outcome}'`)
    await alleyRoot.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await waitPhase(page, 'rest', null, 'back')
    const flag = await page.evaluate(() =>
      localStorage.getItem('pitchperfect_native_welcome_seen'),
    )
    if (flag !== 'true') throw new Error(`back: the welcome flag is ${flag}`)
    note = await goneKept(page, 'back', {
      gone: [
        '[data-testid="alley-headline"]',
        '[data-testid="alley-morph"]',
        '[data-testid="sing-room"]',
      ],
      kept: ['[data-testid="alley-title"]', ...doorKeys],
    })
    await page.waitForTimeout(500)
    const settled = await restLayers(page)
    if (settled !== null) throw new Error(`back: ${settled}`)
    await shoot(page, ctx, 'alley-return')
    steps.push(
      `alley back: the alley at rest, no headline, flag set, doors untransformed once settled; ${note}`,
    )

    // ── Ear Lab at x = 8 ──────────────────────────────────────
    await tapDoor(page, 'ear', 8)
    await waitPhase(page, 'alive', 'ear', 'Ear Lab at x = 8')
    note = await goneKept(page, 'Ear Lab', {
      gone: ['[data-testid="alley-eyebrow"]'],
      kept: [
        '[data-testid="alley-enter"]',
        '.mp-alley__door.is-alive[data-door="ear"]',
      ],
    })
    await expectText(
      page,
      '[data-testid="alley-name"]',
      'Ear Lab · Workshop',
      'the Ear Lab card',
    )
    await page.waitForTimeout(400)
    await shoot(page, ctx, 'alley-ear-alive')
    steps.push(`alley Ear Lab at x = 8: selected, no eyebrow, Enter; ${note}`)

    // ── The Ear Lab opens onto its own room (device round 4) ──
    const earOpen = await walkOpen(
      page,
      ctx,
      'alley-ear-open',
      '[data-testid="ear-room-shell"]',
    )
    if (earOpen.motion !== 'grow' || earOpen.content !== 'paint') {
      throw new Error(`Ear Lab open: the clone was ${JSON.stringify(earOpen)}`)
    }
    await shoot(page, ctx, 'alley-ear-room')
    steps.push(`alley open, Ear Lab: ${earOpen.handOver}`)
    if ((await pressBack(page)) !== 'history') {
      throw new Error('Ear Lab open: Back did not return to the alley')
    }
    await alleyRoot.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await waitPhase(page, 'rest', null, 'Ear Lab open: back at rest')

    // ── Karaoke: locked ───────────────────────────────────────
    await tapDoor(page, 'karaoke')
    await waitPhase(page, 'selected', 'karaoke', 'Karaoke')
    await page.waitForTimeout(600)
    await expectText(
      page,
      '[data-testid="alley-eyebrow"]',
      'Coming soon',
      'the Karaoke eyebrow',
    )
    await expectText(
      page,
      '[data-testid="alley-line"]',
      'Sing your favorite songs.',
      'the Karaoke line',
    )
    const locked = await alleyNow(page)
    if (locked.sounding !== null || locked.level !== 0) {
      throw new Error(`Karaoke: sound is up ${JSON.stringify(locked)}`)
    }
    if ((await mediaPlaying(page)) !== 0) {
      throw new Error('Karaoke: a media element is still playing')
    }
    note = await goneKept(page, 'Karaoke', {
      gone: ['[data-testid="alley-enter"]', '.mp-alley__door.is-alive'],
      kept: [
        '[data-testid="alley-eyebrow"]',
        '.mp-alley__door.is-selected[data-door="karaoke"]',
      ],
    })
    await shoot(page, ctx, 'alley-karaoke-locked')
    steps.push(
      `alley Karaoke: Coming soon, its line, no Enter, nothing playing; ${note}`,
    )

    // ── An open called off: a rail tab at +150 ms ─────────────
    // The tab the user pointed at wins; the grow does not finish under it
    // and navigate to Sing (S4 fix F1).
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'rail mid-open: select Sing')
    await page.locator('[data-testid="alley-enter"]').tap()
    await page.waitForTimeout(150)
    await page.locator('[data-rail-item="progress"]').click()
    await page.waitForTimeout(1200)
    const railMid = await page.evaluate(() => ({
      hash: window.location.hash,
      clone: document.querySelector('[data-testid="alley-morph"]') !== null,
      alley: typeof window.mpAlley === 'function' ? window.mpAlley() : null,
    }))
    if (
      railMid.hash !== '#/progress' ||
      railMid.clone ||
      railMid.alley?.held !== false ||
      railMid.alley?.phase !== 'rest'
    ) {
      throw new Error(`rail mid-open: ${JSON.stringify(railMid)}`)
    }
    note = await goneKept(page, 'rail mid-open', {
      gone: [
        '[data-testid="alley-morph"]',
        '[data-testid="sing-room"]',
        '[data-testid="rooms-alley"]',
      ],
      kept: ['[data-rail-item="progress"][aria-current="page"]'],
    })
    steps.push(
      `alley Enter then rail Progress at +150 ms: on ${railMid.hash}, no clone, hold ${railMid.alley.held}; ${note}`,
    )
    await page.locator('[data-rail-item="rooms"]').click()
    await alleyRoot.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await waitPhase(page, 'rest', null, 'rail mid-open: back to Rooms')

    // ── An open called off: Back ──────────────────────────────
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'Back mid-open: select Sing')
    await page.locator('[data-testid="alley-enter"]').tap()
    await page.waitForTimeout(150)
    const midBack = await pressBack(page)
    if (midBack !== 'door-open') {
      throw new Error(`Back mid-open answered '${midBack}'`)
    }
    await page.waitForTimeout(1200)
    const backMid = await page.evaluate(() => ({
      hash: window.location.hash,
      clone: document.querySelector('[data-testid="alley-morph"]') !== null,
      alley: typeof window.mpAlley === 'function' ? window.mpAlley() : null,
    }))
    if (
      backMid.clone ||
      backMid.alley?.held !== false ||
      backMid.alley?.phase !== 'rest' ||
      backMid.alley?.sounding !== null ||
      (await mediaPlaying(page)) !== 0
    ) {
      throw new Error(`Back mid-open: ${JSON.stringify(backMid)}`)
    }
    note = await goneKept(page, 'Back mid-open', {
      gone: [
        '[data-testid="alley-morph"]',
        '[data-testid="sing-room"]',
        '.mp-alley__panel.is-shown',
      ],
      kept: [
        '[data-testid="rooms-alley"]',
        '[data-testid="alley-clip"]',
        ...doorKeys,
      ],
    })
    steps.push(
      `alley Enter then Back at +150 ms: '${midBack}', the alley at rest, nothing playing, hold ${backMid.alley.held}; ${note}`,
    )

    // ── The alley does not scroll ─────────────────────────────
    // The Guitar spill makes .mp-alley wider than the screen. Under overflow:
    // hidden it is still a scroll container, and a scrollIntoView (Playwright's
    // own actionability retry calls one) moves every door while the plate tap
    // is mapped against the unscrolled box: the next tap picks the door to the
    // left.
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'no scroll: select Sing')
    const shifted = await page.evaluate(() => {
      document
        .querySelector('[data-testid="alley-enter"]')
        ?.scrollIntoView({ block: 'start', inline: 'start' })
      const root = document.querySelector('[data-testid="rooms-alley"]')
      return root === null ? null : [root.scrollLeft, root.scrollTop]
    })
    if (shifted === null || shifted[0] !== 0 || shifted[1] !== 0) {
      throw new Error(
        `no scroll: a scrollIntoView on Enter moved the alley to ${JSON.stringify(shifted)}`,
      )
    }
    await page.keyboard.press('Escape')
    await waitPhase(page, 'rest', null, 'no scroll: Escape')
    steps.push(
      'alley no scroll: a scrollIntoView on Enter leaves the alley at 0,0',
    )

    // ── An open called off: More at +150 ms ───────────────────
    // More is not a tab, so goToTab never sees it: the capture-phase press
    // outside the alley is what calls the open off. The sheet opens over the
    // alley at rest, not over a room the grow went on to open.
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'More mid-open: select Sing')
    const homeHash = await page.evaluate(() => window.location.hash)
    await page.locator('[data-testid="alley-enter"]').tap()
    await page.waitForTimeout(150)
    await page.locator('[data-rail-item="more"]').click()
    await page.waitForTimeout(1200)
    const moreMid = await page.evaluate(() => ({
      hash: window.location.hash,
      clone: document.querySelector('[data-testid="alley-morph"]') !== null,
      sheet: document.querySelector('[data-more-item="developer"]') !== null,
      alley: typeof window.mpAlley === 'function' ? window.mpAlley() : null,
    }))
    if (
      moreMid.hash !== homeHash ||
      !moreMid.sheet ||
      moreMid.clone ||
      moreMid.alley?.phase !== 'rest' ||
      moreMid.alley?.held !== false
    ) {
      throw new Error(
        `More mid-open: ${JSON.stringify({ homeHash, ...moreMid })}`,
      )
    }
    note = await goneKept(page, 'More mid-open', {
      gone: ['[data-testid="alley-morph"]', '[data-testid="sing-room"]'],
      kept: ['[data-testid="rooms-alley"]', '[data-more-item="developer"]'],
    })
    const closed = await pressBack(page)
    if (closed !== 'sheet')
      throw new Error(`More mid-open: Back answered '${closed}'`)
    steps.push(
      `alley Enter then More at +150 ms: stays on ${moreMid.hash} with the sheet open, the alley at rest, hold ${moreMid.alley.held}; ${note}`,
    )

    // ── A door picked, then More (PR 859 review, items 5 and 38) ─
    // The alley stays mounted under the sheet: only a tab change unmounts it.
    // A picked door's ambient and clip once played on under More and under
    // Settings. Covered, the door goes back into the plate and falls silent,
    // and the clip lets go of its source.
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'More over a door: select Sing')
    await page
      .waitForFunction(() => window.mpAlley().level > 0.1, null, {
        timeout: STEP_TIMEOUT_MS,
      })
      .catch(async () => {
        throw new Error(
          `More over a door: the ambient never rose (${JSON.stringify(await alleyNow(page))})`,
        )
      })
    await page.locator('[data-rail-item="more"]').click()
    await page.waitForTimeout(700)
    const under = await page.evaluate(() => {
      const clip = document.querySelector('[data-testid="alley-clip"]')
      return {
        alley: window.mpAlley(),
        sheet: document.querySelector('[data-more-item="developer"]') !== null,
        clipPaused: clip?.paused ?? null,
        clipSrc: clip?.getAttribute('src') ?? null,
      }
    })
    const playingUnder = await mediaPlaying(page)
    if (
      !under.sheet ||
      under.alley.phase !== 'rest' ||
      under.alley.level !== 0 ||
      under.alley.sounding !== null ||
      under.clipPaused !== true ||
      under.clipSrc !== null ||
      playingUnder !== 0
    ) {
      throw new Error(
        `More over a door: ${JSON.stringify({ ...under, playingUnder })}`,
      )
    }
    const shut = await pressBack(page)
    if (shut !== 'sheet')
      throw new Error(`More over a door: Back answered '${shut}'`)
    await page.waitForTimeout(300)
    const back = await alleyNow(page)
    if (back.phase !== 'rest' || back.level !== 0) {
      throw new Error(`More over a door, closed: ${JSON.stringify(back)}`)
    }
    steps.push(
      `alley Sing picked then More: ambient ${under.alley.level}, clip paused with no source, alley ${under.alley.phase}; More closed, alley ${back.phase} at ${back.level}`,
    )

    // ── Back with a door picked (PR 859 review, item 6) ────────
    // The card is the alley's overlay: Back puts the door back, as Escape
    // does. It once fell through to 'history' or, at the root, 'minimize'.
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'Back over a door: select Sing')
    const pickedHash = await page.evaluate(() => window.location.hash)
    const backAnswer = await pressBack(page)
    const afterBack = await page.evaluate(() => ({
      hash: window.location.hash,
      alley: window.mpAlley(),
      card: document.querySelector('[data-testid="alley-card"]') !== null,
    }))
    if (
      backAnswer !== 'door-cleared' ||
      afterBack.hash !== pickedHash ||
      afterBack.alley.phase !== 'rest' ||
      afterBack.card
    ) {
      throw new Error(
        `Back over a door: answered '${backAnswer}', ${JSON.stringify({ pickedHash, ...afterBack })}`,
      )
    }
    steps.push(
      `alley Sing picked then Back: answered '${backAnswer}', still on ${afterBack.hash}, alley ${afterBack.alley.phase}, no card`,
    )

    // ── A rail tab after the cover (PR 859 review, items 21 and 29) ─
    // Covered, the open cannot be called off: the room is being mounted. A
    // rail tab in the wait for the room's background once left Progress under
    // an opaque clone for up to 1.7 s. The clone has to get out of the way.
    // The room's background never shows up here (its mark is taken off as
    // it mounts, as for a room still loading), so the clone is still waiting
    // on it when Progress is tapped. A room that draws fast would reveal on
    // its own, and one that mounts and then unmounts ends the wait by being
    // gone: only the open's own watch on the tab can end this one.
    await page.evaluate(() => {
      const strip = (root) => {
        for (const el of root.querySelectorAll('[data-room-background]')) {
          el.removeAttribute('data-room-background')
        }
      }
      strip(document)
      window.__mpUnmark = new MutationObserver(() => strip(document))
      window.__mpUnmark.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-room-background'],
      })
    })
    await tapDoor(page, 'sing')
    await waitPhase(
      page,
      'alive',
      'sing',
      'Progress after the cover: select Sing',
    )
    await page.locator('[data-testid="alley-enter"]').tap()
    await page.waitForTimeout(600)
    const coveredAt = await page.evaluate(() => ({
      clone:
        document.querySelector('[data-testid="alley-morph"]')?.dataset.phase ??
        null,
      alley: window.mpAlley?.().phase ?? null,
    }))
    await page.locator('[data-rail-item="progress"]').click()
    await page.waitForTimeout(200)
    const progressAfter = await page.evaluate(() => ({
      hash: window.location.hash,
      clone: document.querySelector('[data-testid="alley-morph"]') !== null,
    }))
    await page.evaluate(() => {
      window.__mpUnmark.disconnect()
    })
    if (
      coveredAt.clone !== 'covered' ||
      !progressAfter.hash.includes('progress') ||
      progressAfter.clone
    ) {
      throw new Error(
        `Progress after the cover: ${JSON.stringify({ coveredAt, ...progressAfter })}`,
      )
    }
    await page.locator('[data-rail-item="rooms"]').click()
    await waitPhase(page, 'rest', null, 'Progress after the cover: Rooms again')
    steps.push(
      `alley Enter, room not drawn, rail Progress at +600 ms (clone ${coveredAt.clone}): on ${progressAfter.hash}, no clone 200 ms later`,
    )

    // ── Reduced motion ────────────────────────────────────────
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page
      .locator('.mp-shell[data-reduced="on"]')
      .waitFor({ state: 'attached', timeout: STEP_TIMEOUT_MS })
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'reduced: select Sing')
    await page.waitForTimeout(300)
    const still = await walkOpen(page, ctx, 'alley-reduced-open')
    if (
      still.motion !== 'crossfade' ||
      still.inline !== '' ||
      still.computed !== 'none'
    ) {
      throw new Error(`reduced: the clone moved ${JSON.stringify(still)}`)
    }
    note = await goneKept(page, 'reduced open', {
      gone: ['[data-testid="alley-morph"]', '[data-testid="rooms-alley"]'],
      kept: ['[data-testid="sing-room"]'],
    })
    steps.push(
      `alley reduced motion: a crossfade, no transform on the clone; ${note}`,
    )
    steps.push(`alley reduced motion, Sing: ${still.handOver}`)
    if ((await pressBack(page)) !== 'history') {
      throw new Error('reduced: Back did not return to the alley')
    }
    await alleyRoot.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })

    // ── Reduced motion: the crossfade runs (PR 859 review, item 31) ─
    // Sampled every frame from the frame after the clone is appended, and
    // never read before then: a style read in that window is what made a
    // transition start and hid the hard cut. Under the OS setting app.css
    // cuts every CSS transition to 0.001 ms, so only an animation that is
    // not a transition shows a value between 0 and 1 here.
    await waitPhase(page, 'rest', null, 'reduced fade: back at rest')
    await page.evaluate(() => {
      window.__mpFade = []
      const seen = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof HTMLElement)) continue
            if (node.dataset.testid !== 'alley-morph') continue
            seen.disconnect()
            let frames = 0
            const sample = () => {
              window.__mpFade.push(Number(getComputedStyle(node).opacity))
              frames += 1
              if (frames < 16 && node.isConnected) requestAnimationFrame(sample)
            }
            requestAnimationFrame(sample)
          }
        }
      })
      seen.observe(document.body, { childList: true })
    })
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'reduced fade: select Sing')
    await page.locator('[data-testid="alley-enter"]').tap()
    await page.waitForTimeout(500)
    const fades = await page.evaluate(() => window.__mpFade)
    const between = fades.filter((o) => o > 0 && o < 1)
    if (between.length === 0) {
      throw new Error(
        `reduced fade: no frame between 0 and 1 (${fades.map((o) => o.toFixed(2)).join(' ')})`,
      )
    }
    await page
      .locator('[data-testid="sing-room"]')
      .waitFor({ state: 'attached', timeout: STEP_TIMEOUT_MS })
    steps.push(
      `alley reduced motion crossfade: ${between.length} frames mid-fade (${fades
        .slice(0, 8)
        .map((o) => o.toFixed(2))
        .join(' ')})`,
    )
    if ((await pressBack(page)) !== 'history') {
      throw new Error('reduced fade: Back did not return to the alley')
    }
    await alleyRoot.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    // ── The clip's first frame (PR 859 review, item 12) ────────
    // In its door the loop is cover-fit to the art box; the clone's box is
    // cover-fit to the screen, and both are warped onto the same quad at the
    // start of the grow. The clone has to start on the door's crop, or the
    // first frame after Enter shows 2.7 times as much of the loop, squeezed.
    // The grow is held at that frame (no animation frame runs) for the shot.
    await waitPhase(page, 'rest', null, 'clip crop: back at rest')
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'clip crop: select Sing')
    await page
      .waitForFunction(
        () => {
          const v = document.querySelector('[data-testid="alley-clip"]')
          return v !== null && !v.paused && v.videoWidth > 0
        },
        null,
        { timeout: STEP_TIMEOUT_MS },
      )
      .catch(() => {
        throw new Error('clip crop: the Sing clip never played')
      })
    await page.waitForTimeout(400)
    const doorCrop = await page.evaluate(() => {
      const v = document.querySelector('[data-testid="alley-clip"]')
      const art = v.parentElement
      const w = Number.parseFloat(art.style.width)
      const h = Number.parseFloat(art.style.height)
      const k = Math.max(w / v.videoWidth, h / v.videoHeight)
      return {
        x: (v.videoWidth - w / k) / 2,
        y: (v.videoHeight - h / k) / 2,
        w: w / k,
        h: h / k,
      }
    })
    await shoot(page, ctx, 'alley-clip-before-enter')
    // Item 14: a lifted door is its own box, not the screen's, so it is
    // composited door-sized (CDP layer tree: 393x852 before, 130x362 after).
    const lifted = await page.evaluate(() => {
      const door = document.querySelector('.mp-alley__door.is-selected')
      const key = document.querySelector('[data-testid="alley-door-sing"]')
      const a = door.getBoundingClientRect()
      const k = key.getBoundingClientRect()
      return {
        w: door.offsetWidth,
        h: door.offsetHeight,
        screen: window.innerWidth * window.innerHeight,
        holdsKey:
          a.left <= k.left + 1 &&
          a.top <= k.top + 1 &&
          a.right >= k.right - 1 &&
          a.bottom >= k.bottom - 1,
      }
    })
    if (lifted.w * lifted.h * 2 > lifted.screen || !lifted.holdsKey) {
      throw new Error(`lifted door box: ${JSON.stringify(lifted)}`)
    }
    await page.evaluate(() => {
      window.__mpRaf = window.requestAnimationFrame
      window.requestAnimationFrame = () => 0
      window.__mpClipFirst = null
      const seen = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof HTMLElement)) continue
            if (node.dataset.testid !== 'alley-morph') continue
            seen.disconnect()
            window.__mpClipFirst = {
              transform: node.querySelector('video')?.style.transform ?? '',
              w: node.style.width,
              h: node.style.height,
            }
          }
        }
      })
      seen.observe(document.body, { childList: true })
    })
    await page.locator('[data-testid="alley-enter"]').tap()
    await shoot(page, ctx, 'alley-clip-first-frame')
    const clipFirst = await page.evaluate(() => {
      window.requestAnimationFrame = window.__mpRaf
      return window.__mpClipFirst
    })
    const [kx, , , ky, tx, ty] = (clipFirst?.transform ?? '')
      .replace(/^matrix\(|\)$/gu, '')
      .split(',')
      .map(Number)
    const cloneCrop = {
      x: -tx / kx,
      y: -ty / ky,
      w: Number.parseFloat(clipFirst?.w) / kx,
      h: Number.parseFloat(clipFirst?.h) / ky,
    }
    const off = Math.max(
      ...['x', 'y', 'w', 'h'].map((k) => Math.abs(cloneCrop[k] - doorCrop[k])),
    )
    if (!(off <= 1)) {
      throw new Error(
        `clip crop: door ${JSON.stringify(doorCrop)}, clone's first frame ${JSON.stringify({ ...cloneCrop, clipFirst })}`,
      )
    }
    await page
      .waitForFunction(
        () =>
          document.querySelector('[data-testid="alley-morph"]') === null &&
          document.querySelector('[data-testid="sing-room"]') !== null,
        null,
        { timeout: 8000 },
      )
      .catch(() => {
        throw new Error('clip crop: the room never replaced the clone')
      })
    if ((await pressBack(page)) !== 'history') {
      throw new Error('clip crop: Back did not return to the alley')
    }
    await alleyRoot.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    const r = (v) => Math.round(v * 10) / 10
    steps.push(
      `alley clip first frame: the door showed source ${r(doorCrop.x)},${r(doorCrop.y)} ${r(doorCrop.w)}x${r(doorCrop.h)}, the clone's first frame ${r(cloneCrop.x)},${r(cloneCrop.y)} ${r(cloneCrop.w)}x${r(cloneCrop.h)} (${r(off)} source px apart); shots alley-clip-before-enter, alley-clip-first-frame; the lifted door's own box ${lifted.w}x${lifted.h}`,
    )

    // ── Developer: Replay the welcome ─────────────────────────
    await page.locator('[data-rail-item="more"]').click()
    const developerTile = page.locator('[data-more-item="developer"]')
    await developerTile.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await developerTile.click()
    const replay = page.locator('[data-testid="dev-replay-welcome"]')
    await replay.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await replay.click()
    await page
      .locator('[data-testid="alley-headline"]')
      .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    const cleared = await page.evaluate(() =>
      localStorage.getItem('pitchperfect_native_welcome_seen'),
    )
    if (cleared !== 'false') {
      throw new Error(`replay: the welcome flag is ${cleared}`)
    }
    note = await goneKept(page, 'replay', {
      gone: ['[data-testid="shell-developer"]', '[data-testid="alley-title"]'],
      kept: ['[data-testid="alley-headline"]', ...doorKeys],
    })
    await page.waitForTimeout(400)
    await shoot(page, ctx, 'alley-replayed')
    steps.push(
      `alley Developer "Replay the welcome": flag cleared, headline back; ${note}`,
    )

    // ── The keyboard ──────────────────────────────────────────
    // The skip link lands on the alley (<main> is empty on this tab), a door
    // picked from the keyboard shows its card with a ring, and Escape puts
    // it back with its sound (S4 fix F8).
    const hashBefore = await page.evaluate(() => window.location.hash)
    await page.locator('.skip-link').focus()
    await page.keyboard.press('Enter')
    const skipped = await page.evaluate(() => ({
      focus: document.activeElement?.dataset?.testid ?? null,
      hash: window.location.hash,
    }))
    if (skipped.focus !== 'rooms-alley' || skipped.hash !== hashBefore) {
      throw new Error(`skip link: ${JSON.stringify(skipped)}`)
    }
    await page.keyboard.press('Tab')
    const firstKey = await page.evaluate(
      () => document.activeElement?.dataset?.testid ?? null,
    )
    if (firstKey !== 'alley-door-ear') {
      throw new Error(`skip link, then Tab: focus on ${firstKey}`)
    }
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await waitPhase(page, 'alive', 'sing', 'keyboard: Sing')
    await page.waitForTimeout(500)
    const ring = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="alley-card"]')
      const style = getComputedStyle(card)
      return {
        focused: document.activeElement === card,
        outline: `${style.outlineStyle} ${style.outlineWidth}`,
      }
    })
    if (!ring.focused || !ring.outline.startsWith('solid')) {
      throw new Error(
        `keyboard: the card shows no focus ${JSON.stringify(ring)}`,
      )
    }
    const keyLevel = (await alleyNow(page)).level
    await page.keyboard.press('Escape')
    await waitPhase(page, 'rest', null, 'keyboard: Escape')
    const refocused = await page.evaluate(
      () => document.activeElement?.dataset?.testid ?? null,
    )
    if (refocused !== 'alley-door-sing') {
      throw new Error(`Escape: focus went to ${refocused}, not the Sing door`)
    }
    await page.waitForTimeout(700)
    const hushed = await alleyNow(page)
    if (hushed.level !== 0 || hushed.sounding !== null) {
      throw new Error(
        `Escape: the ambient is still up ${JSON.stringify(hushed)}`,
      )
    }
    note = await goneKept(page, 'Escape', {
      gone: ['.mp-alley__panel.is-shown', '.mp-alley__door.is-alive'],
      kept: doorKeys,
    })
    steps.push(
      `alley keyboard: skip link focuses the alley (hash kept), Tab reaches the Ear Lab, Enter on Sing shows the card with a ${ring.outline} ring, Escape puts it back (ambient ${keyLevel.toFixed(2)} to 0, focus on the Sing door); ${note}`,
    )
  } catch (error) {
    failures.push(error.message)
  } finally {
    await context.close()
  }
  if (failures.length > 0) throw new Error(failures.join('; '))
  const at = `${frame.width}x${frame.height}`
  return steps.map((step) => `[${at}] ${step}`)
}

// ── The headline block takes no door taps ───────────────────
//
// Under a tall safe area (59 px on a Dynamic Island phone) the headline
// block reaches down over the tops of the doors. The tap band starts at the
// block's measured bottom, so a tap on the subline opens nothing, and it
// clears a door that was out.
const SAFE_TOP_FRAMES = [
  { width: 393, height: 852, safeTop: 59 },
  { width: 375, height: 667, safeTop: 20 },
]

async function walkAlleySafeTop(browser, args, frame) {
  const context = await isolate(
    await browser.newContext({
      viewport: { width: frame.width, height: frame.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
    }),
  )
  const failures = []
  let step = null
  try {
    const page = await context.newPage()
    page.on('pageerror', (error) => {
      failures.push(`page error: ${error.message}`)
    })
    await page.addInitScript(seed, args.theme)
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('#root.loaded').waitFor({
      state: 'attached',
      timeout: BOOT_TIMEOUT_MS,
    })
    await page
      .locator('[data-testid="alley-subline"]')
      .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await page.evaluate((px) => {
      document.documentElement.style.setProperty('--safe-top', `${px}px`)
    }, frame.safeTop)
    await page.waitForTimeout(500)
    const measure = () =>
      page.evaluate(() => {
        const box = (id) =>
          document
            .querySelector(`[data-testid="${id}"]`)
            .getBoundingClientRect()
        const doors = [...document.querySelectorAll('.mp-alley__key')].map(
          (k) => k.getBoundingClientRect().top,
        )
        return {
          sublineBottom: box('alley-subline').bottom,
          topBottom: box('alley-top').bottom,
          bandTop: box('alley-hit').top,
          highestDoor: Math.min(...doors),
        }
      })
    const m = await measure()
    const subline = await page
      .locator('[data-testid="alley-subline"]')
      .boundingBox()
    // Its last line, where it comes closest to the doors.
    const at = {
      x: subline.x + subline.width / 2,
      y: subline.y + subline.height - 4,
    }

    // A door out, then the subline: the door goes back, nothing else comes out.
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'safe top: select Sing')
    await page.touchscreen.tap(at.x, at.y)
    await waitPhase(page, 'rest', null, 'safe top: a tap on the subline')
    // From rest: the subline selects nothing.
    await page.touchscreen.tap(at.x, at.y)
    await page.waitForTimeout(400)
    const after = await alleyNow(page)
    if (after.phase !== 'rest' || after.door !== null) {
      throw new Error(`a tap on the subline selected ${JSON.stringify(after)}`)
    }
    if (m.bandTop < m.topBottom - 0.5) {
      throw new Error(
        `the band starts inside the headline block ${JSON.stringify(m)}`,
      )
    }
    step = `alley safe top ${frame.safeTop} px: subline bottom ${Math.round(m.sublineBottom)}, block bottom ${Math.round(m.topBottom)}, band top ${Math.round(m.bandTop)} (highest door ${Math.round(m.highestDoor)}); a subline tap cleared Sing, then selected nothing`
  } catch (error) {
    failures.push(error.message)
  } finally {
    await context.close()
  }
  if (failures.length > 0) throw new Error(failures.join('; '))
  return [`[${frame.width}x${frame.height}] ${step}`]
}

// ── The alley on its side ────────────────────────────────────
//
// Orientation is unlocked (owner decision Q-4). Turned on its side the plate
// is sized by the door band, which sits between the headline block and the
// dock, every door whole; and a rotation in the middle of an open ends with
// the room on the new screen and no clone left behind.
const LANDSCAPE_FRAMES = [{ width: 852, height: 393 }]

async function walkAlleyLandscape(browser, args, frame) {
  const ctx = { ...args, frame }
  const context = await isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
    }),
  )
  const failures = []
  const steps = []
  try {
    const page = await context.newPage()
    page.on('pageerror', (error) => {
      failures.push(`page error: ${error.message}`)
    })
    await page.addInitScript(seed, args.theme)
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('#root.loaded').waitFor({
      state: 'attached',
      timeout: BOOT_TIMEOUT_MS,
    })
    await page
      .locator('[data-testid="alley-headline"]')
      .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await page.waitForTimeout(600)
    const m = await page.evaluate(() => {
      const rect = (el) => el.getBoundingClientRect()
      const keys = [...document.querySelectorAll('.mp-alley__key')].map((k) => {
        const b = rect(k)
        return {
          door: k.dataset.door,
          l: b.left,
          t: b.top,
          r: b.right,
          b: b.bottom,
        }
      })
      const block = rect(document.querySelector('[data-testid="alley-top"]'))
      const band = rect(document.querySelector('[data-testid="alley-hit"]'))
      return {
        keys,
        blockRight: block.right,
        blockBottom: block.bottom,
        bandLeft: band.left,
        bandTop: band.top,
        bandHeight: band.height,
        dock: document.querySelector('.mp-dock')
          ? rect(document.querySelector('.mp-dock')).top
          : window.innerHeight,
        width: window.innerWidth,
      }
    })
    // The block stands beside the doors (S4 round 2, V3 option b): every
    // door right of it, whole, between the top and the dock, and the band
    // taller than the 116 px it had with the block above it.
    const doorTop = Math.min(...m.keys.map((k) => k.t))
    const doorBottom = Math.max(...m.keys.map((k) => k.b))
    const doorLeft = Math.min(...m.keys.map((k) => k.l))
    const widths = m.keys.map((k) => k.r - k.l)
    const cut = m.keys.filter((k) => k.l < -0.5 || k.r > m.width + 0.5)
    if (
      m.keys.length !== 6 ||
      cut.length > 0 ||
      doorLeft < m.blockRight - 0.5 ||
      m.bandLeft < m.blockRight - 0.5 ||
      doorTop < 0 ||
      doorBottom > m.dock + 0.5 ||
      m.bandHeight < 232
    ) {
      throw new Error(`landscape layout: ${JSON.stringify(m)}`)
    }
    await shoot(page, ctx, 'alley-landscape')
    steps.push(
      `alley landscape: headline block beside the doors (right edge ${Math.round(m.blockRight)}), doors ${Math.round(doorLeft)}..${Math.round(Math.max(...m.keys.map((k) => k.r)))} x ${Math.round(doorTop)}..${Math.round(doorBottom)}, band ${Math.round(m.bandHeight)} px tall, dock ${Math.round(m.dock)}, door widths ${Math.min(...widths).toFixed(1)}-${Math.max(...widths).toFixed(1)} px, all six whole`,
    )

    // Select Sing on its side, open it, and turn the phone upright mid-grow.
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'landscape: select Sing')
    await shoot(page, ctx, 'alley-landscape-sing')
    await page.locator('[data-testid="alley-enter"]').tap()
    await page.waitForTimeout(120)
    const upright = { width: frame.height, height: frame.width }
    await page.setViewportSize(upright)
    await page.waitForTimeout(450)
    const covered = await page.evaluate(() => {
      const clone = document.querySelector('[data-testid="alley-morph"]')
      if (clone === null) return null
      const b = clone.getBoundingClientRect()
      return {
        phase: clone.dataset.phase,
        box: [b.left, b.top, b.width, b.height].map((n) => Math.round(n)),
      }
    })
    await page
      .waitForFunction(
        () =>
          document.querySelector('[data-testid="alley-morph"]') === null &&
          document.querySelector('[data-testid="sing-room"]') !== null,
        null,
        { timeout: 8000 },
      )
      .catch(() => {
        throw new Error('rotation mid-open: the room never replaced the clone')
      })
    if (
      covered !== null &&
      (covered.box[2] !== upright.width || covered.box[3] !== upright.height)
    ) {
      throw new Error(
        `rotation mid-open: the clone was ${JSON.stringify(covered)}`,
      )
    }
    steps.push(
      `alley rotation mid-open: clone ${covered === null ? 'already gone' : `${covered.phase} at ${covered.box.join(',')}`} on the ${upright.width}x${upright.height} screen, then the Sing room, no clone left`,
    )
  } catch (error) {
    failures.push(error.message)
  } finally {
    await context.close()
  }
  if (failures.length > 0) throw new Error(failures.join('; '))
  const at = `${frame.width}x${frame.height}`
  return steps.map((step) => `[${at}] ${step}`)
}

// ── The room's microphone waits for the hand-over ───────────
//
// A context that has granted the microphone, and a device that remembers it
// did, so the Sing room starts listening on arrival by itself. Its
// getUserMedia must come after the door's clone is gone AND after the
// alley's ambient stopped its source: the arrival hold is what orders them,
// and a hold that did nothing would open the microphone under the clone.
async function walkAlleyMic(browser, args, frame) {
  const context = await isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
      permissions: ['microphone'],
    }),
  )
  const failures = []
  let step = null
  try {
    const page = await context.newPage()
    page.on('pageerror', (error) => {
      failures.push(`page error: ${error.message}`)
    })
    await page.addInitScript(seed, args.theme)
    await page.addInitScript(() => {
      localStorage.setItem('pitchperfect_sing_mic_granted', 'true')
      const times = { gumAt: null, clonedAt: null, cloneGoneAt: null }
      window.__mpMic = times
      const devices = navigator.mediaDevices
      const real = devices.getUserMedia.bind(devices)
      devices.getUserMedia = (constraints) => {
        times.gumAt ??= performance.now()
        return real(constraints)
      }
      new MutationObserver(() => {
        const clone = document.querySelector('[data-testid="alley-morph"]')
        if (clone !== null) times.clonedAt ??= performance.now()
        else if (times.clonedAt !== null)
          times.cloneGoneAt ??= performance.now()
      }).observe(document, { childList: true, subtree: true })
    })
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('#root.loaded').waitFor({
      state: 'attached',
      timeout: BOOT_TIMEOUT_MS,
    })
    await page
      .locator('[data-testid="rooms-alley"]')
      .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await page.waitForTimeout(400)
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'mic: select Sing')
    await page.waitForTimeout(700)
    await page.locator('[data-testid="alley-enter"]').tap()
    await page
      .waitForFunction(() => window.__mpMic.gumAt !== null, null, {
        timeout: 10_000,
      })
      .catch(() => {
        throw new Error('mic: the Sing room never asked for the microphone')
      })
    const t = await page.evaluate(() => ({
      ...window.__mpMic,
      silentAt: window.mpAlley().silentAt,
      held: window.mpAlley().held,
      room: document.querySelector('[data-testid="sing-room"]') !== null,
    }))
    const ms = (v) => (v === null ? 'null' : `${Math.round(v)}`)
    if (
      t.clonedAt === null ||
      t.cloneGoneAt === null ||
      t.silentAt === null ||
      t.gumAt < t.cloneGoneAt ||
      t.gumAt < t.silentAt ||
      t.held ||
      !t.room
    ) {
      throw new Error(`mic: out of order ${JSON.stringify(t)}`)
    }
    step = `alley mic on arrival: clone up ${ms(t.clonedAt)} ms, ambient source stopped ${ms(t.silentAt)}, clone gone ${ms(t.cloneGoneAt)}, getUserMedia ${ms(t.gumAt)} (after both)`
  } catch (error) {
    failures.push(error.message)
  } finally {
    await context.close()
  }
  if (failures.length > 0) throw new Error(failures.join('; '))
  return [`[${frame.width}x${frame.height}] ${step}`]
}

// ── A door under a practice scope that hides its room (item 9) ──
//
// "I practice" = Guitar hides the Sing tab from the WEB bar, and the web's App
// Mode guard bounced a hidden tab back home with a toast. Under the native
// build the doors reach their rooms whatever the scope says: the Sing door
// once opened, covered, reached Sing and was sent straight back to the alley.
async function walkAlleyScope(browser, args, frame) {
  const context = await isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
    }),
  )
  const failures = []
  let step = null
  try {
    const page = await context.newPage()
    page.on('pageerror', (error) => {
      failures.push(`page error: ${error.message}`)
    })
    await page.addInitScript(seed, args.theme)
    await page.addInitScript(() => {
      // Stored bare: a string setting is not JSON, and '"guitar"' fails the
      // validator and reads back as 'all', which no guard ever bounces.
      localStorage.setItem('pitchperfect_practice_scope', 'guitar')
    })
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('#root.loaded').waitFor({
      state: 'attached',
      timeout: BOOT_TIMEOUT_MS,
    })
    await page
      .locator('[data-testid="rooms-alley"]')
      .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    // Past the guard's start-up grace, so a bounce would say so in a toast.
    await page.waitForTimeout(2500)
    // The scope has to have taken: the rail's stage slot follows it.
    const stage = (
      await page.locator('[data-rail-item="stage"]').innerText()
    ).trim()
    if (!stage.includes('Guitar')) {
      throw new Error(
        `scope guitar: not applied, the rail's stage reads "${stage}"`,
      )
    }
    await tapDoor(page, 'sing')
    await waitPhase(page, 'alive', 'sing', 'scope guitar: select Sing')
    await page.locator('[data-testid="alley-enter"]').tap()
    // Not thrown on: a bounced room never attaches, and the state below says
    // where it went instead.
    await page
      .locator('[data-testid="sing-room"]')
      .waitFor({ state: 'attached', timeout: STEP_TIMEOUT_MS })
      .catch(() => undefined)
    await page.waitForTimeout(1500)
    const after = await page.evaluate(() => ({
      hash: window.location.hash,
      room: document.querySelector('[data-testid="sing-room"]') !== null,
      alley: document.querySelector('[data-testid="rooms-alley"]') !== null,
      toast: document.body.innerText.includes('hidden by your App Mode'),
      scope: localStorage.getItem('pitchperfect_practice_scope'),
    }))
    if (
      !after.hash.includes('singing') ||
      !after.room ||
      after.alley ||
      after.toast
    ) {
      throw new Error(`scope guitar: ${JSON.stringify(after)}`)
    }
    step = `alley under "I practice" = ${after.scope} (rail stage "${stage}"): the Sing door reached ${after.hash} and stayed, no App Mode toast`
  } catch (error) {
    failures.push(error.message)
  } finally {
    await context.close()
  }
  if (failures.length > 0) throw new Error(failures.join('; '))
  return [`[${frame.width}x${frame.height}] ${step}`]
}

async function pressBack(page) {
  return page.evaluate(() => {
    const back = window.mpShellBack
    if (typeof back !== 'function') throw new Error('no shell back handler')
    return back()
  })
}

async function walkBack(page) {
  const steps = []

  await page.locator('[data-rail-item="rooms"]').click()
  await page
    .locator('[data-rail-item="rooms"][aria-current="page"]')
    .waitFor({ state: 'visible', timeout: RUN_TIMEOUT_MS })
  const roomsHash = await page.evaluate(() => window.location.hash)

  // A room entered from Rooms must push an entry Back can return to: the web
  // gallery's covers once pushed with `history.pushState`, which fires no
  // hashchange, and a depth that only learned from events minimized the app
  // instead. Rooms is the alley now, and its way into a room is a door.
  await page
    .locator('[data-testid="rooms-alley"]')
    .waitFor({ state: 'visible', timeout: RUN_TIMEOUT_MS })
  await tapDoor(page, 'sing')
  const enter = page.locator('[data-testid="alley-enter"]')
  await enter.waitFor({ state: 'visible', timeout: RUN_TIMEOUT_MS })
  await enter.tap()
  await page.waitForFunction((was) => window.location.hash !== was, roomsHash, {
    timeout: RUN_TIMEOUT_MS,
  })
  steps.push('back: a door opened into its room and pushed an entry')

  const outcome = await pressBack(page)
  if (outcome !== 'history') {
    throw new Error(`Back after a door answered '${outcome}'`)
  }
  await page.waitForFunction((was) => window.location.hash === was, roomsHash, {
    timeout: RUN_TIMEOUT_MS,
  })
  steps.push('back: it returned to Rooms rather than minimizing')

  return steps
}

/**
 * The other end of the same order, and it has to be asked at boot: by the
 * time a walk has been anywhere there are real entries behind it, and a
 * press that answers 'history' there is right.
 */
async function walkBackRoot(page) {
  const outcome = await pressBack(page)
  if (outcome !== 'minimize') {
    throw new Error(`Back on the launch screen answered '${outcome}'`)
  }
  return ['back: on the launch screen it declines, and the app minimizes']
}

/** One frame's whole walk, in its own context so nothing carries over. */
async function walkFrame(browser, args, frame) {
  const ctx = { ...args, frame }
  const context = await isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
      permissions: ['microphone'],
    }),
  )

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
  await page.addInitScript(installRepaintCounter)

  let steps = []
  try {
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page.locator('#root.loaded').waitFor({
      state: 'attached',
      timeout: BOOT_TIMEOUT_MS,
    })
    steps.push('boot: #root.loaded')
    steps = steps.concat(await walkBackRoot(page))
    steps = steps.concat(await walkChrome(page, ctx))
    if (!args.chromeOnly) {
      const room = []
      try {
        await walkRun(page, ctx, room)
        // Device round 2 continues in the same context on purpose: it needs a
        // granted microphone and a couple of kept takes, which is exactly
        // what the walk above leaves behind.
        await walkRound2(page, ctx, room)
      } finally {
        steps = steps.concat(room)
      }
      steps = steps.concat(await walkBack(page))
    }
  } catch (error) {
    failures.push(`walk: ${error.message}`)
  } finally {
    await context.close()
  }

  const at = `${frame.width}x${frame.height}`
  return {
    steps: steps.map((step) => `[${at}] ${step}`),
    failures: failures.map((failure) => `[${at}] ${failure}`),
  }
}

// UPLOAD_DENIAL, and the sentences it must and must not catch, live in
// ./upload-denial.mjs: the walk runs its self-test before it trusts it.

/**
 * Chunks that may contain the WORD at all, and why.
 *
 * The second, weaker rule: a chunk that starts talking about uploads has to
 * be named here before it ships. Matched on the name Rollup gives the chunk,
 * without its content hash. The app chunk is on the list because three real
 * upload flows compile into it — and it is covered by the denial rule above,
 * which has no allowlist at all, so naming it here weakens nothing.
 */
const UPLOAD_CHUNKS = [
  [
    'index',
    "the app chunk: the vocal separator's own upload box, the voiceprint sync and the MIDI library import all upload a file the singer chose. Covered by the denial rule, which allowlists nothing.",
  ],
  [
    'AdminContentStudio',
    "the owner's studio: managed uploads of demo audio, and the states of one in flight.",
  ],
  [
    'ShazamListen',
    'the "Upload audio instead" path — identifying a file the singer picks rather than one of ours.',
  ],
  [
    'ShazamResults',
    "names the source of a match: the singer's own upload, or the library.",
  ],
  ['ShazamDebugPanel', 'the same source label, in the debug read-out.'],
  [
    'KaraokeGroupsPanel',
    '"No songs yet — upload one to get started." — the empty state of a real upload.',
  ],
  [
    'SheetMusicView',
    'a font glyph name in the notation renderer (`elecUpload`), not copy.',
  ],
  [
    'ort.bundle.min',
    'the ONNX runtime: WebGPU errors about uploading to an MLTensor. Not UI.',
  ],
  ['whisper-worker', 'the same runtime, in the transcription worker. Not UI.'],
  ['voice-stt-worker', 'the same runtime, in the speech worker. Not UI.'],
]

/** The chunk's name without Rollup's content hash: `index-DGNfDjFf.js` -> `index`. */
function chunkName(file) {
  return file
    .split('/')
    .pop()
    .replace(/\.js$/u, '')
    .replace(/-[A-Za-z0-9_-]{8}$/u, '')
}

function checkNativeCopy(dir) {
  // A tripwire that has stopped catching is worse than none: it reports
  // clean. Its own positives and negatives first.
  const selfTest = selfTestUploadDenial()
  const files = listJs(dir)
  if (files.length === 0) {
    throw new Error(`no .js under ${dir} to read the room's copy out of`)
  }

  // ── The rule with no allowlist ──
  const denials = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    UPLOAD_DENIAL.lastIndex = 0
    let match
    while ((match = UPLOAD_DENIAL.exec(text)) !== null) {
      const around = text
        .slice(
          Math.max(0, match.index - 60),
          match.index + match[0].length + 40,
        )
        .replace(/\s+/gu, ' ')
      denials.push(`${chunkName(file)}: …${around}…`)
    }
  }
  if (denials.length > 0) {
    throw new Error(
      `${denials.length} place(s) in the native bundle say an upload does not happen:\n  ${denials.join('\n  ')}`,
    )
  }

  // ── The rule with one ──
  const allowed = new Set(UPLOAD_CHUNKS.map(([name]) => name))
  const unnamed = [
    ...new Set(
      files
        .filter((file) => /upload/iu.test(readFileSync(file, 'utf8')))
        .map(chunkName)
        .filter((name) => !allowed.has(name)),
    ),
  ]
  if (unnamed.length > 0) {
    throw new Error(
      `${unnamed.join(', ')} talk(s) about uploads and is not named in UPLOAD_CHUNKS. Say why it may, or take the word out.`,
    )
  }

  // ── …and the room's own sentences really are in there ──
  const source = files.map((file) => readFileSync(file, 'utf8')).join('\n')
  const missing = [
    'Keep stores it on this phone.',
    'The microphone stays off until you tap.',
    'Only you can hear you.',
  ].filter((sentence) => !source.includes(sentence))
  if (missing.length > 0) {
    throw new Error(
      `the sentences that replaced the denials are not in the bundle: ${missing.join(' / ')}`,
    )
  }

  const words = (source.match(/upload/giu) ?? []).length
  return `${selfTest}; dist: nothing in ${files.length} chunks denies an upload; the word appears ${words} times, all in the ${UPLOAD_CHUNKS.length} chunks that say why`
}

/** Every .js under `dir`, recursively. */
function listJs(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) out.push(...listJs(path))
    else if (entry.name.endsWith('.js')) out.push(path)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.shots !== null) mkdirSync(args.shots, { recursive: true })

  const tone = writeToneWav(resolve(tmpdir(), 'mp-probe-voice.wav'))

  const browser = await chromium.launch({
    headless: !args.headed,
    args: [
      // Any window this opens belongs on the agent workspace, never the one
      // somebody is looking at. Headless opens none; headed must still say so.
      '--class=agent-browser',
      // A microphone that answers, and no permission sheet in front of it.
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      // …and a voice for it to answer with. Without this the fake device
      // beeps once a second, which is about a tenth of the time: no take
      // would ever reach three seconds of voice inside a probe's patience.
      `--use-file-for-fake-audio-capture=${tone}`,
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
    ],
  })

  const steps = []
  const failures = []
  if (args.dist !== null) {
    try {
      steps.push(checkNativeCopy(args.dist))
    } catch (error) {
      failures.push(`copy: ${error.message}`)
    }
  }
  try {
    // Every frame is walked even when an earlier one failed: "it broke at 390"
    // and "it broke at both" are different reports, and the second one is the
    // one that says the fix is not a width rule.
    for (const frame of args.landscapeOnly ? [] : FRAMES) {
      const result = await walkFrame(browser, args, frame)
      steps.push(...result.steps)
      failures.push(...result.failures)
      if (args.chromeOnly) continue
      try {
        steps.push(...(await walkDenied(browser, args, frame)))
      } catch (error) {
        failures.push(
          `[${frame.width}x${frame.height}] denied: ${error.message}`,
        )
      }
      try {
        steps.push(...(await walkSuspended(args, frame)))
      } catch (error) {
        failures.push(
          `[${frame.width}x${frame.height}] suspended: ${error.message}`,
        )
      }
      try {
        steps.push(...(await walkAlley(browser, args, frame)))
      } catch (error) {
        failures.push(
          `[${frame.width}x${frame.height}] alley: ${error.message}`,
        )
      }
      try {
        steps.push(...(await walkAlleyMic(browser, args, frame)))
      } catch (error) {
        failures.push(
          `[${frame.width}x${frame.height}] alley mic: ${error.message}`,
        )
      }
      try {
        steps.push(...(await walkAlleyScope(browser, args, frame)))
      } catch (error) {
        failures.push(
          `[${frame.width}x${frame.height}] alley scope: ${error.message}`,
        )
      }
    }
    if (!args.chromeOnly) {
      for (const frame of LANDSCAPE_FRAMES) {
        try {
          steps.push(...(await walkAlleyLandscape(browser, args, frame)))
        } catch (error) {
          failures.push(
            `[${frame.width}x${frame.height}] alley landscape: ${error.message}`,
          )
        }
      }
      for (const frame of args.landscapeOnly ? [] : SAFE_TOP_FRAMES) {
        try {
          steps.push(...(await walkAlleySafeTop(browser, args, frame)))
        } catch (error) {
          failures.push(
            `[${frame.width}x${frame.height}] alley safe top: ${error.message}`,
          )
        }
      }
      const kit = {
        isolate,
        seed,
        shoot,
        bootTimeoutMs: BOOT_TIMEOUT_MS,
        stepTimeoutMs: STEP_TIMEOUT_MS,
        runTimeoutMs: RUN_TIMEOUT_MS,
      }
      for (const frame of LANDSCAPE_INSET_FRAMES) {
        try {
          steps.push(
            ...(await walkLandscapeSurfaces(browser, args, frame, kit)),
          )
        } catch (error) {
          failures.push(
            `[${frame.width}x${frame.height}] on its side: ${error.message}`,
          )
        }
      }
    }
  } finally {
    await browser.close()
  }

  for (const step of steps) console.log(`ok    ${step}`)
  for (const failure of failures) console.error(`FAIL  ${failure}`)

  if (failures.length > 0) {
    console.error(`\nprobe-bundle: ${failures.length} problem(s).`)
    process.exitCode = 1
    return
  }
  console.log(
    `\nprobe-bundle: every step passed (${args.theme}, ${args.landscapeOnly ? 'landscape only' : `${FRAMES.length} frames`}).`,
  )
}

await main()
