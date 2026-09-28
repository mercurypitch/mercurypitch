// ============================================================
// Two rooms with a run each, walked against the built bundle
// ============================================================
//
// Sing and Karaoke both have runs of their own, and the shell holds one: the
// session pill is the way back to it from wherever the singer went. On
// TestFlight 0.7.0 (owner, 28 Sep) the two rooms met:
//
//   Karaoke played, then Sing. The Karaoke pill sat over the Sing room, and
//   singing could not start there.
//
//   Sing sang, then Karaoke. The Sing pill sat on Karaoke's own bar, over
//   its playback controls.
//
// The rule (run-shell-store.ts, "A room's own run comes first"): a room with
// a run of its own that comes on screen lets go of the run held for another
// room. So neither room ever has the other's pill over it, and nothing is
// ended: the room let go of keeps its own place, and going back to it
// brings its run back paused. This walks both sequences the way a finger
// would, and then goes back for what was left: the Karaoke song at its
// place, and the Sing take, which ends on its own card.
//
// THE PILL ON EVERY TAB (TestFlight 0.7.1, owner, 28 Sep): a Sing run parked,
// then the Ear Lab, and the "<room> · paused" pill sat on the bench's Today,
// Calibrate, Instruments and Ear Report and took their taps. The Ear Lab,
// Piano and Guitar have runs of their own that the shell does not drive, and
// let go of the parked run the same way. So the third walk parks a Sing run
// and takes it everywhere the pill can go: the alley at rest and with a door
// picked, Progress, Settings and every screen it pushes, the account and
// Developer. On none of them may the pill lie over a control, unless the
// control's scroller can still lift it out from under it; each is measured
// where it opens and again at its end. Then the Ear Lab, Piano and Guitar in
// turn: no pill there, and back in Sing the take is paused under its own
// transport, every time.
//
// Walked upright on each frame, with the phone's own status bar and home
// indicator (probe-safe-areas.mjs), and on each phone turned sideways with
// its notch and home-indicator insets (probe-landscape.mjs). Wired into
// probe-bundle.mjs, which owns the browser and passes its helpers in.

import { readStage } from './probe-karaoke.mjs'
import { toEnd } from './probe-landscape.mjs'

const PILL = '[data-testid="shell-session-pill"]'
const STAGE = '[data-testid="karaoke-mobile-stage"]'
const SING = '[data-testid="sing-room"]'
const KARAOKE = '[data-testid="karaoke-room"]'

/**
 * In the page: the pill, if one is drawn, and every control of the room in
 * `scope` it lies over, by what a finger at that control's centre would hit.
 */
const readPill = (scope) => {
  const pill = document.querySelector('[data-testid="shell-session-pill"]')
  const name = (el) =>
    el.getAttribute('data-testid') ??
    el.getAttribute('aria-label') ??
    el.tagName.toLowerCase()
  if (pill === null) return { pill: null, label: null, covers: [] }
  const p = pill.getBoundingClientRect()
  const room = document.querySelector(scope)
  const covers = []
  for (const el of room?.querySelectorAll(
    'button, [role="button"], [role="slider"], input, a[href]',
  ) ?? []) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const overlaps =
      r.left < p.right &&
      r.right > p.left &&
      r.top < p.bottom &&
      r.bottom > p.top
    if (!overlaps) continue
    const hit = document.elementFromPoint(
      (Math.max(r.left, p.left) + Math.min(r.right, p.right)) / 2,
      (Math.max(r.top, p.top) + Math.min(r.bottom, p.bottom)) / 2,
    )
    covers.push(
      `${name(el)}${pill.contains(hit) ? ' (the pill takes its tap)' : ''}`,
    )
  }
  return {
    pill: [p.left, p.top, p.width, p.height].map((n) => Math.round(n)),
    label:
      pill
        .querySelector('[data-testid="shell-session-pill-name"]')
        ?.textContent?.trim() ?? null,
    covers,
  }
}

/**
 * In the page: every control the pill lies over in `scope`, and what a finger
 * at the overlap would hit. A control whose scroller can still scroll on is
 * not one: scrolling lifts it out from under the pill, and the reading at
 * the end of the scroll is the one that counts. A sliver under a pixel is
 * not an overlap.
 */
