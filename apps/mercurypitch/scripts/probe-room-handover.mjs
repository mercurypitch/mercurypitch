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
// Walked upright on each frame, and on each phone turned sideways with its
// notch and home-indicator insets (probe-landscape.mjs). Wired into
// probe-bundle.mjs, which owns the browser and passes its helpers in.

import { readStage } from './probe-karaoke.mjs'

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

async function openPage(browser, args, frame, kit, failures) {
  const { isolate, seed, bootTimeoutMs, stepTimeoutMs } = kit
  const sideways = frame.side !== undefined
  const viewport = { width: frame.width, height: frame.height }
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
  if (sideways) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', {
      insets: {
        top: 0,
        left: frame.side,
        right: frame.side,
        bottom: frame.bottom,
      },
    })
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
 * Both sequences on one frame. Both are walked even when the first fails,
 * and the error names every problem found.
 */
export async function walkRoomHandover(browser, args, frame, kit) {
  const where = `${frame.width}x${frame.height}`
  const steps = []
  const problems = []
  for (const [name, walk] of [
    ['Karaoke, then Sing', karaokeThenSing],
    ['Sing, then Karaoke', singThenKaraoke],
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
