// ============================================================
// Every native surface on its side, with the phone's own insets
// ============================================================
//
// iOS turns the app on an iPhone now (device round 4: Info.plist listed
// portrait alone). A phone on its side has its notch, or its island, at one
// end of every screen and the home indicator along the bottom, and headless
// Chromium resolves every `env(safe-area-inset-*)` to 0 — so a screen that
// ignores them looks right here and wrong in the hand. Chromium's DevTools
// protocol can set them (Emulation.setSafeAreaInsetsOverride), and this walk
// sets them to the phones' own in landscape: 59 at each side and 21 at the
// bottom on a 852 x 393 island phone, 47 and 21 on the 844 x 390 notch phone
// the owner holds.
//
// Then every surface is measured rather than looked at. Every run of text,
// every icon, picture and control that is showing must be
//   - clear of both side insets,
//   - clear of the home indicator's band, unless a scroll lifts it out,
//   - on top where it is drawn: not under the rail, a bar, or an empty slot
//     that still takes taps, unless a scroll brings it out,
//   - whole: not cut by a box that does not scroll,
// and nothing may scroll the page sideways. Each surface is measured where it
// opens and again scrolled to its end.
//
// Wired into probe-bundle.mjs, which owns the browser (with its fake voice,
// so the Sing room's run and its take sheet are real) and passes in its own
// seed, isolation and screenshot helpers.

/** The two phones the brief names, on their sides. */
export const LANDSCAPE_INSET_FRAMES = [
  { width: 852, height: 393, side: 59, bottom: 21 },
  { width: 844, height: 390, side: 47, bottom: 21 },
]

/**
 * Drawn where one of the rules does not apply, each for its own reason.
 *
 * - The alley's plate is the scene itself, cropped by the alley on purpose.
 * - The floating voice pill mounts on a width test (`isNarrow()`), so a
 *   phone on its side gets it and a phone upright does not; on its side it
 *   sits wholly under the rail's first item. Where voice control belongs in
 *   the native app is the owner's call (round 4 report), not a layout fix.
 * - The test build's console handle keeps to the bottom edge. Raised by the
 *   home indicator's inset it would sit on the rail's More, upright.
 */
const EXEMPT = [
  {
    selector: '[data-testid="alley-plate"]',
    rules: ['clipped', 'home-indicator', 'covered'],
  },
  { selector: '[data-testid="voice-control-pill"]', rules: ['covered'] },
  {
    selector: '[data-testid="portable-console-handle"]',
    rules: ['home-indicator'],
  },
]

