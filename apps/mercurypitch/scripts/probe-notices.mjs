// ============================================================
// Notices in the native app: the pill under the status bar, and a room's chip
// ============================================================
//
// Owner, 17 Oct 2026: two badges earned in one take stacked at the bottom of
// a premium room and covered its controls. The native app now draws its
// notices as one pill under the status bar (NoticePill.tsx), placed between
// the header's controls or below them (notice-pill-place.ts), and a room
// shows its unlocks in a chip under its result (room-kit/UnlockChip.tsx).
//
// This walk proves both against the BUILT bundle, on the owner's iPhone and
// iPad sizes, upright and on their sides:
//
//   THE PILL. On every surface the shell draws (the alley, the Sing room,
//   the Ear Lab, Progress, the More sheet, Settings, the account, Karaoke,
//   Piano, Guitar, Developer, and each premium room), a merged unlock and a
//   notice with an action are raised the way the app raises them. Each pill
//   is hit-tested against every control a tap can reach on that screen: no
//   control may lie under it. It must sit inside the safe area, be at most
//   420 px wide, read at 4.5:1 or better, keep an action at 44 px, and go
//   on a tap and on a swipe up.
//
//   THE CHIP. In each premium room a take is started with Chromium's fake
//   voice, two unlocks are announced during it, and the take is taken to
//   its result. No pill may show, and the chip under the result must say
//   "2 new badges" and list both. One more after the result joins the chip.
//   And one announced in a take the singer walks out of falls back to the
//   pill on the screen they return to.
//
// A phone holds a premium room upright (portrait-lock.ts), so on a phone's
// side the rooms are not walked: there is no such screen on a device.
//
// Wired into probe-bundle.mjs, which owns the browser and its fake voice:
// `--notices-only` walks this alone.

/** iPhone 13 Pro, an island iPhone, both on their sides, and three iPads. */
export const NOTICE_FRAMES = [
  {
    name: 'phone 390x844',
    width: 390,
    height: 844,
    insets: { top: 47, right: 0, bottom: 34, left: 0 },
    orientation: { type: 'portraitPrimary', angle: 0 },
    rooms: true,
  },
  {
    name: 'phone 393x852',
    width: 393,
    height: 852,
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
    orientation: { type: 'portraitPrimary', angle: 0 },
    rooms: true,
  },
  {
    name: 'phone 844x390 sideways',
    width: 844,
    height: 390,
    insets: { top: 0, right: 47, bottom: 21, left: 47 },
    orientation: { type: 'landscapePrimary', angle: 90 },
    rooms: false,
  },
  {
    name: 'phone 852x393 sideways',
    width: 852,
    height: 393,
    insets: { top: 0, right: 59, bottom: 21, left: 59 },
    orientation: { type: 'landscapePrimary', angle: 90 },
    rooms: false,
  },
  {
    name: 'iPad 820x1180',
    width: 820,
    height: 1180,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
    orientation: { type: 'portraitPrimary', angle: 0 },
    rooms: true,
  },
  {
    name: 'iPad 1024x1366',
    width: 1024,
    height: 1366,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
    orientation: { type: 'portraitPrimary', angle: 0 },
    rooms: true,
  },
  {
    name: 'iPad 1180x820 sideways',
    width: 1180,
    height: 820,
    insets: { top: 24, right: 0, bottom: 20, left: 0 },
    orientation: { type: 'landscapePrimary', angle: 90 },
    rooms: true,
  },
]

/** The frames a full take is sung in every room; elsewhere Long note only. */
const FULL_TAKE_FRAMES = new Set(['phone 390x844', 'iPad 820x1180'])

const PILL = '[data-testid="notice-pill"]'
const PLACED = `${PILL}.is-placed:not(.is-leaving)`
const PUSHED = '[data-testid="shell-pushed"]'
const MAX_WIDTH = 420
const MIN_CONTRAST = 4.5

/**
 * The grant engine's own call, as the app makes it. The pill checks also
 * pass a minute's `durationMs`, so a loaded machine cannot time a notice out
 * between raising it and measuring it.
 */
const UNLOCKS = [
  { kind: 'badge', name: 'Steady Hold', icon: 'leaf' },
  { kind: 'badge', name: 'Night Owl', icon: 'moon' },
]
const LATE = { kind: 'achievement', name: 'First Week', icon: 'calendarcheck' }
const FALLBACK = { kind: 'badge', name: 'Lantern Light', icon: 'sun' }