const readPillOver = (scope) => {
  const pill = document.querySelector('[data-testid="shell-session-pill"]')
  if (pill === null) return { pill: null, label: null, covers: [], lifted: 0 }
  const p = pill.getBoundingClientRect()
  const root = document.querySelector(scope) ?? document.body
  const name = (el) =>
    el.getAttribute('data-testid') ??
    el.getAttribute('aria-label') ??
    ((el.textContent ?? '').trim().replace(/\s+/gu, ' ').slice(0, 32) ||
      el.tagName.toLowerCase())
  const scrollerOf = (el) => {
    for (
      let n = el.parentElement;
      n !== null && n !== document.documentElement;
      n = n.parentElement
    ) {
      const s = getComputedStyle(n)
      if (
        /(auto|scroll)/u.test(s.overflowY) &&
        n.scrollHeight > n.clientHeight + 1
      ) {
        return n
      }
    }
    return null
  }
  const covers = []
  let lifted = 0
  for (const el of root.querySelectorAll(
    'button, a[href], input, select, textarea, [role="button"], [role="slider"], [role="switch"], [role="tab"], [role="link"], [role="checkbox"], [role="radio"]',
  )) {
    if (pill.contains(el)) continue
    if (
      !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })
    )
      continue
    if (el.closest('[inert], [aria-hidden="true"]') !== null) continue
    if (getComputedStyle(el).pointerEvents === 'none') continue
    const r = el.getBoundingClientRect()
    const w = Math.min(r.right, p.right) - Math.max(r.left, p.left)
    const h = Math.min(r.bottom, p.bottom) - Math.max(r.top, p.top)
    if (w <= 1 || h <= 1) continue
    const s = scrollerOf(el)
    if (s !== null && s.scrollTop + s.clientHeight < s.scrollHeight - 1) {
      lifted += 1
      continue
    }
    const hit = document.elementFromPoint(
      Math.max(r.left, p.left) + w / 2,
      Math.max(r.top, p.top) + h / 2,
    )
    if (hit === null) continue
    if (pill.contains(hit)) covers.push(`${name(el)} (the pill takes its tap)`)
    else if (el.contains(hit)) covers.push(`${name(el)} (drawn over the pill)`)
  }
  return {
    pill: [p.left, p.top, p.width, p.height].map((n) => Math.round(n)),
    label:
      pill
        .querySelector('[data-testid="shell-session-pill-name"]')
        ?.textContent?.trim() ?? null,
    covers,
    lifted,
  }
}

/** In the page: the shell's bottom edge, as a singer sees it. */
const readEdge = () => ({
  rail: document.documentElement.getAttribute('data-shell-rail') === 'on',
  transport:
    document
      .querySelector('[data-testid="shell-transport-layer"]')
      ?.classList.contains('is-in') ?? false,
  pill: document.querySelector('[data-testid="shell-session-pill"]') !== null,
  hash: window.location.hash,
})

/** In the page: what the element at a point is, by its test id. */
const readHit = ([x, y]) => {
  const hit = document.elementFromPoint(x, y)
  const named = hit?.closest('[data-testid]')
  return named?.getAttribute('data-testid') ?? hit?.tagName ?? null
}

/**
 * The two phones' own insets upright: the status bar, and the home indicator
 * the dock and its pill sit above (probe-safe-areas.mjs).
 */
const UPRIGHT_INSETS = new Map([
  ['393x852', { top: 59, right: 0, bottom: 34, left: 0 }],
  ['390x844', { top: 47, right: 0, bottom: 34, left: 0 }],
])

async function openPage(browser, args, frame, kit, failures) {
  const { isolate, seed, bootTimeoutMs, stepTimeoutMs } = kit
  const sideways = frame.side !== undefined
  const viewport = { width: frame.width, height: frame.height }
  const insets = sideways
    ? { top: 0, left: frame.side, right: frame.side, bottom: frame.bottom }
    : (UPRIGHT_INSETS.get(`${frame.width}x${frame.height}`) ?? null)
  const context = await isolate(
    await browser.newContext({
      viewport,
      deviceScaleFactor: sideways ? 3 : 2,
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
  if (insets !== null) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets })
  }
  await page.addInitScript(seed, args.theme)
  await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
  await page
    .locator('#root.loaded')
    .waitFor({ state: 'attached', timeout: bootTimeoutMs })
  await page
    .locator('[data-testid="rooms-alley"]')
    .waitFor({ state: 'visible', timeout: stepTimeoutMs })
  await page.waitForTimeout(600)
  return { context, page }
}

