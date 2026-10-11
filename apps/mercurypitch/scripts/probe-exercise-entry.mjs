// ============================================================
// The Sing screen's way in to the exercises, walked against the bundle
// ============================================================
//
// The Sing room's exercise row (the last exercise, and the door to all of
// them), the picker it opens, and the options' "All exercises" row. Five
// scenarios, each in a fresh page with its own storage:
//
//   A  Fresh, the microphone off on arrival: one "Exercises" pill; the
//      picker's card says Merc sings it first; a pick opens Long note on
//      its intro and records it; Back finds the pill reading "Long note".
//   B  Seeded (Long note opened before, A3 remembered, a 9.46 s best there,
//      the demo seen) with the microphone on arrival: a live free run with
//      the row over the transport reading "Long note · A3" over "Best
//      9.4 s"; four seconds of the fake A4, then a tap ends the run, keeps
//      its take and opens Long note on A3.
//   C  A melody run: no row, and no options row.
//   D  Karaoke played, then Sing (probe-room-handover.mjs): no session
//      pill over the room, and the row in its place.
//   E  On its side (probe-landscape.mjs's inset frames): no row at rest or
//      in a run, and the gear's "All exercises" opens the picker.
//
// Every reading of the row checks that each target is at least 44 x 44,
// that none lies over the capsule, the shell's transport, its corner chip
// or its rail, that a finger at the pill's centre lands on the pill, that
// the name is not cut short, and that nothing scrolls sideways.
//
// THE STAGE'S HEIGHT is printed for every frame: at rest on a first run, at
// rest with the microphone granted, and in a free run. `--baseline` prints
// only that, for a build without the row, so the two can be compared; at
// 360 x 640 it must stay at 160 px or more.
//
// Wired into probe-bundle.mjs (`--exercises-only`, and the full walk of a
// build that imports songs), which owns the browser and passes its helpers
// in. A build without the premium exercises gets one check: no row.

import { LANDSCAPE_INSET_FRAMES } from './probe-landscape.mjs'

const SING = '[data-testid="sing-room"]'
const ROW = '[data-testid="sing-exercise-row"]'
const PICKER = '[data-testid="sing-exercise-picker"]'
const LONG_NOTE = '[data-testid="long-note-room"]'

/**
 * Upright, at DPR 3, under each phone's own status bar and home indicator:
 * a small Android phone, the owner's iPhone 13 Pro and the largest iPhone.
 */
export const EXERCISE_FRAMES = [
  {
    width: 360,
    height: 640,
    insets: { top: 24, right: 0, bottom: 0, left: 0 },
  },
  {
    width: 390,
    height: 844,
    insets: { top: 47, right: 0, bottom: 34, left: 0 },
  },
  {
    width: 430,
    height: 932,
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
  },
]

/** On their sides, with the notch and home-indicator insets. */
export const EXERCISE_LANDSCAPE_FRAMES = LANDSCAPE_INSET_FRAMES

/** The stage's floor at the tightest frame (exercise-entry plan, section 8). */
const SMALLEST = { width: 360, height: 640, stageFloor: 160 }

/** The fresh state's Long note and Sing room settings, as storage holds them. */
const MIC_OFF_ON_ARRIVAL = { pitchperfect_sing_mic_on_arrival: 'false' }
const MIC_GRANTED = { pitchperfect_sing_mic_granted: 'true' }
const LONG_NOTE_BEFORE = {
  mp_last_exercise: 'long-note-lantern',
  pitchperfect_long_note_lantern_note: '57',
  pitchperfect_long_note_lantern_bests: JSON.stringify({
    57: { inBandSeconds: 9.46, steadiness: 80, at: 1 },
  }),
  mp_long_note_demo_seen: 'true',
}

const frameName = (frame) => `${frame.width}x${frame.height}`

/**
 * In the page: the row, everything it must stay clear of, and the stage.
 * Boxes are [left, top, width, height], rounded.
 */