/** The four premium rooms: their id in the picker and their test-id prefix. */
const ROOMS = [
  { id: 'long-note-lantern', root: 'long-note-room', prefix: 'long-note' },
  { id: 'echo-stars', root: 'echo-room', prefix: 'echo' },
  { id: 'lip-roll-bay', root: 'lip-roll-room', prefix: 'lip' },
  { id: 'ng-slides-bridge', root: 'ng-slides-room', prefix: 'ng' },
]
/** Phases in which a take is under way, per room kind. */
const TAKE_PHASES = new Set([
  'listen',
  'hold',
  'settle',
  'call',
  'response',
  'between',
  'run',
])

/** Seen-flags and settings, so no demo or first-run sheet covers a room. */
const ROOM_STORAGE = {
  mp_long_note_demo_seen: 'true',
  mp_echo_demo_seen: 'true',
  mp_lip_demo_seen: 'true',
  mp_ng_demo_seen: 'true',
  // A4, the note the fake voice opens on (probe-bundle.mjs writeToneWav).
  pitchperfect_long_note_lantern_note: '69',
  // A note each room starts on, so none waits for the voice to settle on
  // one: the fake voice never leaves the gap that settling listens for.
  pitchperfect_echo_stars_root: '69',
  pitchperfect_lip_roll_note: '69',
  pitchperfect_ng_slides_note: '69',
  pitchperfect_sing_mic_on_arrival: 'false',
  pitchperfect_sing_mic_granted: 'true',
}

// ── In the page ──────────────────────────────────────────────

/**
 * The pill, and every control a tap can reach that lies under it.
 *
 * Its own hit-test, not the pill's: the pill is taken out of hit-testing for
 * the length of this call, and each control is sampled at its centre and
 * four points inside its edges. A control counts if any sample lands on it
 * (a control half under a sheet still takes taps on its other half).
 */
function readPill() {
  const pill = document.querySelector('[data-testid="notice-pill"]')
  if (pill === null) return { error: 'no pill' }
  const off = document.createElement('style')
  off.textContent =
    '[data-testid="notice-pill"], [data-testid="notice-pill"] * { pointer-events: none !important; }'
  document.head.append(off)
  const box = (r) => ({
    left: Math.round(r.left * 10) / 10,
    top: Math.round(r.top * 10) / 10,
    right: Math.round(r.right * 10) / 10,
    bottom: Math.round(r.bottom * 10) / 10,
  })
  const p = pill.getBoundingClientRect()
  const SELECTOR =
    'button, a[href], input, select, textarea, summary, [role="button"], ' +
    '[role="link"], [role="tab"], [role="switch"], [role="slider"], ' +
    '[role="menuitem"], [role="option"], [role="checkbox"], [role="radio"], ' +
    '[tabindex]:not([tabindex="-1"])'
  const name = (el) =>
    el.getAttribute('data-testid') ??
    el.getAttribute('aria-label') ??
    (el.textContent ?? '').trim().slice(0, 30) ??
    el.tagName
  let reachable = 0
  let header = 0
  const under = []
  const safe = document
    .querySelector('.mp-notice-safe')
    ?.getBoundingClientRect()
  for (const el of document.querySelectorAll(SELECTOR)) {
    if (pill.contains(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    if (
      r.bottom <= 0 ||
      r.top >= innerHeight ||
      r.right <= 0 ||
      r.left >= innerWidth
    )
      continue
    const inset = (a, b) => Math.min(Math.max(a, 0), b - 1)
    const points = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + 2, r.top + 2],
      [r.right - 2, r.top + 2],
      [r.left + 2, r.bottom - 2],
      [r.right - 2, r.bottom - 2],
    ]
    const tappable = points.some(([x, y]) => {
      const hit = document.elementFromPoint(
        inset(x, innerWidth),
        inset(y, innerHeight),
      )
      return hit !== null && el.contains(hit)
    })
    if (!tappable) continue
    reachable += 1
    if (safe !== undefined && r.top < safe.top + 120) header += 1
    const overlapX = Math.min(p.right, r.right) - Math.max(p.left, r.left)
    const overlapY = Math.min(p.bottom, r.bottom) - Math.max(p.top, r.top)
    if (overlapX > 0.5 && overlapY > 0.5)
      under.push({ name: name(el), box: box(r) })
  }
  off.remove()

  // Colours, composited the way they are drawn: through a 1 px canvas, so
  // any colour syntax the engine computes (color-mix, color()) is read back
  // as the pixel it paints.
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const paint = (...layers) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 1, 1)
    for (const layer of layers) {
      ctx.fillStyle = layer
      ctx.fillRect(0, 0, 1, 1)
    }
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
  }
  const lum = ([r, g, b]) => {
    const c = [r, g, b].map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
  }
  const pillBg = getComputedStyle(pill).backgroundColor
  const bg = paint(pillBg)
  const contrast = []
  const text = pill.querySelector('.mp-notice-pill__text')
  if (text !== null)
    contrast.push([
      'text',
      ratio(paint(pillBg, getComputedStyle(text).color), bg),
    ])
  const names = pill.querySelector('.mp-notice-pill__names')
  if (names !== null)
    contrast.push([
      'names',
      ratio(paint(pillBg, getComputedStyle(names).color), bg),
    ])
  const actions = []
  for (const button of pill.querySelectorAll('.mp-notice-pill__action')) {
    const style = getComputedStyle(button)
    const under = paint(pillBg, style.backgroundColor)
    contrast.push([
      `action "${button.textContent}"`,
      ratio(paint(pillBg, style.backgroundColor, style.color), under),
    ])
    const r = button.getBoundingClientRect()
    actions.push({
      label: button.textContent,
      height: Math.round(r.height * 10) / 10,
    })
  }

  return {
    pill: box(p),
    width: Math.round(p.width * 10) / 10,
    safe: safe === undefined ? null : box(safe),
    viewport: { width: innerWidth, height: innerHeight },
    text: pill.textContent,
    reachable,
    header,
    under,
    contrast,
    actions,
    userSelect:
      getComputedStyle(pill).webkitUserSelect ||
      getComputedStyle(pill).userSelect,
    docked: pill.classList.contains('mp-notice-pill--below') ? 'below' : 'top',
  }
}