/** The walk's own verbs, over one page. */
function verbs(page, args, frame, kit) {
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
  const settle = (ms = 400) => page.waitForTimeout(ms)
  /** A finger on the element's centre: whatever is on top takes the tap. */
  const finger = async (selector) => {
    const box = await page.locator(selector).first().boundingBox()
    if (box === null) throw new Error(`${selector} is not on screen`)
    const at = [box.x + box.width / 2, box.y + box.height / 2]
    const hit = await page.evaluate(readHit, at)
    await page.touchscreen.tap(at[0], at[1])
    return hit
  }
  return {
    visible,
    settle,
    finger,
    shot: (name) => shoot(page, ctx, name),
    edge: () => page.evaluate(readEdge),
    pill: (scope) => page.evaluate(readPill, scope),
    over: (scope) => page.evaluate(readPillOver, scope),
    /** Every scroller back to its top, so the rail unfolds again. */
    toTop: async () => {
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('*')) {
          if (el.scrollTop > 0) el.scrollTop = 0
        }
      })
      await settle(300)
    },
    toEnd: (scope) => page.evaluate(toEnd, scope),
    /** A destination behind More. */
    more: async (item) => {
      await page.locator('[data-rail-item="more"]').click()
      await visible(`[data-more-item="${item}"]`)
      await settle(300)
      await page.locator(`[data-more-item="${item}"]`).click()
    },
    stage: () => page.evaluate(readStage),
    sing: () => page.evaluate(() => window.mpSingRoom?.() ?? null),
    rail: async (id) => {
      await page.locator(`[data-rail-item="${id}"]`).click()
      await visible(`[data-rail-item="${id}"][aria-current="page"]`)
      await settle()
    },
    /** Karaoke is in More, upright and on its side alike. */
    karaoke: async () => {
      await page.locator('[data-rail-item="more"]').click()
      await visible('[data-more-item="karaoke"]')
      await settle(300)
      await page.locator('[data-more-item="karaoke"]').click()
      await visible(KARAOKE)
      await page
        .locator(`${STAGE} button[aria-label="Play"]:not([disabled])`)
        .waitFor({ state: 'visible', timeout: runTimeoutMs })
        .catch(() => {
          throw new Error('no song ready to play in the Karaoke room')
        })
      await settle(600)
    },
    /**
     * A Sing run, from rest: Sing a note, the door, Continue, live, and then
     * `seconds` of it. A take the end card keeps needs three seconds of
     * voice (take-summary.ts, MIN_VOICED_MS); a shorter one ends on none.
     */
    startSinging: async (seconds = 0) => {
      const hit = await finger('[data-testid="sing-capsule"]')
      await visible('[data-testid="sing-priming"]').catch(async () => {
        throw new Error(
          `Sing a note did not open the priming door: the tap landed on ${hit}, and the page is at ${JSON.stringify(await page.evaluate(readEdge))}`,
        )
      })
      await page.locator('[data-testid="sing-priming-continue"]').click()
      await page
        .waitForFunction(() => window.mpSingRoom?.().state === 'live', null, {
          timeout: runTimeoutMs,
        })
        .catch(async () => {
          throw new Error(
            `the Sing run never went live: ${JSON.stringify(await page.evaluate(() => window.mpSingRoom?.()))}`,
          )
        })
      await page
        .waitForFunction(() => (window.mpSingRoom?.().trail ?? 0) > 60, null, {
          timeout: runTimeoutMs,
        })
        .catch(() => {
          throw new Error('the Sing run drew no trace')
        })
      await page
        .waitForFunction(
          (at) => (window.mpSingRoom?.().elapsedSeconds ?? 0) >= at,
          seconds,
          { timeout: runTimeoutMs },
        )
        .catch(() => {
          throw new Error(`the Sing run never reached ${seconds}s`)
        })
    },
    /** Out of a Sing run the way the shell offers: the chip, then Rooms. */
    leaveSing: async () => {
      await page.locator('[data-testid="shell-chip"]').click()
      await page.locator('[data-column-item="rooms"]').click()
      await visible('[data-testid="rooms-alley"]')
      await visible(PILL)
      await settle()
    },
    /** Out of the Karaoke room mid-song: the room header's Back. */
    leaveKaraoke: async () => {
      await page.locator('[data-testid="shell-room-back"]').click()
      await visible('[data-testid="rooms-alley"]')
      await visible(PILL)
      await settle()
    },
  }
}

