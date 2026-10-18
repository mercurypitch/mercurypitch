// ============================================================
// The native onboarding, walked against the built bundle
// ============================================================
//
// A new install (no onboarding flag, no welcome) opens the alley's Sing
// door, and the onboarding comes up over the Sing room: the rail out of the
// way, the room held under it, Merc's hello, the labelled example line and
// the mic. The probe's fake voice (its tone file) sings one note; the note
// is named, and Start singing lands in the Sing room, live, with the flag
// done. Then, each on an install of its own: Not now, Back, and a refused
// microphone. Every visible part is measured on each frame: inside the
// screen, apart from one another, and every control at least 44 px.
//
// Only on a build with the onboarding (NATIVE_ONBOARDING, the import
// switch: `kit.importing`); probe-bundle.mjs decides, owns the browser and
// passes its helpers in. Every other walk starts past the onboarding (its
// seed sets the flag done); this one takes the flag away again.

const LAYER = '[data-testid="native-onboarding"]'
const NOT_NOW = '[data-testid="onboarding-not-now"]'
const LINE = '[data-testid="onboarding-line"]'
const MIC = '[data-testid="onboarding-mic"]'
const NOTE = '[data-testid="onboarding-note"]'
const START = '[data-testid="onboarding-start-singing"]'
const FLAG = 'mp:native-onboarding'

/** A phone, an iPad upright and an iPad on its side. */
export const ONBOARDING_FRAMES = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
]

/** The note names the tone file can be heard as (writeToneWav). */
const TONE_NOTES = ['A4', 'C5', 'E5']

/** Runs after the probe's seed: a new install, once per page load. */
function fresh(flag) {
  try {
    localStorage.removeItem(flag)
    localStorage.removeItem('pitchperfect_native_welcome_seen')
    localStorage.removeItem('pitchperfect_sing_mic_granted')
  } catch {
    /* storage blocked: the walk fails on the flag and says so */
  }
}

/** A microphone that is refused, as the denied walk in probe-bundle.mjs. */
function refuseMic() {
  if (navigator.mediaDevices === undefined) return
  navigator.mediaDevices.getUserMedia = () => {
    const error = new Error('Permission denied')
    error.name = 'NotAllowedError'
    return Promise.reject(error)
  }
}

async function boot(browser, args, frame, kit, { refuse = false } = {}) {
  const context = await kit.isolate(
    await browser.newContext({
      viewport: frame,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: args.theme,
      permissions: refuse ? [] : ['microphone'],
    }),
  )
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
  await page.addInitScript(kit.seed, args.theme)
  await page.addInitScript(fresh, FLAG)
  if (refuse) await page.addInitScript(refuseMic)
  await page.goto(args.baseUrl, { waitUntil: 'domcontentloaded' })
  await page
    .locator('#root.loaded')
    .waitFor({ state: 'attached', timeout: kit.bootTimeoutMs })
  await page
    .locator('[data-testid="rooms-alley"]')
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
  return { context, page, errors }
}

const flagNow = (page) =>
  page.evaluate((key) => localStorage.getItem(key), FLAG)

/** Up, over the Sing room: what is on screen and what is held under it. */
async function expectUp(page, kit, how) {
  await page
    .locator(LAYER)
    .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error(`${how}: the onboarding did not come up`)
    })
  const flag = await flagNow(page)
  if (flag !== 'due') throw new Error(`${how}: the flag is ${flag}, not due`)
  const under = await page.evaluate(() => ({
    room: document.querySelector('[data-testid="sing-room"]') !== null,
    state:
      typeof window.mpSingRoom === 'function'
        ? window.mpSingRoom().state
        : null,
    rail:
      document
        .querySelector('[data-testid="shell-rail-layer"]')
        ?.classList.contains('is-in') ?? null,
    priming: document.querySelector('[data-testid="sing-priming"]') !== null,
  }))
  if (!under.room || under.state !== 'resting' || under.priming) {
    throw new Error(
      `${how}: the Sing room is not held ${JSON.stringify(under)}`,
    )
  }
  if (under.rail !== false) {
    throw new Error(`${how}: the rail did not step aside (${under.rail})`)
  }
  return under
}