// ── The walk ─────────────────────────────────────────────────

async function openPage(browser, args, frame, kit, failures) {
  const { isolate, seed, bootTimeoutMs, stepTimeoutMs } = kit
  const viewport = { width: frame.width, height: frame.height }
  const context = await isolate(
    await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
      permissions: ['microphone'],
    }),
  )
  const page = await context.newPage()
  page.on('pageerror', (error) => {
    failures.push(`page error: ${error.message}`)
  })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: frame.insets,
  })
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    ...viewport,
    deviceScaleFactor: 2,
    mobile: true,
    screenOrientation: frame.orientation,
  })
  await page.addInitScript(seed, args.theme)
  await page.addInitScript((items) => {
    try {
      for (const [key, value] of Object.entries(items))
        localStorage.setItem(key, value)
    } catch {
      /* storage blocked: the room that needed it says so */
    }
  }, ROOM_STORAGE)
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

function verbs(page, args, frame, kit, results) {
  const { stepTimeoutMs } = kit
  const ctx = { ...args, frame: { width: frame.width, height: frame.height } }
  const shots = args.shots
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
  const back = () =>
    page.evaluate(() => {
      const press = window.mpShellBack
      if (typeof press !== 'function') throw new Error('no shell back handler')
      return press()
    })
  const toTop = async () => {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('*')) {
        if (el.scrollTop > 0) el.scrollTop = 0
      }
    })
    await settle(300)
  }
  /** A small JPEG, named by frame and theme: the run keeps every one. */
  const shot = async (name) => {
    if (shots === null) return
    const file = `${frame.width}x${frame.height}-${args.theme}-${name}.jpg`
    await page.screenshot({
      path: `${shots}/${file}`,
      type: 'jpeg',
      quality: 72,
    })
  }

  const raise = (kind) =>
    page.evaluate(
      ([what, unlocks]) => {
        const notices = window.mpNotices
        if (notices === undefined) throw new Error('no mpNotices hook')
        if (what === 'unlocks') {
          for (const unlock of unlocks) {
            notices.show(`Badge unlocked: ${unlock.name}`, 'success', {
              unlock,
              durationMs: 60_000,
            })
          }
        } else if (what === 'action') {
          notices.showAction(
            'New to Piano? Take a quick tour.',
            'info',
            { label: 'Start tour', onClick: () => undefined },
            { durationMs: 60_000 },
          )
        } else {
          notices.show('Saved to your library', 'success', {
            durationMs: 60_000,
          })
        }
      },
      [kind, UNLOCKS],
    )

  const unlock = (item) =>
    page.evaluate((u) => {
      const word = u.kind === 'badge' ? 'Badge' : 'Achievement'
      window.mpNotices.show(`${word} unlocked: ${u.name}`, 'success', {
        unlock: u,
      })
    }, item)

  /** Raise one kind of notice here, test it, and dismiss it. */
  const pillCheck = async (
    screen,
    kind,
    { shotName = null, swipe = false } = {},
  ) => {
    await raise(kind)
    await visible(PLACED)
    // Measured where it rests: after its drop from the status bar, which a
    // loaded machine can stretch well past its 280 ms.
    await page.evaluate(() =>
      Promise.race([
        Promise.all(
          (
            document
              .querySelector('[data-testid="notice-pill"]')
              ?.getAnimations() ?? []
          ).map((a) => a.finished.catch(() => undefined)),
        ),
        new Promise((done) => setTimeout(done, 3000)),
      ]),
    )
    await settle(300)
    const read = await page.evaluate(readPill)
    const where = `${screen} (${kind})`
    if (read.error !== undefined) {
      results.failures.push(`${where}: ${read.error}`)
      return
    }
    for (const control of read.under) {
      results.failures.push(
        `${where}: the pill [${read.pill.left},${read.pill.top} to ${read.pill.right},${read.pill.bottom}] covers "${control.name}" [${control.box.left},${control.box.top} to ${control.box.right},${control.box.bottom}]`,
      )
    }
    const safe = read.safe
    if (
      safe !== null &&
      (read.pill.top < safe.top ||
        read.pill.bottom > safe.bottom + 0.5 ||
        read.pill.left < safe.left - 0.5 ||
        read.pill.right > safe.right + 0.5)
    ) {
      results.failures.push(
        `${where}: the pill leaves the safe area (${JSON.stringify(read.pill)} in ${JSON.stringify(safe)})`,
      )
    }
    if (read.width > MAX_WIDTH + 0.5)
      results.failures.push(`${where}: the pill is ${read.width} px wide`)
    for (const [part, value] of read.contrast) {
      if (value < MIN_CONTRAST)
        results.failures.push(`${where}: ${part} reads at ${value}:1`)
    }
    for (const action of read.actions) {
      if (action.height < 44)
        results.failures.push(
          `${where}: "${action.label}" is ${action.height} px tall`,
        )
    }
    if (read.userSelect !== 'none')
      results.failures.push(`${where}: the pill's text can be selected`)
    if (kind === 'unlocks' && !read.text.startsWith('2 new badges'))
      results.failures.push(`${where}: the merged pill reads "${read.text}"`)
    results.hits.push({
      frame: frame.name,
      theme: args.theme,
      screen,
      kind,
      docked: read.docked,
      width: read.width,
      top: read.pill.top,
      reachable: read.reachable,
      header: read.header,
      covered: read.under.length,
      contrast: read.contrast.map(([, v]) => v),
    })
    if (shotName !== null) await shot(shotName)

    // And away: a swipe up, or a tap.
    const body = page.locator('[data-testid="notice-pill-body"]').first()
    const b = await body.boundingBox()
    if (b === null) throw new Error(`${where}: the pill's body has no box`)
    if (swipe) {
      const x = b.x + b.width / 2
      const y = b.y + b.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x, y - 18, { steps: 3 })
      await page.mouse.move(x, y - 40, { steps: 3 })
      await page.mouse.up()
    } else {
      await page.touchscreen.tap(b.x + 12, b.y + b.height / 2)
    }
    await hidden(PILL).catch(() => {
      results.failures.push(
        `${where}: a ${swipe ? 'swipe up' : 'tap'} did not dismiss the pill`,
      )
    })
    await settle(250)
  }

  /** Both notices on one screen; pictures only where asked. */
  const screenCheck = async (screen, shotName = null) => {
    await pillCheck(screen, 'unlocks', { shotName })
    await pillCheck(screen, 'action', {
      swipe: true,
      shotName: shotName === null ? null : `${shotName}-action`,
    })
    results.screens.push(screen)
  }

  const rail = async (id) => {
    await toTop()
    await page.locator(`[data-rail-item="${id}"]`).click()
    await visible(`[data-rail-item="${id}"][aria-current="page"]`)
    await settle(500)
  }
  const more = async (item) => {
    await toTop()
    await page.locator('[data-rail-item="more"]').click()
    await visible('[data-more-item="settings"]')
    await settle(300)
    if (item !== null) await page.locator(`[data-more-item="${item}"]`).click()
  }

  /** Back down the whole stack: the account sits on Settings. */
  const popAll = async () => {
    const pushed = page.locator(PUSHED)
    for (let i = 0; i < 4 && (await pushed.count()) > 0; i += 1) {
      await page.locator('[data-testid="shell-pushed-back"]').last().click()
      await settle(450)
    }
    await hidden(PUSHED)
  }

  return {
    page,
    popAll,
    visible,
    hidden,
    settle,
    back,
    shot,
    rail,
    more,
    unlock,
    screenCheck,
    pillCheck,
    ctx,
  }
}