const readEntry = () => {
  const q = (id) => document.querySelector(`[data-testid="${id}"]`)
  const shown = (el) =>
    el !== null &&
    el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
    el.getBoundingClientRect().width > 0
  const box = (el) => {
    const r = el.getBoundingClientRect()
    return [r.left, r.top, r.width, r.height].map((n) => Math.round(n))
  }
  const overlap = (a, b) =>
    a.left < b.right - 0.5 &&
    a.right > b.left + 0.5 &&
    a.top < b.bottom - 0.5 &&
    a.bottom > b.top + 0.5
  const row = q('sing-exercise-row')
  const targets = [
    'sing-exercise-pill',
    'sing-exercise-door',
    'sing-exercise-browse',
  ]
    .map((id) => [id, q(id)])
    .filter(([, el]) => shown(el))
  const others = ['sing-capsule', 'shell-transport', 'shell-chip', 'shell-rail']
    .map((id) => [id, q(id)])
    .filter(([, el]) => shown(el))
  const covers = []
  for (const [id, el] of targets) {
    for (const [other, near] of others) {
      if (overlap(el.getBoundingClientRect(), near.getBoundingClientRect())) {
        covers.push(`${id} over ${other}`)
      }
    }
  }
  const lead = targets[0]?.[1] ?? null
  let hit = null
  if (lead !== null) {
    const r = lead.getBoundingClientRect()
    const at = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    )
    hit = lead.contains(at)
      ? 'the pill'
      : (at?.closest('[data-testid]')?.getAttribute('data-testid') ??
        at?.tagName ??
        null)
  }
  // The name is the title's first span; " · A3" is its second.
  const name = q('sing-exercise-title')?.firstElementChild ?? null
  const transport = q('shell-transport')
  const stage = q('sing-stage')
  return {
    row: shown(row) ? box(row) : null,
    targets: targets.map(([id, el]) => [id, box(el)]),
    covers,
    hit,
    title: q('sing-exercise-title')?.textContent ?? null,
    best: q('sing-exercise-best')?.textContent ?? null,
    browse: shown(q('sing-exercise-browse')),
    cut: name !== null && name.scrollWidth > name.clientWidth + 0.5,
    aboveTransport:
      shown(transport) && shown(row)
        ? row.getBoundingClientRect().bottom <=
          transport.getBoundingClientRect().top + 0.5
        : null,
    overflow:
      document.scrollingElement.scrollWidth > window.innerWidth ||
      (shown(row) &&
        row.getBoundingClientRect().right > window.innerWidth + 0.5),
    stage:
      stage === null ? null : Math.round(stage.getBoundingClientRect().height),
  }
}

/** What a reading of the row says is wrong with it, if anything. */
function rowProblems(read, where) {
  const problems = []
  for (const [id, [, , w, h]] of read.targets) {
    if (w < 44 || h < 44)
      problems.push(`${where}: ${id} is ${w} x ${h}, under 44 x 44`)
  }
  if (read.covers.length > 0)
    problems.push(`${where}: ${read.covers.join(', ')}`)
  if (read.hit !== 'the pill') {
    problems.push(
      `${where}: a finger at the pill's centre lands on ${read.hit}`,
    )
  }
  if (read.cut) problems.push(`${where}: the exercise's name is cut short`)
  if (read.overflow) problems.push(`${where}: the page scrolls sideways`)
  return problems
}