/** Karaoke played, then Sing; then back to the Karaoke song. */
async function karaokeThenSing(browser, args, frame, kit) {
  const failures = []
  let line = null
  const { context, page } = await openPage(browser, args, frame, kit, failures)
  try {
    const go = verbs(page, args, frame, kit)
    await go.karaoke()
    await page.locator(`${STAGE} button[aria-label="Play"]`).tap()
    await go.visible(`${STAGE} button[aria-label="Pause"]`)
    await page.waitForTimeout(2600)
    const played = await go.stage()
    if (!(played.elapsed >= 1)) {
      throw new Error(`the song did not play: ${JSON.stringify(played)}`)
    }
    await go.leaveKaraoke()
    const parkedPill = await go.pill('body')

    await go.rail('stage')
    await go.visible(SING)
    await go.settle(600)
    const inSing = await go.pill(SING)
    await go.shot('handover-sing-arrival')
    if (inSing.pill !== null) {
      failures.push(
        `the "${inSing.label}" pill is drawn over the Sing room at ${inSing.pill.join(',')}${inSing.covers.length > 0 ? `, over ${inSing.covers.join(', ')}` : ''}`,
      )
    }
    await go.startSinging()
    const live = await go.edge()
    await go.shot('handover-sing-live')
    if (live.pill || live.rail || !live.transport) {
      failures.push(
        `singing started, but the bottom edge is not the Sing run's: ${JSON.stringify(live)}`,
      )
    }

    // Back to the song: at its place, not over.
    await go.leaveSing()
    await go.karaoke()
    const again = await go.stage()
    const inKaraoke = await go.pill(KARAOKE)
    if (inKaraoke.pill !== null) {
      failures.push(
        `the "${inKaraoke.label}" pill is drawn over the Karaoke room at ${inKaraoke.pill.join(',')}`,
      )
    }
    if (again.title !== played.title || again.elapsed < played.elapsed - 1) {
      failures.push(
        `the Karaoke song did not come back at its place: left ${JSON.stringify(played)}, found ${JSON.stringify(again)}`,
      )
    }
    line = `Karaoke played to ${played.elapsed}s and parked under the "${parkedPill.label}" pill; in Sing no pill, Sing a note opened the door and the run went live with its own transport, the rail aside; back in Karaoke "${again.title}" is cued at ${again.elapsed}s, where it was left`
  } catch (error) {
    failures.push(error.message.split('\n')[0])
  } finally {
    await context.close()
  }
  if (failures.length > 0) throw new Error(failures.join('; '))
  return [line]
}