/** Walk sections over one page; one that breaks reloads and the next runs. */
async function walkSections(boot, sections, results, where) {
  for (const [name, walk] of sections) {
    try {
      await walk()
    } catch (error) {
      results.failures.push(
        `${where} ${name}: could not walk it: ${error.message.split('\n')[0]}`,
      )
      await boot().catch(() => {})
    }
  }
}

async function shellSurfaces(browser, args, frame, kit, results) {
  const { context, page, boot } = await openPage(
    browser,
    args,
    frame,
    kit,
    results.failures,
  )
  const go = verbs(page, args, frame, kit, results)
  const sections = [
    [
      'the alley',
      async () => {
        await go.rail('rooms')
        await go.screenCheck('alley', 'pill-alley')
      },
    ],
    [
      'the Sing room',
      async () => {
        await go.rail('stage')
        await go.visible('[data-testid="sing-room"]')
        await go.settle(600)
        await go.screenCheck('sing', 'pill-sing')
      },
    ],
    [
      'the Ear Lab',
      async () => {
        await go.rail('ear')
        await go.visible('[data-testid="ear-room-shell"]')
        await go.settle(600)
        await go.screenCheck('ear-lab')
      },
    ],
    [
      'Progress',
      async () => {
        await go.rail('progress')
        await go.settle(600)
        await go.screenCheck('progress')
      },
    ],
    [
      'the More sheet',
      async () => {
        await go.more(null)
        await go.settle(300)
        await go.screenCheck('more-sheet')
        await go.back()
        await go.hidden('[data-more-item="settings"]')
      },
    ],
    [
      'Settings',
      async () => {
        await go.more('settings')
        await go.visible('[data-testid="settings-screen"]')
        await go.settle()
        await go.screenCheck('settings', 'pill-settings')
        await page.locator('[data-testid="shell-pushed-back"]').click()
        await go.hidden(PUSHED)
      },
    ],
    [
      'the account',
      async () => {
        await go.more('account')
        await go.visible('[data-testid="account-screen"]')
        await go.settle()
        await go.screenCheck('account')
        await go.popAll()
      },
    ],
    [
      'Karaoke',
      async () => {
        await go.more('karaoke')
        await go.visible('[data-testid="karaoke-room"]')
        await go.settle(800)
        await go.screenCheck('karaoke', 'pill-karaoke')
      },
    ],
    [
      'Piano',
      async () => {
        await go.more('piano')
        await go.settle(900)
        await go.screenCheck('piano')
      },
    ],
    [
      'Guitar',
      async () => {
        await go.more('guitar')
        await go.settle(900)
        await go.screenCheck('guitar')
      },
    ],
    [
      'Developer',
      async () => {
        await go.more(null)
        const developer = page.locator('[data-more-item="developer"]')
        if ((await developer.count()) === 0) {
          await go.back()
          return
        }
        await developer.click()
        await go.visible('[data-testid="shell-developer"]')
        await go.settle()
        await go.screenCheck('developer')
        await page.locator('[data-testid="shell-pushed-back"]').click()
        await go.hidden(PUSHED)
      },
    ],
  ]
  try {
    await walkSections(boot, sections, results, `[${frame.name}]`)
  } finally {
    await context.close()
  }
}

