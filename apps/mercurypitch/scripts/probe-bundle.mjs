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
// Native plugins do not exist here: `@capacitor/*` answers `Unimplemented`,
// which the platform wrappers already turn into a no-op, so nothing in this
// walk depends on one.

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'

/** Every frame the walk is repeated at. The lab's, and the owner's phone. */
const FRAMES = [
  { width: 393, height: 852 },
  { width: 390, height: 844 },
]
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
  rooms: {
    gone: ['[data-testid="home-learn"]', '[data-testid="home-whats-new"]'],
    kept: ['[data-testid="home-heading"]'],
  },
  ear: {
    gone: ['[data-testid="ear-session-copy"]'],
    kept: [
      '[data-testid="ear-readiness-chip"]',
      '[data-testid="ear-rulers-chip"]',
      '[data-testid="ear-room-chip"]',
    ],
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
  headroom: 6,
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
      steps.push(
        `${id}: no page band, ${rule.kept.length} control(s)/heading kept`,
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

  // One reservation, not two (P2). The stage's own bar added its own
  // safe-area inset on top of the scroller's, which left 8 + 10 + 34 pt of
  // nothing between the last control and the band on a notched phone.
  //
  // WITH A HOME INDICATOR STOOD UP BY HAND. Headless resolves every
  // `env(safe-area-inset-*)` to 0, so the whole bug is invisible here: the
  // doubled reservation IS the safe area, and at 0 the broken bar and the
  // fixed one measure the same. The inset is pushed onto the document for
  // this one measurement and taken off again, which is also the only place
  // in the walk that exercises the reserve chain the way a phone does.
  await page.locator('[data-rail-item="stage"]').click()
  await page
    .locator('[data-testid="singing-mobile-stage"]')
    .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  await page.waitForTimeout(400)

  const readSeam = () => {
    const round = (n) => Math.round(n * 10) / 10
    const bar = document.querySelector('[data-testid="mobile-transport-bar"]')
    const band = document.querySelector('.mp-band')
    if (bar === null || band === null) return null
    const boxes = [...bar.querySelectorAll('button')].map((node) =>
      node.getBoundingClientRect(),
    )
    if (boxes.length === 0) return null
    const barBox = bar.getBoundingClientRect()
    const bandTop = band.getBoundingClientRect().top
    const style = getComputedStyle(bar)
    return {
      // The box seam is the reservation. The two insets are the bar's own
      // padding as the eye reads it — a row flush with one edge and 10 px off
      // the other is the doubled reserve showing up as an off-centre row.
      box: round(bandTop - barBox.bottom),
      above: round(Math.min(...boxes.map((b) => b.top)) - barBox.top),
      below: round(barBox.bottom - Math.max(...boxes.map((b) => b.bottom))),
      controls: round(bandTop - Math.max(...boxes.map((b) => b.bottom))),
      paddingBottom: style.paddingBottom,
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
  await shoot(page, ctx, 'stage-bar-seam')
  await page.evaluate(() => {
    document.documentElement.style.removeProperty('--safe-bottom')
  })
  await page.waitForTimeout(200)
  const flat = await page.evaluate(readSeam)

  for (const [what, seam] of [
    ['with a home indicator', notched],
    ['without one', flat],
  ]) {
    if (seam === null) throw new Error('no stage bar, or no band, on Sing')
    if (Math.abs(seam.box - 8) > 1) {
      throw new Error(
        `${what}, the stage bar's box sits ${seam.box} px above the band`,
      )
    }
    // The half that only a real inset can show: the bar used to carry the
    // safe area itself, so its row sat `10 + inset` off its own bottom edge
    // and `10` off its top.
    if (Math.abs(seam.below - seam.above) > 1) {
      throw new Error(
        `${what}, the stage bar's row sits ${seam.above} px from its top and ${seam.below} px from its bottom`,
      )
    }
  }
  if (notched.safeBottom !== `${NOTCH}px`) {
    throw new Error(
      `the home indicator did not take: --safe-bottom read ${notched.safeBottom}`,
    )
  }
  steps.push(
    `stage: the bar's box is ${flat.box} px above the band, its row centred at a ${NOTCH} pt inset too`,
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

async function walkRun(page, ctx) {
  const { frame } = ctx
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
    // `undefined` in the ARG slot: waitForFunction is (fn, arg, options), so
    // an options object passed second is serialised as the function's
    // argument and the deadline silently falls back to the 30 s default.
    undefined,
    { timeout: RUN_TIMEOUT_MS },
  )
  const chip = await page.locator('[data-testid="shell-chip"]').boundingBox()
  const band = await page.locator('.mp-band').boundingBox()
  if (chip === null || band === null) throw new Error('no chip or no band')
  const near = (a, b) => Math.abs(a - b) <= 1.5
  if (!near(chip.width, 56) || !near(chip.height, 56)) {
    throw new Error(`the chip is ${chip.width} x ${chip.height}, not 56 x 56`)
  }
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
  steps.push('run: the chip is 56, 8 above the band, 16 from the edge')
  await shoot(page, ctx, 'run-active')

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
  await shoot(page, ctx, 'run-column')
  steps.push('run: the column opens with focus in it')

  await page.mouse.click(frame.width / 2, frame.height / 2)
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
  await shoot(page, ctx, 'run-paused')
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
  await shoot(page, ctx, 'run-locked')
  steps.push('run: locked, dimmed, still announced')
  await page.locator('[aria-label="Lock controls"]').click()

  // A tab from the column parks: the destination pushes in, the pill takes
  // the dock's accessory slot, and the microphone is released on the way.
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
  steps.push('run: parked, with the pill in the dock')

  // On EVERY other tab, not just the first. The room unmounts when the singer
  // leaves it, and a shell that read the global store there decided the run
  // had ended: the pill was gone by the second hop.
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
  steps.push('run: the pill is on every tab the run is not')

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
  await shoot(page, ctx, 'run-returned')
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
  await shoot(page, ctx, 'run-ended')
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

/**
 * Back, pressed the way Android presses it.
 *
 * The shell's handler is registered with Capacitor and no browser can fire
 * it, so the bundle exposes it under `window.E2E_TEST_MODE` — which this walk
 * sets before the first script runs. Without this the back ORDER could only
 * be asserted by inference, and the bug it hides is exactly that: a press
 * that reports itself handled while doing nothing.
 */
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

  // A room cover navigates with `setActiveTab`, whose sync pushes with
  // `history.pushState` — which fires no hashchange and no popstate. A depth
  // that only learned from events never moved, so this press minimized the
  // app instead of returning to the gallery.
  const cover = page.locator('[data-destination]').first()
  await cover.waitFor({ state: 'visible', timeout: RUN_TIMEOUT_MS })
  await cover.click()
  await page.waitForFunction((was) => window.location.hash !== was, roomsHash, {
    timeout: RUN_TIMEOUT_MS,
  })
  steps.push('back: a room cover pushed an entry')

  const outcome = await pressBack(page)
  if (outcome !== 'history') {
    throw new Error(`Back after a room cover answered '${outcome}'`)
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
  const context = await browser.newContext({
    viewport: frame,
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
    steps = steps.concat(await walkBackRoot(page))
    steps = steps.concat(await walkChrome(page, ctx))
    if (!args.chromeOnly) {
      steps = steps.concat(await walkRun(page, ctx))
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

  const steps = []
  const failures = []
  try {
    // Every frame is walked even when an earlier one failed: "it broke at 390"
    // and "it broke at both" are different reports, and the second one is the
    // one that says the fix is not a width rule.
    for (const frame of FRAMES) {
      const result = await walkFrame(browser, args, frame)
      steps.push(...result.steps)
      failures.push(...result.failures)
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
    `\nprobe-bundle: every step passed (${args.theme}, ${FRAMES.length} frames).`,
  )
}

await main()