/**
 * In the page: every visible part of the layer, its box, and what is wrong
 * with the layout: outside the screen, a control under 44 px, or two parts
 * on top of one another.
 */
const readLayout = () => {
  const box = (selector) => {
    const element = document.querySelector(selector)
    if (element === null) return null
    const r = element.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return null
    return {
      left: Math.round(r.left),
      top: Math.round(r.top),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
      height: Math.round(r.height),
    }
  }
  const parts = {
    notNow: box('[data-testid="onboarding-not-now"]'),
    line: box('[data-testid="onboarding-line"]'),
    merc: box('[data-testid="onboarding-merc"]'),
    lane: box('[data-testid="onboarding-lane"]'),
    mic: box('[data-testid="onboarding-mic"]'),
    start: box('[data-testid="onboarding-start-singing"]'),
    retry: box('[data-testid="onboarding-retry"]'),
  }
  const problems = []
  const w = window.innerWidth
  const h = window.innerHeight
  for (const [name, b] of Object.entries(parts)) {
    if (b === null) continue
    if (b.left < 0 || b.top < 0 || b.right > w || b.bottom > h) {
      problems.push(`${name} is off the screen ${JSON.stringify(b)}`)
    }
  }
  for (const name of ['notNow', 'mic', 'start', 'retry']) {
    const b = parts[name]
    if (b !== null && (b.width < 44 || b.height < 44)) {
      problems.push(`${name} is ${b.width}x${b.height}, under 44 px`)
    }
  }
  const apart = (a, b) =>
    a === null ||
    b === null ||
    a.right <= b.left ||
    b.right <= a.left ||
    a.bottom <= b.top ||
    b.bottom <= a.top
  for (const [a, b] of [
    ['notNow', 'line'],
    ['line', 'lane'],
    ['lane', 'mic'],
    ['lane', 'start'],
    ['merc', 'mic'],
  ]) {
    if (!apart(parts[a], parts[b])) problems.push(`${a} overlaps ${b}`)
  }
  if (document.documentElement.scrollWidth > w) {
    problems.push(
      `the page scrolls sideways (${document.documentElement.scrollWidth} > ${w})`,
    )
  }
  return { parts, problems }
}

async function expectLayout(page, how) {
  const layout = await page.evaluate(readLayout)
  if (layout.problems.length > 0) {
    throw new Error(`${how}: ${layout.problems.join('; ')}`)
  }
  return layout.parts
}

/**
 * Gone, the flag done, and the shell's band back: the rail over a resting
 * room, or the run's transport over a room that arrived live.
 */
async function expectGone(page, kit, how, band = 'rail') {
  await page
    .waitForFunction(
      (selector) => document.querySelector(selector) === null,
      LAYER,
      { timeout: kit.stepTimeoutMs },
    )
    .catch(() => {
      throw new Error(`${how}: the onboarding is still up`)
    })
  const flag = await flagNow(page)
  if (flag !== 'done') throw new Error(`${how}: the flag is ${flag}, not done`)
  await page
    .locator(`[data-testid="shell-${band}-layer"].is-in`)
    .waitFor({ state: 'attached', timeout: kit.stepTimeoutMs })
    .catch(() => {
      throw new Error(`${how}: the ${band} is not back`)
    })
}