/** To a premium room through the Sing room's picker, as a finger gets there. */
async function openRoom(go, room) {
  const { page } = go
  await go.rail('stage')
  await go.visible('[data-testid="sing-room"]')
  await go.settle(500)
  const row = page.locator(
    '[data-testid="sing-exercise-browse"], [data-testid="sing-exercise-door"]',
  )
  await row.first().click()
  await go.visible('[data-testid="sing-exercise-picker"]')
  await go.settle(400)
  await page
    .locator(`[data-testid="sing-exercise-card"][data-exercise="${room.id}"]`)
    .click()
  await go.visible(`[data-testid="${room.root}"]`)
  await go.settle(900)
}

const phaseOf = (page, room) =>
  page.locator(`[data-testid="${room.root}"]`).getAttribute('data-phase')

async function waitPhase(page, room, test, what, timeout) {
  const end = Date.now() + timeout
  let phase = null
  while (Date.now() < end) {
    phase = await phaseOf(page, room)
    if (test(phase)) return phase
    await page.waitForTimeout(250)
  }
  throw new Error(`${what}: the room stayed at "${phase}"`)
}

/**
 * A finger on the mic button. Not `click()`: the button breathes while it
 * waits, so it is never "stable" by Playwright's measure and a click waits
 * out its whole timeout.
 */