/** Sing sang, then Karaoke; then back to the Sing take. */
async function singThenKaraoke(browser, args, frame, kit) {
  const failures = []
  let line = null
  const { context, page } = await openPage(browser, args, frame, kit, failures)
  try {
    const go = verbs(page, args, frame, kit)
    await go.rail('stage')
    await go.visible(SING)
    await go.startSinging(4.5)
    await go.leaveSing()
    const parkedPill = await go.pill('body')

    await go.karaoke()
    const inKaraoke = await go.pill(KARAOKE)
    await go.shot('handover-karaoke-cued')
    if (inKaraoke.pill !== null) {
      failures.push(
        `the "${inKaraoke.label}" pill is drawn over the Karaoke room at ${inKaraoke.pill.join(',')}${inKaraoke.covers.length > 0 ? `, over ${inKaraoke.covers.join(', ')}` : ''}`,
      )
    }
    const cued = await go.stage()
    const hit = await go.finger(`${STAGE} button[aria-label="Play"]`)
    await go.visible(`${STAGE} button[aria-label="Pause"]`).catch(async () => {
      throw new Error(
        `Play did not play: the tap landed on ${hit}, and the page is at ${JSON.stringify(await go.edge())}`,
      )
    })
    await page.waitForTimeout(2600)
    const playing = await go.stage()
    const edge = await go.edge()
    await go.shot('handover-karaoke-playing')
    if (!(playing.elapsed >= cued.elapsed + 1)) {
      failures.push(
        `the song did not play: ${cued.elapsed}s, then ${playing.elapsed}s`,
      )
    }
    if (edge.pill || edge.rail || edge.transport) {
      failures.push(
        `the song plays, but the bottom edge is not Karaoke's own: ${JSON.stringify(edge)}`,
      )
    }

    // Back to the take: paused, then ended on its own card.
    await go.leaveKaraoke()
    await go.rail('stage')
    await go.visible(SING)
    await go.settle(600)
    const room = await go.sing()
    const back = await go.edge()
    if (room?.state !== 'paused' || back.pill || !back.transport) {
      failures.push(
        `the Sing take did not come back paused under its own transport: ${JSON.stringify({ room, edge: back })}`,
      )
    } else {
      await page
        .locator('[data-testid="shell-transport"] [aria-label="Stop"]')
        .click()
      await go.visible('[data-testid="sing-take-sheet"]').catch(() => {
        failures.push('Stop on the returned take opened no card')
      })
    }
    line = `Sing sang and parked under the "${parkedPill.label}" pill; in Karaoke no pill, Play played (${cued.elapsed}s to ${playing.elapsed}s) with the rail aside and no shell transport; back in Sing the take was paused under its own transport, and Stop ended it on its card`
  } catch (error) {
    failures.push(error.message.split('\n')[0])
  } finally {
    await context.close()
  }
  if (failures.length > 0) throw new Error(failures.join('; '))
  return [line]
}

/**
 * A Sing run parked, then every tab the pill may sit on, and then the three
 * rooms that let go of it (the header, THE PILL ON EVERY TAB).
 */
