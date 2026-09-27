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

import { readSideways } from './probe-karaoke.mjs'

/** The two phones the brief names, on their sides. */
export const LANDSCAPE_INSET_FRAMES = [
  { width: 852, height: 393, side: 59, bottom: 21 },
  { width: 844, height: 390, side: 47, bottom: 21 },
]

/**
 * Drawn where one of the rules does not apply, each for its own reason.
 *
 * - The alley's plate is the scene itself, cropped by the alley on purpose.
 * - The test build's console handle keeps to the bottom edge. Raised by the
 *   home indicator's inset it would sit on the rail's More, upright.
 */
const EXEMPT = [
  {
    selector: '[data-testid="alley-plate"]',
    rules: ['clipped', 'home-indicator', 'covered'],
  },
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
 * The fake voice sings A4 and then C5: three semitones.
 *
 * Device round 5: on its side the Sing room drew the line as one flat row.
 * The canvas is 117 px tall there, and the stage's bands (34 px above the
 * view, 78 under it) left five of them for the whole range. A step that did
 * not read how far apart the line draws two notes would pass that picture.
 */
const TRACE_SEMITONES = 3
/** Upright the line moves about 10 px a semitone, and 2.4 on its side. */
const TRACE_MIN_PX_PER_SEMITONE = 1.5
/** Left of this the canvas draws the live marker, its pill and the row labels. */
const TRACE_LEFT_PX = 30

/**
 * In the page: how far apart the Sing trace draws its notes, in CSS px.
 *
 * Only the line itself is opaque and saturated there: its glow, the head's
 * halo, the grid and the labels are translucent, and the cores are white. So
 * each column right of the marker gives the line's centre, and the 5th and
 * 95th percentiles of those are the two notes. A detection glitch at an onset
 * is a few columns, and moves neither.
 */
const readTrace = (left) => {
  const canvas = document.querySelector('[data-testid="sing-stage"] canvas')
  if (!(canvas instanceof HTMLCanvasElement)) return null
  const { width, height } = canvas
  const data = canvas.getContext('2d').getImageData(0, 0, width, height).data
  const scale = height / canvas.clientHeight
  const centres = []
  for (let x = Math.ceil(left * scale); x < width; x += 1) {
    let sum = 0
    let count = 0
    for (let y = 0; y < height; y += 1) {
      const i = (y * width + x) * 4
      const hi = Math.max(data[i], data[i + 1], data[i + 2])
      const lo = Math.min(data[i], data[i + 1], data[i + 2])
      if (data[i + 3] < 200 || hi - lo < 60) continue
      sum += y
      count += 1
    }
    if (count > 0) centres.push(sum / count / scale)
  }
  centres.sort((a, b) => a - b)
  const at = (q) =>
    centres[Math.min(centres.length - 1, Math.floor(q * centres.length))]
  return {
    height: Math.round(canvas.clientHeight),
    columns: centres.length,
    spread: centres.length === 0 ? 0 : at(0.95) - at(0.05),
  }
}

/**
 * In the page: the coach mark, the pill it points at, and what it must not
 * cover on its side (device round 5): the key chip and the stage's line.
 */
const readCoachMark = () => {
  const box = (selector) => {
    const el = document.querySelector(selector)
    if (el === null) return null
    const r = el.getBoundingClientRect()
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  }
  return {
    coach: box('[data-testid="sing-coach-mark"]'),
    pill: box('[data-testid="sing-note-chip"]'),
    key: box('[data-testid="sing-key-chip"]'),
    stage: box('[data-testid="sing-stage"]'),
  }
}

/** Whether two boxes share more than half a pixel each way. */
const overlaps = (a, b) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5

/**
 * In the page: where the hosted zen stage draws its song line, its play
 * button and its lyrics, as [left, right] and [top, bottom] in CSS px.
 */
const readColumns = () => {
  const box = (selector) => {
    const el = document.querySelector(selector)
    if (el === null) return null
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
  }
  const song = box('[data-testid="karaoke-songline"]')
  const play = box(
    '[data-testid="karaoke-mobile-stage"] button[aria-label="Play"], [data-testid="karaoke-mobile-stage"] button[aria-label="Pause"]',
  )
  const lyrics = box('[data-testid="karaoke-lyrics"]')
  const stage = box('[data-testid="karaoke-mobile-stage"]')
  const round = (n) => Math.round(n)
  return {
    song,
    play,
    lyricsBox: lyrics,
    stage,
    left:
      song === null || play === null
        ? null
        : [
            round(Math.min(song.left, play.left)),
            round(Math.max(song.right, play.right)),
          ],
    lyrics: lyrics === null ? null : [round(lyrics.left), round(lyrics.right)],
  }
}