async function tapMic(page, room, { optional = false } = {}) {
  const box = await page
    .locator(`[data-testid="${room.prefix}-mic"]`)
    .boundingBox({ timeout: optional ? 2000 : 10_000 })
    .catch(() => null)
  if (box === null) {
    if (optional) return
    throw new Error('no mic button on screen')
  }
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
}

/**
 * Announce the unlocks inside a take, and say whether the take was still
 * under way on both sides of the announcement: read in one turn of the
 * page, so the answer cannot be stale.
 */
const unlockMidTake = (page, room) =>
  page.evaluate(
    ([root, unlocks, phases]) => {
      const el = document.querySelector(`[data-testid="${root}"]`)
      const before = el?.getAttribute('data-phase') ?? null
      for (const u of unlocks) {
        window.mpNotices.show(`Badge unlocked: ${u.name}`, 'success', {
          unlock: u,
        })
      }
      const after = el?.getAttribute('data-phase') ?? null
      return phases.includes(before) && phases.includes(after)
        ? null
        : `${before} to ${after}`
    },
    [room.root, UNLOCKS, [...TAKE_PHASES]],
  )

async function startTake(go, room) {
  const { page } = go
  await tapMic(page, room)
  const phase = await waitPhase(
    page,
    room,
    (p) => TAKE_PHASES.has(p),
    'a take never started',
    20_000,
  )
  // A first visit's tap plays Merc's demo, whose result is not one.
  const demo = await page
    .locator(`[data-testid="${room.root}"]`)
    .getAttribute('data-demo')
  if (demo !== null && demo !== 'idle')
    throw new Error(`the mic started the demo (${demo}), not a take`)
  return phase
}

/** Any pill or web toast on screen that announces an unlock. */
const unlockNotices = (page) =>
  page.evaluate(() => {
    const pills = [
      ...document.querySelectorAll(
        '[data-testid="notice-pill"][data-unlock="on"]',
      ),
    ].map((p) => p.textContent)
    const toasts = [
      ...document.querySelectorAll(
        '[role="region"][aria-label="Notifications"] [role="status"]',
      ),
    ].map((t) => t.textContent)
    return [...pills, ...toasts]
  })

/**
 * One room: an unlock in a take left early falls back to the pill; then a
 * take sung to its result with two unlocks announced in it, and one more
 * after it. `full` false sings Long note only (it finishes on a tap).
 */
async function roomCheck(go, room, results, where, options) {
  const at = { step: 'opening the room' }
  try {
    await roomSteps(go, room, results, where, options, at)
  } catch (error) {
    throw new Error(`${at.step}: ${error.message.split('\n')[0]}`)
  }
}