async function openPage(browser, args, frame, kit, failures, storage) {
  const { isolate, seed, bootTimeoutMs, stepTimeoutMs } = kit
  const sideways = frame.side !== undefined
  const insets = sideways
    ? { top: 0, left: frame.side, right: frame.side, bottom: frame.bottom }
    : frame.insets
  const context = await isolate(
    await browser.newContext({
      viewport: { width: frame.width, height: frame.height },
      deviceScaleFactor: 3,
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
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets })
  await page.addInitScript(seed, args.theme)
  await page.addInitScript((items) => {
    try {
      for (const [key, value] of Object.entries(items)) {
        localStorage.setItem(key, value)
      }
    } catch {
      /* storage blocked: the case that needed it fails and says so */
    }
  }, storage)
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

/** The walk's verbs, over one page. */
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
  const sing = () => page.evaluate(() => window.mpSingRoom?.() ?? null)
  const until = (fn, arg, what) =>
    page.waitForFunction(fn, arg, { timeout: runTimeoutMs }).catch(async () => {
      throw new Error(`${what}; the room says ${JSON.stringify(await sing())}`)
    })
  return {
    visible,
    settle,
    sing,
    shot: (name) => shoot(page, ctx, name),
    read: () => page.evaluate(readEntry),
    /** A finger on the element's centre: whatever is on top takes the tap. */
    finger: async (selector) => {
      const box = await page.locator(selector).first().boundingBox()
      if (box === null) throw new Error(`${selector} is not on screen`)
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    },
    /** To the Sing room by the rail, as a finger gets there. */
    toSing: async () => {
      await page.locator('[data-rail-item="stage"]').click()
      await visible(SING)
      await settle(800)
    },
    /** The run the capsule starts on a first visit: the door, Continue. */
    startFirstRun: async () => {
      await page.locator('[data-testid="sing-capsule"]').tap()
      await visible('[data-testid="sing-priming"]')
      await page.locator('[data-testid="sing-priming-continue"]').click()
      await until(
        () => window.mpSingRoom?.().state === 'live',
        undefined,
        'the free run never went live',
      )
    },
    /** A live free run drawing its trace, `seconds` into its take. */
    runFor: (seconds) =>
      until(
        (at) =>
          window.mpSingRoom?.().state === 'live' &&
          (window.mpSingRoom?.().trail ?? 0) > 60 &&
          (window.mpSingRoom?.().elapsedSeconds ?? 0) >= at,
        seconds,
        `the free run never reached ${seconds} s`,
      ),
    /** A melody from the gear's song row: the run it starts is a melody run. */
    startMelodyRun: async () => {
      await page.locator('[data-testid="shell-room-gear"]').click()
      await page.locator('[data-testid="sing-options-song"]').click()
      await visible('.fn-modal-item')
      await page.locator('.fn-modal-item').first().click()
      await until(
        () => window.mpSingRoom?.().melodyRun === true,
        undefined,
        'the melody run never started',
      )
    },
    takes: () =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('pitchperfect_sing_takes') ?? '[]')
            .length,
      ),
    stored: (key) => page.evaluate((k) => localStorage.getItem(k), key),
  }
}

/** One scenario in its own page; its problems are returned, not thrown. */
async function scenario(browser, args, frame, kit, storage, walk) {
  const failures = []
  let line = null
  const { context, page } = await openPage(
    browser,
    args,
    frame,
    kit,
    failures,
    storage,
  )
  try {
    line = await walk(verbs(page, args, frame, kit), page, failures)
  } catch (error) {
    failures.push(error.message.split('\n')[0])
  } finally {
    await context.close()
  }
  return { line, failures }
}

/** A: fresh. The lone pill, the picker, Long note, and back. */
async function fresh(go, page, failures) {
  await go.toSing()
  await go.visible('[data-testid="sing-exercise-browse"]')
  const rest = await go.read()
  failures.push(...rowProblems(rest, 'A at rest'))
  await go.shot('exercise-a-rest')

  await go.finger('[data-testid="sing-exercise-browse"]')
  await go.visible(PICKER)
  await go.settle(500)
  const meta = await page
    .locator('[data-testid="sing-exercise-meta"]')
    .first()
    .textContent()
    .catch(() => null)
  if (meta?.trim() !== 'Merc sings it first') {
    failures.push(
      `A: the card's third line reads "${meta}", not "Merc sings it first"`,
    )
  }
  await go.shot('exercise-a-picker')

  await go.finger('[data-testid="sing-exercise-card"]')
  await go.visible(LONG_NOTE)
  await go.settle(600)
  const phase = await page.locator(LONG_NOTE).getAttribute('data-phase')
  const record = await go.stored('mp_last_exercise')
  if (phase !== 'intro')
    failures.push(`A: Long note opened at "${phase}", not its intro`)
  if (record !== 'long-note-lantern') {
    failures.push(`A: mp_last_exercise holds ${JSON.stringify(record)}`)
  }
  await go.shot('exercise-a-long-note')

  await page.locator('[data-testid="shell-pushed-back"]').click()
  await go.visible('[data-testid="sing-exercise-pill"]')
  await go.settle(500)
  const back = await go.read()
  if (back.title !== 'Long note')
    failures.push(`A: back in Sing the pill reads "${back.title}"`)
  failures.push(...rowProblems(back, 'A back'))
  await go.shot('exercise-a-back')
  return `A: "Exercises" at rest (stage ${rest.stage} px), the card says Merc sings it first, Long note opens at ${phase} and records ${record}, back in Sing the pill reads "${back.title}"`
}