/** In the page: every rule above, over one surface. */
const audit = ({ scope, exempt }) => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  // The insets as the page resolves them, so a walk whose override did not
  // take says so instead of passing on zeros.
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;' +
    'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) ' +
    'env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'
  document.body.appendChild(probe)
  const read = getComputedStyle(probe)
  const inset = {
    right: parseFloat(read.paddingRight),
    bottom: parseFloat(read.paddingBottom),
    left: parseFloat(read.paddingLeft),
  }
  probe.remove()
  const root = scope === null ? document.body : document.querySelector(scope)
  if (root === null) return { inset, inks: 0, problems: [`no ${scope}`] }

  const round = (n) => Math.round(n * 10) / 10
  const name = (el) => {
    const id =
      el.getAttribute('data-testid') ?? el.getAttribute('data-rail-item')
    const raw =
      typeof el.className === 'string'
        ? el.className
        : (el.getAttribute('class') ?? '')
    const cls = raw.split(/\s+/u).filter(Boolean)[0]
    const text = (el.textContent ?? '').trim().replace(/\s+/gu, ' ')
    return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''}${cls ? `.${cls}` : ''}${text ? ` "${text.slice(0, 32)}"` : ''}`
  }
  const excused = (el, rule) =>
    exempt.some((e) => e.rules.includes(rule) && el.closest(e.selector))
  // Visually hidden text (the sr-only pattern) is for a screen reader.
  const srOnly = (el) => {
    for (let n = el; n instanceof Element; n = n.parentElement) {
      const s = getComputedStyle(n)
      const box = n.getBoundingClientRect()
      if (s.clip !== 'auto' && s.clip !== '') return true
      if (box.width <= 1 && box.height <= 1 && s.overflow === 'hidden') {
        return true
      }
    }
    return false
  }
  const opacity = (el) => {
    let o = 1
    for (let n = el; n instanceof Element; n = n.parentElement) {
      o *= Number(getComputedStyle(n).opacity)
    }
    return o
  }
  const showing = (el) =>
    el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) &&
    el.closest('[inert]') === null &&
    opacity(el) > 0.1 &&
    !srOnly(el)
  const scrolls = (el, axis) => {
    const s = getComputedStyle(el)
    return axis === 'y'
      ? /(auto|scroll)/u.test(s.overflowY) &&
          el.scrollHeight > el.clientHeight + 1
      : /(auto|scroll)/u.test(s.overflowX) &&
          el.scrollWidth > el.clientWidth + 1
  }
  /** The box as drawn: cut by every clipping ancestor, then by the screen. */
  const drawn = (el, r) => {
    let box = { l: r.left, t: r.top, r: r.right, b: r.bottom }
    let cutBy = null
    let scroller = null
    let scrollerX = null
    for (
      let n = el.parentElement;
      n !== null && n !== document.documentElement;
      n = n.parentElement
    ) {
      const s = getComputedStyle(n)
      const y = scrolls(n, 'y')
      const x = scrolls(n, 'x')
      if (scroller === null && y) scroller = n
      if (scrollerX === null && x) scrollerX = n
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        const c = n.getBoundingClientRect()
        const was = (box.r - box.l) * (box.b - box.t)
        if (s.overflowX !== 'visible') {
          box = {
            ...box,
            l: Math.max(box.l, c.left),
            r: Math.min(box.r, c.right),
          }
        }
        if (s.overflowY !== 'visible') {
          box = {
            ...box,
            t: Math.max(box.t, c.top),
            b: Math.min(box.b, c.bottom),
          }
        }
        const now = Math.max(0, box.r - box.l) * Math.max(0, box.b - box.t)
        if (was - now > 1 && cutBy === null && !x && !y) cutBy = n
      }
      if (s.position === 'fixed') break
    }
    const cut = { ...box }
    box = {
      l: Math.max(box.l, 0),
      t: Math.max(box.t, 0),
      r: Math.min(box.r, vw),
      b: Math.min(box.b, vh),
    }
    return { box, cut, cutBy, scroller, scrollerX }
  }
  const area = (b) => Math.max(0, b.r - b.l) * Math.max(0, b.b - b.t)

  // Ink: runs of text, then icons, pictures and controls.
  const inks = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let t = walker.nextNode(); t !== null; t = walker.nextNode()) {
    if (!/\S/u.test(t.textContent ?? '')) continue
    const el = t.parentElement
    if (el === null || el.closest('svg,script,style,noscript,template')) {
      continue
    }
    if (!showing(el)) continue
    const range = document.createRange()
    range.selectNodeContents(t)
    for (const r of range.getClientRects()) {
      if (r.width >= 1 && r.height >= 1) inks.push({ el, r, what: name(el) })
    }
  }
  for (const el of root.querySelectorAll(
    'svg, img, input, select, textarea, canvas, video, [role="slider"]',
  )) {
    const tag = el.tagName.toLowerCase()
    if (tag === 'svg' && el.parentElement?.closest('svg')) continue
    if (!showing(el)) continue
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    // A full-bleed picture or trace is the room's, not content on it.
    if (r.width >= vw * 0.9 && /^(img|canvas|video|svg)$/u.test(tag)) continue
    inks.push({
      el,
      r,
      what: tag === 'svg' ? `the icon in ${name(el.parentElement)}` : name(el),
    })
  }

  const problems = new Set()
  const flag = (ink, rule, text) => {
    if (!excused(ink.el, rule)) problems.add(`${ink.what} ${text}`)
  }
  let counted = 0
  for (const ink of inks) {
    const d = drawn(ink.el, ink.r)
    if (area(d.box) < 1) continue // scrolled away, or not on the screen at all
    counted += 1
    const whole = {
      l: ink.r.left,
      t: ink.r.top,
      r: ink.r.right,
      b: ink.r.bottom,
    }
    if (d.cutBy !== null && area(d.cut) < area(whole) - 1) {
      flag(ink, 'clipped', `is cut by ${name(d.cutBy)}, which does not scroll`)
    }
    if (
      (ink.r.left < -0.5 || ink.r.right > vw + 0.5) &&
      d.scrollerX === null &&
      area(d.cut) > area(d.box) + 1
    ) {
      flag(ink, 'off-screen', 'runs off the side of the screen')
    }
    if (inset.left > 0 && d.box.l < inset.left - 0.5) {
      flag(
        ink,
        'notch',
        `starts at x ${round(d.box.l)}, inside the ${inset.left} px inset`,
      )
    }
    if (inset.right > 0 && d.box.r > vw - inset.right + 0.5) {
      flag(
        ink,
        'notch',
        `ends at x ${round(d.box.r)}, inside the ${inset.right} px inset`,
      )
    }
    const s = d.scroller
    const below =
      s !== null && s.scrollTop + s.clientHeight < s.scrollHeight - 1
    const above = s !== null && s.scrollTop > 0
    if (inset.bottom > 0 && d.box.b > vh - inset.bottom + 0.5 && !below) {
      flag(
        ink,
        'home-indicator',
        `reaches y ${round(d.box.b)}, into the home indicator's ${inset.bottom} px`,
      )
    }
    // Under something else. A sliver at a scroller's edge is not a finding,
    // and neither is anything a scroll towards the covering chrome reveals.
    const cx = (d.box.l + d.box.r) / 2
    const cy = (d.box.t + d.box.b) / 2
    if (d.box.r - d.box.l < 4 || d.box.b - d.box.t < 4) continue
    if (getComputedStyle(ink.el).pointerEvents === 'none') continue
    if (cy < vh / 2 ? above : below) continue
    const hit = document.elementFromPoint(cx, cy)
    if (hit !== null && !ink.el.contains(hit) && !hit.contains(ink.el)) {
      flag(
        ink,
        'covered',
        `is under ${name(hit)} at ${round(cx)}, ${round(cy)}`,
      )
    }
  }
  const page = document.scrollingElement
  if (page.scrollWidth > vw + 0.5) {
    problems.add(`the page scrolls sideways by ${page.scrollWidth - vw} px`)
  }
  return { inset, inks: counted, problems: [...problems] }
}