async function roomSteps(go, room, results, where, { pills }, at) {
  const { page } = go
  const step = (what) => {
    at.step = what
  }
  const chip = `[data-testid="${room.prefix}-unlock-chip"]`

  await openRoom(go, room)
  if (pills) {
    // A notice that is not an unlock is still a pill in a room, and must
    // keep clear of the room's bar.
    await go.pillCheck(`${room.prefix} room`, 'plain', {
      shotName: `pill-${room.prefix}-room`,
    })
  }

  // Walked out of mid-take: the unlock it held becomes the pill outside.
  step('a take left early')
  await startTake(go, room)
  await go.unlock(FALLBACK)
  await go.settle(300)
  if ((await unlockNotices(page)).length > 0)
    results.failures.push(`${where}: an unlock raised a notice mid-take`)
  await page.locator('[data-testid="shell-pushed-back"]').click()
  await go.hidden(`[data-testid="${room.root}"]`)
  // The pill shows one notice at a time. A notice the room raised before it
  // was left (the run's save failing against the stand-in, say) is ahead of
  // the fallback in the queue: tap it away, and expect the unlock next.
  let fallback = ''
  const skipped = []
  for (let turn = 0; turn < 3; turn++) {
    await go.visible(PLACED)
    const pill = page.locator(PLACED).first()
    fallback = (await pill.textContent()) ?? ''
    if ((await pill.getAttribute('data-unlock')) === 'on') break
    skipped.push(fallback)
    await page.locator('[data-testid="notice-pill-body"]').first().click()
    // The next notice can follow within the exit animation: wait for this
    // one to go, not for the screen to be empty.
    await page.waitForFunction(
      ([sel, was]) => document.querySelector(sel)?.textContent !== was,
      [PLACED, fallback],
    )
  }
  if (fallback !== `New badge: ${FALLBACK.name}`)
    results.failures.push(
      `${where}: after leaving, the pill reads "${fallback}"`,
    )
  await page.locator('[data-testid="notice-pill-body"]').first().click()
  await go.hidden(PILL)

  // A take to its result.
  step('a take to its result')
  // Long note can end a take on its own within a second or two (the fake
  // voice moves off the note), so the take is tried again until the
  // unlocks land inside one.
  let missed = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await openRoom(go, room)
    await startTake(go, room)
    await go.settle(600)
    missed = await unlockMidTake(page, room)
    if (missed === null) break
    await page.locator('[data-testid="shell-pushed-back"]').click()
    await go.hidden(`[data-testid="${room.root}"]`)
    // Those unlocks were the room's and are now the pill's: clear them.
    const left = page.locator('[data-testid="notice-pill-body"]')
    if ((await left.count()) > 0) await left.first().click()
    await go.hidden(PILL).catch(() => undefined)
  }
  if (missed !== null)
    throw new Error(`no take held still for the unlocks (${missed})`)
  await go.settle(400)
  if ((await page.locator(chip).count()) > 0)
    results.failures.push(`${where}: the chip showed before the result`)
  if ((await unlockNotices(page)).length > 0)
    results.failures.push(`${where}: an unlock raised a notice during the take`)
  if (room.prefix === 'long-note') {
    // Long note finishes on a tap, once the voice is holding the note.
    step('Long note holding')
    await waitPhase(
      page,
      room,
      (phase) => phase === 'hold' || phase === 'result',
      'the voice never held the note',
      30_000,
    )
    // It may have ended on its own: the fake voice moves off the note.
    if ((await phaseOf(page, room)) === 'hold') {
      await go.settle(2500)
      if ((await phaseOf(page, room)) === 'hold')
        await tapMic(page, room, { optional: true })
    }
  }
  await waitPhase(
    page,
    room,
    (phase) => phase === 'result' || phase === 'intro' || phase === 'blocked',
    'the take never ended',
    180_000,
  )
  const phase = await phaseOf(page, room)
  if (phase !== 'result') {
    results.failures.push(
      `${where}: the take ended at "${phase}", not a result`,
    )
    return
  }
  await go.visible(chip)
  step('the chip at the result')
  await go.settle(700)
  const said = await page.locator(chip).textContent()
  if (said !== '2 new badges')
    results.failures.push(`${where}: the chip reads "${said}"`)
  const notices = await unlockNotices(page)
  if (notices.length > 0)
    results.failures.push(
      `${where}: a notice at the result: ${notices.join(' | ')}`,
    )
  const others = await page.locator(PILL).allTextContents()
  await go.shot(`chip-${room.prefix}`)
  await page.locator(chip).click()
  await go.visible(`[data-testid="${room.prefix}-unlock-list"]`)
  const names = await page
    .locator(`[data-testid="${room.prefix}-unlock-list"] li`)
    .allTextContents()
  if (names.join(', ') !== UNLOCKS.map((u) => u.name).join(', '))
    results.failures.push(`${where}: the list reads "${names.join(', ')}"`)
  await go.settle(300)
  await go.shot(`chip-${room.prefix}-open`)

  // After the result: one more joins the chip.
  step('one more after the result')
  await go.unlock(LATE)
  await go.settle(500)
  const later = await page.locator(chip).textContent()
  if (later !== '2 new badges and 1 achievement')
    results.failures.push(
      `${where}: after the result the chip reads "${later}"`,
    )
  if ((await unlockNotices(page)).length > 0)
    results.failures.push(
      `${where}: an unlock after the result raised a notice`,
    )
  const chipBox = await page.locator(chip).boundingBox()
  results.chips.push({
    frame: go.ctx.frame,
    theme: go.ctx.theme,
    room: room.prefix,
    text: said,
    after: later,
    listed: names.length,
    height: chipBox === null ? null : Math.round(chipBox.height),
    otherPills: [...skipped, ...others],
  })
  await page.locator('[data-testid="shell-pushed-back"]').click()
  await go.hidden(`[data-testid="${room.root}"]`)
  await go.settle(400)
  // What the chip showed is not announced again on the way out.
  if ((await unlockNotices(page)).length > 0)
    results.failures.push(`${where}: leaving re-announced what the chip showed`)
}