async function pillEverywhere(browser, args, frame, kit) {
  const failures = []
  const clear = []
  let line = null
  const { context, page } = await openPage(browser, args, frame, kit, failures)
  const pushed = '[data-testid="shell-pushed"]'
  try {
    const go = verbs(page, args, frame, kit)
    /** Nothing under the pill here, where it opens and at its end. */
    const nothingUnder = async (where, scope, { end = false } = {}) => {
      const first = await go.over(scope)
      if (first.pill === null) {
        failures.push(`${where}: no pill, with a Sing run parked`)
        return
      }
      const covers = [...first.covers]
      if (end && (await go.toEnd(scope)) > 0) {
        await go.settle(300)
        const last = await go.over(scope)
        covers.push(...last.covers.map((c) => `${c} at its end`))
        await go.toTop()
      }
      if (covers.length > 0) {
        failures.push(
          `${where}: the "${first.label}" pill at ${first.pill.join(',')} is over ${covers.join(', ')}`,
        )
      } else clear.push(where)
    }
    const pop = async (under = null) => {
      await page.locator('[data-testid="shell-pushed-back"]').click()
      if (under === null) {
        await page
          .locator(pushed)
          .waitFor({ state: 'hidden', timeout: kit.stepTimeoutMs })
      } else await go.visible(under)
      await go.settle(300)
    }

    await go.rail('stage')
    await go.visible(SING)
    await go.startSinging(1)
    await go.leaveSing()
    const parkedPill = await go.pill('body')

    await nothingUnder('the alley', 'body')
    await kit.tapDoor(page, 'sing')
    await kit.waitPhase(page, 'alive', 'sing', 'a door picked, the pill up')
    await go.visible('[data-testid="alley-enter"]')
    await go.settle()
    await nothingUnder('the alley with a door picked', 'body')
    await page.evaluate(() => window.mpShellBack?.())
    await kit.waitPhase(page, 'rest', null, 'the door put back, the pill up')

    await go.rail('progress')
    await page.waitForFunction(
      () =>
        document.querySelector('section[aria-busy="true"]') === null &&
        [...document.querySelectorAll('h1')].some(
          (h) => (h.textContent ?? '').trim() === 'Progress',
        ),
      undefined,
      { timeout: kit.stepTimeoutMs },
    )
    await go.settle()
    await nothingUnder('Progress', 'body', { end: true })

    await go.more('settings')
    await go.visible('[data-testid="settings-screen"]')
    await go.settle()
    await nothingUnder('Settings', pushed, { end: true })
    for (const [row, screen, where] of [
      ['microphone', 'microphone-screen', 'Microphone'],
      ['storage', 'storage-screen', 'Storage'],
      ['this-phone', 'this-phone-screen', 'This phone'],
      ['appearance', 'appearance-screen', 'Appearance'],
      ['rooms-karaoke', 'karaoke-settings-screen', 'Karaoke settings'],
      ['about', 'about-screen', 'About'],
    ]) {
      await go.toTop()
      await page.locator(`[data-settings-row="${row}"]`).click()
      await go.visible(`[data-testid="${screen}"]`)
      await go.settle()
      await nothingUnder(where, pushed, { end: true })
      await pop('[data-testid="settings-screen"]')
    }
    await pop()
    await go.more('account')
    await go.visible('[data-testid="account-screen"]')
    await go.settle()
    await nothingUnder('Account', pushed, { end: true })
    await pop('[data-testid="settings-screen"]')
    await pop()
    await page.locator('[data-rail-item="more"]').click()
    await go.visible('[data-more-item="settings"]')
    await go.settle(300)
    if ((await page.locator('[data-more-item="developer"]').count()) > 0) {
      await page.locator('[data-more-item="developer"]').click()
      await go.visible('[data-testid="shell-developer"]')
      await go.settle()
      await nothingUnder('Developer', pushed, { end: true })
      await pop()
    } else {
      await page.keyboard.press('Escape')
      await page
        .locator('[data-more-item="settings"]')
        .waitFor({ state: 'hidden', timeout: kit.stepTimeoutMs })
    }

    // The rooms with runs of their own: the pill goes, and the take comes
    // back paused under its own transport each time.
    const letGo = []
    for (const [where, open, ready] of [
      ['the Ear Lab', () => go.rail('ear'), '[data-testid="ear-room-shell"]'],
      [
        'Piano',
        () => go.more('piano'),
        '[data-testid="piano-mobile-stage"]:visible, [data-testid="practice-view-toolbar"]:visible',
      ],
      [
        'Guitar',
        () => go.more('guitar'),
        '[data-testid="gp-song-status-bar"]:visible',
      ],
    ]) {
      await open()
      await go.visible(ready)
      await go.settle(800)
      const there = await go.over('body')
      await go.shot(
        `handover-pill-${where.replace(/^the /u, '').replaceAll(' ', '-').toLowerCase()}`,
      )
      if (there.pill !== null) {
        failures.push(
          `the "${there.label}" pill is drawn over ${where} at ${there.pill.join(',')}${there.covers.length > 0 ? `, over ${there.covers.join(', ')}` : ''}`,
        )
      }
      await go.toTop()
      await go.rail('stage')
      await go.visible(SING)
      await go.settle(600)
      const room = await go.sing()
      const back = await go.edge()
      if (room?.state !== 'paused' || back.pill || !back.transport) {
        failures.push(
          `after ${where}, the Sing take did not come back paused under its own transport: ${JSON.stringify({ room, edge: back })}`,
        )
        break
      }
      letGo.push(where)
      await go.leaveSing()
    }
    line = `Sing sang and parked under the "${parkedPill.label}" pill; it is over no control on ${clear.length} surfaces (${clear.join(', ')}); ${letGo.join(', ')} each let go of it, and Sing took the take back paused under its own transport every time`
  } catch (error) {
    failures.push(error.message.split('\n')[0])
  } finally {
    await context.close()
  }
  if (failures.length > 0) throw new Error(failures.join('; '))
  return [line]
}

/**
 * Every sequence on one frame. Each is walked even when an earlier one
 * fails, and the error names every problem found.
 */
export async function walkRoomHandover(browser, args, frame, kit) {
  const where = `${frame.width}x${frame.height}`
  const steps = []
  const problems = []
  for (const [name, walk] of [
    ['Karaoke, then Sing', karaokeThenSing],
    ['Sing, then Karaoke', singThenKaraoke],
    ['Sing parked, then every tab', pillEverywhere],
  ]) {
    try {
      steps.push(
        ...(await walk(browser, args, frame, kit)).map(
          (line) => `[${where}] rooms hand over, ${name}: ${line}`,
        ),
      )
    } catch (error) {
      problems.push(`${name}: ${error.message.split('\n')[0]}`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`[${where}] rooms hand over: ${problems.join(' | ')}`)
  }
  return steps
}