/**
 * In the page: whether the shell's rail is up, and where it and the lyrics
 * column are drawn.
 */
const readRailOverLyrics = () => {
  const box = (el) => {
    if (el === null) return null
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
  }
  return {
    up: document.documentElement.getAttribute('data-shell-rail') === 'on',
    rail: box(document.querySelector('[data-testid="shell-rail"] .mp-rail')),
    lyrics: box(document.querySelector('[data-testid="karaoke-lyrics"]')),
  }
}

/** What is wrong with the columns `readColumns` read, if anything. */
const columnProblems = (c) => {
  if (c.song === null || c.play === null || c.lyricsBox === null) {
    return ['the song line, the play button or the lyrics is missing']
  }
  const problems = []
  if (c.song.right > c.lyricsBox.left + 0.5) {
    problems.push('the song line runs into the lyrics column')
  }
  if (c.play.right > c.lyricsBox.left + 0.5) {
    problems.push('the transport runs into the lyrics column')
  }
  if (!(c.play.top > c.song.bottom)) {
    problems.push('the transport is not under the song line')
  }
  const tall = c.lyricsBox.bottom - c.lyricsBox.top
  const stageTall = c.stage.bottom - c.stage.top
  if (tall < stageTall * 0.5) {
    problems.push(
      `the lyrics column is ${Math.round(tall)} px of ${Math.round(stageTall)}`,
    )
  }
  const leftWide = c.play.right - Math.min(c.song.left, c.play.left)
  if (c.lyricsBox.right - c.lyricsBox.left <= leftWide) {
    problems.push('the lyrics column is not the wider one')
  }
  return problems
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
    // The first live run shows the coach mark. Under the pill it would sit on
    // the line, so on its side it goes beside the pill, arrow pointing left.
    at = 'reading the coach mark'
    const mark = await page.evaluate(readCoachMark)
    if (mark.coach === null || mark.pill === null) {
      throw new Error('no coach mark or no pitch pill on the first live run')
    }
    const markMiddle = (mark.coach.top + mark.coach.bottom) / 2
    const markGap = mark.coach.left - mark.pill.right
    // Near enough for its arrow to reach across the gap.
    const beside =
      markGap >= 4 &&
      markGap <= 20 &&
      markMiddle >= mark.pill.top &&
      markMiddle <= mark.pill.bottom
    const clear = [mark.pill, mark.key, mark.stage].every(
      (box) => box === null || !overlaps(mark.coach, box),
    )
    if (!beside || !clear) {
      failures.push(
        `coach mark: not beside the pill and clear of it, the key chip and the stage: ${JSON.stringify(mark)}`,
      )
    } else {
      steps.push(
        `coach mark: beside the pitch pill, ${Math.round(markGap)} px right of it, clear of the key chip and the stage`,
      )
    }
    at = 'reading the Sing trace'
    await page
      .waitForFunction(
        () =>
          (
            document
              .querySelector('[data-testid="sing-note-chip"]')
              ?.getAttribute('aria-label') ?? ''
          ).startsWith('C5'),
        undefined,
        { timeout: runTimeoutMs },
      )
      .catch(() => {
        throw new Error('the note chip never said C5')
      })
    await settle(800)
    const trace = await page.evaluate(readTrace, TRACE_LEFT_PX)
    if (trace === null) throw new Error('no canvas in the Sing stage')
    const perSemitone = trace.spread / TRACE_SEMITONES
    const read = `A4 and C5 drawn ${trace.spread.toFixed(1)} px apart on a ${trace.height} px canvas, ${perSemitone.toFixed(2)} px a semitone over ${trace.columns} columns`
    if (perSemitone < TRACE_MIN_PX_PER_SEMITONE) {
      failures.push(
        `sing trace: ${read}, under ${TRACE_MIN_PX_PER_SEMITONE}; the line is one flat row`,
      )
    } else steps.push(`sing trace: ${read}`)
    await page
      .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
      .click()
    await visible('[data-testid="sing-take-sheet"]', runTimeoutMs)
    await settle(300)
    await measure('sing-take', '[data-testid="sing-take-sheet"]', { end: true })
    // Kept, so the account offer rises over the room a beat later (S6 2a):
    // on its side it sits in the middle, 560 wide, the room at both ends.
    await page.locator('[data-testid="sing-take-keep"]').click()
    await hidden('[data-testid="sing-take-sheet"]')
    at = 'on the way to the account offer'
    await visible('[data-testid="account-offer"]')
    await settle()
    const offer = '[data-testid="sheet-panel"]'
    await measure('account-offer', offer, { end: true })
    const placed = await page.evaluate((selector) => {
      const r = document.querySelector(selector)?.getBoundingClientRect()
      return r === undefined
        ? null
        : {
            width: r.width,
            left: r.left,
            right: window.innerWidth - r.right,
          }
    }, offer)
    if (
      placed === null ||
      placed.width > 560.5 ||
      Math.abs(placed.left - placed.right) > 1
    ) {
      failures.push(`account offer on its side: ${JSON.stringify(placed)}`)
    } else {
      steps.push(
        `landscape account offer: ${Math.round(placed.width)} px wide, centred, the room showing ${Math.round(placed.left)} px at each end`,
      )
    }
    // Sign in, not Later, so Settings below still has the card to measure.
    await page.locator('[data-testid="offer-sign-in"]').click()
    await visible('[data-testid="signin-sheet"]')
    await page.keyboard.press('Escape')
    await hidden('[data-testid="signin-sheet"]')

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
    // Settings is a stack now (S6): a row pushes a screen of its own over it,
    // and each level is measured the same way before Back walks down it.
    at = 'on the way to Appearance'
    await page.locator('[data-settings-row="appearance"]').click()
    await visible('[data-testid="appearance-screen"]')
    await settle()
    await measure('appearance', pushed)
    await back('[data-testid="appearance-screen"]')
    await visible('[data-testid="settings-screen"]')
    await back(pushed)

    // More's Account tile lands on Account, with Settings under it.
    at = 'on the way to Account'
    await more('account')
    await visible('[data-testid="account-screen"]')
    await settle()
    await measure('account', pushed)
    // Its one button opens the sign-in sheet over it (S6 step 3), measured
    // the way the web dialog it replaced was.
    at = 'on the way to the sign-in sheet'
    await page.locator('[data-testid="account-sign-in"]').click()
    await visible('[data-testid="signin-sheet"]')
    await settle()
    await measure('sign-in', '[role="dialog"][aria-label="Sign in"]', {
      end: true,
    })
    await page.keyboard.press('Escape')
    await hidden('[data-testid="signin-sheet"]')
    await back('[data-testid="account-screen"]')
    await visible('[data-testid="settings-screen"]')
    await back(pushed)

    await more('developer')
    await visible('[data-testid="shell-developer"]')
    await settle()
    // The Audio section says which way the screen is turned and what the
    // insets resolve to, as a phone's copied report will (device round 5).
    at = 'reading the Orientation rows'
    const rows = await page.evaluate(() => {
      const read = (label) =>
        document
          .querySelector(`[data-audio-row="${label}"] dd`)
          ?.textContent?.trim() ?? null
      return { orientation: read('Orientation'), insets: read('Safe insets') }
    })
    const size = `${frame.width} x ${frame.height}`
    const inUse = `in use 0 ${frame.side} ${frame.bottom} ${frame.side}`
    if (
      rows.orientation !== `landscape-primary · ${size}` ||
      !rows.insets?.endsWith(inUse)
    ) {
      failures.push(`developer rows: ${JSON.stringify(rows)}`)
    } else {
      steps.push(
        `landscape developer: Orientation "${rows.orientation}", Safe insets "${rows.insets}"`,
      )
    }
    await measure('developer', '[data-testid="shell-developer"]', { end: true })
    await back('[data-testid="shell-developer"]')

    // ── Piano and Guitar, from More ──
    // The studio's own rooms, shared with the web app. A phone on its side
    // is wider than the web's phone rule, so each draws its wide layout: the
    // song status bar over Piano and Guitar, and Piano's practice-view
    // toolbar.
    for (const [item, ready] of [
      ['piano', '[data-testid="practice-view-toolbar"]'],
      ['guitar', '[data-testid="gp-song-status-bar"]'],
    ]) {
      at = `on the way to ${item}`
      await more(item)
      await visible(ready)
      await settle(600)
      await measure(item, null, { end: true })
    }
    // ── Karaoke, from More: the room on its side (plan S8 D3 A) ──
    // Two columns: the song, the bar and the transport on the left, the
    // lyrics on the right. Measured cued, and again playing, when the rail
    // has stepped aside and zen's bar is down on the home indicator's band.
    // Last, because a song paused in the room is a run: the rail stays
    // aside until it ends, and Back parks it under a session pill.
    at = 'on the way to karaoke'
    const stageButton = (label) =>
      `[data-testid="karaoke-mobile-stage"] button[aria-label="${label}"]`
    await more('karaoke')
    await visible('[data-testid="karaoke-room"]')
    await page
      .locator(`${stageButton('Play')}:not([disabled])`)
      .waitFor({ state: 'visible', timeout: runTimeoutMs })
      .catch(() => {
        throw new Error('no song ready to play in the room')
      })
    await settle(600)
    await measure('karaoke', null, { end: true })
    at = 'reading the two columns'
    const columns = await page.evaluate(readColumns)
    const problems = columnProblems(columns)
    if (problems.length > 0) {
      failures.push(
        `karaoke columns: ${problems.join('; ')} (${JSON.stringify(columns)})`,
      )
    } else {
      steps.push(
        `landscape karaoke: two columns, the song and the transport in ${columns.left.join('..')}, the lyrics in ${columns.lyrics.join('..')}`,
      )
    }
    // Cued, the rail is up (plan §4.2) and runs along the bottom under both
    // columns: the lyrics column has to stop above it, or the line being
    // read is under the rail (review V3).
    at = 'the rail beside the lyrics'
    const railed = await page.evaluate(readRailOverLyrics)
    const px = (b) =>
      b === null
        ? 'none'
        : `[${[b.left, b.top, b.right, b.bottom].map(Math.round).join(', ')}]`
    if (!railed.up || railed.rail === null) {
      failures.push(
        `karaoke cued: the rail is not up before the first play (${JSON.stringify(railed)})`,
      )
    } else if (railed.lyrics === null || overlaps(railed.rail, railed.lyrics)) {
      failures.push(
        `karaoke cued: the rail ${px(railed.rail)} covers the lyrics column ${px(railed.lyrics)}`,
      )
    } else {
      steps.push(
        `landscape karaoke cued: the rail ${px(railed.rail)} is clear of the lyrics column ${px(railed.lyrics)}`,
      )
    }
    at = 'playing on its side'
    await page.locator(stageButton('Play')).click()
    await visible(stageButton('Pause'))
    await settle(1200)
    await measure('karaoke-playing', null)
    await page.locator(stageButton('Pause')).click()
    await visible(stageButton('Play'))

    // The options, and the studio they push, which must not scroll sideways
    // on its side either (plan step 12).
    at = 'on the way to the karaoke options'
    const options = '[role="dialog"][aria-label="Karaoke options"]'
    await page.locator('[data-testid="shell-room-gear"]').click()
    await visible(options)
    await settle()
    await measure('karaoke-options', options, { end: true })
    at = 'on the way to the karaoke studio'
    await page.locator('button[aria-label="Manage songs"]').click()
    await visible('[data-testid="karaoke-studio"]')
    await visible('.history-list-inline .uvr-session-result')
    await settle(600)
    await measure('karaoke-studio', pushed, { end: true })
    const wide = await page.evaluate(readSideways, pushed)
    if (wide.over.length > 0) {
      failures.push(...wide.over.map((line) => `karaoke studio: ${line}`))
    } else {
      steps.push(
        `landscape karaoke studio: none of its ${wide.elements} elements is wider than its box`,
      )
    }
    await back('[data-testid="karaoke-studio"]')
    await visible('[data-testid="karaoke-room"]')
  } catch (error) {
    failures.push(`${at}: ${error.message.split('\n')[0]}`)
  } finally {
    await context.close()
  }
  if (failures.length > 0) throw new Error(failures.join('; '))
  return steps.map((step) => `[${frame.width}x${frame.height}] ${step}`)
}