async function roomSurfaces(browser, args, frame, kit, results) {
  const { context, page, boot } = await openPage(
    browser,
    args,
    frame,
    kit,
    results.failures,
  )
  const go = verbs(page, args, frame, kit, results)
  const full = FULL_TAKE_FRAMES.has(frame.name) && args.theme === 'dark'
  // `--notice-room echo` sings in that room alone.
  const rooms = (full ? ROOMS : ROOMS.slice(0, 1)).filter(
    (room) => args.noticeRoom == null || room.prefix === args.noticeRoom,
  )
  try {
    await walkSections(
      boot,
      rooms.map((room) => [
        room.prefix,
        () =>
          roomCheck(go, room, results, `[${frame.name}] ${room.prefix}`, {
            pills: true,
          }),
      ]),
      results,
      `[${frame.name}]`,
    )
  } finally {
    await context.close()
  }
}

export async function walkNotices(browser, args, frame, kit) {
  const results = {
    failures: [],
    hits: [],
    chips: [],
    screens: [],
  }
  // `--notice-rooms-only` skips the shell's surfaces.
  if (args.noticeRoomsOnly !== true)
    await shellSurfaces(browser, args, frame, kit, results)
  if (frame.rooms && kit.importing) {
    await roomSurfaces(browser, args, frame, kit, results)
  }
  const steps = []
  const where = `[${frame.name} ${args.theme}] notices`
  const covered = results.hits.filter((h) => h.covered > 0).length
  steps.push(
    `${where}: ${results.hits.length} pills on ${results.screens.length} screens, ${covered} covering a control; docked ${results.hits.filter((h) => h.docked === 'top').length} under the status bar, ${results.hits.filter((h) => h.docked === 'below').length} below a header; widths ${Math.min(...results.hits.map((h) => h.width))} to ${Math.max(...results.hits.map((h) => h.width))} px; ${results.hits.reduce((n, h) => n + h.reachable, 0)} controls hit-tested, ${results.hits.reduce((n, h) => n + h.header, 0)} of them in the header band; lowest contrast ${Math.min(...results.hits.flatMap((h) => h.contrast))}:1`,
  )
  for (const chip of results.chips) {
    steps.push(
      `${where}: ${chip.room} chip at the result "${chip.text}", ${chip.listed} listed, then "${chip.after}" (${chip.height} px)${chip.otherPills.length > 0 ? `; other pills: ${chip.otherPills.join(' | ')}` : ''}`,
    )
  }
  if (args.noticeLog !== undefined && args.noticeLog !== null) {
    const { appendFileSync } = await import('node:fs')
    appendFileSync(
      args.noticeLog,
      `${JSON.stringify({ frame: frame.name, theme: args.theme, hits: results.hits, chips: results.chips, failures: results.failures })}\n`,
    )
  }
  return {
    steps,
    failures: results.failures.map((f) => `${where}: ${f}`),
  }
}