/** Scrolls every scroller in scope, and the page, to its end. */
const toEnd = (scope) => {
  const root = scope === null ? document.body : document.querySelector(scope)
  if (root === null) return 0
  let moved = 0
  for (const el of [root, ...root.querySelectorAll('*')]) {
    const s = getComputedStyle(el)
    if (
      /(auto|scroll)/u.test(s.overflowY) &&
      el.scrollHeight > el.clientHeight + 1
    ) {
      el.scrollTop = el.scrollHeight
      moved += 1
    }
  }
  return moved
}

/**
 * One frame: every surface the brief names, each measured where it opens and
 * scrolled to its end.
 */
export async function walkLandscapeSurfaces(browser, args, frame, kit) {
  const { isolate, seed, shoot, bootTimeoutMs, stepTimeoutMs, runTimeoutMs } =
    kit
  const viewport = { width: frame.width, height: frame.height }
  const ctx = { ...args, frame: viewport }
  const context = await isolate(
    await browser.newContext({
      viewport,
      // Both phones draw at 3x; the plate and the pictures pick their files by it.
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
      permissions: ['microphone'],
    }),
  )
  const failures = []
  const steps = []
  let at = 'boot'
  try {
    const page = await context.newPage()
    page.on('pageerror', (error) => {
      failures.push(`page error: ${error.message}`)
    })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: {
        top: 0,
        left: frame.side,
        right: frame.side,
        bottom: frame.bottom,
      },
    })
    await page.addInitScript(seed, args.theme)
    await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
    await page
      .locator('#root.loaded')
      .waitFor({ state: 'attached', timeout: bootTimeoutMs })
    const visible = (selector, timeout = stepTimeoutMs) =>
      page
        .locator(selector)
        .first()
        .waitFor({ state: 'visible', timeout })
        .catch(() => {
          throw new Error(`${selector} never showed`)
        })
    const hidden = (selector) =>
      page
        .locator(selector)
        .first()
        .waitFor({ state: 'hidden', timeout: stepTimeoutMs })
        .catch(() => {
          throw new Error(`${selector} never went`)
        })
    const settle = (ms = 400) => page.waitForTimeout(ms)
    await visible('[data-testid="rooms-alley"]')
    await settle(600)

    const measure = async (name, scope, { end = false } = {}) => {
      at = `measuring ${name}`
      const first = await page.evaluate(audit, { scope, exempt: EXEMPT })
      if (
        first.inset.left !== frame.side ||
        first.inset.bottom !== frame.bottom
      ) {
        throw new Error(
          `the insets did not take: the page reads ${JSON.stringify(first.inset)}`,
        )
      }
      await shoot(page, ctx, `landscape-${name}`)
      const problems = first.problems.map((p) => `${name}: ${p}`)
      let inks = first.inks
      if (end && (await page.evaluate(toEnd, scope)) > 0) {
        await settle(300)
        const last = await page.evaluate(audit, { scope, exempt: EXEMPT })
        problems.push(...last.problems.map((p) => `${name}, at its end: ${p}`))
        inks += last.inks
        await shoot(page, ctx, `landscape-${name}-end`)
      }
      if (problems.length > 0) failures.push(...problems)
      else {
        steps.push(
          `landscape ${name}: ${inks} runs of ink, all inside the ${frame.side} px insets, clear of the home indicator and of the chrome`,
        )
      }
    }
    const rail = async (id) => {
      await page.locator(`[data-rail-item="${id}"]`).click()
      await visible(`[data-rail-item="${id}"][aria-current="page"]`)
      await settle()
    }
    const more = async (item) => {
      await page.locator('[data-rail-item="more"]').click()
      await visible('[data-more-item="settings"]')
      await settle(300)
      if (item !== null)
        await page.locator(`[data-more-item="${item}"]`).click()
    }
    const back = async (selector) => {
      await page.locator('[data-testid="shell-pushed-back"]').click()
      await hidden(selector)
      await settle(300)
    }

    // ── The alley, and the rail under every tab ──
    await measure('alley', null)

    // ── The Sing room: resting, the priming door, a live run, its end card ──
    at = 'on the way to the Sing room'
    await rail('stage')
    await visible('[data-testid="sing-room"]')
    await measure('sing-room', null)
    await page.locator('[data-testid="sing-capsule"]').click()
    await visible('[data-testid="sing-priming"]')
    await settle(300)
    await measure('sing-priming', '[data-testid="sing-priming"]', { end: true })
    await page.locator('[data-testid="sing-priming-continue"]').click()
    await hidden('[data-testid="sing-priming"]')
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="sing-note-chip"]')
          ?.getAttribute('data-variant') !== 'quiet',
      undefined,
      { timeout: runTimeoutMs },
    )
    // Past the three seconds of voice a take needs to earn its card.
    await settle(4000)
    await measure('sing-live', null)
    await page
      .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
      .click()
    await visible('[data-testid="sing-take-sheet"]', runTimeoutMs)
    await settle(300)
    await measure('sing-take', '[data-testid="sing-take-sheet"]', { end: true })
    await page.locator('[data-testid="sing-take-discard"]').click()
    await hidden('[data-testid="sing-take-sheet"]')

    // ── The Ear Lab: the bench, its three racks, a drill and the report ──
    at = 'on the way to the Ear Lab'
    await rail('ear')
    await visible('[data-testid="ear-room-shell"]')
    await measure('ear-lab', null, { end: true })
    const rack = '[data-testid="ear-rack"]'
    for (const [chip, label] of [
      ['[data-testid="ear-readiness-chip"]', 'ear-readiness'],
      ['[data-testid="ear-room-chip"]', 'ear-rooms'],
    ]) {
      await page.locator(chip).first().click()
      await visible(rack)
      await settle()
      await measure(label, rack, { end: true })
      await page.keyboard.press('Escape')
      await hidden(rack)
    }
    await page
      .getByRole('button', { name: /Instruments/u })
      .first()
      .click()
    await visible(rack)
    await settle()
    await measure('ear-instruments', rack, { end: true })
    await page
      .locator(`${rack} button`, { hasText: 'Hairline' })
      .first()
      .click()
    await visible('[data-testid="ear-stage"]')
    await settle(600)
    await measure('ear-drill', '[data-testid="ear-stage"]', { end: true })
    await page
      .locator('[data-testid="ear-stage"] button[aria-label^="Back"]')
      .first()
      .click()
    await hidden('[data-testid="ear-stage"]')
    await page
      .getByRole('button', { name: /Ear Report/u })
      .first()
      .click()
    await visible('[data-testid="ear-report"]')
    await settle(600)
    await measure('ear-report', '[data-testid="ear-report"]', { end: true })
    await page
      .locator('[data-testid="ear-report"] button[aria-label^="Back"]')
      .first()
      .click()
    await hidden('[data-testid="ear-report"]')

    // ── Progress ──
    at = 'on the way to Progress'
    await rail('progress')
    // Measured loaded: the skeleton that stands in first has no words in it.
    await page.waitForFunction(
      () =>
        document.querySelector('section[aria-busy="true"]') === null &&
        [...document.querySelectorAll('h1')].some(
          (h) => (h.textContent ?? '').trim() === 'Progress',
        ),
      undefined,
      { timeout: stepTimeoutMs },
    )
    await measure('progress', null, { end: true })

    // ── More, and everything it pushes ──
    at = 'on the way to More'
    await more(null)
    await measure('more', '[role="dialog"][aria-label="More"]')
    await page.keyboard.press('Escape')
    await hidden('[data-more-item="settings"]')

    const pushed = '[data-testid="shell-pushed"]'
    await more('settings')
    await visible(pushed)
    await settle()
    await measure('settings', pushed, { end: true })
    await back(pushed)

    await more('account')
    await visible(pushed)
    await settle()
    await measure('account', pushed)
    await page.locator('[data-testid="show-login"]').first().click()
    await visible('[data-testid="auth-modal-overlay"]')
    await settle()
    await measure('sign-in', '[data-testid="auth-modal-overlay"]', {
      end: true,
    })
    await page.locator('[data-testid="auth-modal-close"]').click()
    await hidden('[data-testid="auth-modal-overlay"]')
    await back(pushed)

    await more('developer')
    await visible('[data-testid="shell-developer"]')
    await settle()
    await measure('developer', '[data-testid="shell-developer"]', { end: true })
    await back('[data-testid="shell-developer"]')
  } catch (error) {
    failures.push(`${at}: ${error.message.split('\n')[0]}`)
  } finally {
    await context.close()
  }
  if (failures.length > 0) throw new Error(failures.join('; '))
  return steps.map((step) => `[${frame.width}x${frame.height}] ${step}`)
}
