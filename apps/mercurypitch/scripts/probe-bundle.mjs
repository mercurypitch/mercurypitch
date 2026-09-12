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
import { tmpdir } from 'node:os'
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
    return { total: pixels.length / 4, transparent, painted, flatGreen, spectrum }
  })
}

/** The room's whole walk, from the silent trace to a decided take. */
async function walkRun(page, ctx) {
  const { frame } = ctx
  const steps = []

  await page.locator('[data-rail-item="stage"]').click()
  await expectVisible(page.locator('[data-testid="sing-room"]'), 'the Sing room')

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

  const trace = await sampleTrace(page)
  if (trace.error !== undefined) throw new Error(trace.error)
  if (trace.transparent < trace.total * 0.5) {
    const opaque = Math.round((100 * trace.painted) / trace.total)
    throw new Error(`the canvas is ${opaque}% opaque — the room is behind a plate`)
  }
  if (trace.spectrum < 200) {
    throw new Error(
      `only ${trace.spectrum} spectrum pixels: the trace is not drawing`,
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
  steps.push('run: the shell has the band, and the chip is 56, 8 above it, 16 in')

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
  if (Number(locked.opacity) > 0.6) throw new Error('a locked Stop is not dimmed')
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
    throw new Error('a first take compared itself with a history it has not got')
  }
  await shoot(page, ctx, 'room-end-card')
  steps.push('room: Stop opens the end card with four counts and no history yet')

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
  if (history === undefined || !history.startsWith('Against your own history:')) {
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
  await shoot(page, ctx, 'room-resting-returning')
  steps.push('room: Discard stores nothing and the room rests')

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
  const context = await browser.newContext({
    viewport: frame,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: args.theme,
    permissions: [],
  })
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
    steps.push('room: a refused mic shows the demo line, Settings and a way out')

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
  try {
    // Every frame is walked even when an earlier one failed: "it broke at 390"
    // and "it broke at both" are different reports, and the second one is the
    // one that says the fix is not a width rule.
    for (const frame of FRAMES) {
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