/** B: seeded, the mic on arrival. The row in a free run, then a tap. */
async function seeded(go, page, failures) {
  await go.toSing()
  await go.runFor(0)
  await go.visible('[data-testid="sing-exercise-pill"]')
  const live = await go.read()
  failures.push(...rowProblems(live, 'B in a run'))
  if (live.title !== 'Long note · A3' || live.best !== 'Best 9.4 s') {
    failures.push(`B: the pill reads "${live.title}" over "${live.best}"`)
  }
  if (live.aboveTransport !== true) {
    failures.push(
      `B: the row is not above the transport (${JSON.stringify(live.row)})`,
    )
  }
  await go.shot('exercise-b-live')

  await go.runFor(4)
  const before = await go.takes()
  await go.finger('[data-testid="sing-exercise-pill"]')
  await go.visible(LONG_NOTE)
  await go.visible('[data-testid="long-note-note"]')
  await go.settle(600)
  const after = await go.takes()
  const note = (
    await page.locator('[data-testid="long-note-note"]').textContent()
  )?.trim()
  if (after !== before + 1)
    failures.push(`B: the kept takes went ${before} to ${after}`)
  if (note !== 'A3') failures.push(`B: Long note opened on "${note}", not A3`)
  await go.shot('exercise-b-long-note')
  return `B: in a free run the row reads "${live.title}" over "${live.best}" above the transport (stage ${live.stage} px); a tap 4 s in kept the take (${before} to ${after}) and opened Long note on ${note}`
}

/** C: a melody run draws no row, and its options no row either. */
async function melody(go, page, failures) {
  await go.toSing()
  await go.visible(ROW)
  await go.startMelodyRun()
  await go.settle(600)
  const read = await go.read()
  if (read.row !== null)
    failures.push(`C: a row over the melody run at ${read.row.join(',')}`)
  await go.shot('exercise-c-melody')
  await page.locator('[data-testid="shell-room-gear"]').click()
  await go.visible('[data-testid="sing-options-song"]')
  const offered = await page
    .locator('[data-testid="sing-options-exercises"]')
    .count()
  if (offered > 0)
    failures.push('C: the options offer the exercises over a melody run')
  return 'C: a melody run draws no row and its options no exercises row'
}

/** D: Karaoke played and parked, then Sing: no pill, and the row. */
async function handover(go, page, failures) {
  await page.locator('[data-rail-item="more"]').click()
  await go.visible('[data-more-item="karaoke"]')
  await go.settle(300)
  await page.locator('[data-more-item="karaoke"]').click()
  const play = page.locator(
    '[data-testid="karaoke-mobile-stage"] button[aria-label="Play"]:not([disabled])',
  )
  await play.waitFor({ state: 'visible', timeout: 20_000 })
  await go.settle(600)
  await play.tap()
  await go.visible(
    '[data-testid="karaoke-mobile-stage"] button[aria-label="Pause"]',
  )
  await page.waitForTimeout(2000)
  await page.locator('[data-testid="shell-room-back"]').click()
  await go.visible('[data-testid="shell-session-pill"]')
  await go.toSing()
  await go.visible(ROW)
  const read = await go.read()
  const pills = await page.locator('[data-testid="shell-session-pill"]').count()
  if (pills > 0)
    failures.push('D: the Karaoke pill is drawn over the Sing room')
  failures.push(...rowProblems(read, 'D'))
  await go.shot('exercise-d-handover')
  return 'D: Karaoke parked, then Sing: no session pill, the row in its place'
}