/** The Sing door, the onboarding, one note named, and Start singing. */
async function walkNote(browser, args, frame, kit) {
  const { context, page, errors } = await boot(browser, args, frame, kit)
  try {
    await kit.tapDoor(page, 'sing')
    await kit.waitPhase(page, 'alive', 'sing', 'onboarding: the Sing door')
    await page.locator('[data-testid="alley-enter"]').tap()
    await expectUp(page, kit, 'the Sing door')
    const first = await page.locator(LINE).textContent()
    if (first !== "Hi, I'm Merc." && first !== 'Sing me one note, any note.') {
      throw new Error(`hello: Merc says "${first}"`)
    }
    await page
      .locator('[data-testid="onboarding-example"]')
      .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    await page.waitForFunction(
      (selector) =>
        document.querySelector(selector)?.textContent ===
        'Sing me one note, any note.',
      LINE,
      { timeout: kit.stepTimeoutMs },
    )
    const hello = await expectLayout(page, 'hello')
    const right = frame.width - hello.notNow.right
    if (right > 24 || hello.notNow.top > 80) {
      throw new Error(
        `hello: Not now is not top right ${JSON.stringify(hello.notNow)}`,
      )
    }
    const granted = await page.evaluate(() =>
      localStorage.getItem('pitchperfect_sing_mic_granted'),
    )
    if (granted === 'true') throw new Error('hello: a mic grant before the tap')

    // ── One note ──────────────────────────────────────────────
    // The pitch stream reads once a screen frame, and a headless page this
    // size draws few of them, so a take can come up short and Merc asks for
    // a tap, as he would on a phone. Up to three taps, and the step says
    // how many it took.
    let tries = 0
    let named = false
    while (!named && tries < 3) {
      tries += 1
      await page.locator(MIC).tap()
      await page
        .waitForFunction(
          (selector) =>
            document.querySelector(selector)?.getAttribute('data-state') ===
            'sing',
          MIC,
          { timeout: kit.stepTimeoutMs },
        )
        .catch(() => {
          throw new Error(`listen: the mic never opened (tap ${tries})`)
        })
      if (tries === 1) await expectLayout(page, 'listen')
      await page
        .waitForFunction(
          ([note, mic]) =>
            document.querySelector(note) !== null ||
            document.querySelector(mic)?.getAttribute('data-state') === 'ready',
          [NOTE, MIC],
          { timeout: kit.runTimeoutMs },
        )
        .catch(() => undefined)
      named = (await page.locator(NOTE).count()) > 0
    }
    if (!named) {
      const line = await page.locator(LINE).textContent()
      const take = await page.evaluate(() => window.mpOnboarding?.())
      throw new Error(
        `listen: no note was named in ${tries} taps (Merc: "${line}", the take: ${JSON.stringify(take)})`,
      )
    }
    const note = (await page.locator(NOTE).textContent())?.trim() ?? ''
    if (!TONE_NOTES.includes(note)) {
      throw new Error(`heard: "${note}" is not a note the voice sang`)
    }
    const said = await page.locator(LINE).textContent()
    const article = note.startsWith('A') || note.startsWith('E') ? 'an' : 'a'
    if (said !== `That's ${article} ${note}.`) {
      throw new Error(`heard: Merc says "${said}"`)
    }
    const heard = await expectLayout(page, 'heard')
    if (heard.start === null || heard.mic !== null) {
      throw new Error(`heard: ${JSON.stringify(heard)}`)
    }
    const grant = await page.evaluate(() =>
      localStorage.getItem('pitchperfect_sing_mic_granted'),
    )
    if (grant !== 'true') throw new Error(`heard: the grant is ${grant}`)

    // ── Start singing: the Sing room, live, with no priming screen ──
    await page.locator(START).tap()
    await page
      .waitForFunction(
        () =>
          typeof window.mpSingRoom === 'function' &&
          window.mpSingRoom().state === 'live',
        null,
        { timeout: kit.stepTimeoutMs },
      )
      .catch(async () => {
        const room = await page.evaluate(() => window.mpSingRoom?.())
        throw new Error(`Start singing: the room is ${JSON.stringify(room)}`)
      })
    await expectGone(page, kit, 'Start singing', 'transport')

    // ── Never again on this install ───────────────────────────
    // The run is live, so the corner chip's column is the way to Rooms: it
    // parks the run, and the rail's Sing comes back to it.
    await page.locator('[data-testid="shell-chip"]').click()
    await page.locator('[data-column-item="rooms"]').click()
    await page
      .locator('[data-testid="rooms-alley"]')
      .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    await page.locator('[data-rail-item="stage"]').click()
    await page
      .locator('[data-testid="sing-room"]')
      .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
    await page.waitForTimeout(500)
    if ((await page.locator(LAYER).count()) !== 0) {
      throw new Error('again: the onboarding opened a second time')
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return [
      `the Sing door: up over the held room, rail aside; hello and the example; ${note} named ("${said}", tap ${tries}); Start singing: the room live under the transport, flag done; parked and back, not again`,
    ]
  } finally {
    await context.close()
  }
}

/** The rail's Sing, then Not now: no grant, the room resting. */
async function walkNotNow(browser, args, frame, kit) {
  const { context, page, errors } = await boot(browser, args, frame, kit)
  try {
    await page.locator('[data-rail-item="stage"]').click()
    await expectUp(page, kit, "the rail's Sing")
    await expectLayout(page, 'Not now')
    await page.locator(NOT_NOW).tap()
    await expectGone(page, kit, 'Not now')
    const room = await page.evaluate(() => window.mpSingRoom?.())
    if (room?.state !== 'resting') {
      throw new Error(`Not now: the room is ${JSON.stringify(room)}`)
    }
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return ["the rail's Sing, then Not now: gone, flag done, the room resting"]
  } finally {
    await context.close()
  }
}

/** Back is Not now. */
async function walkBack(browser, args, frame, kit) {
  const { context, page, errors } = await boot(browser, args, frame, kit)
  try {
    await page.locator('[data-rail-item="stage"]').click()
    await expectUp(page, kit, 'Back')
    const outcome = await page.evaluate(() => window.mpShellBack())
    if (outcome !== 'onboarding') {
      throw new Error(`Back answered '${outcome}'`)
    }
    await expectGone(page, kit, 'Back')
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return ["Back answers 'onboarding': gone, flag done"]
  } finally {
    await context.close()
  }
}

/** A refused microphone: why, Try again, and Not now still the way on. */
async function walkRefused(browser, args, frame, kit) {
  const { context, page, errors } = await boot(browser, args, frame, kit, {
    refuse: true,
  })
  try {
    await page.locator('[data-rail-item="stage"]').click()
    await expectUp(page, kit, 'refused')
    await page.locator(MIC).tap()
    await page
      .locator('[data-testid="onboarding-retry"]')
      .waitFor({ state: 'visible', timeout: kit.stepTimeoutMs })
      .catch(() => {
        throw new Error('refused: no Try again')
      })
    const notice = await page.locator('[role="alert"]').first().textContent()
    if (!notice?.includes('Merc needs the microphone')) {
      throw new Error(`refused: the notice reads "${notice}"`)
    }
    await expectLayout(page, 'refused')
    const grant = await page.evaluate(() =>
      localStorage.getItem('pitchperfect_sing_mic_granted'),
    )
    if (grant === 'true') throw new Error('refused: a grant was remembered')
    await page.locator(NOT_NOW).tap()
    await expectGone(page, kit, 'refused, Not now')
    if (errors.length > 0) throw new Error(`page error: ${errors.join(' | ')}`)
    return ['a refused mic: the notice and Try again; Not now: gone, flag done']
  } finally {
    await context.close()
  }
}

export async function walkOnboarding(browser, args, frame, kit) {
  const where = `${frame.width}x${frame.height}`
  const steps = []
  const problems = []
  for (const [name, walk] of [
    ['one note', walkNote],
    ['Not now', walkNotNow],
    ['Back', walkBack],
    ['refused', walkRefused],
  ]) {
    try {
      steps.push(
        ...(await walk(browser, args, frame, kit)).map(
          (line) => `[${where}] onboarding, ${name}: ${line}`,
        ),
      )
    } catch (error) {
      problems.push(`${name}: ${error.message.split('\n')[0]}`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`[${where}] onboarding: ${problems.join(' | ')}`)
  }
  return steps
}