/** E: on its side. No row at rest or in a run; the gear's row opens the picker. */
async function sideways(go, page, failures) {
  await go.toSing()
  await go.settle(400)
  const rest = await go.read()
  if (rest.row !== null)
    failures.push(`E: a row at rest at ${rest.row.join(',')}`)
  await go.shot('exercise-e-rest')

  await go.startFirstRun()
  await go.runFor(1)
  const live = await go.read()
  if (live.row !== null)
    failures.push(`E: a row in a run at ${live.row.join(',')}`)
  await go.shot('exercise-e-live')

  await page.locator('[data-testid="shell-room-gear"]').click()
  const row = page.locator('[data-testid="sing-options-exercises"]')
  await row.scrollIntoViewIfNeeded()
  await go.visible('[data-testid="sing-options-exercises"]')
  await row.click()
  await go.visible(PICKER)
  await go.settle(500)
  await go.shot('exercise-e-picker')
  return `E: no row at rest or in a run (stage ${rest.stage} px, ${live.stage} px); the gear's "All exercises" opens the picker`
}

/**
 * The stage's height, three ways: at rest on a first visit, in that first
 * free run, and at rest with the microphone granted. Asks nothing of the
 * row, so a build without it answers too.
 */
async function measureStage(browser, args, frame, kit) {
  const first = await scenario(
    browser,
    args,
    frame,
    kit,
    MIC_OFF_ON_ARRIVAL,
    async (go) => {
      await go.toSing()
      const rest = await go.read()
      await go.startFirstRun()
      await go.runFor(1)
      const live = await go.read()
      return [rest.stage, live.stage]
    },
  )
  const granted = await scenario(
    browser,
    args,
    frame,
    kit,
    { ...MIC_OFF_ON_ARRIVAL, ...MIC_GRANTED },
    async (go) => {
      await go.toSing()
      return (await go.read()).stage
    },
  )
  const failures = [...first.failures, ...granted.failures]
  const [rest, live] = first.line ?? [null, null]
  const tight =
    frame.width === SMALLEST.width && frame.height === SMALLEST.height
  for (const [what, height] of [
    ['at rest on a first visit', rest],
    ['in a free run', live],
    ['at rest with the mic granted', granted.line],
  ]) {
    if (tight && height !== null && height < SMALLEST.stageFloor) {
      failures.push(
        `the stage is ${height} px ${what}, under ${SMALLEST.stageFloor}`,
      )
    }
  }
  return {
    line: `stage height: first visit ${rest} px, free run ${live} px, granted at rest ${granted.line} px`,
    failures,
  }
}

/** Every scenario for one frame, upright or on its side. */
export async function walkExerciseEntry(browser, args, frame, kit) {
  const where = `[${frameName(frame)}${frame.side === undefined ? '' : ' sideways'}] exercises`
  const steps = []
  const failures = []
  const take = ({ line, failures: found }) => {
    if (line !== null) steps.push(`${where}: ${line}`)
    failures.push(...found.map((f) => `${where}: ${f}`))
  }

  take(await measureStage(browser, args, frame, kit))
  if (args.baseline) return finish(steps, failures)

  if (!kit.importing) {
    take(
      await scenario(
        browser,
        args,
        frame,
        kit,
        MIC_OFF_ON_ARRIVAL,
        async (go, page, found) => {
          await go.toSing()
          if ((await page.locator(ROW).count()) > 0)
            found.push('a row in a build without the exercises')
          return 'no row: this build has no premium exercises'
        },
      ),
    )
    return finish(steps, failures)
  }

  const cases =
    frame.side === undefined
      ? [
          [MIC_OFF_ON_ARRIVAL, fresh],
          [{ ...LONG_NOTE_BEFORE, ...MIC_GRANTED }, seeded],
          [{ ...MIC_OFF_ON_ARRIVAL, ...MIC_GRANTED }, melody],
          [MIC_OFF_ON_ARRIVAL, handover],
        ]
      : [[MIC_OFF_ON_ARRIVAL, sideways]]
  for (const [storage, walk] of cases) {
    take(await scenario(browser, args, frame, kit, storage, walk))
  }
  return finish(steps, failures)
}

function finish(steps, failures) {
  if (failures.length > 0) throw new Error(failures.join('; '))
  return steps
}
